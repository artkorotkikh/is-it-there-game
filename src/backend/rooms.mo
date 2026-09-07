import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Principal "mo:core/Principal";

// Separate from records: bounded rendezvous and aggregate co-op milestones; no profile changes.
persistent actor {
  type Room = { host : Principal; var guest : ?Principal; mapKey : Text; offer : Text; var answer : ?Text; expires : Int };
  public type View = { mapKey : Text; offer : Text; answer : ?Text; joined : Bool; sessionId : ?Nat };
  public type Result = { #ok : View; #err : Text };
  let rooms = Map.empty<Text, Room>();
  // Keep the original Room layout intact for upgrades from 0.7.0.
  type Session = { host : Principal; var guest : ?Principal; expires : Int; var hostConnected : Bool; var guestConnected : Bool; var hostStarted : Bool; var guestStarted : Bool; var connectedCounted : Bool; var startedCounted : Bool };
  let sessionRefs = Map.empty<Text, Nat>();
  let sessions = Map.empty<Nat, Session>();
  var nextSession : Nat = 0;
  let collectionSince : Int = Time.now();
  var created : Nat = 0; var joined : Nat = 0; var connected : Nat = 0; var started : Nat = 0;
  var evicted : Nat = 0;
  transient let reportingWindow = 21_600_000_000_000; // Six hours; independent of invite TTL.
  public type Milestone = { #connected; #started };
  public type Statistics = { since : Int; roomsCreated : Nat; guestsJoined : Nat; pairsConnected : Nat; expeditionsStarted : Nat; sessionsEvicted : Nat };
  public type ReportResult = { #ok; #err : Text };
  public type StatisticsReader = { reader : Principal; grantedBy : Principal };
  var statisticsReaders : [StatisticsReader] = [];
  func removeRoom(code : Text) { Map.remove(rooms,Text.compare,code); Map.remove(sessionRefs,Text.compare,code) };
  func pruneSessions() {
    for ((id,s) in Map.entries(sessions)) { if(s.expires < Time.now()) Map.remove(sessions,Nat.compare,id) };
  };
  func newSession(code : Text, host : Principal) {
    pruneSessions();
    if(Map.size(sessions) >= 5_000) {
      // IDs increase monotonically; evict the oldest report window, never block play.
      switch(Map.entries(sessions).next()) { case(?(id,_)) { Map.remove(sessions,Nat.compare,id); evicted += 1 }; case null {} };
    };
    nextSession += 1;
    Map.add(sessions,Nat.compare,nextSession,{host;var guest=(null : ?Principal);expires=Time.now()+reportingWindow;var hostConnected=false;var guestConnected=false;var hostStarted=false;var guestStarted=false;var connectedCounted=false;var startedCounted=false});
    Map.add(sessionRefs,Text.compare,code,nextSession); created += 1;
  };
  public shared({caller}) func report(id : Nat, event : Milestone) : async ReportResult {
    pruneSessions();
    let ?s = Map.get(sessions,Nat.compare,id) else return #err("Reporting window expired.");
    if(Principal.isAnonymous(caller) or (caller != s.host and s.guest != ?caller)) return #err("Only session members may report.");
    switch(event) {
      case(#connected) { if(caller == s.host) s.hostConnected := true else s.guestConnected := true };
      case(#started) { if(caller == s.host) s.hostStarted := true else s.guestStarted := true };
    };
    if(s.hostConnected and s.guestConnected and not s.connectedCounted) { s.connectedCounted := true; connected += 1 };
    if(s.connectedCounted and s.hostStarted and s.guestStarted and not s.startedCounted) { s.startedCounted := true; started += 1 };
    #ok
  };
  public shared({caller}) func setStatisticsReader(reader : Principal, enabled : Bool) : async ReportResult {
    if(not Principal.isController(caller)) return #err("Only controllers can grant statistics access.");
    if(Principal.isAnonymous(reader)) return #err("Choose a signed account.");
    let remaining = Array.filter<StatisticsReader>(statisticsReaders,func(r) {r.reader != reader and Principal.isController(r.grantedBy)});
    if(enabled and remaining.size() >= 8) return #err("At most eight statistics readers are allowed.");
    statisticsReaders := if(enabled) Array.concat(remaining,[{reader;grantedBy=caller}]) else remaining;
    #ok
  };
  public shared query({caller}) func listStatisticsReaders() : async {#ok : [StatisticsReader]; #err : Text} {
    if(not Principal.isController(caller)) return #err("Only controllers can list readers.");
    #ok(Array.filter<StatisticsReader>(statisticsReaders,func(r) {Principal.isController(r.grantedBy)}))
  };
  public shared query({caller}) func adminStatistics() : async {#ok : Statistics; #err : Text} {
    if(not Principal.isController(caller)) {
      let allowed = Array.find<StatisticsReader>(statisticsReaders,func(r) {r.reader == caller and Principal.isController(r.grantedBy)});
      if(allowed == null) return #err("This account has no co-op statistics access.");
    };
    #ok({since=collectionSince;roomsCreated=created;guestsJoined=joined;pairsConnected=connected;expeditionsStarted=started;sessionsEvicted=evicted})
  };
  transient let ttl = 600_000_000_000; // Ten minutes to connect; live WebRTC does not renew this.
  func prune() { for ((code, r) in Map.entries(rooms)) { if (r.expires < Time.now()) removeRoom(code) } };
  func view(r : Room, code : Text) : Result { #ok({mapKey=r.mapKey; offer=r.offer; answer=r.answer; joined=r.guest != null; sessionId=Map.get(sessionRefs,Text.compare,code)}) };
  func member(r : Room, p : Principal) : Bool { r.host == p or r.guest == ?p };
  func validCode(code : Text) : Bool {
    if (code.size() != 20) return false;
    for (c in code.chars()) { if (not ((c >= '0' and c <= '9') or (c >= 'a' and c <= 'f'))) return false }; true
  };
  func validSdp(sdp : Text) : Bool { sdp.size() > 10 and sdp.size() <= 32_000 };
  public shared({caller}) func create(code : Text, mapKey : Text, offer : Text) : async Result {
    prune();
    if (Principal.isAnonymous(caller)) return #err("A room identity is required.");
    if (not validCode(code) or mapKey.size() > 160 or mapKey.size() < 3 or not validSdp(offer)) return #err("Invalid room request.");
    switch (Map.get(rooms,Text.compare,code)) {
      case (?r) { if (r.host == caller and r.mapKey == mapKey and r.offer == offer) return view(r,code); return #err("Room code is already in use.") };
      case null {};
    };
    var previous : ?Text = null;
    for ((oldCode, r) in Map.entries(rooms)) { if (r.host == caller) previous := ?oldCode };
    if (Map.size(rooms) >= 128 and previous == null) return #err("Rooms are busy. Try again shortly.");
    // Returning accounts can replace their abandoned invite after a reload.
    // This removes signaling only; an established WebRTC match is independent.
    switch (previous) { case (?oldCode) removeRoom(oldCode); case null {} };
    let r : Room = {host=caller; var guest=null; mapKey; offer; var answer=null; expires=Time.now()+ttl};
    Map.add(rooms,Text.compare,code,r);newSession(code,caller);view(r,code)
  };
  public shared({caller}) func join(code : Text) : async Result {
    prune();if (Principal.isAnonymous(caller)) return #err("A room identity is required.");
    let ?r = Map.get(rooms,Text.compare,code) else return #err("Room not found or expired.");
    if (r.host == caller) return #err("You are signed in as the host. Your teammate needs a different account. Use another browser profile and sign in with their Internet Identity.");
    switch (r.guest) { case (?p) { if (p != caller) return #err("This room already has two players.") };case null {r.guest:=?caller;
      switch(Map.get(sessionRefs,Text.compare,code)) {case(?id) {switch(Map.get(sessions,Nat.compare,id)) {case(?s) {s.guest:=?caller;joined += 1};case null {}}};case null {}}
    } };view(r,code)
  };
  public shared({caller}) func answer(code : Text, sdp : Text) : async Result {
    prune();let ?r = Map.get(rooms,Text.compare,code) else return #err("Room expired.");
    if (r.guest != ?caller or not validSdp(sdp)) return #err("Invalid answer.");
    switch(r.answer) {case (?old) {if(old != sdp) return #err("Create a new room to reconnect.")};case null {r.answer:=?sdp}};view(r,code)
  };
  // Update replies authenticate SDP through consensus; polling stops after connection.
  public shared({caller}) func poll(code : Text) : async Result {
    prune();let ?r = Map.get(rooms,Text.compare,code) else return #err("Room not found or expired.");
    if (not member(r,caller)) return #err("Only room members can read signaling.");view(r,code)
  };
  public shared({caller}) func close(code : Text) : async () {
    switch(Map.get(rooms,Text.compare,code)){case(?r){if(member(r,caller))removeRoom(code)};case null{}}
  };
}

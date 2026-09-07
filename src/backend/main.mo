import Blob "mo:core/Blob";
import Array "mo:core/Array";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Nat "mo:core/Nat";

// Personal, client-reported times. This canister does not simulate or certify gameplay.
persistent actor {
  public type Record = { track : Text; rulesVersion : Nat; bestMs : Nat; lastMs : Nat; completions : Nat; updatedAt : Int };
  public type Ticket = { id : Nat; track : Text; rulesVersion : Nat; startedAt : Int };
  public type Receipt = { id : Nat; record : Record; newBest : Bool };
  public type Result<T> = { #ok : T; #err : Text };
  type Account = { var records : [Record]; var active : ?Ticket; var receipt : ?Receipt };
  let accounts = Map.empty<Principal, Account>();
  public type Skin = { color : Text; wheels : Text; decal : Text };
  public type Profile = { nickname : Text; skin : Skin; listed : Bool };
  public type Leader = { nickname : Text; skin : Skin; bestMs : Nat; completions : Nat; isYou : Bool };
  // Separate map preserves the original account/record schema on upgrade.
  let profiles = Map.empty<Principal, Profile>();
  var nameSeed : Nat = 173;
  var nextId : Nat = 0;
  transient let maxAccounts = 10_000;
  transient let lifetimeNs = 3_600_000_000_000;

  func supported(track : Text, version : Nat) : Bool {
    ((version == 1 or version == 2 or version == 3 or version == 4) and (track == "old-road" or track == "relay-ridge" or track == "finality-quarry"))
      or (track == "old-road" and version == 5)
  };
  public query func version() : async Text { "0.6.1" };

  func validSkin(skin : Skin) : Bool {
    (skin.color == "cream" or skin.color == "mint" or skin.color == "coral" or skin.color == "blue" or skin.color == "violet" or skin.color == "gold")
      and (skin.wheels == "stock" or skin.wheels == "whitewall" or skin.wheels == "rally")
      and (skin.decal == "probably" or skin.decal == "ship" or skin.decal == "404")
  };
  func validName(name : Text) : Bool {
    if (name.size() < 3 or name.size() > 24) return false;
    for (c in name.chars()) {
      if (not ((c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z') or (c >= '0' and c <= '9') or (c >= 'А' and c <= 'я') or c == 'Ё' or c == 'ё' or c == ' ' or c == '-' or c == '_')) return false
    };
    true
  };
  public shared query ({ caller }) func myProfile() : async Result<?Profile> {
    if (Principal.isAnonymous(caller)) return #err("Sign in to load your profile.");
    #ok(Map.get(profiles, Principal.compare, caller))
  };
  public shared ({ caller }) func ensureProfile() : async Result<Profile> {
    if (Principal.isAnonymous(caller)) return #err("Sign in to create your profile.");
    switch (Map.get(profiles, Principal.compare, caller)) { case (?profile) return #ok(profile); case null {} };
    if (not Map.containsKey(accounts, Principal.compare, caller)) {
      if (Map.size(accounts) >= maxAccounts) return #err("Profile storage is full. You can still play as a guest.");
      let created : Account = { var records = []; var active = null; var receipt = null };
      Map.add(accounts, Principal.compare, caller, created)
    };
    // Decorative pseudorandom names, not security tokens. Stored once, not regenerated on login.
    nameSeed := (nameSeed * 1_103_515_245 + 12_345 + Int.abs(Time.now())) % 2_147_483_648;
    let adjectives = ["Rusty", "Sleepy", "Lucky", "Wobbly", "Cosmic", "Turbo", "Muddy", "Brave"];
    let drivers = ["Otter", "Badger", "Goose", "Moose", "Lynx", "Panda", "Yeti", "Duck"];
    let profile : Profile = {
      nickname = adjectives[nameSeed % 8] # " " # drivers[(nameSeed / 8) % 8] # " " # Nat.toText(1000 + (nameSeed / 64) % 9000);
      skin = { color = "cream"; wheels = "stock"; decal = "probably" }; listed = false
    };
    Map.add(profiles, Principal.compare, caller, profile);
    #ok(profile)
  };
  public shared ({ caller }) func saveProfile(value : Profile) : async Result<Profile> {
    if (Principal.isAnonymous(caller)) return #err("Sign in to save your profile.");
    if (not Map.containsKey(profiles, Principal.compare, caller)) return #err("Load your profile before saving.");
    let nickname = Text.trim(value.nickname, #char ' ');
    if (not validName(nickname)) return #err("Use 3–24 English or Cyrillic letters, numbers, spaces, - or _.");
    if (not validSkin(value.skin)) return #err("Choose a paint, wheels and stickers from the garage.");
    let profile = { nickname; skin = value.skin; listed = value.listed };
    Map.add(profiles, Principal.compare, caller, profile);
    #ok(profile)
  };
  public shared query ({ caller }) func leaderboard(track : Text, rulesVersion : Nat) : async Result<[Leader]> {
    if (not ((track == "old-road" and rulesVersion == 5) or ((track == "relay-ridge" or track == "finality-quarry") and rulesVersion == 4))) return #err("Choose a current course.");
    type Candidate = { owner : Principal; profile : Profile; record : Record };
    var best : [Candidate] = [];
    // Scan at most 10,000 accounts; retain only 20. Live profile lookup makes
    // opt-out, renames and backfill immediate without exposing private legacy data.
    for ((owner, profile) in Map.entries(profiles)) {
      if (profile.listed) switch (Map.get(accounts, Principal.compare, owner)) {
        case (?account) switch (Array.find<Record>(account.records, func(r) { r.track == track and r.rulesVersion == rulesVersion })) {
          case (?record) {
            let sorted = Array.sort<Candidate>(Array.concat(best, [{ owner; profile; record }]), func(a, b) {
              if (a.record.bestMs < b.record.bestMs) #less else if (a.record.bestMs > b.record.bestMs) #greater else Principal.compare(a.owner, b.owner)
            });
            best := Array.tabulate<Candidate>(Nat.min(20, sorted.size()), func(i) { sorted[i] })
          };
          case null {}
        };
        case null {}
      }
    };
    #ok(Array.map<Candidate, Leader>(best, func(item) { {
      nickname = item.profile.nickname; skin = item.profile.skin; bestMs = item.record.bestMs;
      completions = item.record.completions; isYou = item.owner == caller
    } }))
  };

  // Caller comes from the signed ingress. No method accepts an account principal.
  public shared query ({ caller }) func myRecords() : async Result<[Record]> {
    if (Principal.isAnonymous(caller)) return #err("Sign in to see your records.");
    switch (Map.get(accounts, Principal.compare, caller)) {
      case null #ok([]);
      case (?account) #ok(account.records);
    }
  };

  public shared ({ caller }) func startRun(track : Text, rulesVersion : Nat) : async Result<Ticket> {
    if (Principal.isAnonymous(caller)) return #err("Sign in before starting a saved run.");
    if (not supported(track, rulesVersion)) return #err("This track version is not supported. Reload the game.");
    let account = switch (Map.get(accounts, Principal.compare, caller)) {
      case (?existing) existing;
      case null {
        if (Map.size(accounts) >= maxAccounts) return #err("Record storage is full. You can still play as a guest.");
        let created : Account = { var records = []; var active = null; var receipt = null };
        Map.add(accounts, Principal.compare, caller, created);
        created
      };
    };
    let now = Time.now();
    switch (account.active) {
      case (?previous) { if (now - previous.startedAt < 2_000_000_000) return #err("Please wait a moment before restarting.") };
      case null {};
    };
    nextId += 1;
    let ticket = { id = nextId; track; rulesVersion; startedAt = now };
    account.active := ?ticket;
    #ok(ticket)
  };

  public shared ({ caller }) func finishRun(id : Nat, elapsedMs : Nat) : async Result<Receipt> {
    if (Principal.isAnonymous(caller)) return #err("Sign in to save a result.");
    let account = switch (Map.get(accounts, Principal.compare, caller)) {
      case null return #err("Start a new saved run first.");
      case (?value) value;
    };
    // Idempotent retries after a lost response never count a completion twice.
    switch (account.receipt) {
      case (?receipt) if (receipt.id == id) {
        if (receipt.record.lastMs != elapsedMs) return #err("This run has already been saved with a different time.");
        return #ok(receipt)
      };
      case _ {};
    };
    let ticket = switch (account.active) {
      case null return #err("No active saved run. Start a new delivery.");
      case (?value) value;
    };
    if (ticket.id != id) return #err("This run was replaced by another start.");
    let now = Time.now();
    if (now - ticket.startedAt > lifetimeNs) { account.active := null; return #err("This run expired after one hour.") };
    if (elapsedMs < 10_000 or elapsedMs > 3_600_000) return #err("The reported time is outside the allowed range.");
    // Simulation time excludes pauses, but cannot exceed actual elapsed time.
    if (elapsedMs * 1_000_000 > now - ticket.startedAt + 2_000_000_000) return #err("The timer is ahead of this run. Try saving again.");
    let receipt = commitRecord(account, ticket, elapsedMs, now);
    account.receipt := ?receipt;
    account.active := null;
    #ok(receipt)
  };
  // Shared record update; guest claims must not replace a legacy active ticket or receipt.
  func commitRecord(account : Account, ticket : Ticket, elapsedMs : Nat, now : Int) : Receipt {
    let id = ticket.id;
    let prior = Array.find<Record>(account.records, func(record) { record.track == ticket.track and record.rulesVersion == ticket.rulesVersion });
    let newBest = switch (prior) { case null true; case (?record) elapsedMs < record.bestMs };
    let record : Record = {
      track = ticket.track; rulesVersion = ticket.rulesVersion;
      bestMs = switch (prior) { case (?record) if (record.bestMs < elapsedMs) record.bestMs else elapsedMs; case null elapsedMs };
      lastMs = elapsedMs; updatedAt = now;
      completions = switch (prior) { case null 1; case (?record) record.completions + 1 };
    };
    account.records := Array.concat(Array.filter<Record>(account.records, func(item) { item.track != ticket.track or item.rulesVersion != ticket.rulesVersion }), [record]);
    let receipt = { id; record; newBest };
    receipt
  };

  public type CourseStats = { track : Text; rulesVersion : Nat; starts : Nat; finishes : Nat; saved : Nat };
  public type Statistics = { since : Int; opens : Nat; courses : [CourseStats] };
  var statsSince : Int = Time.now();
  var gameOpens : Nat = 0;
  var courseStats : [CourseStats] = [];
  type Delivery = { ticket : Ticket; var owner : ?Principal; var elapsedMs : ?Nat; var receipt : ?Receipt };
  type Event = { createdAt : Int; kind : { #open; #delivery : Delivery } };
  // Client-generated 256-bit capabilities stay in tab memory, never URLs or public queries.
  // Fixed expiry + creation-order index keep both storage and cleanup work bounded.
  let events = Map.empty<Blob, Event>();
  let eventOrder = Map.empty<Nat, Blob>();
  var nextEvent : Nat = 0;
  transient let eventLifetimeNs = 86_400_000_000_000;
  transient let maxEvents = 50_000;

  func pruneEvents(now : Int) {
    var removed = 0;
    label cleanup while (removed < 100) {
      switch (Map.minEntry(eventOrder)) {
        case null break cleanup;
        case (?(id, key)) {
          switch (Map.get(events, Blob.compare, key)) {
            case (?event) if (now - event.createdAt < eventLifetimeNs) break cleanup;
            case _ {};
          };
          Map.remove(events, Blob.compare, key);
          Map.remove(eventOrder, Nat.compare, id);
          removed += 1
        };
      }
    }
  };
  func addEvent(key : Blob, kind : { #open; #delivery : Delivery }, now : Int) {
    nextEvent += 1;
    Map.add(events, Blob.compare, key, { createdAt = now; kind });
    Map.add(eventOrder, Nat.compare, nextEvent, key)
  };
  func countCourse(ticket : Ticket, event : { #start; #finish; #save }) {
    let prior = switch (Array.find<CourseStats>(courseStats, func(r) { r.track == ticket.track and r.rulesVersion == ticket.rulesVersion })) {
      case (?r) r;
      case null { { track = ticket.track; rulesVersion = ticket.rulesVersion; starts = 0; finishes = 0; saved = 0 } };
    };
    let updated = { prior with starts = prior.starts + (if (event == #start) 1 else 0); finishes = prior.finishes + (if (event == #finish) 1 else 0); saved = prior.saved + (if (event == #save) 1 else 0) };
    courseStats := Array.concat(Array.filter<CourseStats>(courseStats, func(r) { r.track != ticket.track or r.rulesVersion != ticket.rulesVersion }), [updated])
  };
  public shared query ({ caller }) func statistics() : async Result<Statistics> {
    if (not Principal.isController(caller)) return #err("Only canister controllers can read statistics.");
    #ok({ since = statsSince; opens = gameOpens; courses = courseStats })
  };
  // Separate read-only grants never confer controller or player-data access.
  // A controller's grants stop authorizing reads as soon as that controller is removed.
  public type StatisticsReader = { reader : Principal; grantedBy : Principal };
  var statisticsReaders : [StatisticsReader] = [];
  public shared ({ caller }) func setStatisticsReader(reader : Principal, enabled : Bool) : async Result<()> {
    if (not Principal.isController(caller)) return #err("Only canister controllers can manage statistics readers.");
    if (Principal.isAnonymous(reader)) return #err("Choose a signed account.");
    let remaining = Array.filter<StatisticsReader>(statisticsReaders, func(r) { r.reader != reader and Principal.isController(r.grantedBy) });
    if (enabled and remaining.size() >= 8) return #err("At most eight statistics readers are allowed.");
    statisticsReaders := if (enabled) Array.concat(remaining, [{ reader; grantedBy = caller }]) else remaining;
    #ok(())
  };
  public shared query ({ caller }) func listStatisticsReaders() : async Result<[StatisticsReader]> {
    if (not Principal.isController(caller)) return #err("Only canister controllers can manage statistics readers.");
    #ok(Array.filter<StatisticsReader>(statisticsReaders, func(r) { Principal.isController(r.grantedBy) }))
  };
  public shared query ({ caller }) func adminStatistics() : async Result<Statistics> {
    if (not Principal.isController(caller)) {
      let allowed = Array.find<StatisticsReader>(statisticsReaders, func(r) { r.reader == caller and Principal.isController(r.grantedBy) });
      if (allowed == null) return #err("Statistics access has not been granted to this account.")
    };
    #ok({ since = statsSince; opens = gameOpens; courses = courseStats })
  };
  public func gameOpened(key : Blob) : async Result<()> {
    if (key.size() != 32) return #err("Invalid event key.");
    let now = Time.now(); pruneEvents(now);
    switch (Map.get(events, Blob.compare, key)) {
      case (?event) { switch (event.kind) { case (#open) return #ok(()); case _ return #err("Event key already used.") } };
      case null {};
    };
    if (Map.size(events) >= maxEvents) return #err("Activity storage is busy.");
    addEvent(key, #open, now); gameOpens += 1; #ok(())
  };
  public shared ({ caller }) func beginDelivery(key : Blob, track : Text, rulesVersion : Nat) : async Result<Ticket> {
    if (key.size() != 32) return #err("Invalid delivery key.");
    if (not supported(track, rulesVersion)) return #err("This track version is not supported. Reload the game.");
    let now = Time.now(); pruneEvents(now);
    let owner = if (Principal.isAnonymous(caller)) null else ?caller;
    switch (Map.get(events, Blob.compare, key)) {
      case (?event) {
        switch (event.kind) {
          case (#delivery(run)) {
            if (run.ticket.track == track and run.ticket.rulesVersion == rulesVersion and run.owner == owner) return #ok(run.ticket);
            return #err("Delivery key already used.")
          };
          case _ return #err("Event key already used.");
        }
      };
      case null {};
    };
    if (Map.size(events) >= maxEvents) return #err("Activity storage is busy. You can play without saving.");
    nextId += 1;
    let ticket = { id = nextId; track; rulesVersion; startedAt = now };
    addEvent(key, #delivery({ ticket; var owner; var elapsedMs = null; var receipt = null }), now);
    countCourse(ticket, #start); #ok(ticket)
  };
  func delivery(key : Blob, id : Nat) : Result<Delivery> {
    if (key.size() != 32) return #err("Invalid delivery key.");
    switch (Map.get(events, Blob.compare, key)) {
      case (?event) {
        if (Time.now() - event.createdAt >= eventLifetimeNs) return #err("This delivery expired. Start a new run.");
        switch (event.kind) { case (#delivery(run)) { if (run.ticket.id == id) return #ok(run) }; case _ {} }
      };
      case null {};
    };
    #err("Delivery unavailable. Start a new run.")
  };
  public func completeDelivery(key : Blob, id : Nat, elapsedMs : Nat) : async Result<()> {
    let run = switch (delivery(key, id)) { case (#err(error)) return #err(error); case (#ok(value)) value };
    switch (run.elapsedMs) {
      case (?prior) { if (prior == elapsedMs) return #ok(()); return #err("This delivery already has a different time.") };
      case null {};
    };
    let wall = Time.now() - run.ticket.startedAt;
    if (wall > lifetimeNs) return #err("This run expired after one hour.");
    if (elapsedMs < 10_000 or elapsedMs > 3_600_000) return #err("The reported time is outside the allowed range.");
    if (elapsedMs * 1_000_000 > wall + 2_000_000_000) return #err("The timer is ahead of this run. Try saving again.");
    run.elapsedMs := ?elapsedMs; countCourse(run.ticket, #finish); #ok(())
  };
  public shared ({ caller }) func claimDelivery(key : Blob, id : Nat, publish : Bool) : async Result<Receipt> {
    if (Principal.isAnonymous(caller)) return #err("Sign in to save this delivery.");
    let run = switch (delivery(key, id)) { case (#err(error)) return #err(error); case (#ok(value)) value };
    switch (run.owner) { case (?owner) { if (owner != caller) return #err("Sign in with the same account before saving this run.") }; case null {} };
    let elapsed = switch (run.elapsedMs) { case (?ms) ms; case null return #err("Finish the delivery before saving.") };
    let account = switch (Map.get(accounts, Principal.compare, caller)) { case (?value) value; case null return #err("Load your profile before saving.") };
    // Publication is an explicit finish CTA; false preserves the existing preference.
    if (publish) {
      let profile = switch (Map.get(profiles, Principal.compare, caller)) { case (?value) value; case null return #err("Load your profile before publishing.") };
      Map.add(profiles, Principal.compare, caller, { profile with listed = true })
    };
    switch (run.receipt) { case (?receipt) return #ok(receipt); case null {} };
    let receipt = commitRecord(account, run.ticket, elapsed, Time.now());
    run.owner := ?caller; run.receipt := ?receipt; countCourse(run.ticket, #save);
    #ok(receipt)
  };
}

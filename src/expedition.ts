import { expeditionMaps, mapTrack } from './game/maps/catalog';
import { updateExpeditionCard } from './ui/expedition-card';
import { InteractionIndicator } from './ui/interaction-indicator';
import { masthead, modeSwitch } from './ui/masthead';
import { Garage } from './ui/garage';
import { tracks } from './game/tracks';
import { initPhysics, Simulation } from './game/simulation';
import { Renderer } from './game/renderer';
import { Input } from './game/input';
import { TouchControls } from './game/touch-controls';
import { GameAudio } from './game/audio';
import { config } from './game/config';
import { CoopTelemetry } from './services/coop-telemetry';
import { Account, formatTime } from './services/account';
import { defaultSkin } from './game/skin';
import { connectRooms, newRoomCode, roomsAvailable } from './services/rooms';
import { roomValue, type RoomsApi } from './services/rooms-api';
import { Peer, iceConfiguration } from './network/peer';
import { InputMailbox, SnapshotBuffer, mapKey, networkConfig, validAction, validTargetId, validSnapshot, validCrewProfile, type CrewProfile } from './network/protocol';
import type { Snapshot } from './game/types';

/** Expeditions share the account/garage, but never submit solo tickets or records. */
export async function bootExpedition() {
  const incomingInvite=new URLSearchParams(location.search).get('room');
  const app=document.querySelector<HTMLDivElement>('#app')!,canvas=document.querySelector<HTMLCanvasElement>('#game')!;canvas.tabIndex=0;
  app.innerHTML=`<div class="vignette"></div>
    ${masthead()}
    <div id="account-feedback" class="account-feedback hidden" role="status" aria-live="polite"></div>
    <main id="exp-menu" class="expedition-menu${incomingInvite!==null?' hidden':''}">
      <div class="exp-copy">${modeSwitch('coop')}<span class="eyebrow">TWO DRIVERS. FARTHER TOGETHER.</span><h1>DELIVER<br><span>TOGETHER.</span></h1>
      <p class="intro">One drives. One clears the way.<br>Load the canisters and find your way through.<br>A little easier with a friend.</p></div>
      <div class="exp-actions">
      <div id="exp-map-picker" class="hidden"><label class="exp-map-label" for="exp-map">Choose a map</label><select id="exp-map" class="exp-map-select"></select><p id="exp-description" class="track-description"></p></div>
      <button id="exp-host" class="primary" disabled>Create expedition <span aria-hidden="true">↗</span></button>
      <form id="exp-join-form" class="exp-join"><label class="sr-only" for="exp-code">Invite link or room code</label><input id="exp-code" placeholder="Invite link or room code" autocomplete="off" spellcheck="false"><button id="exp-join" class="secondary" type="submit" disabled>Join</button></form>
      <p class="exp-team-note">2 players · One shared bus</p>
      <button id="exp-explore" class="text-button" disabled>Loading the clearing…</button>
      <p id="exp-status" class="start-status" role="status">Expedition runs are separate from solo records.</p>
      </div>
      <figure id="exp-card" class="exp-card" aria-labelledby="exp-card-title">
        <img class="exp-card-art" width="480" height="320" alt="">
        <figcaption><span class="exp-featured">FEATURED ROUTE</span><h2 id="exp-card-title"></h2><p class="exp-card-description"></p><dl class="exp-card-facts">
          <div data-fact="duration"><dt>Time</dt><dd></dd></div>
          <div data-fact="difficulty"><dt>Difficulty</dt><dd></dd></div>
          <div data-fact="routes"><dt>Routes</dt><dd></dd></div>
        </dl></figcaption>
      </figure>
    </main>
    <section id="exp-lobby" class="overlay${incomingInvite===null?' hidden':''}" role="dialog" aria-modal="true" aria-labelledby="exp-lobby-title"><div class="pause-card">
      <span id="exp-lobby-role" class="eyebrow">ROAD CREW / 2 PLAYERS</span><h2 id="exp-lobby-title">Joining your team.</h2>
      <p id="exp-lobby-status" role="status">Opening the invitation…</p><p id="exp-room-id" class="exp-room-id"></p>
      <p id="exp-crew" class="exp-crew hidden"></p>
      <button id="exp-signin" class="primary hidden">Sign in with Internet Identity</button>
      <div id="exp-share" class="hidden"><button id="exp-copy" class="primary" disabled>Copy invite link</button><input id="exp-invite" class="hidden" readonly aria-label="Invite link"><p class="exp-invite-tip">Your teammate needs their own account.<br>On this computer, use another browser profile.</p></div>
      <button id="exp-ready" class="primary hidden" disabled>Ready to go</button><button id="exp-cancel" class="text-button">Back to expeditions</button>
    </div></section>
    <section id="exp-hud" class="hud hidden" aria-label="Expedition status">
      <div class="route-card"><span id="exp-map-name" class="eyebrow"></span><strong>Get every module to production.</strong><span id="exp-systems"></span><span id="exp-timer" class="run-timer"></span></div>
      <div class="top-actions"><button id="exp-pause-button" class="icon-button" aria-label="Pause expedition">Ⅱ</button></div>
      <div class="bottom-left"><span id="exp-role" class="role-tag"></span><div id="exp-prompt" class="interaction"></div><div id="exp-notice" class="notice" role="status"></div></div>
      <div class="dashboard"><div class="speed"><strong id="exp-speed">0</strong><span>KM/H</span></div></div>
      <div id="exp-controls" class="controls"></div>
    </section>
    <section id="exp-pause" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="exp-pause-title"><div class="pause-card"><span class="eyebrow">ROADSIDE BREAK</span><h2 id="exp-pause-title">Take a breath.</h2><p>The expedition is paused.</p><button id="exp-resume" class="primary">Back to the clearing ↗</button><button id="exp-restart" class="secondary">Start the expedition again</button><button id="exp-leave" class="text-button">Back to expeditions</button></div></section>
    <section id="exp-finish" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="exp-finish-title"><div class="pause-card"><span class="eyebrow">DEPLOYMENT COMPLETE</span><h2 id="exp-finish-title">IT’S LIVE.</h2><p id="exp-result"></p><p>Try a different route next time.</p><button id="exp-again" class="primary">Another way through ↗</button><button id="exp-done" class="text-button">Back to expeditions</button></div></section>`;
  const get=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const show=(id:string,on:boolean)=>get(id).classList.toggle('hidden',!on);
  const text=(id:string,value:string)=>{if(get(id).textContent!==value)get(id).textContent=value;};
  const selector=get<HTMLSelectElement>('exp-map');
  for(const map of expeditionMaps){const option=document.createElement('option');option.value=map.id;option.textContent=map.name;selector.append(option);}
  let map=expeditionMaps.find(m=>m.id===new URLSearchParams(location.search).get('map'))??expeditionMaps[0];selector.value=map.id;show('exp-map-picker',expeditionMaps.length>1);
  await initPhysics();
  const renderer=new Renderer(canvas),input=new Input(canvas),touch=new TouchControls(input,app),audio=new GameAudio();
  const account=new Account(),available=roomsAvailable()&&account.available;
  let pendingEntry:{role:'host'|'guest';invite:string}|null=null;
  let ownProfile:CrewProfile|null=null,remoteProfile:CrewProfile|null=null;
  let telemetry:CoopTelemetry|undefined;
  let ownsRoom=false,closing=Promise.resolve();
  let sim=new Simulation('road',mapTrack(map)),screen:'menu'|'lobby'|'game'|'pause'|'finish'='menu';
  let previous=sim.snapshot(),current=previous,accumulator=0,hudTime=0;
  let team:'host'|'guest'|null=null,peer:Peer|undefined,api:RoomsApi|undefined,code='',generation=0;
  let signalingDone=false,helloReceived=false;
  let connected=false,localReady=false,remoteReady=false,key='',epoch=0,sequence=0,lastAction=-1;
  let lastPacket=0,lastSend=0,lastHeartbeat=0,prompt='',notice='',remotePaused=false;
  const mailbox=new InputMailbox(),buffer=new SnapshotBuffer();
  // A crew keeps the appearance agreed at entry; garage drafts apply before joining.
  const garage=new Garage(account,app,skin=>{if(!team)renderer.setSkin(skin);});
  function reset(){sim.destroy();renderer.setTrack(mapTrack(map));renderer.setSkin((team==='guest'?remoteProfile:ownProfile)?.skin??account.profile?.skin??defaultSkin);sim=new Simulation('road',mapTrack(map));if(team==='host')sim.addPlayer();for(let i=0;i<60;i++)sim.step();previous=current=sim.snapshot();input.yaw=map.spawn.players[team==='guest'?1:0].yaw;input.pitch=.5;accumulator=0;audio.reset();renderer.resetCamera();mailbox.clear();buffer.clear();}
  function ownPrompt(){return current.interaction.target?current.interaction.prompt:team==='guest'?prompt:sim.prompt();}
  function setScreen(next:typeof screen){screen=next;input.active=next==='game';input.clear();sim.cancelInteractions();mailbox.clear();accumulator=0;for(const name of ['menu','lobby','hud','pause','finish'])show(`exp-${name}`,name==='hud'?next==='game':next===name);show('account-feedback',false);headerAccount();touch.update(current,input.active,ownPrompt());if(next==='game'){canvas.focus();void audio.start();}else{audio.pause();if(document.pointerLockElement)document.exitPointerLock();}}
  function stopTeam(){
    telemetry?.stop();telemetry=undefined;
    generation++;peer?.close();peer=undefined;
    // A failed self-join must not close the host's room under the same principal.
    if(api&&code&&ownsRoom)closing=Promise.all([closing,api.close(code).catch(()=>{})]).then(()=>{});
    ownsRoom=false;api=undefined;code='';team=null;connected=false;localReady=remoteReady=false;ownProfile=remoteProfile=null;
    return closing;
  }
  function roomAddress(room?:string){const url=new URL(location.href);if(room)url.searchParams.set('room',room);else url.searchParams.delete('room');history.replaceState(null,'',url);}
  function choose(){pendingEntry=null;stopTeam();roomAddress();get<HTMLInputElement>('exp-code').value='';selector.value=map.id;text('exp-description',map.description);text('exp-map-name',map.name.toUpperCase());updateExpeditionCard(get('exp-card'),map);reset();setScreen('menu');}
  function sendState(reliable=false,type='state') {peer?.send({type,epoch,snapshot:sim.snapshot('guest-player'),prompt:sim.prompt('guest-player'),message:sim.message},reliable);}
  function start(){if(team==='guest')return;if(team&&!connected)return;reset();epoch++;sim.message='Supplies are nearby. Find your own way to the delivery clearing.';setScreen('game');if(team){void telemetry?.report('started');sendState(true,'start');}}
  function pause(broadcast=true){if(screen==='game'){setScreen('pause');if(team&&broadcast)peer?.send({type:'pause',epoch},true);get('exp-resume').focus();}}
  function resume(){if(remotePaused){text('exp-notice','Waiting for your teammate to return.');return;}if(team==='guest'){peer?.send({type:'resume',epoch},true);return;}if(team)sendState(true,'resume');setScreen('game');}
  function failed(message:string){pendingEntry=null;stopTeam();setScreen('lobby');text('exp-lobby-title','Couldn’t connect.');text('exp-lobby-role','ROAD CREW / CONNECTION');show('exp-share',false);show('exp-ready',false);show('exp-signin',false);show('exp-crew',false);text('exp-lobby-status',message);get<HTMLButtonElement>('exp-ready').disabled=true;get<HTMLButtonElement>('exp-copy').disabled=true;}
  function headerAccount(){
    get<HTMLButtonElement>('account-toggle').disabled=Boolean(team)||account.busy||!account.available;
    text('account-toggle',account.busy?'Connecting…':account.signedIn?`${account.profile?.nickname??'My garage'} ↗`:touch.enabled?'Sign in':'Sign in · Internet Identity');
    get('account-toggle').title=team?'Internet Identity · leave the team to edit your profile':'Internet Identity account';
  }
  function accountStatus(){
    get<HTMLButtonElement>('exp-host').disabled=!available||account.busy;
    get<HTMLButtonElement>('exp-join').disabled=!available||account.busy;
    get<HTMLButtonElement>('exp-signin').disabled=!available||account.busy;
    headerAccount();
    text('account-feedback',account.message);show('account-feedback',account.available&&Boolean(account.message)&&screen==='menu'&&!garage.opened);
    text('exp-status',!available?'Team play needs the accounts and rooms services. You can explore now.':account.busy?'Checking your account…':account.signedIn?'Expedition runs are separate from solo records.':'Sign in to play as a team. Solo exploration needs no account.');
    garage.sync();
    if(pendingEntry)authPrompt();
  }
  function authPrompt(){
    if(!pendingEntry)return;
    const guest=pendingEntry.role==='guest';
    setScreen('lobby');show('exp-share',false);show('exp-ready',false);show('exp-crew',false);show('exp-signin',true);text('exp-room-id','');
    text('exp-lobby-role',guest?'ROAD CREW / YOU ARE JOINING':'ROAD CREW / YOU ARE THE HOST');
    text('exp-lobby-title',account.signedIn?'Load your crew profile.':guest?'Sign in to join.':'Sign in to team up.');
    text('exp-lobby-status',account.busy?'Opening your account…':account.message||'Use your saved nickname and garage. After signing in, you’ll continue with this team.');
    text('exp-signin',account.signedIn?'Retry profile':'Sign in with Internet Identity');
  }
  function requestTeam(role:'host'|'guest',invite=get<HTMLInputElement>('exp-code').value){
    if(!available){failed('Team play needs the accounts and rooms services. Solo exploration is available.');return;}
    if(role==='guest'){
      let parsed=invite.trim();try{parsed=new URL(parsed).searchParams.get('room')??parsed;}catch{/* Raw invite code. */}
      if(!/^[a-f0-9]{20}$/.test(parsed)){failed('Paste the complete invite link or its room code.');return;}
      invite=parsed;roomAddress(invite);
    }
    pendingEntry={role,invite};
    if(account.busy||!account.signedIn||!account.profile){authPrompt();return;}
    pendingEntry=null;void openTeam(role,invite);
  }
  async function signInForTeam(){
    const entry=pendingEntry,run=generation;if(!entry||account.busy)return;
    if(account.signedIn)await account.refresh();else await account.signIn();
    if(entry!==pendingEntry||run!==generation)return;
    if(account.signedIn&&account.profile)requestTeam(entry.role,entry.invite);else authPrompt();
  }
  function finishHandshake(){
    if(!connected&&signalingDone&&helloReceived){connected=true;void telemetry?.report('connected');if(team==='host')peer?.send({type:'ready'},true);lobbyStatus();}
  }
  function lobbyStatus(){
    if(!connected)return;
    const host=team==='host';
    text('exp-lobby-title',host?'Your crew is here.':'You’re on the crew.');
    text('exp-lobby-status',host?(remoteReady?'Your teammate is ready. Let’s ship it.':'Your teammate is connected. Waiting for them to choose Ready.'):(localReady?'You’re ready. The host will start the expedition.':'Connected to the host. Ready to ship it?'));
    show('exp-crew',true);text('exp-crew',`${ownProfile!.nickname} (you) · ${remoteProfile!.nickname}`);
    show('exp-share',false);show('exp-ready',true);
    text('exp-ready',host?'Start expedition ↗':localReady?'Ready ✓':'Ready to go');
    get<HTMLButtonElement>('exp-ready').disabled=host?!remoteReady:localReady;
  }
  function receive(packet:Record<string,unknown>,reliable:boolean){
    lastPacket=performance.now();
    if(packet.type==='hello'&&reliable){if(packet.key!==key||!validCrewProfile(packet.profile)){failed('The crew data or game versions do not match. Both players: reload the game. Host: create a new expedition and send the new invite.');return;}if(helloReceived)return;remoteProfile=packet.profile;if(team==='guest')renderer.setSkin(remoteProfile.skin);helloReceived=true;finishHandshake();return;}
    // Reliable readiness may arrive while our final ICP reply is still pending.
    if(packet.type==='ready'&&reliable&&helloReceived&&screen==='lobby'){remoteReady=true;lobbyStatus();return;}
    if(!connected)return;
    if(packet.type==='heartbeat')return;
    if(packet.type==='visibility'&&reliable&&typeof packet.hidden==='boolean'){remotePaused=packet.hidden;if(remotePaused)pause(false);get<HTMLButtonElement>('exp-resume').disabled=remotePaused;return;}
    if(team==='guest'&&['start','state','resume'].includes(String(packet.type))){
      if(!validSnapshot(packet.snapshot)||packet.snapshot.trackId!==map.id||packet.snapshot.player.id!=='guest-player'||typeof packet.epoch!=='number'||!Number.isSafeInteger(packet.epoch)||typeof packet.prompt!=='string'||typeof packet.message!=='string')return;
      if(packet.type==='start'&&reliable&&packet.epoch>epoch){epoch=packet.epoch;buffer.clear();previous=current=packet.snapshot;setScreen('game');void telemetry?.report('started');}
      if(packet.epoch!==epoch)return;
      if(packet.type==='resume'&&reliable&&!document.hidden){buffer.clear();previous=current=packet.snapshot;setScreen('game');}
      if(screen!=='game')return;
      buffer.push(packet.snapshot,lastPacket);prompt=packet.prompt.slice(0,512);notice=packet.message.slice(0,512);return;
    }
    if(packet.epoch!==epoch)return;
    if(packet.type==='pause'&&reliable){pause(false);return;}
    if(packet.type==='resume'&&reliable&&team==='host'&&screen==='pause'&&!document.hidden&&!remotePaused){resume();return;}
    if(screen!=='game')return;
    if(team==='host'&&packet.type==='input'&&!reliable)mailbox.accept(packet.sequence,packet.frame,lastPacket);
    if(team==='host'&&packet.type==='action'&&reliable&&validAction(packet.action)&&validTargetId(packet.targetId)&&typeof packet.sequence==='number'&&Number.isSafeInteger(packet.sequence)&&packet.sequence>lastAction){lastAction=packet.sequence;sim.action(packet.action,'guest-player',packet.targetId);}
  }
  async function openTeam(role:'host'|'guest',inviteValue=get<HTMLInputElement>('exp-code').value){
    const cleanup=stopTeam();localReady=role==='host';signalingDone=helloReceived=false;team=role;epoch=0;sequence=0;lastAction=-1;remotePaused=false;const run=generation;
    show('exp-signin',false);show('exp-crew',false);
    if(role==='host')roomAddress();
    setScreen('lobby');show('exp-share',role==='host');show('exp-ready',false);show('exp-invite',false);text('exp-room-id','');text('exp-copy','Copy invite link');text('exp-lobby-role',role==='host'?'ROAD CREW / YOU ARE THE HOST':'ROAD CREW / YOU ARE JOINING');text('exp-lobby-title',role==='host'?'Invite your teammate.':'Joining your team.');text('exp-lobby-status',role==='host'?'Preparing your invite…':'Connecting to the room in your invite…');text('exp-ready','Ready to go');get<HTMLButtonElement>('exp-ready').disabled=true;get<HTMLButtonElement>('exp-copy').disabled=true;get<HTMLInputElement>('exp-invite').value='';
    const alive=()=>run===generation;
    try{
      await cleanup;if(!alive())return;
      const identity=await account.sessionIdentity();if(!alive())return;
      if(!account.profile)throw new Error('Load your profile before joining a team.');
      ownProfile={nickname:account.profile.nickname,skin:{...account.profile.skin}};
      const service=await connectRooms(identity);if(!alive())return;api=service;
      let offer='';
      if(role==='guest'){
        const value=inviteValue.trim();let roomCode=value;
        try{roomCode=new URL(value).searchParams.get('room')??value;}catch{/* A raw code is accepted too. */}
        if(!/^[a-f0-9]{20}$/.test(roomCode))throw new Error('Paste the complete invite link or its room code.');
        code=roomCode;roomAddress(code);text('exp-room-id',`ROOM ${code.slice(0,6)} · ${code.slice(-6)}`);const view=roomValue(await service.join(code));if(!alive()){void service.close(roomCode).catch(()=>{});return;}ownsRoom=true;if(view.sessionId[0]!==undefined)telemetry=new CoopTelemetry(service,view.sessionId[0]);
        const chosen=expeditionMaps.find(m=>m.id===view.mapKey.split(':')[0]);if(!chosen||await mapKey(chosen)!==view.mapKey)throw new Error('This invite was created with a different game or map version. Both players: reload the game. Host: create a new expedition and send the new invite.');
        if(!alive())return;map=chosen;offer=view.offer;
      }else code=newRoomCode();
      text('exp-room-id',`ROOM ${code.slice(0,6)} · ${code.slice(-6)}`);
      const selectedKey=await mapKey(map),configuration=await iceConfiguration();if(!alive())return;key=selectedKey;
      const connection=new Peer(configuration);peer=connection;reset();text('exp-map-name',map.name.toUpperCase());
      connection.onOpen=()=>{if(alive()){lastPacket=performance.now();connection.send({type:'hello',key,profile:ownProfile},true);}};
      connection.onPacket=(packet,reliable)=>{if(alive())receive(packet,reliable);};connection.onLost=message=>{if(alive())failed(message);};
      const roomCode=code;
      if(role==='host'){
        const sdp=await connection.offer();if(!alive())return;const created=roomValue(await service.create(roomCode,key,sdp));if(!alive()){void service.close(roomCode).catch(()=>{});return;}ownsRoom=true;if(created.sessionId[0]!==undefined)telemetry=new CoopTelemetry(service,created.sessionId[0]);
        const invite=new URL(location.href);invite.search=new URLSearchParams({mode:'expedition',room:roomCode}).toString();get<HTMLInputElement>('exp-invite').value=invite.href;get<HTMLButtonElement>('exp-copy').disabled=false;text('exp-lobby-status','Share the invite. Your teammate will join this room when they open it.');
        const deadline=performance.now()+600_000;
        while(alive()&&!connected&&performance.now()<deadline){const view=roomValue(await service.poll(roomCode));if(!alive())return;if(view.answer[0]){await connection.accept(view.answer[0]);break;}if(view.joined)text('exp-lobby-status','Your teammate opened the invite. Connecting…');await new Promise(resolve=>setTimeout(resolve,2000));}
        if(!alive())return;
        if(performance.now()>=deadline)throw new Error('The invite expired. Create another room.');
      }else{
        const answer=await connection.answer(offer);if(!alive())return;roomValue(await service.answer(roomCode,answer));if(!alive())return;text('exp-lobby-status','Connecting to your teammate…');
      }
      signalingDone=true;finishHandshake();
      setTimeout(()=>{if(alive()&&!connected)failed('Could not connect these networks. A TURN relay may be needed. Try the same Wi-Fi or configure the connection service.');},30_000);
    }catch(error){if(alive())failed(error instanceof Error?error.message:'Could not open the room.');}
  }
  selector.onchange=()=>{map=expeditionMaps.find(m=>m.id===selector.value)!;choose();};
  get('exp-explore').onclick=start;get('exp-restart').onclick=start;get('exp-again').onclick=start;
  get('exp-pause-button').onclick=()=>pause();input.onPause=()=>pause();
  get('exp-resume').onclick=resume;get('exp-leave').onclick=choose;get('exp-done').onclick=choose;get('exp-cancel').onclick=choose;
  get('exp-host').onclick=()=>requestTeam('host');get<HTMLFormElement>('exp-join-form').onsubmit=event=>{event.preventDefault();requestTeam('guest');};
  get('exp-signin').onclick=()=>void signInForTeam();
  account.onChange=accountStatus;
  get('account-toggle').onclick=()=>{
    if(team||account.busy)return;
    pause();show('account-feedback',false);
    if(pendingEntry){void signInForTeam();return;}
    if(account.signedIn){garage.open('garage',tracks[0]);return;}
    const run=generation;
    void account.signIn().then(()=>{if(run===generation&&account.signedIn&&!team&&!pendingEntry){show('account-feedback',false);garage.open('garage',tracks[0]);}});
  };
  get('exp-ready').onclick=()=>{if(!connected)return;if(team==='host'){if(remoteReady)start();return;}localReady=true;peer?.send({type:'ready'},true);lobbyStatus();};
  get('exp-copy').onclick=()=>{void navigator.clipboard.writeText(get<HTMLInputElement>('exp-invite').value).then(()=>text('exp-copy','Invite copied ✓')).catch(()=>{show('exp-invite',true);get<HTMLInputElement>('exp-invite').select();text('exp-copy','Select and copy the invite');});};
  get('music-toggle').onclick=()=>{void audio.start();audio.toggleMusic();text('music-toggle',audio.musicEnabled?'♫ Music on':'♫ Music off');get('music-toggle').setAttribute('aria-pressed',String(audio.musicEnabled));if(screen==='game')canvas.focus({preventScroll:true});};
  get('effects-toggle').onclick=()=>{void audio.start();audio.toggleEffects();text('effects-toggle',audio.effectsEnabled?'◖ Sound on':'◖ Sound off');get('effects-toggle').setAttribute('aria-pressed',String(audio.effectsEnabled));if(screen==='game')canvas.focus({preventScroll:true});};
  input.onAction=action=>{if(screen!=='game')return;const targetId=action==='interact'?current.interaction.target?.id:undefined;if(team==='guest')peer?.send({type:'action',epoch,sequence:++sequence,action,targetId},true);else sim.action(action,'local-player',targetId);};
  const indicator=new InteractionIndicator(get('exp-hud'),get('exp-prompt'),()=>{input.onAction('cycleTarget');canvas.focus({preventScroll:true});});
  document.addEventListener('visibilitychange',()=>{if(team)peer?.send({type:'visibility',hidden:document.hidden},true);if(document.hidden)pause();});
  window.addEventListener('pagehide',()=>peer?.close());
  choose();get<HTMLButtonElement>('exp-explore').disabled=false;text('exp-explore','Explore on your own');
  const restored=account.restore();
  if(incomingInvite!==null)requestTeam('guest',incomingInvite);
  void restored.then(()=>{if(pendingEntry)requestTeam(pendingEntry.role,pendingEntry.invite);});

  renderer.app.on('update',(elapsed:number)=>{
    const dt=Math.min(elapsed,config.physics.maxFrame),now=performance.now();let steps=0;
    if(connected&&now-lastHeartbeat>1000){lastHeartbeat=now;peer?.send({type:'heartbeat'});}
    if(connected&&screen==='game'&&now-lastPacket>networkConfig.stallMs)pause();
    if(team&&screen!=='menu'){get<HTMLButtonElement>('exp-restart').disabled=team==='guest';get<HTMLButtonElement>('exp-again').disabled=team==='guest';}else{get<HTMLButtonElement>('exp-restart').disabled=false;get<HTMLButtonElement>('exp-again').disabled=false;}
    let interpolation=1;
    if(screen==='game'){
      if(team==='guest'){
        if(now-lastSend>=networkConfig.snapshotInterval*1000){lastSend=now;peer?.send({type:'input',epoch,sequence:++sequence,frame:{...input.frame(),push:Boolean(input.frame().push)}});}
        const frame=buffer.sample(now);if(frame){previous=frame.previous;current=frame.current;interpolation=frame.alpha;}
      }else{
      accumulator+=dt;
      while(accumulator>=config.physics.step&&steps<config.physics.maxSteps){previous=current;sim.stepPlayers({'local-player':input.frame(),...(team==='host'?{'guest-player':mailbox.read(now)}:{})});current=sim.snapshot();accumulator-=config.physics.step;steps++;}
      if(steps===config.physics.maxSteps)accumulator=0;interpolation=accumulator/config.physics.step;
      if(team==='host'&&now-lastSend>=networkConfig.snapshotInterval*1000){lastSend=now;sendState();}
      }
      if(current.progress.finished){if(team==='host')sendState(true);text('exp-result',`${map.name} · ${formatTime(Math.round(current.progress.elapsed*1000))} · all modules in production`);setScreen('finish');get('exp-again').focus();}
    }
    renderer.draw(previous,current,screen==='game'?interpolation:1,input.yaw,input.pitch,screen==='menu',dt);audio.update(current,screen==='game',input.frame());
    indicator.update(current,p=>renderer.marker(p),screen==='game',touch.enabled);
    if((hudTime+=dt)<.08)return;hudTime=0;
    const kit=current.fieldKit!,carried=kit.items.find(item=>item.id===kit.carriedId);
    touch.update(current,screen==='game',ownPrompt());
    text('exp-timer',`${formatTime(Math.round(current.progress.elapsed*1000))} · EXPEDITION · UNSAVED`);
    text('exp-role',current.player.driving?'AT THE WHEEL':current.player.passenger?'PASSENGER':carried?`CARRYING ${carried.kind.toUpperCase()}`:kit.pushing?'PUSHING':'ROAD CREW');
    text('exp-systems',`${current.systems.loaded}/3 modules aboard${current.vehicle.parkingBrake?' · PARKED':''}`);
    text('exp-prompt',ownPrompt());text('exp-notice',team==='guest'?notice:sim.message);text('exp-speed',String(Math.round(current.vehicle.speed*3.6)));
    text('exp-controls',current.player.driving?'WASD drive · SPACE brake · P park · E get out':carried?'E / G place · Q / R rotate · WASD carry':'WASD walk · E interact · X next target · F cable · Q / R winch · B push · T mark');
  });
  if(import.meta.env.DEV)Object.defineProperty(window,'__expeditionDebug',{configurable:true,get:()=>({screen,mapId:map.id,team,roomCode:code,connected,snapshot:current as Snapshot})});
}

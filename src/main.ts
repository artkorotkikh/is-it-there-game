import './style.css';
import { tracks, type Track } from './game/tracks';
import { Account, formatTime, type DeliveryRun } from './services/account';
import { Garage } from './ui/garage';
import { masthead, modeSwitch } from './ui/masthead';
import { CargoLossNotice, cargoLossCopy } from './ui/cargo-loss';
import { GameAudio } from './game/audio';
import { config, moduleDefinitions } from './game/config';
import { Input } from './game/input';
import { TouchControls } from './game/touch-controls';
import { Renderer } from './game/renderer';
import { initPhysics, Simulation } from './game/simulation';
import { canisterTypes, type StartMode } from './game/types';

if(new URLSearchParams(location.search).get('mode')==='expedition') {
  void import('./expedition').then(({bootExpedition})=>bootExpedition()).catch(error=>{console.error(error);document.querySelector('#app')!.textContent='The expedition could not load. Reload to try again.';});
} else {
const app = document.querySelector<HTMLDivElement>('#app')!;
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
canvas.tabIndex = 0;
app.innerHTML = `
  <div class="vignette"></div>
  ${masthead()}
  <div id="account-feedback" class="account-feedback hidden" role="status" aria-live="polite"></div>
  <main id="menu" class="menu">
    ${modeSwitch('solo')}
    <div class="eyebrow"><span></span> THREE CANISTERS. ONE QUESTION.</div>
    <h1>IS IT<br><span class="title-line">THERE YET<span class="title-question">?</span></span></h1>
    <p class="intro">Meet Probably Works. An app on wheels.<br>Load its canisters. Try to ship it in one piece.</p>
    <div class="track-selector" role="group" aria-label="Choose a track">${tracks.map((track,i)=>`<button id="track-${track.id}" class="track-choice" aria-pressed="${i===0}" style="--track-accent:${track.palette.accent}"><span>${track.number} / ${track.difficulty}</span><strong>${track.name}</strong><small id="best-${track.id}">No saved time yet</small></button>`).join('')}</div>
    <p id="track-description" class="track-description">${tracks[0].description}</p>
    <div class="menu-actions"><button id="start" class="primary" disabled>Loading the app… <span>↗</span></button></div>
    <div class="menu-tools"><button id="open-garage" class="text-button">My garage ↗</button><button id="open-leaderboard" class="text-button">Leaderboard ↗</button></div>
    <p id="start-status" class="start-status" role="status"></p><button id="guest-start" class="text-button hidden">Play without saving</button>
    <p class="menu-note">Touch or keyboard + mouse.</p>
  </main>
  <div id="postcard" class="postcard"><span>DISPATCH NOTE / 001</span><strong>CANISTERS CARGO</strong><p>01 — WINCH<br>02 — CYCLES<br>03 — DRIVING SKILLS</p><p>Three canisters. One app.<br>Some assembly required.</p><div class="icp-stripe"></div></div>
  <footer id="menu-footer" class="menu-footer"><span>01 / THE ROAD TO THERE</span><span>POWERED BY ICP. HELD TOGETHER BY YOU.</span><span>↘ MIND THE BUMPS</span></footer>
  <section id="hud" class="hud hidden" aria-label="Game status">
    <div class="route-card"><span class="eyebrow"><span id="route-name">THE OLD ROAD</span><span id="route-number">01</span></span><strong id="objective">Load the bus.</strong><div class="route-progress"><i id="route-fill"></i></div><span id="objective-note">Three canisters. Three matching sockets.</span><span id="run-timer" class="run-timer">0:00.00 · GUEST RUN</span></div>
    <div class="module-rack" aria-label="Canister systems">${canisterTypes.map(type => `<div id="module-${type}" class="module-card" style="--module-color:${moduleDefinitions[type].color}"><span>${moduleDefinitions[type].number} / ${moduleDefinitions[type].symbol}</span><strong>${moduleDefinitions[type].label}</strong><small id="module-state-${type}">UNLOADED</small></div>`).join('')}</div>
    <div id="system-warning" class="system-warning hidden" role="status"><strong id="warning-title"></strong><span id="warning-detail"></span></div>
    <div id="cargo-loss" class="cargo-loss" role="status" aria-live="polite" aria-atomic="true" aria-hidden="true">
      <strong id="cargo-loss-title"></strong><p id="cargo-loss-detail"></p>
      <span id="cargo-loss-action"></span>
    </div>
    ${canisterTypes.map(type => `<div id="marker-${type}" class="cargo-marker hidden" style="--module-color:${moduleDefinitions[type].color}"><b>${moduleDefinitions[type].symbol}</b><span id="marker-label-${type}"></span></div>`).join('')}
    <div class="top-actions"><button id="pause-button" class="icon-button" aria-label="Pause game">Ⅱ</button></div>
    <div class="bottom-left"><span id="role" class="role-tag">ON FOOT</span><div id="prompt" class="interaction"></div><div class="hold-track hidden" id="hold-track"><i id="hold-fill"></i></div><div id="notice" class="notice" role="status" aria-live="polite"></div></div>
    <div class="dashboard"><div class="speed"><strong id="speed">0</strong><span>KM/H</span></div><div class="winch-status"><span>WINCH</span><strong id="winch-state">STOWED</strong><div class="tension-track"><i id="tension-fill"></i></div><span id="cable-length">Ready when you aren’t.</span></div></div>
    <div id="controls" class="controls"></div>
    <div id="brake-state" class="brake-state">P / PARKED</div>
  </section>
  <section id="pause" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="pause-title"><div class="pause-card"><span class="eyebrow">ROADSIDE BREAK</span><h2 id="pause-title">No hurry.<br>Well, a little.</h2><p>The drive is paused.</p><div class="pause-audio"><button id="pause-music" class="sound-button" aria-pressed="true">♫ Music on</button><button id="pause-effects" class="sound-button" aria-pressed="true">◖ Sound on</button></div><button id="resume" class="primary">Back to the road <span>↗</span></button><button id="restart" class="secondary">Start over</button><button id="recovery" class="text-button" disabled>Practice the winch · unsaved</button><button id="back-menu" class="text-button">Return to title</button></div></section>
  <section id="finish" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="finish-title"><div class="pause-card finish-card"><span class="eyebrow">PROBABLY WORKS / DELIVERY COMPLETE</span><h2 id="finish-title" tabindex="-1">YES.<br>WE GOT IT THERE.</h2><p>A few dents. A very long shortcut.<br>Your app made it to production. Somehow.</p><p id="finish-time"></p><p id="save-status" class="save-status" role="status"></p><div id="finish-join" class="hidden"><button id="finish-signin" class="primary">Sign in & join leaderboard <span>↗</span></button><p class="finish-sharing">Publishes your nickname, bus look and best times. Hide them anytime in My garage.</p></div><button id="finish-board" class="text-button hidden">View leaderboard ↗</button><button id="retry-save" class="text-button hidden">Retry saving</button><button id="next-track" class="primary">Next delivery <span>↗</span></button><button id="again" class="primary">Drive this track again <span>↗</span></button><button id="finish-menu" class="text-button">Choose a track</button><footer class="finish-credits"><p>Built with GPT Astra.<br>Deployed on OpenCloud.</p><p class="finish-invite">Want your own Cloud Engine?</p><a class="finish-cloud-link" href="https://opencloud.org/" target="_blank" rel="noopener noreferrer">Apply at OpenCloud.org <span aria-hidden="true">↗</span></a></footer></div></section>
  <pre id="debug" class="debug hidden"></pre>
  <div id="error" class="error hidden" role="alert"></div>
`;

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, visible: boolean) => get(id).classList.toggle('hidden', !visible);
const text = (id: string, value: string) => { if (get(id).textContent !== value) get(id).textContent = value; };

async function boot() {
  await initPhysics();
  const renderer = new Renderer(canvas);
  const account = new Account();
  void account.trackOpen();
  let selectedTrack: Track = tracks[0];
  let savedRun: DeliveryRun | null = null;
  let startGeneration = 0;
  let starting = false;
  let finishMs = 0;
  let savingRunId: bigint | null = null;
  let retryPublish = false;
  const audio = new GameAudio();
  const input = new Input(canvas);
  const touch = new TouchControls(input, app);
  const garage = new Garage(account,app,skin=>renderer.setSkin(skin));
  const cargoLoss = new CargoLossNotice();
  let simulation = new Simulation();
  // Let the suspension settle before showing the parked vehicle.
  for (let i = 0; i < 90; i++) simulation.step();
  let previous = simulation.snapshot();
  let current = previous;
  let screen: 'menu' | 'game' | 'pause' | 'finish' = 'menu';
  let startMode: StartMode = 'road';
  let accumulator = 0;
  let hudTimer = 0;
  let fpsTimer = 0;
  let frames = 0;
  let ticks = 0;
  let renderFps = 0;
  let physicsFps = 0;
  let noticeTime = 0;
  let lastMessage = '';

  const unlock = () => { if (document.pointerLockElement) document.exitPointerLock(); };
  const activate = () => { input.active = screen === 'game'; input.clear(); simulation.cancelInteractions(); touch.update(simulation.snapshot(),input.active); accumulator = 0; };
  function resetSimulation(mode: StartMode) {
    audio.reset();
    cargoLoss.reset();
    simulation.destroy();
    simulation = new Simulation(mode, selectedTrack);
    previous = current = simulation.snapshot();
    input.yaw = 0; input.pitch = .35;
    renderer.resetCamera();
  }
  function startReady(mode: StartMode) {
    void audio.start();
    resetSimulation(mode);
    startMode = mode;
    screen = 'game'; activate(); canvas.focus({preventScroll:true});
    show('menu',false); show('postcard',false); show('menu-footer',false); show('hud',true); show('pause',false); show('finish',false);
    show('retry-save',false); show('finish-join',false); show('finish-board',false); retryPublish=false; text('save-status',''); show('account-feedback',false);
    text('route-name',selectedTrack.name.toUpperCase()); text('route-number',selectedTrack.number);
    simulation.message = mode === 'recovery' ? 'Practice run. Modules loaded; take the cable from the front bumper.' : 'Three modules are behind the bus. E to pick up and install.';
    lastMessage=''; noticeTime=0;
  }
  function startButtons() {
    for (const id of ['start','recovery','restart','again','next-track']) get<HTMLButtonElement>(id).disabled=starting;
    for (const track of tracks) get<HTMLButtonElement>(`track-${track.id}`).disabled=starting;
  }
  async function start(mode: StartMode, guest=false) {
    // A saved restart must expose preparation/errors and the guest fallback,
    // which otherwise remain hidden behind the pause or finish overlay.
    if (!guest && mode==='road' && account.available && screen!=='menu') menu();
    const generation=++startGeneration;
    savedRun=null; starting=true; startButtons(); text('start-status',''); show('guest-start',false);
    if (!guest && mode==='road' && account.available) {
      text('start-status','Preparing your delivery…'); show('guest-start',true);
      try {
        const pending=account.prepareDelivery(selectedTrack);
        let timeout:ReturnType<typeof setTimeout>|undefined;
        const run=await Promise.race([pending,new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Online saving is taking too long. Retry or play without saving.')),8000);})]).finally(()=>clearTimeout(timeout));
        if (generation!==startGeneration) return;
        savedRun=run;
      } catch(error) {
        if(generation!==startGeneration) return;
        text('start-status',error instanceof Error ? error.message : 'Could not start a saved run. Try again or play without saving.');
        starting=false; startButtons(); return;
      }
    }
    if(generation!==startGeneration) return;
    starting=false; startButtons(); show('guest-start',false); startReady(mode);
  }
  function menu() {
    ++startGeneration; starting=false; savedRun=null; startButtons();
    resetSimulation('road'); for(let i=0;i<90;i++) simulation.step(); previous=current=simulation.snapshot();
    screen='menu'; activate(); unlock(); audio.pause();
    show('menu',true); show('postcard',true); show('menu-footer',true); show('hud',false); show('pause',false); show('finish',false);show('guest-start',false);
    text('start-status',''); get('start').focus();
  }
  function selectTrack(track: Track) {
    selectedTrack=track; renderer.setTrack(track);
    for(const item of tracks) get(`track-${item.id}`).setAttribute('aria-pressed',String(item.id===track.id));
    text('track-description',track.description);
    text('start',track.id==='old-road' ? 'Take the old road ↗' : `Drive ${track.name} ↗`);
    text('menu-footer',`${track.number} / ${track.name.toUpperCase()} · POWERED BY ICP. HELD TOGETHER BY YOU.`);
    menu();
  }
  function accountChanged() {
    get<HTMLButtonElement>('account-toggle').disabled=account.busy || !account.available;
    text('account-toggle',account.busy ? 'Connecting…' : account.principal ? `${account.profile?.nickname ?? 'My garage'} ↗` : touch.enabled ? 'Sign in' : 'Sign in · Internet Identity');
    text('account-feedback',account.message);
    show('account-feedback',account.available && Boolean(account.message) && screen !== 'game' && !garage.opened);
    for(const track of tracks) {const record=account.best(track); text(`best-${track.id}`,record ? `Best ${formatTime(Number(record.bestMs))}` : account.principal ? 'No completed delivery yet' : 'Sign in to keep your best');}
    garage.sync();
    finishActions();
  }
  account.onChange=accountChanged; accountChanged(); void account.restore();
  get('account-toggle').onclick=()=>{pause();unlock();if(account.principal)garage.open('garage',selectedTrack);else {const generation=startGeneration;void account.signIn().then(()=>{if(!account.principal || generation!==startGeneration)return;if(screen==='finish' && savedRun)void saveFinish();else garage.open('garage',selectedTrack);});}};
  get('open-garage').onclick=()=>{pause();unlock();garage.open('garage',selectedTrack);};
  get('open-leaderboard').onclick=()=>{pause();unlock();garage.open('leaderboard',selectedTrack);};
  for(const track of tracks) get(`track-${track.id}`).onclick=()=>selectTrack(track);
  get('guest-start').onclick=()=>void start('road',true);
  get('next-track').onclick=()=>{selectTrack(tracks[(tracks.indexOf(selectedTrack)+1)%tracks.length]);void start('road');};
  get('finish-menu').onclick=menu;
  function finishActions() {
    const ready=screen==='finish' && startMode==='road' && Boolean(savedRun);
    const listed=Boolean(savedRun?.saved && account.profile?.listed && savedRun.owner===account.principal);
    show('finish-join',ready && !listed);
    show('finish-board',ready && listed);
    text('finish-signin',account.busy ? 'Connecting…' : savingRunId!==null ? 'Saving…' : account.principal ? 'Join leaderboard ↗' : 'Sign in & join leaderboard ↗');
    get<HTMLButtonElement>('finish-signin').disabled=account.busy || savingRunId!==null;
  }
  async function saveFinish(publish=false) {
    if(!savedRun || savingRunId!==null || !account.principal) return;
    const run=savedRun, generation=startGeneration, elapsed=finishMs;
    savingRunId=run.ticket.id; retryPublish=publish; show('retry-save',false); text('save-status','Saving your delivery…'); finishActions();
    try {
      const receipt=await account.claimDelivery(run,elapsed,publish);
      if(generation===startGeneration && screen==='finish') text('save-status',`${receipt.newBest ? 'New personal best! ' : 'Delivery saved. '}Best ${formatTime(Number(receipt.record.bestMs))} · ${receipt.record.completions} deliveries${account.profile?.listed ? ' · Leaderboard enabled.' : ' · Saved privately.'}`);
    } catch(error) {
      if(generation===startGeneration && screen==='finish') {text('save-status',error instanceof Error ? error.message : 'Could not save. Your time is still here; retry when connected.');show('retry-save',true);}
    } finally {if(savingRunId===run.ticket.id) savingRunId=null;finishActions();}
  }
  get('retry-save').onclick=()=>void saveFinish(retryPublish);
  get('finish-board').onclick=()=>garage.open('leaderboard',selectedTrack);
  get('finish-signin').onclick=()=>{
    const generation=startGeneration;
    // Invoke II inside this gesture; wait for the pending finish only after sign-in.
    const login=account.principal ? Promise.resolve() : account.signIn();
    void login.then(()=>{
      if(generation!==startGeneration || screen!=='finish') return;
      if(account.principal) void saveFinish(true);
      else text('save-status',`${account.message} Your time is still here; try again.`);
    });
  };
  function pause() {
    if (screen !== 'game') return;
    screen = 'pause'; activate(); unlock(); audio.pause(); show('pause', true); get('resume').focus();
  }
  function resume() {
    if (screen !== 'pause') return;
    screen = 'game'; activate(); void audio.start(); show('pause', false); canvas.focus({ preventScroll: true });
  }
  input.onAction = action => { if (screen === 'game') simulation.action(action); };
  input.onPause = pause;
  input.onDebug = () => get('debug').classList.toggle('hidden');
  get('start').onclick = () => start('road');
  get('recovery').onclick = () => start('recovery');
  get('pause-button').onclick = pause;
  get('music-toggle').onclick = () => {
    void audio.start(); audio.toggleMusic();
    text('music-toggle', audio.musicEnabled ? '♫ Music on' : '♫ Music off');
    get('music-toggle').setAttribute('aria-pressed', String(audio.musicEnabled));
    text('pause-music',audio.musicEnabled ? '♫ Music on' : '♫ Music off');get('pause-music').setAttribute('aria-pressed',String(audio.musicEnabled));
    if (screen === 'game') canvas.focus({ preventScroll: true });
  };
  get('effects-toggle').onclick = () => {
    void audio.start(); audio.toggleEffects();
    text('effects-toggle', audio.effectsEnabled ? '◖ Sound on' : '◖ Sound off');
    get('effects-toggle').setAttribute('aria-pressed', String(audio.effectsEnabled));
    text('pause-effects',audio.effectsEnabled ? '◖ Sound on' : '◖ Sound off');get('pause-effects').setAttribute('aria-pressed',String(audio.effectsEnabled));
    if (screen === 'game') canvas.focus({ preventScroll: true });
  };
  get('pause-music').onclick=()=>get('music-toggle').click();
  get('pause-effects').onclick=()=>get('effects-toggle').click();
  get('resume').onclick = resume;
  get('restart').onclick = () => start(startMode);
  get('again').onclick = () => start('road');
  get('back-menu').onclick = menu;
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  get<HTMLButtonElement>('start').disabled = false;
  get<HTMLButtonElement>('recovery').disabled = false;
  get('start').innerHTML = 'Take the old road <span>↗</span>';

  renderer.app.on('update', (elapsed: number) => {
    const dt = Math.min(elapsed, config.physics.maxFrame);
    let steps = 0;
    if (screen === 'game') {
      accumulator += dt;
      while (accumulator >= config.physics.step && steps < config.physics.maxSteps) {
        previous = current;
        simulation.step(input.frame());
        current = simulation.snapshot();
        cargoLoss.advance(current, config.physics.step);
        accumulator -= config.physics.step;
        steps++; ticks++;
      }
      if (steps === config.physics.maxSteps) accumulator = 0;
      if (current.progress.finished) {
        screen = 'finish'; activate(); unlock(); show('finish', true);
        finishMs=Math.round(current.progress.elapsed*1000);
        text('finish-time',`${selectedTrack.name} · ${formatTime(finishMs)}`);
        text('save-status', startMode==='recovery' ? 'Practice complete. Full deliveries count toward personal bests.' : savedRun ? 'Keep this delivery. Sign in to save your time and join the leaderboard.' : 'Offline delivery. Online saving was unavailable for this run.');
        if(savedRun) void account.completeDelivery(savedRun,finishMs).catch(()=>{ /* Saving offers an explicit idempotent retry. */ });
        finishActions();
        text('next-track',tracks.indexOf(selectedTrack)<tracks.length-1 ? 'Next delivery ↗' : 'Back to the old road ↗');
        void saveFinish();
        get('finish').scrollTop=0; get('finish-title').focus({preventScroll:true});
      }
    }
    renderer.draw(previous, current, screen === 'game' ? accumulator / config.physics.step : 1, input.yaw, input.pitch, screen === 'menu', dt);
    const lossVisible = screen === 'game' && cargoLoss.event !== null;
    show('cargo-loss', screen === 'game');
    get('cargo-loss').classList.toggle('is-visible', lossVisible);
    get('cargo-loss').setAttribute('aria-hidden', String(!lossVisible));
    if (cargoLoss.event) {
      const type = cargoLoss.event.type, copy = cargoLossCopy[type];
      get('cargo-loss').dataset.type = type;
      text('cargo-loss-title', copy.title); text('cargo-loss-detail', copy.detail); text('cargo-loss-action', copy.action);
      const appearance = cargoLoss.appearance;
      get('cargo-loss').style.setProperty('--loss-opacity', String(appearance.opacity));
      get('cargo-loss').style.setProperty('--loss-scale', String(appearance.scale));
    }
    for (const item of current.canisters) {
      const visible = screen === 'game' && item.phase === 'loose';
      show(`marker-${item.type}`, visible);
      if (!visible) continue;
      const point = renderer.marker(item.position);
      const margin = touch.enabled ? 38 : 55;
      const x = Math.max(margin, Math.min(window.innerWidth - margin, point.behind ? window.innerWidth - point.x : point.x));
      const minY = touch.enabled ? 132 : 245;
      const maxY = Math.max(minY,window.innerHeight - (touch.enabled ? 190 : 200));
      const y = Math.max(minY, Math.min(maxY, point.behind ? maxY : point.y));
      get(`marker-${item.type}`).style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      const distance = Math.hypot(item.position.x - current.player.position.x, item.position.z - current.player.position.z);
      text(`marker-label-${item.type}`, `${moduleDefinitions[item.type].label} · ${Math.round(distance)} m`);
    }
    audio.update(current, screen === 'game', input.frame());
    fpsTimer += elapsed; frames++;
    if (fpsTimer >= 0.5) { renderFps = Math.round(frames / fpsTimer); physicsFps = Math.round(ticks / fpsTimer); frames = 0; ticks = 0; fpsTimer = 0; }
    hudTimer += dt; noticeTime += dt;
    if (simulation.message !== lastMessage) { lastMessage = simulation.message; noticeTime = 0; }
    if (hudTimer < 0.08) return;
    hudTimer = 0;
    touch.update(current,screen==='game',simulation.prompt());
    text('run-timer',`${formatTime(Math.round(current.progress.elapsed*1000))} · ${startMode==='recovery' ? 'PRACTICE' : savedRun ? 'PERSONAL BEST RUN' : 'GUEST RUN'}`);
    text('speed', Math.round(current.vehicle.speed * 3.6).toString());
    const carried = current.canisters.find(item => item.phase === 'carried');
    text('role', current.player.driving ? 'AT THE WHEEL' : carried ? `CARRYING ${moduleDefinitions[carried.type].label}` : current.winch.phase === 'carried' ? 'CABLE IN HAND' : 'ON FOOT');
    text('prompt', touch.enabled ? simulation.prompt().replace(/Hold E · Kick the bus upright/g,'Hold KICK to right the bus').replace(/Hold E · Remove/g,'Hold Remove ·').replace(/[EF] · /g,'').replace(/(?:Hold )?Q · (?:Reel in|Pull)\s+R · (?:Pay out|Give slack)(?:\s+(?:F · )?Detach)?/g,'Reel in / Pay out · Detach') : simulation.prompt());
    text('notice', !lossVisible && noticeTime < 7 ? lastMessage : '');
    text('winch-state', !current.systems.winch ? 'MOTOR OFFLINE' : current.winch.phase === 'attached' ? current.winch.length - current.winch.span > 0.1 ? 'SLACK' : current.winch.tension > 250 ? 'TAUT' : 'ATTACHED' : current.winch.phase.toUpperCase());
    text('cable-length', current.winch.phase === 'attached' ? `${current.winch.length.toFixed(1)} m · ${(current.winch.tension / 1000).toFixed(1)} kN` : current.winch.phase === 'carried' ? 'Find a marked tree.' : 'Ready when you aren’t.');
    get('tension-fill').style.width = `${current.winch.tension / config.winch.maxForce * 100}%`;
    get('route-fill').style.width = `${Math.max(0, Math.min(100, current.vehicle.position.z / selectedTrack.finishZ * 100))}%`;
    const optionalWinch = selectedTrack.winchOptional && current.winch.phase === 'stowed';
    text('objective', !current.systems.startupCompleted ? `Load the bus · ${current.systems.loaded}/3` : current.progress.recovered ? current.systems.loaded < 3 ? 'Bring every module home.' : 'Get the app over the line.' : current.progress.enteredDitch ? optionalWinch ? 'Easy up the slope.' : 'A little help from that tree.' : current.player.driving ? 'Mind the bumps.' : 'All systems online. Get in.');
    text('objective-note', !current.systems.startupCompleted ? 'Pick up · Match the rear socket · Install' : !current.systems.winch ? 'Bring WINCH back to its rear socket.' : current.progress.recovered ? 'A few more bumps. Keep it together.' : current.progress.enteredDitch ? optionalWinch ? 'Drive up gently. The winch can help if you get stuck.' : 'Take cable · Attach at tree · Reel in' : 'Slow down to keep your modules aboard.');
    for (const item of current.canisters) {
      get(`module-${item.type}`).dataset.state = item.phase;
      text(`module-state-${item.type}`, item.phase === 'docked' ? 'ONLINE' : item.phase === 'carried' ? 'CARRIED' : current.systems.startupCompleted ? item.type === 'skills' ? touch.enabled ? 'REVERSED' : 'W↔S · A↔D' : 'OFFLINE' : 'UNLOADED');
    }
    const warning = current.systems.startupCompleted && current.systems.loaded < 3;
    show('system-warning', warning && !lossVisible);
    const swapped = current.systems.startupCompleted && current.systems.skills === 'swapped';
    text('warning-title', !current.systems.engine ? 'CYCLES DISCONNECTED' : swapped ? 'DRIVING SKILLS UNLOADED' : 'WINCH OFFLINE');
    text('warning-detail', !current.systems.engine ? 'No engine power. Brake, collect, reconnect.' : swapped ? `${current.systems.driveInputArmed ? '' : 'Release all controls. '}${touch.enabled ? 'Forward/back + left/right reversed.' : 'W → reverse · S → forward · A → right · D → left'}` : 'The cable holds. Reconnect the motor to reel.');
    const hold=Math.max(current.interaction.hold,current.recovery.charge);
    show('hold-track', hold > 0);
    get('hold-fill').style.width = `${Math.min(100, hold * 100)}%`;
    show('brake-state', current.vehicle.parkingBrake);
    text('brake-state', current.player.driving ? 'P / PARKING BRAKE ON' : 'PARKED');
    const controls = current.player.driving
      ? `<span class="${swapped ? 'swapped' : ''}"><kbd>${swapped ? 'S W' : 'W S'}</kbd> ${swapped ? 'Forward / reverse ↔' : 'Throttle / reverse'}</span><span class="${swapped ? 'swapped' : ''}"><kbd>${swapped ? 'D A' : 'A D'}</kbd> Steer</span><span><kbd>SPACE</kbd> Brake</span><span><kbd>P</kbd> Park</span><span><kbd>E</kbd> Get out</span>${current.winch.phase === 'attached' ? '<span><kbd>Q R</kbd> Reel</span><span><kbd>F</kbd> Detach</span>' : '<span>Drag to look</span>'}`
      : `<span><kbd>W A S D</kbd> Walk</span><span><kbd>E</kbd> Pick up / install</span><span><kbd>G</kbd> Set down</span><span><kbd>F</kbd> Cable</span><span><kbd>Q R</kbd> Reel</span><span><kbd>P</kbd> Park</span><span>Drag to look</span>`;
    if (get('controls').innerHTML !== controls) get('controls').innerHTML = controls;
    text('debug', `LOCAL · physics prototype\nPeers / RTT / snapshots: unavailable\nPhysics ${physicsFps} Hz · Render ${renderFps} FPS\nTick ${current.tick}\nRV ${current.vehicle.position.x.toFixed(2)}, ${current.vehicle.position.y.toFixed(2)}, ${current.vehicle.position.z.toFixed(2)}\nWinch ${current.winch.phase} · ${Math.round(current.winch.tension)} N\nDitch ${current.progress.enteredDitch} · Recovered ${current.progress.recovered}\nBackquote to hide`);
  });

  // Read-only local diagnostics for browser QA; never expose simulation mutation.
  if (import.meta.env.DEV) Object.defineProperty(window, '__rvDebug', { configurable: true, get: () => ({ screen, snapshot: simulation.snapshot(), renderFps, physicsFps, audio: audio.debug() }) });
}

boot().catch(error => {
  console.error(error);
  show('error', true);
  text('error', 'The camper could not start. This preview needs WebGL2 and a current browser. Reload to try again.');
  get('start').textContent = 'Could not load';
});
}

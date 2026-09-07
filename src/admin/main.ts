import './style.css';
import { AuthClient } from '@icp-sdk/auth/client';
import { Actor, HttpAgent, type Identity } from '@icp-sdk/core/agent';
import { safeGetCanisterEnv } from '@icp-sdk/core/agent/canister-env';
import { popupFeatures, signInWithPopup } from '../services/auth-popup';
import { signInOptions } from '../services/auth-options';
import type { Statistics } from '../services/records-api';
import { roomsIdl, type CoopAdminApi, type CoopStatistics } from '../services/rooms-api';
import { coopStatisticsCsv } from './statistics';
import { adminIdl, type AdminApi } from './api';
import { count, courseNames, currentRules, ratio, statisticsCsv, timestamp, totals } from './statistics';

// This origin has its own II account identity; no game profile creation or event writes.
const auth = new AuthClient({identityProvider:'https://id.ai/authorize', windowOpenerFeatures:popupFeatures, idleOptions:{disableIdle:true}});
const env = safeGetCanisterEnv();
let api: AdminApi | undefined;
let coopApi:CoopAdminApi|undefined;
let coopSnapshot:CoopStatistics|undefined;
let principal = '';
let snapshot: Statistics | undefined;
let fetchedAt: Date | undefined;
let generation = 0;
let busy = false;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><a class="brand" href="https://isitthereyet.nano-tema--0v1.opencloud.org/" target="_blank" rel="noopener noreferrer">IS IT THERE YET? <span>↗</span></a><span class="tag">Game management</span><button id="logout" hidden>Sign out</button></header>
  <main>
    <div class="heading"><div><p class="eyebrow">ACTIVITY OVERVIEW</p><h1>Game statistics</h1></div><div class="actions"><button id="refresh" hidden>Refresh</button><button id="export" hidden>Download CSV</button></div></div>
    <p id="message" role="status" aria-live="polite"></p>
    <section id="access" class="panel access"><span class="badge">Owner access</span><h2>Sign in to view statistics</h2><p>Use Internet Identity. Only accounts with viewing access can read these statistics.</p><button class="primary" id="login">Sign in with Internet Identity</button><div id="account" hidden><label for="principal">Your dashboard account ID</label><div class="identity"><input id="principal" readonly /><button id="copy">Copy</button></div><p id="access-help">For first-time access, send this ID to the Cloud Engine owner. Once access is granted, select Refresh.</p></div></section>
    <section id="dashboard" hidden aria-label="Game metrics">
      <div class="period"><span id="since"></span><span id="updated"></span></div>
      <div class="metrics">
        <article class="metric"><p>Game opens</p><strong id="opens"></strong><small>Page loads, including repeat visits</small></article>
        <article class="metric"><p>Delivery starts</p><strong id="starts"></strong><small>Solo runs accepted by the server</small></article>
        <article class="metric"><p>Finishes</p><strong id="finishes"></strong><small id="finish-ratio"></small></article>
        <article class="metric"><p>Saves</p><strong id="saved"></strong><small id="save-ratio"></small></article>
      </div>
      <section id="coop" aria-label="Co-op statistics"><div class="section-title"><h2>Co-op sessions</h2><button id="coop-export" hidden>Download co-op CSV</button></div><p id="coop-status" role="status"></p><p id="coop-since" class="period"></p><div id="coop-metrics" class="metrics" hidden>
        <article class="metric"><p>Rooms created</p><strong id="coop-roomsCreated"></strong><small>Accepted new invitations, excluding retries</small></article>
        <article class="metric"><p>Guests joined</p><strong id="coop-guestsJoined"></strong><small>Rooms whose guest seat was claimed</small></article>
        <article class="metric"><p>Teams connected</p><strong id="coop-pairsConnected"></strong><small>Both players confirmed their connection</small></article>
        <article class="metric"><p>Expeditions started</p><strong id="coop-expeditionsStarted"></strong><small>Both players entered a game; once per room</small></article>
      </div></section>
      <section class="panel courses"><div class="section-title"><h2>Solo courses</h2><span>All rules versions</span></div><div class="table-scroll" tabindex="0" role="region" aria-label="Statistics by course"><table><thead><tr><th scope="col">Course</th><th scope="col">Starts</th><th scope="col">Finishes</th><th scope="col">Saves</th><th scope="col">Finishes / starts</th><th scope="col">Saves / finishes</th></tr></thead><tbody id="courses"></tbody></table></div><p id="empty" hidden>No delivery starts have been recorded since collection began.</p></section>
      <div class="notes"><section><h2>What the numbers mean</h2><p>These are cumulative events, not unique players. One player can open the game or finish a course several times. A save is the first successful transfer of a result to an account.</p><p>Ratios use aggregate counters; they do not track individual player journeys. Offline runs and events that were not sent are excluded.</p></section><section><h2>Co-op and history</h2><p>Co-op counts begin at the separate collection date shown above. These are rooms and teams, not unique people. Restarts within one room do not add another start. Connections and starts require both clients to report; offline or failed reports may be missing. No earlier sessions, daily breakdowns or player relationship history are available.</p></section></div>
    </section>
    <footer>IS IT THERE YET? <span>Statistics · 0.2.0</span></footer>
  </main>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const message = (text: string) => {el('message').textContent = text;};
const date = (value: Date) => value.toLocaleString('en-US', {dateStyle:'medium',timeStyle:'short'});
function controls() {
  el('logout').hidden = !principal;
  el('refresh').hidden = !principal;
  el<HTMLButtonElement>('refresh').disabled = busy;
  el<HTMLButtonElement>('login').disabled = busy || !env?.['PUBLIC_CANISTER_ID:records'];
  el('login').hidden = Boolean(principal);
  el('account').hidden = !principal;
  el<HTMLInputElement>('principal').value = principal;
  el('export').hidden = !snapshot;
}
function clearData() {
  snapshot = undefined; fetchedAt = undefined; coopSnapshot=undefined;
  el('coop-metrics').hidden=true;el('coop-export').hidden=true;el('coop-status').textContent='';el('coop-since').textContent='';
  for(const key of ['roomsCreated','guestsJoined','pairsConnected','expeditionsStarted'])el(`coop-${key}`).textContent='';
  el('dashboard').hidden = true; el('access').hidden = false;
  for (const id of ['opens','starts','finishes','saved','courses','since','updated','finish-ratio','save-ratio']) el(id).replaceChildren();
  controls();
}
function show(data: Statistics) {
  snapshot = data; fetchedAt = new Date();
  const sum = totals(data);
  el('opens').textContent = count(data.opens);
  for (const key of ['starts','finishes','saved'] as const) el(key).textContent = count(sum[key]);
  el('finish-ratio').textContent = `${ratio(sum.finishes,sum.starts)} of starts`;
  el('save-ratio').textContent = `${ratio(sum.saved,sum.finishes)} of finishes`;
  el('since').textContent = `Collecting since ${date(timestamp(data.since))}`;
  el('updated').textContent = `Updated ${date(fetchedAt)}`;
  el('courses').replaceChildren();
  const rows = [...data.courses].sort((a,b)=>a.track.localeCompare(b.track) || (a.rulesVersion > b.rulesVersion ? -1 : a.rulesVersion < b.rulesVersion ? 1 : 0));
  for (const row of rows) {
    const tr = document.createElement('tr');
    const title = document.createElement('th'); title.scope = 'row';
    title.textContent = courseNames[row.track] ?? row.track;
    const version = document.createElement('small');
    version.textContent = `Rules v${row.rulesVersion} · ${currentRules[row.track] === row.rulesVersion ? 'current' : 'historical'}`;
    title.append(version); tr.append(title);
    for (const value of [count(row.starts),count(row.finishes),count(row.saved),ratio(row.finishes,row.starts),ratio(row.saved,row.finishes)]) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    el('courses').append(tr);
  }
  el('empty').hidden = rows.length > 0;
  el('dashboard').hidden = false; el('access').hidden = true; controls();
}
async function queryWithTimeout<T>(query:()=>Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {return await Promise.race([query(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),15000);})]);}
  finally {clearTimeout(timer);}
}
async function refresh() {
  if (!api || busy) return;
  if (!auth.isAuthenticated()) {expire();return;}
  const request = ++generation;
  busy = true; clearData(); message('Loading statistics…');
  try {
    const [solo,coop]=await Promise.allSettled([queryWithTimeout(()=>api!.adminStatistics()),queryWithTimeout(()=>coopApi?coopApi.adminStatistics():Promise.reject(new Error('Co-op statistics unavailable')))]);
    if(solo.status==='rejected')throw solo.reason;
    const result=solo.value;
    if (request !== generation) return;
    if (!auth.isAuthenticated()) {expire();return;}
    if ('err' in result) message('This account does not have statistics access yet.');
    else {
      show(result.ok);message('');
      if(coop.status==='fulfilled'&&'ok' in coop.value){
        coopSnapshot=coop.value.ok;el('coop-metrics').hidden=false;el('coop-export').hidden=false;
        for(const key of ['roomsCreated','guestsJoined','pairsConnected','expeditionsStarted'] as const)el(`coop-${key}`).textContent=count(coopSnapshot[key]);
        el('coop-since').textContent=`Collecting since ${date(timestamp(coopSnapshot.since))}`;
        el('coop-status').textContent=coopSnapshot.sessionsEvicted>0n?`${count(coopSnapshot.sessionsEvicted)} reporting windows were removed at capacity. Connection/start totals may be incomplete.`:'';
      }else el('coop-status').textContent=coop.status==='fulfilled'?'Co-op statistics access has not been granted to this dashboard account.':'Co-op statistics are unavailable. Select Refresh to retry; solo data is shown above.';
    }
  } catch {if (request === generation) message('Could not load statistics. Check your connection and select Refresh.');}
  finally {if (request === generation) {busy=false;controls();}}
}
async function useIdentity(identity: Identity) {
  if (identity.getPrincipal().isAnonymous() || !auth.isAuthenticated()) return;
  const request = ++generation;
  principal = identity.getPrincipal().toText(); controls();
  const agent = await HttpAgent.create({identity,host:location.origin,rootKey:env!.IC_ROOT_KEY});
  if (request !== generation) return;
  api = Actor.createActor<AdminApi>(adminIdl,{agent,canisterId:env!['PUBLIC_CANISTER_ID:records']!});
  coopApi=env?.['PUBLIC_CANISTER_ID:rooms']?Actor.createActor<CoopAdminApi>(roomsIdl,{agent,canisterId:env['PUBLIC_CANISTER_ID:rooms']}):undefined;
  busy = false; await refresh();
}
function expire() {
  ++generation; principal=''; api=undefined;coopApi=undefined; busy=false; clearData();
  message('Your session has expired. Sign in again.');
}
el('login').onclick = async () => {
  if (busy) return;
  busy = true; controls(); message('Complete sign-in in the Internet Identity window.');
  try {await useIdentity(await signInWithPopup(()=>auth.signIn(signInOptions),()=>auth.isAuthenticated()));}
  catch {message('Sign-in did not complete. Allow the popup and try again.');}
  finally {busy=false;controls();}
};
el('logout').onclick = async () => {
  ++generation; principal='';api=undefined;coopApi=undefined;busy=true;clearData();message('Signing out…');
  try {await auth.signOut();message('You have signed out.');}
  catch {message('Data is hidden, but sign-out failed. Close the dashboard and clear site data.');}
  finally {busy=false;controls();}
};
el('refresh').onclick = () => {void refresh();};
el('copy').onclick = async () => {
  try {await navigator.clipboard.writeText(principal);message('Account ID copied.');}
  catch {el<HTMLInputElement>('principal').select();message('Copy the selected account ID.');}
};
el('export').onclick = () => {
  if (!auth.isAuthenticated()) {expire();return;}
  if (!snapshot || !fetchedAt) return;
  const url = URL.createObjectURL(new Blob([statisticsCsv(snapshot,fetchedAt)],{type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url;link.download=`game-statistics-${fetchedAt.toISOString().slice(0,10)}.csv`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
el('coop-export').onclick=()=>{
  if(!auth.isAuthenticated()){expire();return;}
  if(!coopSnapshot||!fetchedAt)return;
  const url=URL.createObjectURL(new Blob([coopStatisticsCsv(coopSnapshot,fetchedAt)],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='coop-statistics.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
setInterval(()=>{if(principal && !auth.isAuthenticated()) expire();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden && principal && !auth.isAuthenticated()) expire();});
controls();
if (!env?.['PUBLIC_CANISTER_ID:records']) message('The dashboard is not connected to game statistics. Open the published dashboard address.');
else {
  busy = true; controls(); message('Checking sign-in…');
  void auth.getIdentity().then(async identity=>{if(auth.isAuthenticated()) await useIdentity(identity);else message('');})
    .catch(()=>message('Could not restore your session. Try signing in again.'))
    .finally(()=>{busy=false;controls();});
}

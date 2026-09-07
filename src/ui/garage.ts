import { Account, formatTime } from '../services/account';
import type { DriverProfile } from '../services/records-api';
import { defaultSkin, paintColors, wheelStyles, decalStyles, paintFor, decalFor, type BusSkin } from '../game/skin';
import { tracks, type Track } from '../game/tracks';

type Tab = 'garage' | 'records' | 'leaderboard';
/** A lightweight visual assembly guide; the same cosmetic IDs drive the real 3D bus. */
export function skinPreview(skin:BusSkin) {
  const paint=paintFor(skin),decal=decalFor(skin);
  const wheel=(x:number)=>`<circle cx="${x}" cy="132" r="23" fill="#283d36"/><circle cx="${x}" cy="132" r="${skin.wheels==='whitewall'?18:13}" fill="${skin.wheels==='rally'?'#bb8753':skin.wheels==='whitewall'?'#efe6cc':'#b3b6a0'}"/><circle cx="${x}" cy="132" r="${skin.wheels==='whitewall'?11:5}" fill="#40584b"/>${skin.wheels==='rally'?Array.from({length:5},(_,i)=>`<circle cx="${x+Math.sin(i*Math.PI*2/5)*8}" cy="${132+Math.cos(i*Math.PI*2/5)*8}" r="2" fill="#283d36"/>`).join(''):''}`;
  // Everything interpolated here comes from fixed, validated catalogs; no nickname markup.
  return `<svg viewBox="0 0 360 170" role="img" aria-label="${paint.name} bus, ${wheelStyles.find(w=>w.id===skin.wheels)?.name}, ${decal.name} stickers"><ellipse cx="180" cy="148" rx="159" ry="10" fill="#122d2725"/><path d="M31 123V38Q31 28 43 28H287L327 66V123Z" fill="${paint.hex}"/><path d="M31 109H327V129H31Z" fill="#70866b"/><path d="M268 39H285L311 69H268Z" fill="#2f4e48"/><rect x="216" y="39" width="42" height="32" rx="3" fill="#2f4e48"/><rect x="50" y="47" width="150" height="58" rx="3" fill="#284641"/><path d="M50 55H200" stroke="#d7cfaf" stroke-width="9"/><text x="125" y="77" fill="#f0e3bc" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="${skin.decal==='404'?22:13}">${decal.title}</text><text x="125" y="93" fill="#d6dbbe" text-anchor="middle" font-family="Arial,sans-serif" font-size="8">${decal.subtitle}</text><rect x="232" y="83" width="18" height="4" rx="2" fill="#4d6758"/><rect x="315" y="94" width="15" height="10" fill="#f5d896"/><path d="M219 98L225 94M291 91L298 87" stroke="#83745c" stroke-width="3"/>${wheel(83)}${wheel(278)}</svg>`;
}

export class Garage {
  private root:HTMLElement;
  private tab:Tab='garage';
  private track:Track=tracks[0];
  private lastProfile:DriverProfile|null=null;
  private lastRecords:Account['records']=[];
  private draft:DriverProfile={nickname:'',skin:{...defaultSkin},listed:false};
  private boardGeneration=0;
  private returnFocus:HTMLElement|null=null;
  private inertBefore=new Map<HTMLElement,boolean>();
  private savedOwner='';
  constructor(private account:Account,host:HTMLElement,private preview:(skin:BusSkin)=>void) {
    this.root=document.createElement('section');this.root.id='account-panel';this.root.className='overlay community-overlay hidden';
    this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-labelledby','garage-title');
    this.root.innerHTML=`<div class="community-card"><header class="community-header"><div><span class="eyebrow">ROADSIDE CLUB</span><h2 id="garage-title">Your garage.</h2></div><button id="close-account" class="garage-close" aria-label="Close profile">×</button></header>
      <div class="community-tabs" role="tablist" aria-label="Driver club"><button id="tab-garage" role="tab" aria-controls="pane-garage">Garage</button><button id="tab-records" role="tab" aria-controls="pane-records">My times</button><button id="tab-leaderboard" role="tab" aria-controls="pane-leaderboard">Leaderboard</button></div>
      <section id="pane-garage" role="tabpanel" aria-labelledby="tab-garage"><div id="skin-preview" class="skin-preview"></div><p class="garage-caption">Three choices. Questionable taste. Your bus.</p>
        <p id="profile-unavailable" class="club-note"></p><button id="garage-signin" class="secondary hidden">Sign in · Internet Identity</button>
        <form id="profile-form"><fieldset id="profile-fields"><label class="field-label" for="nickname">Driver nickname</label><input id="nickname" name="nickname" autocomplete="nickname" minlength="3" maxlength="24" required aria-describedby="nickname-help"><small id="nickname-help">3–24 letters, numbers, spaces, - or _. Nicknames aren’t unique.</small>
        <div class="garage-choice"><span class="field-label" id="paint-label">01 / Paint</span><div class="paint-options" role="group" aria-labelledby="paint-label">${paintColors.map(p=>`<button type="button" data-color="${p.id}" aria-label="${p.name}" title="${p.name}" style="--paint:${p.hex}"><i></i><span class="paint-check" aria-hidden="true">✓</span></button>`).join('')}</div><small id="paint-name"></small></div>
        <div class="garage-choice"><span class="field-label" id="wheels-label">02 / Wheels</span><div class="skin-options" role="group" aria-labelledby="wheels-label">${wheelStyles.map(w=>`<button type="button" data-wheels="${w.id}">${w.name}</button>`).join('')}</div></div>
        <div class="garage-choice"><span class="field-label" id="decal-label">03 / Stickers</span><div class="skin-options" role="group" aria-labelledby="decal-label">${decalStyles.map(d=>`<button type="button" data-decal="${d.id}">${d.name}</button>`).join('')}</div></div>
        <label class="listing-toggle"><input id="profile-listed" type="checkbox"><span>Show my times on the leaderboard<small>Publishes your nickname, bus look and current-course bests. Switch off to hide them again.</small></span></label>
        <button id="save-profile" class="primary" type="submit">Save profile <span>↗</span></button></fieldset></form><p class="club-note">Looks only. Same engine, same loose cargo. Your saved garage follows your Internet Identity.</p></section>
      <section id="pane-records" role="tabpanel" aria-labelledby="tab-records" class="hidden"><h3>Your deliveries.</h3><div id="account-records"></div><p class="club-note">Full deliveries only. Pauses don’t count. Older course times stay stored separately.</p></section>
      <section id="pane-leaderboard" role="tabpanel" aria-labelledby="tab-leaderboard" class="hidden"><label class="field-label" for="board-track">The fastest deliveries</label><select id="board-track">${tracks.map(t=>`<option value="${t.id}">${t.number} / ${t.name}</option>`).join('')}</select><p class="club-note">Top 20 · One best per driver · Current course<br>Browser-reported times. A friendly leaderboard.</p><div id="board-status" role="status"></div><ol id="board-rows" class="board-rows"></ol><button id="refresh-board" class="secondary">Refresh leaderboard</button></section>
      <footer class="community-footer"><p id="account-message" role="status" aria-live="polite"></p><div><button id="refresh-records" class="text-button">Refresh account</button><button id="sign-out" class="text-button">Sign out</button></div></footer></div>`;
    host.appendChild(this.root);
    for(const tab of ['garage','records','leaderboard'] as Tab[]) this.el(`tab-${tab}`).onclick=()=>this.select(tab);
    const tabs=this.el('tab-garage').parentElement!;
    tabs.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const names:Tab[]=['garage','records','leaderboard'];
      const next=event.key==='Home'?0:event.key==='End'?2:(names.indexOf(this.tab)+(event.key==='ArrowRight'?1:2))%3;
      this.select(names[next]);this.el(`tab-${names[next]}`).focus();
    });
    this.el('close-account').onclick=()=>this.close();
    this.el('garage-signin').onclick=()=>void account.signIn();
    this.el('sign-out').onclick=()=>void account.signOut();
    this.el('refresh-records').onclick=()=>void account.refresh();
    this.el('refresh-board').onclick=()=>void this.loadBoard();
    this.el<HTMLSelectElement>('board-track').onchange=()=>{this.track=tracks.find(t=>t.id===this.el<HTMLSelectElement>('board-track').value)!;void this.loadBoard();};
    for(const key of ['color','wheels','decal'] as const) for(const button of this.root.querySelectorAll<HTMLButtonElement>(`[data-${key}]`)) button.onclick=()=>{this.draft.skin={...this.draft.skin,[key]:button.dataset[key]!};this.drawSkin();};
    this.el<HTMLInputElement>('nickname').oninput=()=>{this.draft.nickname=this.el<HTMLInputElement>('nickname').value;this.el<HTMLInputElement>('nickname').setCustomValidity('');};
    this.el<HTMLInputElement>('profile-listed').onchange=()=>{this.draft.listed=this.el<HTMLInputElement>('profile-listed').checked;};
    this.el<HTMLFormElement>('profile-form').onsubmit=event=>{event.preventDefault();const name=this.draft.nickname.trim();if(!/^[a-zA-Zа-яА-ЯёЁ0-9 _-]{3,24}$/.test(name)){const input=this.el<HTMLInputElement>('nickname');input.setCustomValidity('Use 3–24 English or Cyrillic letters, numbers, spaces, - or _.');input.reportValidity();return;}void account.saveProfile({...this.draft,nickname:name,skin:{...this.draft.skin}});};
    this.root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.close();}
      if(event.key!=='Tab')return;
      const targets=[...this.root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(e=>e.getClientRects().length>0 && !e.closest('fieldset:disabled'));
      const first=targets[0],last=targets.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    });
    this.sync();
  }
  private el<T extends HTMLElement=HTMLElement>(id:string) {return this.root.querySelector<T>(`#${id}`)!;}
  get opened(){return !this.root.classList.contains('hidden');}
  open(tab:Tab,track:Track) {
    if(!this.opened){this.returnFocus=document.activeElement as HTMLElement;for(const child of [...this.root.parentElement!.children,document.getElementById('game')!])if(child!==this.root && child instanceof HTMLElement){this.inertBefore.set(child,child.inert);child.inert=true;}}
    this.track=track;this.el<HTMLSelectElement>('board-track').value=track.id;
    this.root.classList.remove('hidden');this.sync();this.select(tab);this.el(`tab-${tab}`).focus();
  }
  close(){this.boardGeneration++;this.root.classList.add('hidden');for(const [el,inert]of this.inertBefore)el.inert=inert;this.inertBefore.clear();this.lastProfile=null;this.sync();this.preview(this.account.profile?.skin??defaultSkin);this.returnFocus?.focus();}
  private select(tab:Tab){this.tab=tab;for(const name of ['garage','records','leaderboard']){this.el(`pane-${name}`).classList.toggle('hidden',name!==tab);this.el(`tab-${name}`).setAttribute('aria-selected',String(name===tab));this.el(`tab-${name}`).tabIndex=name===tab?0:-1;}this.el('garage-title').textContent=tab==='garage'?'Your garage.':tab==='records'?'Personal bests.':'Made it there.';if(tab==='leaderboard')void this.loadBoard();}
  sync() {
    const profile=this.account.profile;
    const changed=profile!==this.lastProfile || this.lastRecords!==this.account.records;this.lastRecords=this.account.records;
    if(profile!==this.lastProfile){this.lastProfile=profile;this.draft=profile?{...profile,skin:{...profile.skin}}:{nickname:'',skin:{...defaultSkin},listed:false};this.el<HTMLInputElement>('nickname').value=this.draft.nickname;this.el<HTMLInputElement>('nickname').setCustomValidity('');this.el<HTMLInputElement>('profile-listed').checked=this.draft.listed;}
    this.el<HTMLFieldSetElement>('profile-fields').disabled=!profile||this.account.busy;
    this.el<HTMLButtonElement>('save-profile').textContent=this.account.busy?'Saving…':'Save profile ↗';
    this.el('profile-unavailable').textContent=profile?'':this.account.principal?'Your garage could not load. Try Refresh account.':'Sign in to get a nickname and save your bus.';
    this.el('garage-signin').classList.toggle('hidden',Boolean(this.account.principal)||!this.account.available);
    this.el<HTMLButtonElement>('garage-signin').disabled=this.account.busy;
    this.el('account-message').textContent=this.account.message;
    for(const id of ['refresh-records','sign-out'])this.el<HTMLButtonElement>(id).disabled=this.account.busy||!this.account.principal;
    this.el('account-records').replaceChildren(...tracks.map(track=>{const row=document.createElement('div');row.className='record-row';const title=document.createElement('strong');title.textContent=track.name;const value=document.createElement('span'),record=this.account.best(track);value.textContent=record?`${formatTime(Number(record.bestMs))} · ${record.completions} deliveries`:this.account.principal?'No time yet':'Sign in to save times';row.append(title,value);return row;}));
    this.drawSkin();
    if(this.savedOwner!==this.account.principal){this.savedOwner=this.account.principal;this.boardGeneration++;this.el('board-rows').replaceChildren();if(this.opened&&this.tab==='leaderboard')void this.loadBoard();}else if(changed&&this.opened&&this.tab==='leaderboard')void this.loadBoard();
  }
  private drawSkin(){this.el('skin-preview').innerHTML=skinPreview(this.draft.skin);this.el('paint-name').textContent=paintFor(this.draft.skin).name;for(const key of ['color','wheels','decal']as const)for(const button of this.root.querySelectorAll<HTMLButtonElement>(`[data-${key}]`))button.setAttribute('aria-pressed',String(button.dataset[key]===this.draft.skin[key]));this.preview(this.opened?this.draft.skin:this.account.profile?.skin??defaultSkin);}
  private async loadBoard(){const generation=++this.boardGeneration;this.el('board-status').textContent='Loading deliveries…';this.el('board-rows').replaceChildren();this.el<HTMLButtonElement>('refresh-board').disabled=true;
    try{const rows=await this.account.leaderboard(this.track);if(generation!==this.boardGeneration)return;this.el('board-status').textContent=rows.length?'':'No public deliveries yet. Enable sharing in your garage and finish this course.';this.el('board-rows').replaceChildren(...rows.map((row,i)=>{const item=document.createElement('li');if(row.isYou)item.className='your-row';const rank=document.createElement('span');rank.className='board-rank';rank.textContent=String(i+1).padStart(2,'0');const swatch=document.createElement('i');swatch.className='board-paint';swatch.style.background=paintFor(row.skin).hex;swatch.title=`${paintFor(row.skin).name} / ${wheelStyles.find(w=>w.id===row.skin.wheels)?.name} / ${decalFor(row.skin).name}`;const name=document.createElement('strong');name.textContent=row.nickname+(row.isYou?' · you':'');const time=document.createElement('span');time.className='board-time';time.textContent=formatTime(Number(row.bestMs));item.append(rank,swatch,name,time);return item;}));}
    catch{if(generation===this.boardGeneration)this.el('board-status').textContent=this.account.available?'Could not load the leaderboard. Try again.':'The leaderboard is available in the online game.';}
    finally{if(generation===this.boardGeneration)this.el<HTMLButtonElement>('refresh-board').disabled=false;}
  }
}

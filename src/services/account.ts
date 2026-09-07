import { signInWithPopup, popupFeatures } from './auth-popup';
import { signInOptions, signInError } from './auth-options';
import { AuthClient } from '@icp-sdk/auth/client';
import { Actor, HttpAgent, type Identity } from '@icp-sdk/core/agent';
import { safeGetCanisterEnv } from '@icp-sdk/core/agent/canister-env';
import { idlFactory, unwrap, type RecordsApi, type RunRecord, type Ticket, type Receipt, type DriverProfile } from './records-api';
import type { Track } from '../game/tracks';

export const identityOrigin = 'https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net';
export const formatTime = (ms: number) => `${Math.floor(ms / 60000)}:${(Math.floor(ms / 1000) % 60).toString().padStart(2, '0')}.${Math.floor(ms % 1000 / 10).toString().padStart(2, '0')}`;
export interface DeliveryRun { key: Uint8Array; ticket: Ticket; owner: string; api: RecordsApi; completed?: Promise<void>; elapsedMs?: number; saved?: Receipt }
export interface SavedRun { ticket: Ticket; owner: string; api: RecordsApi }

/** Optional account; guest simulation never depends on a canister or auth request. */
export class Account {
  private auth: AuthClient;
  private api?: RecordsApi;
  private publicApi?: Promise<RecordsApi>;
  private generation = 0;
  private env = safeGetCanisterEnv();
  readonly available = Boolean(this.env?.['PUBLIC_CANISTER_ID:records']);
  principal = '';
  records: RunRecord[] = [];
  profile: DriverProfile | null = null;
  busy = false;
  message = '';
  onChange = () => {};

  get signedIn() { return Boolean(this.principal) && this.auth.isAuthenticated(); }

  /** Reuse this account for caller-bound services; reject expired or changed sessions. */
  async sessionIdentity():Promise<Identity> {
    const owner=this.principal,generation=this.generation;
    if(!this.signedIn) throw new Error('Sign in to play with a teammate.');
    const identity=await this.auth.getIdentity();
    if(generation!==this.generation || !this.signedIn || identity.getPrincipal().toText()!==owner)
      throw new Error('Your account changed or expired. Sign in again.');
    return identity;
  }

  constructor() {
    // The canister address stays the permanent account origin. Its certified
    // ii-alternative-origins file authorizes the OpenCloud custom game domain.
    // Official gateway aliases are canonicalized by II itself; local dev is separate.
    const local = ['localhost','127.0.0.1'].includes(location.hostname) || location.hostname.endsWith('.localhost');
    const official = /\.(icp\.net|icp0\.io|ic0\.app)$/.test(location.hostname);
    this.auth = new AuthClient({identityProvider:'https://id.ai/authorize',
      ...(!local && !official && location.origin !== identityOrigin ? {derivationOrigin:identityOrigin} : {}),
      windowOpenerFeatures:popupFeatures, idleOptions:{disableIdle:true}});
  }
  async restore() {
    if (!this.available) { this.message='Guest mode · online records need the deployed game.'; this.onChange(); return; }
    this.busy=true; this.onChange();
    try {
      const identity=await this.auth.getIdentity();
      if (this.auth.isAuthenticated() && !identity.getPrincipal().isAnonymous()) await this.useIdentity(identity);
    } catch { this.message='Could not restore sign-in. You can still play.'; }
    this.busy=false; this.onChange();
  }
  async signIn() {
    if (this.busy || !this.available) return;
    this.busy=true; this.message='Complete sign-in in the Internet Identity window.'; this.onChange();
    try {
      // Start the popup directly in the click gesture, before waiting on any network call.
      const identity=await signInWithPopup(()=>this.auth.signIn(signInOptions),()=>this.auth.isAuthenticated());
      if (identity.getPrincipal().isAnonymous()) throw new Error('Sign-in did not complete.');
      this.message='Signed in. Your delivery can be saved.';
      await this.useIdentity(identity);
    } catch (error) { this.message=signInError(error); }
    finally { this.busy=false; this.onChange(); }
  }
  private async useIdentity(identity: Identity) {
    const generation=++this.generation;
    const agent=await HttpAgent.create({identity,host:location.origin,rootKey:this.env!.IC_ROOT_KEY});
    const api=Actor.createActor<RecordsApi>(idlFactory,{agent,canisterId:this.env!['PUBLIC_CANISTER_ID:records']});
    if (generation!==this.generation) return;
    this.api=api; this.principal=identity.getPrincipal().toText(); this.records=[]; this.profile=null;
    await this.loadAccount(api,generation);
  }
  private async loadAccount(api:RecordsApi,generation:number) {
    const [records,profile]=await Promise.allSettled([api.myRecords().then(unwrap),api.ensureProfile().then(unwrap)]);
    if(generation!==this.generation) return;
    if(records.status==='fulfilled') this.records=records.value;
    if(profile.status==='fulfilled') this.profile=profile.value;
    this.message=records.status==='rejected' || profile.status==='rejected' ? 'Some account details could not load. Use Refresh in your profile to retry.' : '';
  }
  async signOut() {
    if (this.busy) return;
    ++this.generation; this.api=undefined; this.principal=''; this.records=[]; this.profile=null; this.busy=true; this.onChange();
    try { await this.auth.signOut(); this.message='Signed out. Guest driving is ready.'; }
    catch { this.message='Could not clear the stored session. Close this tab before using a shared device.'; }
    finally { this.busy=false; this.onChange(); }
  }
  async refresh() {
    if (!this.api || this.busy) return;
    this.busy=true; const generation=this.generation; this.onChange();
    try { await this.loadAccount(this.api,generation); }
    finally {this.busy=false;this.onChange();}
  }
  async saveProfile(profile:DriverProfile):Promise<boolean> {
    if(!this.api || !this.principal || this.busy) return false;
    if(!this.auth.isAuthenticated()) {await this.signOut();return false;}
    const generation=this.generation;
    this.busy=true;this.message='Saving your garage…';this.onChange();
    try {
      const result=await this.api.saveProfile(profile);
      if(generation!==this.generation) return false;
      if('err' in result){this.message=result.err;return false;}
      this.profile=result.ok;this.message='Profile saved. Ready to roll.';return true;
    } catch {
      if(generation===this.generation) this.message='Could not save. Your changes are still here; try again.';
      return false;
    } finally {if(generation===this.generation){this.busy=false;this.onChange();}}
  }
  private guestApi():Promise<RecordsApi> {
    if(!this.available) return Promise.reject(new Error('Online saving is unavailable.'));
    this.publicApi ??= HttpAgent.create({host:location.origin,rootKey:this.env!.IC_ROOT_KEY}).then(agent=>Actor.createActor<RecordsApi>(idlFactory,{agent,canisterId:this.env!['PUBLIC_CANISTER_ID:records']})).catch(error=>{this.publicApi=undefined;throw error;});
    return this.publicApi;
  }
  async trackOpen() {
    if(!this.available) return;
    const key=crypto.getRandomValues(new Uint8Array(32));
    // Best effort only; no retries that could count a reload as a unique person.
    try {unwrap(await (await this.guestApi()).gameOpened(key));} catch { /* Play remains available offline. */ }
  }
  async prepareDelivery(track:Track):Promise<DeliveryRun|null> {
    if(!this.available) return null;
    if(this.principal && !this.auth.isAuthenticated()) {await this.signOut();throw new Error('Session expired. Sign in again, or play without saving.');}
    const key=crypto.getRandomValues(new Uint8Array(32));
    const owner=this.principal, generation=this.generation, api=this.api ?? await this.guestApi();
    const ticket=unwrap(await api.beginDelivery(key,track.id,BigInt(track.rulesVersion)));
    if(owner && generation!==this.generation) throw new Error('Account changed. Start again.');
    return {key,ticket,owner,api};
  }
  completeDelivery(run:DeliveryRun,elapsedMs:number):Promise<void> {
    if(run.elapsedMs!==undefined && run.elapsedMs!==elapsedMs) return Promise.reject(new Error('This delivery already has a different time.'));
    run.elapsedMs=elapsedMs;
    return run.completed ??= run.api.completeDelivery(run.key,run.ticket.id,BigInt(elapsedMs)).catch(()=>{throw new Error('Could not confirm the finish. Your time is still here; retry when connected.');}).then(unwrap).then(()=>{}).catch(error=>{run.completed=undefined;throw error;});
  }
  async claimDelivery(run:DeliveryRun,elapsedMs:number,publish=false):Promise<Receipt> {
    if(this.principal && !this.auth.isAuthenticated()) await this.signOut();
    if(!this.api || !this.principal) throw new Error('Sign in to save this delivery.');
    if(run.owner && run.owner!==this.principal) throw new Error('Sign in with the same account before saving this run.');
    // Bind before the request: a lost response must never retry under another account.
    run.owner=this.principal;
    const api=this.api, generation=this.generation;
    await this.completeDelivery(run,elapsedMs);
    if(generation!==this.generation) throw new Error('Account changed. Sign in with the same account to retry.');
    if(!this.profile) {
      const profile=unwrap(await api.ensureProfile().catch(()=>{throw new Error('Could not load your profile. Your time is still here; retry when connected.');}));
      if(generation!==this.generation) throw new Error('Account changed. Sign in with the same account to retry.');
      this.profile=profile;
    }
    const receipt=unwrap(await api.claimDelivery(run.key,run.ticket.id,publish).catch(()=>{throw new Error('Could not save your delivery. Your time is still here; retry when connected.');}));
    run.saved=receipt;
    if(generation===this.generation) {
      this.mergeReceipt(receipt);
      if(publish && this.profile) this.profile={...this.profile,listed:true};
      this.onChange();
    }
    return receipt;
  }
  private mergeReceipt(receipt:Receipt) {
    const current=this.records.find(r=>r.track===receipt.record.track && r.rulesVersion===receipt.record.rulesVersion);
    if(!current || current.updatedAt<=receipt.record.updatedAt) this.records=[...this.records.filter(r=>r.track!==receipt.record.track || r.rulesVersion!==receipt.record.rulesVersion),receipt.record];
  }
  async leaderboard(track:Track) {
    if(!this.available) throw new Error('The leaderboard is available in the online game.');
    let api=this.api;
    if(!api) {
      api=await this.guestApi();
    }
    return unwrap(await api.leaderboard(track.id,BigInt(track.rulesVersion)));
  }
  best(track: Track) { return this.records.find(r=>r.track===track.id && r.rulesVersion===BigInt(track.rulesVersion)); }
  async begin(track: Track): Promise<SavedRun | null> {
    if (!this.api || !this.principal) return null;
    if (!this.auth.isAuthenticated()) { await this.signOut(); throw new Error('Session expired. Sign in again, or choose guest play.'); }
    const api=this.api, owner=this.principal, generation=this.generation;
    const ticket=unwrap(await api.startRun(track.id,BigInt(track.rulesVersion)));
    if(generation!==this.generation) throw new Error('Account changed. Start again.');
    return {api,owner,ticket};
  }
  async finish(run: SavedRun, elapsedMs: number): Promise<Receipt> {
    if (run.owner!==this.principal || !this.auth.isAuthenticated()) throw new Error('Sign in with the same account before saving this run.');
    const receipt=unwrap(await this.api!.finishRun(run.ticket.id,BigInt(elapsedMs)));
    if(run.owner===this.principal) {
      const current=this.records.find(r=>r.track===receipt.record.track && r.rulesVersion===receipt.record.rulesVersion);
      if(!current || current.updatedAt<=receipt.record.updatedAt) this.records=[...this.records.filter(r=>r.track!==receipt.record.track || r.rulesVersion!==receipt.record.rulesVersion),receipt.record];
      this.onChange();
    }
    return receipt;
  }
}

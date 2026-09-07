import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Principal } from '@icp-sdk/core/principal';
import { tracks } from '../src/game/tracks';
import { readFileSync } from 'node:fs';
const mocks=vi.hoisted(()=>({auth:{getIdentity:vi.fn(),isAuthenticated:vi.fn(),signIn:vi.fn(),signOut:vi.fn()},api:{myRecords:vi.fn(),startRun:vi.fn(),finishRun:vi.fn(),ensureProfile:vi.fn(),saveProfile:vi.fn(),leaderboard:vi.fn(),gameOpened:vi.fn(),beginDelivery:vi.fn(),completeDelivery:vi.fn(),claimDelivery:vi.fn()},agent:vi.fn(),available:true,options:{} as Record<string,unknown>}));
vi.mock('@icp-sdk/auth/client',()=>({AuthClient:class {constructor(options:Record<string,unknown>){mocks.options=options;return mocks.auth;}}}));
vi.mock('@icp-sdk/core/agent',()=>({HttpAgent:{create:mocks.agent},Actor:{createActor:()=>mocks.api}}));
vi.mock('@icp-sdk/core/agent/canister-env',()=>({safeGetCanisterEnv:()=>mocks.available ? {'PUBLIC_CANISTER_ID:records':'aaaaa-aa',IC_ROOT_KEY:new Uint8Array(133)}:undefined}));
import { Account, identityOrigin } from '../src/services/account';
const alice={getPrincipal:()=>Principal.fromUint8Array(new Uint8Array([1]))};
beforeEach(()=>{vi.stubGlobal('window',{open:()=>({closed:false})});vi.stubGlobal('location',{origin:'https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net',hostname:'z4wnx-uqaaa-aaabz-aadeq-cai.icp.net'});vi.clearAllMocks();mocks.available=true;mocks.auth.getIdentity.mockResolvedValue(alice);mocks.auth.signIn.mockResolvedValue(alice);mocks.auth.signOut.mockResolvedValue(undefined);mocks.auth.isAuthenticated.mockReturnValue(true);mocks.agent.mockResolvedValue({});mocks.api.myRecords.mockResolvedValue({ok:[]});mocks.api.ensureProfile.mockResolvedValue({ok:{nickname:"Rusty Otter 1234",skin:{color:"cream",wheels:"stock",decal:"probably"},listed:false}});mocks.api.leaderboard.mockResolvedValue({ok:[]});mocks.api.startRun.mockResolvedValue({ok:{id:1n,track:'old-road',rulesVersion:1n,startedAt:1n}});});
afterEach(()=>vi.unstubAllGlobals());
it('guest mode needs no network and cannot create saved tickets',async()=>{mocks.available=false;const account=new Account();await account.restore();expect(await account.begin(tracks[0])).toBeNull();expect(mocks.agent).not.toHaveBeenCalled();});
it('the authorized custom domain pins the original identity; official aliases and local development keep their own SDK defaults',()=>{
  const custom='https://isitthereyet.nano-tema--0v1.opencloud.org';
  const origins=JSON.parse(readFileSync(new URL('../public/.well-known/ii-alternative-origins',import.meta.url),'utf8'));
  expect(origins.alternativeOrigins).toEqual([custom]);
  for(const origin of [custom,identityOrigin,identityOrigin.replace('icp.net','icp0.io'),identityOrigin.replace('icp.net','ic0.app'),'http://localhost:5173','http://127.0.0.1:5173']) {
    vi.stubGlobal('location',{origin,hostname:new URL(origin).hostname});new Account();
    expect(mocks.options.derivationOrigin).toBe(origin===custom ? identityOrigin : undefined);
  }
});
it('restores a signed identity and reads only the caller records',async()=>{const account=new Account();await account.restore();expect(account.principal).toBe(alice.getPrincipal().toText());expect(mocks.api.myRecords).toHaveBeenCalledOnce();expect(mocks.agent.mock.calls[0][0].identity).toBe(alice);expect(mocks.options.identityProvider).toBe('https://id.ai/authorize');});
it('room services reuse the account identity and reject guest, expired and changed sessions',async()=>{
  const account=new Account();await expect(account.sessionIdentity()).rejects.toThrow('Sign in');
  await account.restore();expect(await account.sessionIdentity()).toBe(alice);
  mocks.auth.isAuthenticated.mockReturnValue(false);expect(account.signedIn).toBe(false);await expect(account.sessionIdentity()).rejects.toThrow('Sign in');
  mocks.auth.isAuthenticated.mockReturnValue(true);
  let resolve!:(value:unknown)=>void;mocks.auth.getIdentity.mockImplementationOnce(()=>new Promise(r=>resolve=r));
  const pending=account.sessionIdentity();await account.signOut();resolve(alice);await expect(pending).rejects.toThrow('changed');
});
it('cancelled sign-in clears busy state and does not invent an account',async()=>{mocks.auth.signIn.mockRejectedValue(new Error('closed'));const account=new Account();await account.signIn();expect(account.principal).toBe('');expect(account.busy).toBe(false);expect(account.message).toContain('cancelled');});
it('a result request cannot restore private data after sign-out',async()=>{const account=new Account();await account.restore();let resolve!:(value:unknown)=>void;mocks.api.myRecords.mockImplementation(()=>new Promise(r=>resolve=r));const refresh=account.refresh();account.busy=false;await account.signOut();resolve({ok:[{track:'old-road'}]});await refresh;expect(account.records).toEqual([]);expect(account.principal).toBe('');});
it('a late ticket cannot start a run after account change',async()=>{const account=new Account();await account.restore();let resolve!:(value:unknown)=>void;mocks.api.startRun.mockImplementation(()=>new Promise(r=>resolve=r));const pending=account.begin(tracks[0]);await account.signOut();resolve({ok:{id:2n}});await expect(pending).rejects.toThrow('Account changed');});
it('rejects expired sessions before a saved run and keeps guest driving possible',async()=>{const account=new Account();await account.restore();mocks.auth.isAuthenticated.mockReturnValue(false);await expect(account.begin(tracks[0])).rejects.toThrow('Session expired');expect(account.principal).toBe('');expect(mocks.api.startRun).not.toHaveBeenCalled();});
it('clears personal records on sign-out and refuses a ticket from another account',async()=>{const account=new Account();await account.restore();const run=await account.begin(tracks[0]);await account.signOut();expect(account.records).toEqual([]);await expect(account.finish(run!,60000)).rejects.toThrow('same account');expect(mocks.api.finishRun).not.toHaveBeenCalled();});
it('saving a current-course result keeps the legacy time and displays only its own version',async()=>{
  const legacy={track:'old-road',rulesVersion:3n,bestMs:45000n,lastMs:45000n,completions:2n,updatedAt:1n};
  mocks.api.myRecords.mockResolvedValue({ok:[legacy]});mocks.api.startRun.mockResolvedValue({ok:{id:5n,track:'old-road',rulesVersion:5n,startedAt:2n}});
  const account=new Account();await account.restore();expect(account.best(tracks[0])).toBeUndefined();const run=await account.begin(tracks[0]);
  expect(mocks.api.startRun).toHaveBeenCalledWith('old-road',5n);
  const current={...legacy,rulesVersion:5n,bestMs:60000n,lastMs:60000n,completions:1n,updatedAt:3n};mocks.api.finishRun.mockResolvedValue({ok:{id:5n,record:current,newBest:true}});
  await account.finish(run!,60000);expect(account.records).toEqual([legacy,current]);expect(account.best(tracks[0])).toEqual(current);
});

it('restores the canister profile and persists garage edits through the authenticated API',async()=>{
  const account=new Account();await account.restore();expect(account.profile?.nickname).toBe('Rusty Otter 1234');
  const next={nickname:'Тёма',skin:{color:'mint',wheels:'rally',decal:'404'},listed:true};mocks.api.saveProfile.mockResolvedValue({ok:next});
  expect(await account.saveProfile(next)).toBe(true);expect(mocks.api.saveProfile).toHaveBeenCalledWith(next);expect(account.profile).toEqual(next);
  await account.signOut();expect(account.profile).toBeNull();
});
it('a failed profile save preserves the previous saved look and exposes retry feedback',async()=>{
  const account=new Account();await account.restore();const before=account.profile;mocks.api.saveProfile.mockResolvedValue({err:'Choose a paint, wheels and stickers from the garage.'});
  expect(await account.saveProfile({...before!,nickname:'New name'})).toBe(false);expect(account.profile).toEqual(before);expect(account.message).toContain('Choose a paint');expect(account.busy).toBe(false);
});
it('public leaderboard reads do not sign guests in or create profiles',async()=>{
  const account=new Account();expect(await account.leaderboard(tracks[0])).toEqual([]);expect(mocks.api.leaderboard).toHaveBeenCalledWith('old-road',5n);expect(mocks.api.ensureProfile).not.toHaveBeenCalled();expect(mocks.auth.signIn).not.toHaveBeenCalled();
});
it('late profile saves cannot repopulate an account after sign-out',async()=>{
  const account=new Account();await account.restore();const profile=account.profile!;let resolve!:(value:unknown)=>void;mocks.api.saveProfile.mockImplementation(()=>new Promise(r=>resolve=r));const pending=account.saveProfile(profile);
  account.busy=false;await account.signOut();resolve({ok:profile});expect(await pending).toBe(false);expect(account.profile).toBeNull();
});

it('prepares a guest delivery without II and claims the exact finished time after login',async()=>{
  mocks.auth.isAuthenticated.mockReturnValue(false);
  const ticket={id:19n,track:'old-road',rulesVersion:5n,startedAt:1n};
  const record={track:'old-road',rulesVersion:5n,bestMs:59000n,lastMs:59000n,completions:1n,updatedAt:2n};
  mocks.api.beginDelivery.mockResolvedValue({ok:ticket});mocks.api.completeDelivery.mockResolvedValue({ok:null});mocks.api.claimDelivery.mockResolvedValue({ok:{id:19n,record,newBest:true}});
  const account=new Account();const run=(await account.prepareDelivery(tracks[0]))!;
  expect(run.owner).toBe('');expect(run.key).toHaveLength(32);expect(mocks.auth.signIn).not.toHaveBeenCalled();
  await account.completeDelivery(run,59000);await account.completeDelivery(run,59000);expect(mocks.api.completeDelivery).toHaveBeenCalledOnce();
  await expect(account.claimDelivery(run,59000,true)).rejects.toThrow('Sign in');
  mocks.auth.isAuthenticated.mockReturnValue(true);await account.signIn();await account.claimDelivery(run,59000,true);
  expect(mocks.api.claimDelivery).toHaveBeenCalledWith(run.key,19n,true);expect(account.best(tracks[0])).toEqual(record);expect(account.profile?.listed).toBe(true);
  await expect(account.completeDelivery(run,58000)).rejects.toThrow('different time');
});
it('failed completion can retry; ambiguous claims bind to the first account and preserve privacy',async()=>{
  const account=new Account();mocks.api.beginDelivery.mockResolvedValue({ok:{id:20n,track:'old-road',rulesVersion:5n,startedAt:1n}});
  const run=(await account.prepareDelivery(tracks[0]))!;
  mocks.api.completeDelivery.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ok:null});
  await expect(account.completeDelivery(run,60000)).rejects.toThrow('confirm the finish');await account.completeDelivery(run,60000);
  await account.restore();mocks.api.claimDelivery.mockRejectedValue(new Error('lost response'));
  await expect(account.claimDelivery(run,60000)).rejects.toThrow('Could not save');expect(account.profile?.listed).toBe(false);
  expect(mocks.api.claimDelivery).toHaveBeenCalledWith(run.key,20n,false);
  await account.signOut();account.principal='another-account';await expect(account.claimDelivery(run,60000)).rejects.toThrow();
});

it('an expired session at the finish restores the sign-in action without losing the run',async()=>{
  const account=new Account();await account.restore();mocks.api.beginDelivery.mockResolvedValue({ok:{id:21n,track:'old-road',rulesVersion:5n,startedAt:1n}});
  const run=(await account.prepareDelivery(tracks[0]))!;mocks.auth.isAuthenticated.mockReturnValue(false);
  await expect(account.claimDelivery(run,60000)).rejects.toThrow('Sign in');expect(account.principal).toBe('');expect(run.owner).toBe(alice.getPrincipal().toText());
});

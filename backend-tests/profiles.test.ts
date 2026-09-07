import { afterAll, beforeAll, expect, it } from 'vitest';
import { PocketIc, PocketIcServer, createIdentity, type Actor } from '@dfinity/pic';
import { Principal } from '@icp-sdk/core/principal';
import { idlFactory, unwrap, type RecordsApi, type DriverProfile } from '../src/services/records-api';
import { paintColors, wheelStyles, decalStyles } from '../src/game/skin';
let server:PocketIcServer,pic:PocketIc,api:Actor<RecordsApi>,canisterId:Principal;
const alice=createIdentity('profile-alice'),bob=createIdentity('profile-bob');
const wasm='.mops/.build/records.wasm';
let original:DriverProfile;
beforeAll(async()=>{server=await PocketIcServer.start();pic=await PocketIc.create(server.getUrl());const fixture=await pic.setupCanister<RecordsApi>({idlFactory,wasm,sender:alice.getPrincipal()});api=fixture.actor;canisterId=fixture.canisterId;api.setIdentity(alice);},60_000);
afterAll(async()=>{await pic?.tearDown();await server?.stop();});
const readProfile=async()=>unwrap(await api.myProfile())[0]!;
async function finish(track='old-road',version=5n,ms=30000n){const ticket=unwrap(await api.startRun(track,version));await pic.advanceTime(Number(ms)+3000);await pic.tick();return unwrap(await api.finishRun(ticket.id,ms));}
it('requires a signed caller for profile reads/creation/updates; anonymous leaderboard is read-only',async()=>{
  api.setPrincipal(Principal.anonymous());expect(await api.myProfile()).toHaveProperty('err');expect(await api.ensureProfile()).toHaveProperty('err');
  expect(await api.saveProfile({nickname:'Visitor',skin:{color:'cream',wheels:'stock',decal:'probably'},listed:true})).toHaveProperty('err');
  expect(unwrap(await api.leaderboard('old-road',5n))).toEqual([]);expect(await api.leaderboard('old-road',3n)).toHaveProperty('err');expect(await api.leaderboard('nope',5n)).toHaveProperty('err');api.setIdentity(alice);
});
it('creates one stable default nickname and isolates each caller profile',async()=>{
  expect(unwrap(await api.myProfile())).toEqual([]);original=unwrap(await api.ensureProfile());expect(original.nickname).toMatch(/^\w+ \w+ \d{4}$/);expect(original.listed).toBe(false);
  expect(unwrap(await api.ensureProfile())).toEqual(original);
  api.setIdentity(bob);const other=unwrap(await api.ensureProfile());expect(other.nickname).not.toBe(original.nickname);unwrap(await api.saveProfile({...other,nickname:'Другой водитель'}));
  api.setIdentity(alice);expect(await readProfile()).toEqual(original);
});
it('validates and normalizes nicknames and rejects invented cosmetics without changing saved data',async()=>{
  for(const nickname of ['', 'ab', ' '.repeat(24), 'a'.repeat(25), '<img onerror=1>', 'Driver\nname', 'Driver\u202ename'])expect(await api.saveProfile({...original,nickname})).toHaveProperty('err');
  for(const key of ['color','wheels','decal'])expect(await api.saveProfile({...original,skin:{...original.skin,[key]:'unknown'}})).toHaveProperty('err');
  expect(await readProfile()).toEqual(original);
  expect(unwrap(await api.saveProfile({...original,nickname:'  Тёма-Driver_7  '})).nickname).toBe('Тёма-Driver_7');
});
it('accepts every client cosmetic choice in all three independent components',async()=>{
  let profile=await readProfile();
  for(const [key,choices]of [['color',paintColors],['wheels',wheelStyles],['decal',decalStyles]] as const)for(const choice of choices){profile={...profile,skin:{...profile.skin,[key]:choice.id}};expect(unwrap(await api.saveProfile(profile))).toEqual(profile);}
});
it('publishes only opted-in current-course bests, uses live names and supports immediate withdrawal',async()=>{
  await finish();await finish('old-road',3n,10000n);expect(unwrap(await api.leaderboard('old-road',5n))).toEqual([]);
  let profile=await readProfile();profile=unwrap(await api.saveProfile({...profile,listed:true}));
  let board=unwrap(await api.leaderboard('old-road',5n));expect(board).toEqual([{nickname:profile.nickname,skin:profile.skin,bestMs:30000n,completions:1n,isYou:true}]);
  await finish('old-road',5n,40000n);board=unwrap(await api.leaderboard('old-road',5n));expect(board[0].bestMs).toBe(30000n);expect(board[0].completions).toBe(2n);
  unwrap(await api.saveProfile({...profile,nickname:'Renamed Driver'}));expect(unwrap(await api.leaderboard('old-road',5n))[0].nickname).toBe('Renamed Driver');
  api.setIdentity(bob);expect(unwrap(await api.leaderboard('old-road',5n))[0].isYou).toBe(false);api.setIdentity(alice);
  unwrap(await api.saveProfile({...profile,listed:false}));expect(unwrap(await api.leaderboard('old-road',5n))).toEqual([]);expect(unwrap(await api.myRecords())).toHaveLength(2);
});
it('returns the fastest 20, keeps ties stable, backfills after opt-out and separates tracks',async()=>{
  const players=Array.from({length:22},(_,i)=>createIdentity(`leader-${i}`));
  for(const [i,identity]of players.entries()){api.setIdentity(identity);const p=unwrap(await api.ensureProfile());unwrap(await api.saveProfile({...p,nickname:`Driver ${i}`,listed:true}));await finish('old-road',5n,BigInt(20000+Math.floor(i/2)*1000));}
  api.setPrincipal(Principal.anonymous());const first=unwrap(await api.leaderboard('old-road',5n));expect(first).toHaveLength(20);expect(first.every(r=>!r.isYou)).toBe(true);expect(first.map(r=>r.bestMs)).toEqual([...first.map(r=>r.bestMs)].sort((a,b)=>Number(a-b)));expect(unwrap(await api.leaderboard('old-road',5n))).toEqual(first);
  expect(unwrap(await api.leaderboard('relay-ridge',4n))).toEqual([]);
  api.setIdentity(players[0]);unwrap(await api.saveProfile({...await readProfile(),listed:false}));
  const after=unwrap(await api.leaderboard('old-road',5n));expect(after).toHaveLength(20);expect(after.some(r=>r.nickname==='Driver 0')).toBe(false);expect(after.some(r=>r.nickname==='Driver 20'||r.nickname==='Driver 21')).toBe(true);
});
it('preserves edited profiles, publication preference and leaderboard results across upgrade',async()=>{
  api.setIdentity(alice);const before=await readProfile();const board=unwrap(await api.leaderboard('old-road',5n));
  await pic.upgradeCanister({canisterId,wasm,sender:alice.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
  expect(await readProfile()).toEqual(before);expect(unwrap(await api.leaderboard('old-road',5n))).toEqual(board);
});

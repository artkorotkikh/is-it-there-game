import { afterAll,beforeAll,expect,it } from 'vitest';
import { PocketIc,PocketIcServer,createIdentity,type Actor } from '@dfinity/pic';
import { Principal } from '@icp-sdk/core/principal';
import { idlFactory,unwrap,type RecordsApi } from '../src/services/records-api';
let server:PocketIcServer,pic:PocketIc,api:Actor<RecordsApi>,canisterId:Principal;
const controller=createIdentity('stats-controller'),alice=createIdentity('finish-alice'),bob=createIdentity('finish-bob');
const wasm='.mops/.build/records.wasm';
const key=(n:number)=>new Uint8Array(32).fill(n);
const guest=()=>api.setPrincipal(Principal.anonymous());
const wait=async(ms:number)=>{await pic.advanceTime(ms);await pic.tick();};
const stats=async()=>{api.setIdentity(controller);return unwrap(await api.statistics());};
beforeAll(async()=>{server=await PocketIcServer.start();pic=await PocketIc.create(server.getUrl());const fixture=await pic.setupCanister<RecordsApi>({idlFactory,wasm,sender:controller.getPrincipal()});api=fixture.actor;canisterId=fixture.canisterId;},60000);
afterAll(async()=>{await pic?.tearDown();await server?.stop();});
it('only current controllers read counters; anonymous openings deduplicate and survive upgrade',async()=>{
  guest();expect(await api.statistics()).toHaveProperty('err');api.setIdentity(alice);expect(await api.statistics()).toHaveProperty('err');
  guest();expect(await api.gameOpened(new Uint8Array(1))).toHaveProperty('err');unwrap(await api.gameOpened(key(1)));unwrap(await api.gameOpened(key(1)));unwrap(await api.gameOpened(key(2)));
  const before=await stats();expect(before.opens).toBe(2n);expect(before.courses).toEqual([]);
  await pic.upgradeCanister({canisterId,wasm,sender:controller.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
  expect(await stats()).toEqual(before);
});
it('guest run freezes before II, claims once and publishes only with explicit opt-in',async()=>{
  guest();const ticket=unwrap(await api.beginDelivery(key(3),'old-road',5n));
  expect(unwrap(await api.beginDelivery(key(3),'old-road',5n))).toEqual(ticket);
  expect(await api.beginDelivery(key(3),'relay-ridge',4n)).toHaveProperty('err');expect(await api.beginDelivery(key(4),'unknown',1n)).toHaveProperty('err');
  expect(await api.completeDelivery(key(3),ticket.id,60000n)).toHaveProperty('err');expect(await api.completeDelivery(key(3),ticket.id,9999n)).toHaveProperty('err');
  expect(await api.claimDelivery(key(3),ticket.id,true)).toHaveProperty('err');
  api.setIdentity(alice);const profile=unwrap(await api.ensureProfile());expect(await api.claimDelivery(key(3),ticket.id,true)).toHaveProperty('err');
  guest();await wait(60000);unwrap(await api.completeDelivery(key(3),ticket.id,59000n));unwrap(await api.completeDelivery(key(3),ticket.id,59000n));
  expect(await api.completeDelivery(key(3),ticket.id,58000n)).toHaveProperty('err');expect(await api.completeDelivery(key(4),ticket.id,59000n)).toHaveProperty('err');
  // Login may take longer than the run lifetime, but completed results have a 24h claim window.
  await wait(3600000);api.setIdentity(alice);const saved=unwrap(await api.claimDelivery(key(3),ticket.id,false));
  expect(saved.record.completions).toBe(1n);expect(unwrap(await api.leaderboard('old-road',5n))).toEqual([]);
  expect(unwrap(await api.claimDelivery(key(3),ticket.id,true))).toEqual(saved);
  expect(unwrap(await api.leaderboard('old-road',5n))).toEqual([{nickname:profile.nickname,skin:profile.skin,bestMs:59000n,completions:1n,isYou:true}]);
  const counters=await stats();expect(counters.courses).toEqual([{track:'old-road',rulesVersion:5n,starts:1n,finishes:1n,saved:1n}]);
  api.setIdentity(bob);unwrap(await api.ensureProfile());expect(await api.claimDelivery(key(3),ticket.id,true)).toHaveProperty('err');expect(unwrap(await api.myRecords())).toEqual([]);
  await pic.upgradeCanister({canisterId,wasm,sender:controller.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
  api.setIdentity(alice);expect(unwrap(await api.claimDelivery(key(3),ticket.id,true))).toEqual(saved);expect(await stats()).toEqual(counters);
});
it('signed starts are caller-bound, independent guest tabs survive upgrades, and expired capabilities cannot be claimed',async()=>{
  api.setIdentity(alice);const signed=unwrap(await api.beginDelivery(key(5),'relay-ridge',4n));
  guest();const other=unwrap(await api.beginDelivery(key(6),'finality-quarry',4n));await wait(30000);
  await pic.upgradeCanister({canisterId,wasm,sender:controller.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
  unwrap(await api.completeDelivery(key(5),signed.id,29000n));unwrap(await api.completeDelivery(key(6),other.id,29000n));
  api.setIdentity(bob);expect(await api.claimDelivery(key(5),signed.id,false)).toHaveProperty('err');unwrap(await api.claimDelivery(key(6),other.id,false));
  api.setIdentity(alice);unwrap(await api.claimDelivery(key(5),signed.id,false));
  guest();const abandoned=unwrap(await api.beginDelivery(key(7),'old-road',5n));await wait(3600001);expect(await api.completeDelivery(key(7),abandoned.id,59000n)).toHaveProperty('err');
  await wait(86400000);api.setIdentity(alice);expect(await api.claimDelivery(key(5),signed.id,false)).toHaveProperty('err');
  guest();const fresh=unwrap(await api.beginDelivery(key(5),'relay-ridge',4n));expect(fresh.id).not.toBe(signed.id);expect(await api.completeDelivery(key(5),signed.id,29000n)).toHaveProperty('err');
  // Retention removes transient keys, not aggregate counters or saved personal results.
  api.setIdentity(alice);expect(unwrap(await api.myRecords()).find(r=>r.track==='relay-ridge')?.bestMs).toBe(29000n);
  expect((await stats()).opens).toBe(2n);
});
it('statistics access follows controller changes instead of a hard-coded identity',async()=>{
  await pic.updateCanisterSettings({canisterId,sender:controller.getPrincipal(),controllers:[bob.getPrincipal()]});
  api.setIdentity(controller);expect(await api.statistics()).toHaveProperty('err');api.setIdentity(bob);expect(unwrap(await api.statistics()).opens).toBe(2n);
  await pic.updateCanisterSettings({canisterId,sender:bob.getPrincipal(),controllers:[controller.getPrincipal()]});
});

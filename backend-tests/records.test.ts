import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PocketIc, PocketIcServer, createIdentity, type Actor } from '@dfinity/pic';
import { Principal } from '@icp-sdk/core/principal';
import { idlFactory, unwrap, type RecordsApi } from '../src/services/records-api';

let server: PocketIcServer, pic: PocketIc, api: Actor<RecordsApi>, canisterId: Principal;
const alice=createIdentity('alice'), bob=createIdentity('bob');
const wasm='.mops/.build/records.wasm';
beforeAll(async()=>{server=await PocketIcServer.start();pic=await PocketIc.create(server.getUrl());const fixture=await pic.setupCanister<RecordsApi>({idlFactory,wasm,sender:alice.getPrincipal()});api=fixture.actor;canisterId=fixture.canisterId;},60_000);
afterAll(async()=>{await pic?.tearDown();await server?.stop();});
async function wait(ms:number) {await pic.advanceTime(ms);await pic.tick();}

describe('persistent personal records on the IC',()=>{
  it('rejects anonymous writes and reads; validates tracks and versions',async()=>{
    api.setPrincipal(Principal.anonymous());
    expect(await api.myRecords()).toHaveProperty('err');expect(await api.startRun('old-road',1n)).toHaveProperty('err');expect(await api.finishRun(1n,20000n)).toHaveProperty('err');
    api.setIdentity(alice);expect(await api.startRun('unknown',1n)).toHaveProperty('err');expect(await api.startRun('old-road',6n)).toHaveProperty('err');
    expect(await api.startRun('relay-ridge',5n)).toHaveProperty('err');expect(await api.startRun('finality-quarry',5n)).toHaveProperty('err');
  });
  it('binds tickets to the signed caller and rejects implausible times',async()=>{
    api.setIdentity(alice);const ticket=unwrap(await api.startRun('old-road',1n));
    api.setIdentity(bob);expect(await api.finishRun(ticket.id,20000n)).toHaveProperty('err');expect(unwrap(await api.myRecords())).toEqual([]);
    api.setIdentity(alice);expect(await api.finishRun(ticket.id,9999n)).toHaveProperty('err');expect(await api.finishRun(ticket.id,60000n)).toHaveProperty('err');
    await wait(60_000);const saved=unwrap(await api.finishRun(ticket.id,59000n));expect(saved.record.bestMs).toBe(59000n);expect(saved.newBest).toBe(true);
  });
  it('makes retry idempotent without double-counting, and refuses rewritten receipts',async()=>{
    const ticket=unwrap(await api.startRun('old-road',1n));await wait(60_000);
    const saved=unwrap(await api.finishRun(ticket.id,60000n));expect(saved.newBest).toBe(false);expect(saved.record.completions).toBe(2n);
    expect(unwrap(await api.finishRun(ticket.id,60000n))).toEqual(saved);expect(await api.finishRun(ticket.id,50000n)).toHaveProperty('err');
  });
  it('updates a personal best and keeps each track independent',async()=>{
    const ticket=unwrap(await api.startRun('old-road',1n));await wait(50_000);expect(unwrap(await api.finishRun(ticket.id,49000n)).newBest).toBe(true);
    const ridge=unwrap(await api.startRun('relay-ridge',1n));await wait(90_000);unwrap(await api.finishRun(ridge.id,89000n));
    const records=unwrap(await api.myRecords());expect(records).toHaveLength(2);expect(records.find(r=>r.track==='old-road')?.bestMs).toBe(49000n);
    api.setIdentity(bob);expect(unwrap(await api.myRecords())).toEqual([]);api.setIdentity(alice);
  });
  it('replaces abandoned runs, rate-limits restarts and expires old tickets',async()=>{
    const old=unwrap(await api.startRun('finality-quarry',1n));expect(await api.startRun('finality-quarry',1n)).toHaveProperty('err');
    await wait(3_000);const current=unwrap(await api.startRun('finality-quarry',1n));await wait(90_000);
    expect(await api.finishRun(old.id,80000n)).toHaveProperty('err');await wait(3_600_000);expect(await api.finishRun(current.id,89000n)).toHaveProperty('err');
  });
  it('preserves personal records, active tickets and retry receipts across upgrades',async()=>{
    const before=unwrap(await api.myRecords());const run=unwrap(await api.startRun('finality-quarry',1n));await wait(100_000);
    await pic.upgradeCanister({canisterId,wasm,sender:alice.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
    expect(unwrap(await api.myRecords())).toEqual(before);const saved=unwrap(await api.finishRun(run.id,99000n));
    await pic.upgradeCanister({canisterId,wasm,sender:alice.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
    expect(unwrap(await api.finishRun(run.id,99000n))).toEqual(saved);expect(unwrap(await api.myRecords())).toHaveLength(3);
  });
  it('keeps nine legacy records plus the easier first course separate across an upgrade',async()=>{
    const legacy=unwrap(await api.myRecords());
    for(const rules of [2n,3n])for(const track of ['old-road','relay-ridge','finality-quarry']) {
      const run=unwrap(await api.startRun(track,rules));await wait(70_000);
      const saved=unwrap(await api.finishRun(run.id,69000n));expect(saved.record.completions).toBe(1n);expect(saved.newBest).toBe(true);
    }
    const easy=unwrap(await api.startRun('old-road',4n));await wait(50_000);
    const easySaved=unwrap(await api.finishRun(easy.id,49000n));expect(easySaved.newBest).toBe(true);expect(easySaved.record.completions).toBe(1n);
    await pic.upgradeCanister({canisterId,wasm,sender:alice.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
    const records=unwrap(await api.myRecords());expect(records).toHaveLength(10);expect(records.filter(r=>r.rulesVersion===1n)).toEqual(legacy);
    expect(records.filter(r=>r.rulesVersion===4n)).toEqual([easySaved.record]);
    api.setIdentity(bob);expect(unwrap(await api.myRecords())).toEqual([]);api.setIdentity(alice);
  });
});

it.skipIf(!process.env.RECORDS_UPGRADE_FROM)('upgrades the supplied previous-release Wasm preserving profile, legacy times, receipt and active ticket',async()=>{
  const fixture=await pic.setupCanister<RecordsApi>({idlFactory,wasm:process.env.RECORDS_UPGRADE_FROM!,sender:bob.getPrincipal()});const old=fixture.actor;old.setIdentity(bob);
  const profile=unwrap(await old.saveProfile({...unwrap(await old.ensureProfile()),nickname:'Rock Tester',listed:true,skin:{color:'mint',wheels:'rally',decal:'404'}}));
  const prior=unwrap(await old.startRun('old-road',4n));await wait(60_000);const saved=unwrap(await old.finishRun(prior.id,59000n));
  const active=unwrap(await old.startRun('relay-ridge',3n));await wait(60_000);
  await pic.upgradeCanister({canisterId:fixture.canisterId,wasm,sender:bob.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
  expect(unwrap(await old.myRecords())).toEqual([saved.record]);expect(unwrap(await old.myProfile())).toEqual([profile]);
  expect(unwrap(await old.finishRun(prior.id,59000n))).toEqual(saved);
  expect(unwrap(await old.leaderboard('old-road',5n))).toEqual([]);
  expect(await old.leaderboard('old-road',4n)).toHaveProperty('err');
  expect(unwrap(await old.finishRun(active.id,59000n)).record.rulesVersion).toBe(3n);
  for(const [track,rules] of [['old-road',5n],['relay-ridge',4n],['finality-quarry',4n]] as const) {
    const current=unwrap(await old.startRun(track,rules));await wait(60_000);
    const result=unwrap(await old.finishRun(current.id,58000n));expect(result.record.completions).toBe(1n);
    expect(unwrap(await old.leaderboard(track,rules))).toEqual([{nickname:profile.nickname,skin:profile.skin,bestMs:58000n,completions:1n,isYou:true}]);
  }
  const records=unwrap(await old.myRecords());expect(records).toHaveLength(5);expect(records.find(r=>r.track==='old-road' && r.rulesVersion===4n)).toEqual(saved.record);
});

it('retains all thirteen supported historical and current course records',async()=>{
  api.setIdentity(createIdentity('all-course-versions'));
  for(const track of ['old-road','relay-ridge','finality-quarry']) for(let rules=1n;rules<=(track==='old-road'?5n:4n);rules++) {
    const run=unwrap(await api.startRun(track,rules));await wait(30_000);unwrap(await api.finishRun(run.id,29000n));
  }
  const records=unwrap(await api.myRecords());expect(records).toHaveLength(13);
  await pic.upgradeCanister({canisterId,wasm,sender:alice.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
  expect(unwrap(await api.myRecords())).toEqual(records);
});

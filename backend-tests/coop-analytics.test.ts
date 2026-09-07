import {afterAll,beforeAll,expect,it} from 'vitest';
import {PocketIc,PocketIcServer,createIdentity,type Actor} from '@dfinity/pic';
import {Principal} from '@icp-sdk/core/principal';
import {roomsIdl,roomValue,type RoomsApi} from '../src/services/rooms-api';
let server:PocketIcServer,pic:PocketIc;
const host=createIdentity('analytics-host'),guest=createIdentity('analytics-guest'),other=createIdentity('analytics-other'),reader=createIdentity('analytics-reader');
const wasm='.mops/.build/rooms.wasm',code='a123456789abcdef0123',offer='v=0\r\nanalytics-offer';
const ok=<T>(r:{ok:T}|{err:string}):T=>{if('err'in r)throw new Error(r.err);return r.ok;};
beforeAll(async()=>{server=await PocketIcServer.start();pic=await PocketIc.create(server.getUrl());});
afterAll(async()=>{await pic?.tearDown();await server?.stop();});
async function create(old?:string){const f=await pic.setupCanister<RoomsApi>({idlFactory:roomsIdl,wasm:old??wasm,sender:host.getPrincipal()});f.actor.setIdentity(host);return f;}
async function upgrade(id:Principal){await pic.upgradeCanister({canisterId:id,wasm,sender:host.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});}
async function pair(api:Actor<RoomsApi>){api.setIdentity(host);const view=roomValue(await api.create(code,'map:1',offer));api.setIdentity(guest);roomValue(await api.join(code));return view.sessionId[0]!;}
it('counts accepted creation and guest claim once; denied and duplicate calls do not inflate totals',async()=>{
 const {actor:a}=await create();const before=ok(await a.adminStatistics());expect(before.roomsCreated).toBe(0n);
 const view=roomValue(await a.create(code,'map:1',offer));expect(view.sessionId).toHaveLength(1);
 expect(roomValue(await a.create(code,'map:1',offer))).toEqual(view);expect(await a.join(code)).toHaveProperty('err');
 a.setPrincipal(Principal.anonymous());expect(await a.join(code)).toHaveProperty('err');expect(await a.adminStatistics()).toHaveProperty('err');
 a.setIdentity(guest);roomValue(await a.join(code));roomValue(await a.join(code));
 a.setIdentity(other);expect(await a.join(code)).toHaveProperty('err');a.setIdentity(host);
 expect(ok(await a.adminStatistics())).toMatchObject({since:before.since,roomsCreated:1n,guestsJoined:1n,pairsConnected:0n,expeditionsStarted:0n});
});
it('both signed participants must report; reordered and retried milestones count one first start per room',async()=>{
 const {actor:a}=await create();const id=await pair(a);
 a.setIdentity(other);expect(await a.report(id,{connected:null})).toHaveProperty('err');
 a.setIdentity(host);ok(await a.report(id,{connected:null}));ok(await a.report(id,{started:null}));
 expect(ok(await a.adminStatistics())).toMatchObject({pairsConnected:0n,expeditionsStarted:0n});
 a.setIdentity(guest);ok(await a.report(id,{started:null}));ok(await a.report(id,{connected:null}));ok(await a.report(id,{started:null}));
 a.setIdentity(host);ok(await a.report(id,{connected:null}));expect(ok(await a.adminStatistics())).toMatchObject({pairsConnected:1n,expeditionsStarted:1n});
});
it('reporting survives invite closure and expiry, but stops after six hours with lifetime totals retained',async()=>{
 const {actor:a}=await create();const id=await pair(a);await a.close(code);
 await pic.advanceTime(601000);await pic.tick();ok(await a.report(id,{connected:null}));
 a.setIdentity(host);ok(await a.report(id,{connected:null}));const before=ok(await a.adminStatistics());expect(before.pairsConnected).toBe(1n);
 await pic.advanceTime(21600001);await pic.tick();expect(await a.report(id,{started:null})).toHaveProperty('err');expect(ok(await a.adminStatistics())).toEqual(before);
 roomValue(await a.create(code,'map:1',offer));expect(ok(await a.adminStatistics()).roomsCreated).toBe(2n);
});
it('grants are private, bounded, survive upgrades and respect revocation and controller changes',async()=>{
 const {actor:a,canisterId}=await create();const id=await pair(a);a.setIdentity(host);ok(await a.setStatisticsReader(reader.getPrincipal(),true));
 expect(await a.setStatisticsReader(Principal.anonymous(),true)).toHaveProperty('err');
 for(let i=0;i<7;i++)ok(await a.setStatisticsReader(createIdentity(`coop-reader-${i}`).getPrincipal(),true));
 expect(await a.setStatisticsReader(other.getPrincipal(),true)).toHaveProperty('err');ok(await a.setStatisticsReader(reader.getPrincipal(),true));
 ok(await a.report(id,{connected:null}));const before=ok(await a.adminStatistics());await upgrade(canisterId);
 a.setIdentity(reader);expect(ok(await a.adminStatistics())).toEqual(before);expect(await a.listStatisticsReaders()).toHaveProperty('err');expect(await a.report(id,{connected:null})).toHaveProperty('err');
 expect(await a.setStatisticsReader(other.getPrincipal(),true)).toHaveProperty('err');
 a.setIdentity(guest);ok(await a.report(id,{connected:null}));a.setIdentity(host);expect(ok(await a.adminStatistics()).pairsConnected).toBe(1n);
 ok(await a.setStatisticsReader(reader.getPrincipal(),false));a.setIdentity(reader);expect(await a.adminStatistics()).toHaveProperty('err');a.setIdentity(host);ok(await a.setStatisticsReader(reader.getPrincipal(),true));
 await pic.updateCanisterSettings({canisterId,sender:host.getPrincipal(),controllers:[other.getPrincipal()]});a.setIdentity(reader);expect(await a.adminStatistics()).toHaveProperty('err');
});
it.skipIf(!process.env.ROOMS_UPGRADE_FROM)('upgrades the real pre-analytics Wasm without losing a live invite or inventing historical counts',async()=>{
 const prior=process.env.ROOMS_UPGRADE_FROM;if(!prior)throw new Error('ROOMS_UPGRADE_FROM must point to the retained 0.7.0 Wasm');
 const {actor:a,canisterId}=await create(prior);roomValue(await a.create(code,'map:old',offer));a.setIdentity(guest);roomValue(await a.join(code));roomValue(await a.answer(code,'v=0\r\nretained-answer'));
 await upgrade(canisterId);a.setIdentity(host);expect(roomValue(await a.poll(code))).toMatchObject({mapKey:'map:old',joined:true,answer:['v=0\r\nretained-answer'],sessionId:[]});
 expect(ok(await a.adminStatistics())).toMatchObject({roomsCreated:0n,guestsJoined:0n,pairsConnected:0n,expeditionsStarted:0n});
 await a.close(code);const id=await pair(a);ok(await a.report(id,{connected:null}));a.setIdentity(host);ok(await a.report(id,{connected:null}));
 const before=ok(await a.adminStatistics());await upgrade(canisterId);expect(ok(await a.adminStatistics())).toEqual(before);
});

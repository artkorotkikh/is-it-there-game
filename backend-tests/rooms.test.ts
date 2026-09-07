import {afterAll,beforeAll,expect,it} from 'vitest';
import {PocketIc,PocketIcServer,createIdentity,type Actor} from '@dfinity/pic';
import {Principal} from '@icp-sdk/core/principal';
import {roomsIdl,roomValue,type RoomsApi} from '../src/services/rooms-api';
let server:PocketIcServer,pic:PocketIc,api:Actor<RoomsApi>,canisterId:Principal;
const host=createIdentity('room-host'),guest=createIdentity('room-guest'),outsider=createIdentity('room-outsider');
const code='0123456789abcdef0123',offer='v=0\r\nexample-offer',answer='v=0\r\nexample-answer',wasm='.mops/.build/rooms.wasm';
beforeAll(async()=>{server=await PocketIcServer.start();pic=await PocketIc.create(server.getUrl());const fixture=await pic.setupCanister<RoomsApi>({idlFactory:roomsIdl,wasm,sender:host.getPrincipal()});api=fixture.actor;canisterId=fixture.canisterId;});
afterAll(async()=>{await pic?.tearDown();await server?.stop();});
it('rejects anonymous access, invalid codes and oversized signaling',async()=>{api.setPrincipal(Principal.anonymous());expect(await api.create(code,'map:1',offer)).toHaveProperty('err');api.setIdentity(host);expect(await api.create('bad','map:1',offer)).toHaveProperty('err');expect(await api.create(code,'map:1','x'.repeat(32_001))).toHaveProperty('err');});
it('binds the two seats to callers; retries retain the same room and answer',async()=>{
  api.setIdentity(host);const created=roomValue(await api.create(code,'map:1',offer));expect(roomValue(await api.create(code,'map:1',offer))).toEqual(created);
  expect(await api.join(code)).toEqual({err:expect.stringContaining('different account')});
  api.setIdentity(outsider);expect(await api.poll(code)).toHaveProperty('err');await api.close(code);
  api.setIdentity(guest);expect(roomValue(await api.join(code)).offer).toBe(offer);expect(roomValue(await api.join(code)).joined).toBe(true);
  roomValue(await api.answer(code,answer));roomValue(await api.answer(code,answer));expect(await api.answer(code,answer+'changed')).toHaveProperty('err');
  api.setIdentity(outsider);expect(await api.join(code)).toHaveProperty('err');expect(await api.answer(code,answer)).toHaveProperty('err');
  api.setIdentity(host);expect(roomValue(await api.poll(code)).answer).toEqual([answer]);
});
it('preserves membership and bounded signaling across a canister upgrade',async()=>{
  await pic.upgradeCanister({canisterId,wasm,sender:host.getPrincipal(),upgradeModeOptions:{skip_pre_upgrade:[],wasm_memory_persistence:[{keep:null}]}});
  api.setIdentity(host);expect(roomValue(await api.poll(code)).answer).toEqual([answer]);api.setIdentity(outsider);expect(await api.poll(code)).toHaveProperty('err');
});
it('expires abandoned invites and allows member cancellation',async()=>{
  await pic.advanceTime(601_000);await pic.tick();api.setIdentity(host);expect(await api.poll(code)).toHaveProperty('err');roomValue(await api.create(code,'map:1',offer));api.setIdentity(guest);roomValue(await api.join(code));await api.close(code);api.setIdentity(host);expect(await api.poll(code)).toHaveProperty('err');
});
it('a returning account replaces only its own previous invite',async()=>{
  const replacement='1123456789abcdef0123',other='2123456789abcdef0123';
  api.setIdentity(host);roomValue(await api.create(code,'map:1',offer));
  api.setIdentity(outsider);roomValue(await api.create(other,'map:1',offer));
  api.setIdentity(host);roomValue(await api.create(replacement,'map:1',offer));
  expect(await api.poll(code)).toHaveProperty('err');expect(roomValue(await api.poll(replacement)).offer).toBe(offer);
  api.setIdentity(outsider);expect(roomValue(await api.poll(other)).offer).toBe(offer);
});

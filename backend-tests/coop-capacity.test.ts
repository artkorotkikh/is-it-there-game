import {expect,it} from 'vitest';
import {PocketIc,PocketIcServer,createIdentity} from '@dfinity/pic';
import {roomsIdl,roomValue,type RoomsApi} from '../src/services/rooms-api';
it('evicts the oldest reporting session at capacity without blocking rooms or losing lifetime totals',async()=>{
 const server=await PocketIcServer.start();const pic=await PocketIc.create(server.getUrl());
 try{
  const owner=createIdentity('capacity-owner');const {actor:a}=await pic.setupCanister<RoomsApi>({idlFactory:roomsIdl,wasm:'.mops/.build/rooms.wasm',sender:owner.getPrincipal()});a.setIdentity(owner);
  let oldest=0n;
  for(let i=0;i<5001;i++){
   const view=roomValue(await a.create(i.toString(16).padStart(20,'0'),'map:1','v=0\r\ncapacity-offer'));if(i===0)oldest=view.sessionId[0]!;
  }
  const stats=await a.adminStatistics();expect(stats).toMatchObject({ok:{roomsCreated:5001n,sessionsEvicted:1n}});
  expect(await a.report(oldest,{connected:null})).toHaveProperty('err');expect(await a.report(5001n,{connected:null})).toHaveProperty('ok');
 }finally{await pic.tearDown();await server.stop();}
},240000);

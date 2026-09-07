import {afterEach,beforeAll,expect,it} from 'vitest';
import {initPhysics,Simulation} from '../src/game/simulation';
import {mapTrack} from '../src/game/maps/catalog';
import {parseMap} from '../src/game/maps/schema';
import rawMap from '../src/game/maps/data/forest-crossing.json';
import {neutralInput} from '../src/game/types';
import {InputMailbox,SnapshotBuffer,validSnapshot,validCrewProfile,mapKey} from '../src/network/protocol';
import {config} from '../src/game/config';
import {placePlayer} from './cargo-helpers';
let s:Simulation;const worlds:Simulation[]=[];beforeAll(initPhysics);afterEach(()=>worlds.splice(0).forEach(world=>world.destroy()));
function create(){s=new Simulation('road',mapTrack(parseMap(rawMap)));worlds.push(s);s.addPlayer();for(let i=0;i<60;i++)s.step();return s;}
it('peers agree on map identity only with matching map content and prop dimensions',async()=>{
  const map=parseMap(rawMap),key=await mapKey(map);
  expect(await mapKey(structuredClone(map))).toBe(key);
  const changed=structuredClone(map);changed.terrain.heights[0]+=.1;
  expect(await mapKey(changed)).not.toBe(key);
  const dimensions=config.fieldKit.plank as {length:number},length=dimensions.length;
  try{dimensions.length=length-.5;expect(await mapKey(map)).not.toBe(key);}
  finally{dimensions.length=length;}
  expect(await mapKey(map)).toBe(key);
});
it('crew presentation accepts catalog cosmetics and bounds untrusted names and assets',()=>{
  const profile={nickname:'Дорожный Друг',skin:{color:'mint',wheels:'stock',decal:'ship'}};
  expect(validCrewProfile(profile)).toBe(true);
  for(const nickname of ['<script>alert(1)</script>','a'.repeat(25),'ab'])expect(validCrewProfile({...profile,nickname})).toBe(false);
  expect(validCrewProfile({...profile,skin:{...profile.skin,color:'https://external.example/avatar'}})).toBe(false);
  expect(validCrewProfile({...profile,skin:null})).toBe(false);
});
function guestAt(x:number,z:number){const guest=s.snapshot('guest-player').player;let body:import('@dimforge/rapier3d-compat').RigidBody|undefined;s.world.forEachRigidBody(b=>{if(b.isKinematic()&&Math.hypot(b.translation().x-guest.position.x,b.translation().z-guest.position.z)<.01)body=b;});const p={x,y:s.level.groundHeight(x,z)+1,z};body!.setTranslation(p,true);body!.setNextKinematicTranslation(p);}
it('two players compete for one prop without duplicating it',()=>{create();placePlayer(s,5,7);guestAt(5,7);s.action('interact');s.action('interact','guest-player');expect(s.fieldKit!.carried()?.id).toBe('plank-1');expect(s.fieldKit!.carried('guest-player')?.id).not.toBe('plank-1');expect(s.snapshot('guest-player').fieldKit!.carriedId).not.toBe('plank-1');});
it('guest can drive while the host rides, then they can swap roles',()=>{
 create();guestAt(-3.1,3);s.action('interact','guest-player');expect(s.snapshot('guest-player').player.driving,s.message).toBe(true);
 placePlayer(s,3.1,3);s.action('interact');expect(s.snapshot().player.passenger).toBe(true);s.stepPlayers({'guest-player':neutralInput()});
 const start=s.vehicle.translation().z;for(let i=0;i<90;i++)s.stepPlayers({'guest-player':{...neutralInput(),moveZ:1}});expect(s.vehicle.translation().z).toBeGreaterThan(start+1);
 s.action('interact','guest-player');s.action('interact');placePlayer(s,-3.1,s.vehicle.translation().z);s.action('interact');expect(s.snapshot().player.driving,s.message).toBe(true);expect(s.snapshot('guest-player').player.driving).toBe(false);
});
it('both characters move independently and snapshots carry their real owners',()=>{create();for(let i=0;i<60;i++)s.stepPlayers({'local-player':{...neutralInput(),moveZ:1},'guest-player':{...neutralInput(),moveZ:-1}});expect(s.snapshot().player.position.z).toBeGreaterThan(1);expect(s.snapshot('guest-player').player.position.z).toBeLessThan(-1);expect(validSnapshot(s.snapshot('guest-player'))).toBe(true);const bad=structuredClone(s.snapshot('guest-player'));bad.vehicle.position.x=NaN;expect(validSnapshot(bad)).toBe(false);});
it('reordered or stale input cannot keep a vanished guest accelerating',()=>{const inbox=new InputMailbox();expect(inbox.accept(2,{...neutralInput(),push:false,moveZ:20},0)).toBe(true);expect(inbox.read(100).moveZ).toBe(1);expect(inbox.accept(1,{...neutralInput(),push:false,moveZ:-1},150)).toBe(false);expect(inbox.read(351).moveZ).toBe(0);expect(inbox.accept(3,{...neutralInput(),push:false,yaw:NaN},500)).toBe(false);});
it('snapshot interpolation discards stale states and never extrapolates physics',()=>{create();const buffer=new SnapshotBuffer(),a=s.snapshot('guest-player');for(let i=0;i<6;i++)s.step();const b=s.snapshot('guest-player');buffer.push(a,100);buffer.push(b,200);buffer.push(a,210);buffer.sample(200);expect(buffer.sample(250)?.alpha).toBeCloseTo(.5);expect(buffer.sample(500)?.alpha).toBe(1);expect(buffer.sample(500)?.current.tick).toBe(b.tick);});

it('rejects unsafe or unknown cargo event fields in snapshots',()=>{create();const snapshot=s.snapshot('guest-player');snapshot.events=[{sequence:1,kind:'eject',type:'winch'}];expect(validSnapshot(snapshot)).toBe(true);snapshot.events=[{sequence:1,kind:'eject',type:'unknown'} as never];expect(validSnapshot(snapshot)).toBe(false);snapshot.events=[{sequence:Number.MAX_SAFE_INTEGER+1,kind:'eject',type:'winch'} as never];expect(validSnapshot(snapshot)).toBe(false);});
it('the helper owns the cable and operates it independently of the driver',()=>{
 create();const mount=s.mount();guestAt(mount.x,mount.z+1);s.action('winch','guest-player');expect(s.snapshot().winch.carrierId).toBe('guest-player');
 placePlayer(s,mount.x,mount.z+1);s.action('winch');expect(s.snapshot().winch.carrierId).toBe('guest-player');
 const anchor=s.level.anchors[0];guestAt(anchor.x,anchor.z-1);s.action('interact','guest-player');expect(s.snapshot().winch.phase,s.message).toBe('attached');
 const length=s.snapshot().winch.length;for(let i=0;i<12;i++)s.stepPlayers({'local-player':{...neutralInput(),reel:1}});expect(s.snapshot().winch.length).toBe(length);
 for(let i=0;i<12;i++)s.stepPlayers({'guest-player':{...neutralInput(),reel:1}});expect(s.snapshot().winch.length).toBeLessThan(length);
});

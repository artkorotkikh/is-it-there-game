import {afterEach,beforeAll,expect,it} from 'vitest';
import {Simulation,initPhysics} from '../src/game/simulation';
import {mapTrack,expeditionMaps} from '../src/game/maps/catalog';
import {config} from '../src/game/config';
import {neutralInput,type CanisterType} from '../src/game/types';
import {validAction,validSnapshot,validTargetId} from '../src/network/protocol';
import {advance,placePlayer,atSocket} from './cargo-helpers';

const worlds:Simulation[]=[];beforeAll(initPhysics);afterEach(()=>worlds.splice(0).forEach(s=>s.destroy()));
function create(){const s=new Simulation('road',mapTrack(expeditionMaps[0]));worlds.push(s);advance(s,1);return s;}
function loose(s:Simulation,type:CanisterType,x:number,z:number){
  s.canisters.eject(type);const item=s.canisters.items[type];
  item.body.setTranslation({x,y:s.level.groundHeight(x,z)+config.cargo.halfHeight+.03,z},true);
  item.body.setLinvel({x:0,y:0,z:0},true);item.body.setAngvel({x:0,y:0,z:0},true);
}
function crowded(s:Simulation){
  const plank=s.fieldKit!.items.find(item=>item.id==='plank-1')!;
  plank.position={x:1.04,y:s.level.groundHeight(1.04,2)+.13,z:2};plank.rotation={x:0,y:0,z:0,w:1};
  plank.phase='placed';plank.body.setTranslation(plank.position,true);plank.body.setRotation(plank.rotation,true);
  loose(s,'winch',2,1.9);loose(s,'skills',2.7,1.4);placePlayer(s,2,1);
}
function select(s:Simulation,id:string,player='local-player'){
  for(let i=0;i<40&&s.snapshot(player).interaction.target?.id!==id;i++)s.action('cycleTarget',player);
  expect(s.snapshot(player).interaction.target?.id).toBe(id);
}
it('loose cargo wins over a loaded plank and bus, and the chosen module is picked up',()=>{
  const s=create();crowded(s);const target=s.snapshot().interaction;
  expect(target.target?.id).toMatch(/^cargo:/);expect(target.kind).toBe('pickup');
  expect(s.prompt()).toBe(target.prompt);s.action('interact','local-player',target.target!.id);
  expect(s.canisters.carried()).toBe(target.type);expect(s.fieldKit!.carried()).toBeUndefined();
});
it('cycling selects either canister, the bus and blocked supports without moving',()=>{
  const s=create();crowded(s);select(s,'resource:plank-1');
  expect(s.snapshot().interaction.kind).toBe('blocked');expect(s.prompt()).toContain('in use');
  s.action('interact');expect(s.fieldKit!.carried()).toBeUndefined();
  select(s,'bus:enter');expect(s.snapshot().interaction.kind).toBe('enter');
  select(s,'cargo:skills');const position=s.snapshot().player.position;
  advance(s,.2);expect(s.snapshot().interaction.target?.id).toBe('cargo:skills');
  s.action('interact');expect(s.canisters.carried()).toBe('skills');expect(s.player.translation().x).toBeCloseTo(position.x,2);
});
it('a closer module does not hide a second canister in the same pile',()=>{
  const s=create();loose(s,'winch',-5,10);loose(s,'skills',-5,10.65);placePlayer(s,-5,9.55);
  select(s,'cargo:skills');expect(s.snapshot().interaction.kind).toBe('pickup');
  s.action('interact');expect(s.canisters.carried()).toBe('skills');
});
it('solid bus geometry still blocks a canister; moving out of reach clears selection',()=>{
  const s=create();loose(s,'skills',0,3);placePlayer(s,1.5,3);
  select(s,'cargo:skills');expect(s.snapshot().interaction.kind).toBe('blocked');
  s.action('interact');expect(s.canisters.carried()).toBeNull();expect(s.message).toContain('Walk around');
  placePlayer(s,10,18);expect(s.snapshot().interaction.target).toBeUndefined();
});
it('stale explicit targets cannot pick a different item or place a just-picked prop',()=>{
  const s=create();crowded(s);const target=s.snapshot().interaction.target!.id;
  const type=s.snapshot().interaction.type!;s.canisters.items[type].body.setTranslation({x:20,y:4,z:20},true);advance(s,.1);
  s.action('interact','local-player',target);expect(s.canisters.carried()).toBeNull();expect(s.message).toContain('no longer');
  placePlayer(s,5,7);select(s,'resource:plank-2');s.action('interact','local-player','resource:plank-2');
  expect(s.fieldKit!.carried()?.id).toBe('plank-2');s.action('interact','local-player','resource:plank-2');expect(s.fieldKit!.carried()?.id).toBe('plank-2');
});
it('each teammate selects independently and a contested pickup never falls through',()=>{
  const s=create();s.addPlayer();crowded(s);
  const guest=s.snapshot('guest-player').player.position;
  s.world.forEachRigidBody(body=>{if(body.isKinematic()&&Math.hypot(body.translation().x-guest.x,body.translation().z-guest.z)<.01){const p={x:2.4,y:s.level.groundHeight(2.4,.9)+1,z:.9};body.setTranslation(p,true);body.setNextKinematicTranslation(p);}});
  advance(s,.1);select(s,'cargo:winch');select(s,'cargo:skills','guest-player');
  expect(s.snapshot().interaction.target?.id).toBe('cargo:winch');expect(validSnapshot(s.snapshot('guest-player'))).toBe(true);
  s.action('interact','local-player','cargo:skills');s.action('interact','guest-player','cargo:skills');
  expect(s.canisters.items.skills.carrierId).toBe('local-player');expect(s.snapshot('guest-player').canisters.some(item=>item.carrierId==='guest-player')).toBe(false);
});
it('cycling away from a held removal cancels it; selecting it again permits a normal removal',()=>{
  const s=create();atSocket(s,'cycles');select(s,'socket:cycles');s.action('interact');advance(s,.4,{interact:true});
  expect(s.snapshot().interaction.hold).toBeGreaterThan(0);s.action('cycleTarget');advance(s,1,{interact:true});expect(s.canisters.isDocked('cycles')).toBe(true);
  select(s,'socket:cycles');s.action('interact');advance(s,1,{interact:true});expect(s.canisters.carried()).toBe('cycles');
});
it('selection packets reject malformed target identities and counters',()=>{
  const s=create();s.addPlayer();crowded(s);const snapshot=s.snapshot('local-player');expect(validSnapshot(snapshot)).toBe(true);
  expect(validAction('cycleTarget')).toBe(true);expect(validTargetId('cargo:skills')).toBe(true);expect(validTargetId({id:'cargo:skills'})).toBe(false);
  expect(validSnapshot({...snapshot,interaction:{...snapshot.interaction,target:{...snapshot.interaction.target!,index:99,total:2}}})).toBe(false);
  s.step(neutralInput());
});

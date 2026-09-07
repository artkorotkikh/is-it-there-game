import {neutralInput,type InputFrame,type Action,type Snapshot} from '../game/types';
import type {MapDefinition} from '../game/maps/schema';
import {config} from '../game/config';
import {paintColors,wheelStyles,decalStyles,type BusSkin} from '../game/skin';
export interface CrewProfile {nickname:string;skin:BusSkin}
export const networkConfig={snapshotInterval:1/20,inputExpiryMs:350,stallMs:2000,interpolationMs:100,maxMessageBytes:48_000,maxBufferedBytes:96_000};
const actions:Action[]=['interact','winch','jump','drop','park','ping','cycleTarget'];
export const validAction=(v:unknown):v is Action=>actions.includes(v as Action);
export const validTargetId=(v:unknown):v is string|undefined=>v===undefined||(typeof v==='string'&&v.length<=128&&/^(cargo|socket|resource|bus|tree):[a-z0-9-]+$/.test(v));
const obj=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
/** Presentation only: never accept a principal, public-listing flag or arbitrary asset URL. */
export function validCrewProfile(v:unknown):v is CrewProfile {
  if(!obj(v)||typeof v.nickname!=='string'||!/^[A-Za-zА-Яа-яЁё0-9 _-]{3,24}$/.test(v.nickname)||!obj(v.skin))return false;
  const skin=v.skin;
  return paintColors.some(p=>p.id===skin.color)&&wheelStyles.some(p=>p.id===skin.wheels)&&decalStyles.some(p=>p.id===skin.decal);
}
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e9;
const vector=(v:unknown)=>obj(v)&&num(v.x)&&num(v.y)&&num(v.z);
const rotation=(v:unknown)=>vector(v)&&obj(v)&&num(v.w);
const flag=(v:unknown)=>typeof v==='boolean';
const str=(v:unknown)=>typeof v==='string'&&v.length<512;
const nullableString=(v:unknown)=>v===null||str(v);
const all=(o:Record<string,unknown>,keys:string[],test:(v:unknown)=>boolean)=>keys.every(k=>test(o[k]));
const list=(v:unknown,min:number,max:number,test:(v:unknown)=>boolean)=>Array.isArray(v)&&v.length>=min&&v.length<=max&&v.every(test);
function player(v:unknown){return obj(v)&&['local-player','guest-player'].includes(String(v.id))&&vector(v.position)&&num(v.yaw)&&all(v,['driving','grounded','passenger'],flag);}
function resource(v:unknown){return obj(v)&&str(v.id)&&['plank','stone'].includes(String(v.kind))&&['available','carried','placed'].includes(String(v.phase))&&nullableString(v.carrierId)&&vector(v.position)&&rotation(v.rotation);}
/** Reject malformed host packets before they reach render/physics-facing code. */
export function validSnapshot(v:unknown):v is Snapshot{
  if(!obj(v)||!str(v.trackId)||!num(v.tick)||!player(v.player)||!list(v.players,2,2,player))return false;
  const {vehicle:a,fieldKit:k,systems:s,interaction:i,recovery:r,winch:w,progress:p}=v;
  return obj(a)&&all(a,['position','velocity'],vector)&&rotation(a.rotation)&&all(a,['speed','steering','throttle','shock'],num)&&flag(a.parkingBrake)&&list(a.wheels,4,4,x=>obj(x)&&all(x,['suspension','rotation'],num))&&
    obj(k)&&list(k.items,0,32,resource)&&nullableString(k.carriedId)&&flag(k.pushing)&&(k.ping===null||vector(k.ping))&&(k.preview===null||(obj(k.preview)&&['plank','stone'].includes(String(k.preview.kind))&&vector(k.preview.position)&&rotation(k.preview.rotation)&&flag(k.preview.valid)&&str(k.preview.reason)&&list(k.preview.supports,0,32,str)))&&
    obj(s)&&all(s,['startupCompleted','driveInputArmed','engine','winch','doorOpen'],flag)&&num(s.loaded)&&['normal','swapped'].includes(String(s.skills))&&
    obj(i)&&['pickup','dock','remove','blocked','none','enter','right','attach'].includes(String(i.kind))&&nullableString(i.type)&&(i.position===null||vector(i.position))&&str(i.prompt)&&num(i.hold)&&
    (i.target===undefined||(obj(i.target)&&typeof i.target.id==='string'&&validTargetId(i.target.id)&&str(i.target.label)&&Number.isInteger(i.target.index)&&Number.isInteger(i.target.total)&&Number(i.target.index)>=1&&Number(i.target.index)<=Number(i.target.total)&&Number(i.target.total)<=40))&&
    obj(r)&&flag(r.available)&&all(r,['charge','cooldown','kicks','animation'],num)&&
    obj(w)&&['stowed','carried','attached'].includes(String(w.phase))&&all(w,['length','span','tension'],num)&&all(w,['mount','end'],vector)&&nullableString(w.carrierId)&&nullableString(w.operatorId)&&
    obj(p)&&all(p,['enteredDitch','recovered','finished'],flag)&&num(p.elapsed)&&obj(p.ejected)&&all(p.ejected,['winch','cycles','skills'],flag)&&
    list(v.canisters,3,3,c=>obj(c)&&str(c.id)&&['winch','cycles','skills'].includes(String(c.type))&&['loose','carried','docked'].includes(String(c.phase))&&nullableString(c.carrierId)&&all(c,['position','velocity','angularVelocity','socket'],vector)&&rotation(c.rotation)&&num(c.rattle))&&
    list(v.events,0,64,e=>obj(e)&&num(e.sequence)&&str(e.kind)&&str(e.type));
}
export function parsePacket(raw:unknown):Record<string,unknown>|null{
  if(typeof raw!=='string'||raw.length>networkConfig.maxMessageBytes)return null;
  try{const v:unknown=JSON.parse(raw);return obj(v)&&str(v.type)?v:null;}catch{return null;}
}
export function readInput(v:unknown):InputFrame|null{
  if(!obj(v)||!all(v,['moveX','moveZ','yaw','reel'],num)||!all(v,['sprint','brake','interact','push'],flag))return null;
  return {moveX:Math.max(-1,Math.min(1,Number(v.moveX))),moveZ:Math.max(-1,Math.min(1,Number(v.moveZ))),reel:Math.max(-1,Math.min(1,Number(v.reel))),yaw:Number(v.yaw)%(Math.PI*2),sprint:Boolean(v.sprint),brake:Boolean(v.brake),interact:Boolean(v.interact),push:Boolean(v.push)};
}
/** Sequence + watchdog prevent reordered packets or a vanished tab holding throttle. */
export class InputMailbox{
  private sequence=-1;private at=-Infinity;private frame=neutralInput();
  accept(sequence:unknown,value:unknown,now:number){const frame=readInput(value);if(typeof sequence!=='number'||!Number.isSafeInteger(sequence)||sequence<=this.sequence||!frame)return false;this.sequence=sequence;this.frame=frame;this.at=now;return true;}
  read(now:number){return now-this.at>networkConfig.inputExpiryMs?{...neutralInput(),yaw:this.frame.yaw}:this.frame;}
  clear(){this.frame={...neutralInput(),yaw:this.frame.yaw};this.at=-Infinity;}
}
export class SnapshotBuffer{
  private frames:{at:number;snapshot:Snapshot}[]=[];
  clear(){this.frames=[];}
  push(snapshot:Snapshot,now:number){if(snapshot.tick<=(this.frames.at(-1)?.snapshot.tick??-1))return;this.frames.push({at:now,snapshot});if(this.frames.length>12)this.frames.shift();}
  sample(now:number){const target=now-networkConfig.interpolationMs;while(this.frames.length>2&&this.frames[1].at<=target)this.frames.shift();const a=this.frames[0],b=this.frames[1]??a;if(!a)return null;return {previous:a.snapshot,current:b.snapshot,alpha:a===b?1:Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at)))};}
}
// Prop dimensions are shared by physics and rendering; mixed tunings must not join.
export async function mapKey(map:MapDefinition){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({map,fieldKit:config.fieldKit})));return `${map.id}:${map.version}:${Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')}:net3`;}

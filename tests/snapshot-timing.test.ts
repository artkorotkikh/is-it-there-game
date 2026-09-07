import {expect,it} from 'vitest';
import {SnapshotBuffer} from '../src/network/protocol';
import type {Snapshot} from '../src/game/types';
// A labelled constant-speed trajectory isolates transport timing from physics.
const frame=(tick:number)=>({tick,player:{position:{x:tick/60,y:0,z:0}}}) as Snapshot;
function position(buffer:SnapshotBuffer,now:number){const s=buffer.sample(now)!;return s.previous.player.position.x+(s.current.player.position.x-s.previous.player.position.x)*s.alpha;}
it('renders constant speed despite alternating packet delays and a missing snapshot',()=>{
 const buffer=new SnapshotBuffer();
 const arrivals=[[0,0],[85,3],[100,6],[185,9],[200,12],[285,15],[300,18],[400,24],[485,27],[500,30]];
 let index=0,last=0;
 for(let now=0;now<=500;now+=10){
  while(index<arrivals.length&&arrivals[index][0]<=now){const [at,tick]=arrivals[index++];buffer.push(frame(tick),at);}
  const x=position(buffer,now);
  if(now>100)expect(x-last).toBeCloseTo(.01,8);
  else expect(x).toBe(0);
  last=x;
 }
});
it('late bursts cannot rewind movement; underruns hold and refill before resuming',()=>{
 const buffer=new SnapshotBuffer();for(const tick of [0,3,6])buffer.push(frame(tick),100);
 expect(position(buffer,100)).toBe(0);
 expect(position(buffer,150)).toBeCloseTo(.05);
 expect(position(buffer,500)).toBeCloseTo(.1);
 buffer.push(frame(9),510);expect(position(buffer,510)).toBeCloseTo(.1);
 buffer.push(frame(12),550);expect(position(buffer,550)).toBeCloseTo(.1);
 expect(position(buffer,560)).toBeCloseTo(.11);
 buffer.push(frame(3),565);expect(position(buffer,570)).toBeCloseTo(.12);
});
it('pause/restart reset playback timing and accept a fresh lower tick',()=>{
 const buffer=new SnapshotBuffer();buffer.push(frame(600),0);buffer.push(frame(606),100);position(buffer,100);position(buffer,150);
 buffer.clear();expect(buffer.sample(5000)).toBeNull();
 buffer.push(frame(0),5000);expect(position(buffer,5000)).toBe(0);
 buffer.push(frame(6),5100);expect(position(buffer,5100)).toBe(0);
 expect(position(buffer,5150)).toBeCloseTo(.05);
});
it('bounds queued history after a suspended renderer and never extrapolates',()=>{
 const buffer=new SnapshotBuffer();for(let tick=0;tick<=60;tick+=3)buffer.push(frame(tick),tick);
 const first=position(buffer,1000);expect(first).toBeGreaterThan(0);expect(first).toBeLessThan(1);
 expect(position(buffer,5000)).toBe(1);expect(position(buffer,6000)).toBe(1);
});

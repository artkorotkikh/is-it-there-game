import { afterEach, beforeAll, expect, it } from 'vitest';
import { initPhysics, Simulation } from '../src/game/simulation';
import { advance, loadAll } from './cargo-helpers';
import { neutralInput } from '../src/game/types';
import { config } from '../src/game/config';
const worlds:Simulation[]=[];
beforeAll(initPhysics);afterEach(()=>worlds.splice(0).forEach(sim=>sim.destroy()));
function loadedRoad() {const sim=new Simulation();worlds.push(sim);advance(sim,1);loadAll(sim);sim.action('interact');return sim;}
for(const speed of [3,4]) it(`first delivery is completable at ${speed} m/s without losing cargo or needing the winch`,()=>{
  const sim=loadedRoad();let minUp=1;
  for(let i=0;i<3600 && !sim.snapshot().progress.finished;i++) {
    const s=sim.snapshot();sim.step({...neutralInput(),moveZ:s.vehicle.speed<speed ? 1:0,brake:s.vehicle.speed>speed+.2});
    const q=sim.vehicle.rotation();minUp=Math.min(minUp,1-2*(q.x*q.x+q.z*q.z));
  }
  expect(sim.snapshot().progress.finished,JSON.stringify(sim.snapshot().progress)).toBe(true);
  expect(sim.snapshot().progress.enteredDitch).toBe(true);
  expect(sim.canisters.loadedCount()).toBe(3);expect(sim.snapshot().progress.ejected).toEqual({winch:false,skills:false,cycles:false});
  expect(sim.snapshot().winch.phase).toBe('stowed');expect(sim.snapshot().recovery.kicks).toBe(0);expect(minUp).toBeGreaterThan(.85);
});
it('fast first-road driving still physically jolts a module loose',()=>{
  const sim=loadedRoad();let peak=0;
  for(let i=0;i<1200 && sim.canisters.loadedCount()===3;i++) {sim.step({...neutralInput(),moveZ:1});peak=Math.max(peak,sim.snapshot().vehicle.shock);}
  expect(peak).toBeGreaterThan(config.cargo.shockThreshold);expect(sim.canisters.isDocked('winch')).toBe(false);
  expect(sim.vehicle.translation().z).toBeLessThan(sim.level.track.finishZ);
});

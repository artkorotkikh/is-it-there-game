import type { Snapshot, Vec3 } from '../game/types';

/** Labels and input hints consume the same selected snapshot as the 3D outline. */
export class InteractionIndicator {
  private label=document.createElement('div');
  private cycle=document.createElement('button');
  constructor(parent:HTMLElement,prompt:HTMLElement,onCycle:()=>void) {
    this.label.id='interaction-target';this.label.className='interaction-target hidden';
    this.label.setAttribute('aria-live','polite');parent.append(this.label);
    this.cycle.id='interaction-cycle';this.cycle.type='button';this.cycle.className='interaction-cycle hidden';
    this.cycle.onclick=onCycle;prompt.after(this.cycle);
  }
  update(s:Snapshot,project:(p:Vec3)=>{x:number;y:number;behind:boolean},active:boolean,touch:boolean) {
    const {target,position,kind}=s.interaction;
    const point=position?project(position):null;
    const visible=active&&target&&point&&!point.behind&&point.x>0&&point.x<innerWidth&&point.y>0&&point.y<innerHeight;
    this.label.classList.toggle('hidden',!visible);
    this.cycle.classList.toggle('hidden',!active||!target||target.total<2||touch);
    if(!target)return;
    const label=`${target.label}${kind==='blocked'?' · blocked':''}`;
    if(this.label.textContent!==label)this.label.textContent=label;
    this.label.dataset.targetId=target.id;this.label.classList.toggle('blocked',kind==='blocked');
    if(point){this.label.style.left=`${Math.max(90,Math.min(innerWidth-90,point.x))}px`;this.label.style.top=`${point.y}px`;}
    const text=`X · Next target · ${target.index}/${target.total}`;
    if(this.cycle.textContent!==text)this.cycle.textContent=text;
  }
}

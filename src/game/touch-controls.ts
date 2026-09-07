import { Input } from './input';
import type { Snapshot } from './types';

export const touchDevice = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

/** Pointer capture keeps steering, camera and held actions independent. */
export class TouchControls {
  readonly enabled = touchDevice();
  private root = document.createElement('div');
  private stickPointer: number | null = null;
  private knob: HTMLElement;
  private pad: HTMLElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private held = new Map<number, HTMLButtonElement>();

  constructor(private input: Input, parent: HTMLElement) {
    document.documentElement.classList.toggle('touch-mode', this.enabled);
    this.root.id = 'touch-controls'; this.root.className = 'touch-controls hidden';
    this.root.innerHTML = '<div id="touch-stick" class="touch-stick" aria-label="Move or steer"><span class="stick-arrows">↑<br>← &nbsp; →<br>↓</span><i></i></div><span class="touch-look">Drag the view to look</span><div class="touch-actions"></div>';
    parent.append(this.root);
    this.pad = this.root.querySelector('.touch-stick')!;
    this.knob = this.pad.querySelector('i')!;
    for (const [code,label] of [['KeyE','Interact'],['KeyX','Next target'],['Space','Jump'],['KeyF','Cable'],['KeyP','Park'],['KeyG','Drop'],['KeyQ','Reel in'],['KeyR','Pay out'],['KeyB','Push'],['KeyT','Mark']]) {
      const button = document.createElement('button'); button.type='button'; button.textContent=label;
      button.id=`touch-${code}`; button.className='touch-button'; button.setAttribute('aria-label',label);
      this.root.querySelector('.touch-actions')!.append(button); this.buttons.set(code,button);
      button.addEventListener('pointerdown',event=>{
        if (!this.input.active || event.button!==0) return;
        event.preventDefault(); button.setPointerCapture(event.pointerId); this.held.set(event.pointerId,button);
        button.classList.add('pressed'); this.input.touchDown(event.pointerId,code);
      });
      const release = (event:PointerEvent) => {
        this.held.delete(event.pointerId); this.input.touchUp(event.pointerId);
        if (![...this.held.values()].includes(button)) button.classList.remove('pressed');
      };
      button.addEventListener('pointerup',release); button.addEventListener('pointercancel',release); button.addEventListener('lostpointercapture',release);
      // Accessible keyboard/assistive activation; real pointer clicks already ran on down.
      button.addEventListener('click',event=>{ if(event.detail===0){this.input.touchDown(-1,code);this.input.touchUp(-1);} });
    }
    const move = (event:PointerEvent) => {
      if(event.pointerId!==this.stickPointer) return;
      const r=this.pad.getBoundingClientRect(), radius=r.width*.34;
      let x=(event.clientX-r.left-r.width/2)/radius, y=(event.clientY-r.top-r.height/2)/radius;
      const length=Math.hypot(x,y); if(length>1){x/=length;y/=length;}
      // Small neutral region makes releasing inverted controls dependable.
      this.input.setStick(Math.abs(x)<.12 ? 0 : x,Math.abs(y)<.12 ? 0 : -y);
      this.knob.style.transform=`translate(${x*radius}px,${y*radius}px)`;
    };
    this.pad.addEventListener('pointerdown',event=>{
      if(!this.input.active || event.button!==0 || this.stickPointer!==null)return;
      event.preventDefault();this.stickPointer=event.pointerId;this.pad.setPointerCapture(event.pointerId);move(event);
    });
    this.pad.addEventListener('pointermove',move);
    const stop = (event:PointerEvent) => {if(event.pointerId===this.stickPointer){this.stickPointer=null;this.input.setStick(0,0);this.knob.style.transform='';}};
    this.pad.addEventListener('pointerup',stop);this.pad.addEventListener('pointercancel',stop);this.pad.addEventListener('lostpointercapture',stop);
    input.onClear=()=>{
      this.stickPointer=null;this.knob.style.transform='';this.held.clear();
      for(const button of this.buttons.values())button.classList.remove('pressed');
    };
  }

  private visible(code:string,show:boolean) {
    const button=this.buttons.get(code)!;button.classList.toggle('hidden',!show);
    if(!show)for(const [id,owner] of this.held)if(owner===button){this.input.touchUp(id);this.held.delete(id);button.classList.remove('pressed');}
  }

  update(s:Snapshot,active:boolean,prompt='') {
    this.root.classList.toggle('hidden',!this.enabled || !active);
    if(!this.enabled || !active)return;
    const prop=Boolean(s.fieldKit?.carriedId),carried=s.canisters.some(c=>c.carrierId===(s.player.id??'local-player'))||prop;
    const right=s.fieldKit?s.interaction.kind==='right':s.recovery.available || s.recovery.charge>0;
    const label=s.player.driving || s.player.passenger ? 'Get out' : prop?'Place':right ? 'Hold · KICK!' : s.interaction.kind==='pickup'||prompt.includes('Pick up') ? 'Pick up' : s.interaction.kind==='dock' ? 'Install' : s.interaction.kind==='remove' ? 'Hold · Remove' : prompt.includes('Attach cable') ? 'Attach' : prompt.includes('Get in') ? 'Get in' : 'Interact';
    this.buttons.get('KeyE')!.textContent=label;
    this.buttons.get('KeyE')!.setAttribute('aria-label',label);
    this.buttons.get('Space')!.textContent=s.player.driving ? 'Brake' : 'Jump';
    this.buttons.get('Space')!.setAttribute('aria-label',s.player.driving ? 'Brake' : 'Jump');
    this.buttons.get('KeyP')!.textContent=s.vehicle.parkingBrake ? 'Unpark' : 'Park';
    this.buttons.get('KeyF')!.textContent=s.winch.phase==='attached' ? 'Detach' : s.winch.carrierId===(s.player.id??'local-player') ? 'Stow' : 'Cable';
    this.visible('KeyG',carried);
    this.visible('KeyX',(s.interaction.target?.total??0)>1);
    this.visible('Space',!carried);
    this.buttons.get('KeyQ')!.textContent=prop?'Rotate ↶':'Reel in';this.buttons.get('KeyR')!.textContent=prop?'Rotate ↷':'Pay out';
    for(const code of ['KeyQ','KeyR'])this.visible(code,(s.winch.phase==='attached'&&s.winch.operatorId===(s.player.id??'local-player'))||prop);
    this.visible('KeyB',Boolean(s.fieldKit)&&!s.player.driving&&!s.player.passenger&&!carried);this.visible('KeyT',Boolean(s.fieldKit));
    for(const button of this.buttons.values())button.setAttribute('aria-label',button.textContent!);
    this.pad.classList.toggle('swapped',s.player.driving && s.systems.skills==='swapped');
    this.root.dataset.driving=String(s.player.driving);
  }
}

import type {CoopEvent, RoomsApi} from './rooms-api';

/** At most two distinct milestones, three attempts each; never awaited by gameplay.
 * The server deduplicates by session/caller/event, including late timeout replies. */
export class CoopTelemetry {
  private active=true;
  private sent=new Set<CoopEvent>();
  private tail=Promise.resolve();
  constructor(private api:Pick<RoomsApi,'report'>,private id:bigint,private timeoutMs=8000,private retryMs=1500) {}
  report(event:CoopEvent):Promise<void> {
    if(!this.active||this.sent.has(event))return this.tail;
    this.sent.add(event);
    this.tail=this.tail.then(async()=>{
      for(let attempt=0;attempt<3&&this.active;attempt++) {
        let timer:ReturnType<typeof setTimeout>|undefined;
        try {
          const result=await Promise.race([this.api.report(this.id,event==='connected'?{connected:null}:{started:null}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Telemetry timeout')),this.timeoutMs);})]);
          // Membership/window rejection is permanent; transport failures may retry.
          if('ok' in result || 'err' in result)return;
        }catch{/* Reporting failure must never pause or fail a game. */}
        finally{clearTimeout(timer);}
        if(attempt<2&&this.active)await new Promise(resolve=>setTimeout(resolve,this.retryMs*(attempt+1)));
      }
    });
    return this.tail;
  }
  stop(){this.active=false;}
}

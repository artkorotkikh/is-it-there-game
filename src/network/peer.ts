import {networkConfig,parsePacket} from './protocol';
/** Only transport. No simulation or account state is owned by this class. */
export class Peer {
  readonly connection:RTCPeerConnection;
  private state:RTCDataChannel;private events:RTCDataChannel;private opened=false;private closed=false;
  onOpen=()=>{};onPacket=(_packet:Record<string,unknown>,_reliable:boolean)=>{};onLost=(_reason:string)=>{};
  constructor(configuration:RTCConfiguration={}){
    this.connection=new RTCPeerConnection(configuration);
    this.state=this.connection.createDataChannel('state',{negotiated:true,id:0,ordered:false,maxRetransmits:0});
    this.events=this.connection.createDataChannel('events',{negotiated:true,id:1,ordered:true});
    for(const channel of [this.state,this.events]){
      channel.onopen=()=>{if(!this.opened&&this.state.readyState==='open'&&this.events.readyState==='open'){this.opened=true;this.onOpen();}};
      channel.onmessage=e=>{const packet=parsePacket(e.data);if(packet)this.onPacket(packet,channel===this.events);};
      channel.onclose=()=>{if(!this.closed)this.onLost('Your teammate disconnected. Create a new room to reconnect.');};
    }
    this.connection.onconnectionstatechange=()=>{if(!this.closed&&['failed','disconnected'].includes(this.connection.connectionState))this.onLost('Connection interrupted. The expedition has stopped.');};
  }
  private async gathered(){
    if(this.connection.iceGatheringState!=='complete')await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{cleanup();reject(new Error('Could not gather a connection route. Check the network and try again.'));},12_000);
      const check=()=>{if(this.connection.iceGatheringState==='complete'){cleanup();resolve();}else if(this.connection.connectionState==='closed'){cleanup();reject(new Error('Connection cancelled.'));}};
      const cleanup=()=>{clearTimeout(timer);this.connection.removeEventListener('icegatheringstatechange',check);this.connection.removeEventListener('connectionstatechange',check);};
      this.connection.addEventListener('icegatheringstatechange',check);this.connection.addEventListener('connectionstatechange',check);check();
    });
    const sdp=this.connection.localDescription?.sdp;if(!sdp||sdp.length>32_000)throw new Error('Invalid connection description.');return sdp;
  }
  async offer(){await this.connection.setLocalDescription(await this.connection.createOffer());return this.gathered();}
  async answer(offer:string){await this.connection.setRemoteDescription({type:'offer',sdp:offer});await this.connection.setLocalDescription(await this.connection.createAnswer());return this.gathered();}
  async accept(answer:string){await this.connection.setRemoteDescription({type:'answer',sdp:answer});}
  send(value:object,reliable=false){const channel=reliable?this.events:this.state;if(channel.readyState!=='open')return false;const data=JSON.stringify(value);if(data.length>networkConfig.maxMessageBytes)return false;if(channel.bufferedAmount>networkConfig.maxBufferedBytes){if(reliable)this.onLost('Connection is too slow. The expedition has stopped.');return false;}channel.send(data);return true;}
  close(){this.closed=true;this.connection.close();}
}
/** Optional same-origin service supplies short-lived TURN credentials. No bundled secrets. */
export async function iceConfiguration():Promise<RTCConfiguration>{
  const endpoint=import.meta.env.VITE_ICE_CONFIG_PATH as string|undefined;
  if(!endpoint)return {}; // LAN/direct connections; public-network readiness requires TURN.
  if(!endpoint.startsWith('/')||endpoint.startsWith('//'))throw new Error('ICE configuration must use a same-origin path.');
  const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Connection service is unavailable.');
  const body=await response.json();if(!Array.isArray(body.iceServers)||body.iceServers.length>8)throw new Error('Invalid connection service configuration.');
  return {iceServers:body.iceServers,iceTransportPolicy:body.iceTransportPolicy==='relay'?'relay':'all'};
}

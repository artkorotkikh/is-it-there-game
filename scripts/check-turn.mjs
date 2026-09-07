// Real external relay check, without room/account calls or game analytics.
import {chromium} from '@playwright/test';
const origin='https://isitthereyet.nano-tema--0v1.opencloud.org';
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage();
 const release=await page.request.get(origin+'/');
 const csp=release.headers()['content-security-policy'];
 if(!release.ok()||!csp?.includes('https://turn.62-84-183-92.sslip.io'))throw new Error('Published CSP does not allow TURN issuer');
 await page.route(origin+'/turn-check',route=>route.fulfill({contentType:'text/html',headers:{'content-security-policy':csp},body:'TURN transport check'}));
 await page.goto(origin+'/turn-check');
 for(const transport of ['udp','tcp']) {
  const result=await page.evaluate(async({transport})=>{
   const response=await fetch('https://turn.62-84-183-92.sslip.io/connection-config',{signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('Issuer status '+response.status);
   const config=await response.json();
   config.iceServers=config.iceServers.filter(s=>s.username).map(s=>({...s,urls:s.urls.filter(url=>url.endsWith('transport='+transport))}));
   config.iceTransportPolicy='relay';
   const a=new RTCPeerConnection(config),b=new RTCPeerConnection(config);
   try {
    const channel=a.createDataChannel('check');
    const received=new Promise(resolve=>{b.ondatachannel=e=>{e.channel.onmessage=msg=>{e.channel.send(msg.data);};};channel.onmessage=e=>resolve(e.data);});
    a.onicecandidate=e=>{if(e.candidate)b.addIceCandidate(e.candidate).catch(()=>{});};
    b.onicecandidate=e=>{if(e.candidate)a.addIceCandidate(e.candidate).catch(()=>{});};
    await a.setLocalDescription(await a.createOffer());await b.setRemoteDescription(a.localDescription);
    await b.setLocalDescription(await b.createAnswer());await a.setRemoteDescription(b.localDescription);
    await Promise.race([new Promise(resolve=>{channel.onopen=resolve;}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Relay connect timeout')),25000))]);
    channel.send('relay-echo');
    const echo=await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Echo timeout')),5000))]);
    const stats=await a.getStats();let pair;
    stats.forEach(s=>{if(s.type==='transport'&&s.selectedCandidatePairId)pair=stats.get(s.selectedCandidatePairId);});
    const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);
    if(local.candidateType!=='relay'||remote.candidateType!=='relay'||echo!=='relay-echo')throw new Error('Not a working relay pair');
    return {echo,local:local.candidateType,remote:remote.candidateType,relayProtocol:local.relayProtocol};
   } finally {a.close();b.close();}
  },{transport});
  console.log(JSON.stringify({transport,...result}));
 }
} finally {await browser.close();}

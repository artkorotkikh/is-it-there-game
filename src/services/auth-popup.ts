import type { Identity } from '@icp-sdk/core/agent';

export const popupFeatures='width=540,height=720';
/** auth 8.0.3's pinned signer waits 120 s if the popup closes before its first
 * handshake. Keep a handle to the same named window so that case returns promptly.
 * The SDK still performs the complete delegation protocol and origin checks. */
export async function signInWithPopup(signIn:()=>Promise<Identity>,authenticated:()=>boolean):Promise<Identity> {
  const popup=window.open('https://id.ai/authorize','https://id.ai-signer-window',popupFeatures);
  if(!popup) throw new Error('Allow the Internet Identity popup and try again.');
  let interval:ReturnType<typeof setInterval> | undefined;
  const closed=new Promise<never>((_,reject)=>{
    let closedAt:number|undefined;
    interval=setInterval(()=>{
      if(!popup.closed){closedAt=undefined;return;}
      // A successful SDK response also closes the window; allow its session
      // persistence to finish before classifying a closed window as cancellation.
      closedAt ??= Date.now();
      if(Date.now()-closedAt>1500 && !authenticated()) reject(new Error('Sign-in cancelled.'));
    },200);
  });
  try {return await Promise.race([signIn(),closed]);}
  finally {clearInterval(interval);}
}

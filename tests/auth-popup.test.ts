import {afterEach,expect,it,vi} from 'vitest';
import {signInWithPopup} from '../src/services/auth-popup';
import {AnonymousIdentity} from '@icp-sdk/core/agent';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('returns promptly when a popup is closed before the SDK handshake',async()=>{
  vi.useFakeTimers();const popup={closed:false};vi.stubGlobal('window',{open:()=>popup});
  const result=signInWithPopup(()=>new Promise(()=>{}),()=>false);const assertion=expect(result).rejects.toThrow('cancelled');
  popup.closed=true;await vi.advanceTimersByTimeAsync(2000);await assertion;
});
it('does not mistake successful automatic popup closure for cancellation',async()=>{
  vi.useFakeTimers();vi.stubGlobal('window',{open:()=>({closed:true})});const identity=new AnonymousIdentity();
  const result=signInWithPopup(()=>new Promise(resolve=>setTimeout(()=>resolve(identity),2300)),()=>true);
  await vi.advanceTimersByTimeAsync(2400);expect(await result).toBe(identity);expect(vi.getTimerCount()).toBe(0);
});
it('explains a blocked popup without starting the SDK flow',async()=>{
  vi.stubGlobal('window',{open:()=>null});const sign=vi.fn();await expect(signInWithPopup(sign,()=>false)).rejects.toThrow('Allow');expect(sign).not.toHaveBeenCalled();
});

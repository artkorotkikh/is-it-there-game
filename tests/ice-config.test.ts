import {afterEach,expect,it,vi} from 'vitest';
import {iceConfiguration} from '../src/network/peer';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function setup(endpoint:string){
 vi.stubEnv('VITE_ICE_CONFIG_PATH',endpoint);
 vi.stubGlobal('window',{location:{origin:'https://game.example'}});
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({iceServers:[{urls:'turn:relay.example:3478',username:'temporary',credential:'temporary'}]})});
 vi.stubGlobal('fetch',fetch);return fetch;
}
it('fetches external HTTPS TURN credentials without cookies or caching',async()=>{
 const fetch=setup('https://relay.example/connection-config');
 expect((await iceConfiguration()).iceServers).toHaveLength(1);
 expect(fetch.mock.calls[0][0].href).toBe('https://relay.example/connection-config');
 expect(fetch.mock.calls[0][1]).toMatchObject({credentials:'omit',cache:'no-store'});
});
it('keeps local direct connections when no endpoint is configured',async()=>{vi.stubEnv('VITE_ICE_CONFIG_PATH','');expect(await iceConfiguration()).toEqual({});});
it('retains same-origin configuration paths',async()=>{const fetch=setup('/connection-config');await iceConfiguration();expect(fetch.mock.calls[0][0].href).toBe('https://game.example/connection-config');});
it('rejects insecure external services and embedded credentials before sending requests',async()=>{
 for(const endpoint of ['http://relay.example/config','https://user:secret@relay.example/config','data:text/plain,test']){
  const fetch=setup(endpoint);await expect(iceConfiguration()).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 }
});
it('reports unavailable or invalid configuration rather than silently falling back',async()=>{
 const fetch=setup('/config');fetch.mockResolvedValueOnce({ok:false});await expect(iceConfiguration()).rejects.toThrow('unavailable');
 fetch.mockResolvedValueOnce({ok:true,json:async()=>({iceServers:null})});await expect(iceConfiguration()).rejects.toThrow('Invalid');
});

import {Actor,HttpAgent,type Identity} from '@icp-sdk/core/agent';
import {safeGetCanisterEnv} from '@icp-sdk/core/agent/canister-env';
import {roomsIdl,type RoomsApi} from './rooms-api';
export function roomsAvailable(){return Boolean(safeGetCanisterEnv()?.['PUBLIC_CANISTER_ID:rooms']);}
/** Sign room calls with the existing account; never create a temporary guest identity. */
export async function connectRooms(identity:Identity):Promise<RoomsApi>{
  if(identity.getPrincipal().isAnonymous())throw new Error('Sign in to play with a teammate.');
  const env=safeGetCanisterEnv(),canisterId=env?.['PUBLIC_CANISTER_ID:rooms'];
  if(!canisterId)throw new Error('Team rooms are not enabled on this deployment yet.');
  const agent=await HttpAgent.create({identity,host:location.origin,rootKey:env.IC_ROOT_KEY});
  return Actor.createActor<RoomsApi>(roomsIdl,{agent,canisterId});
}
export function newRoomCode(){return Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>n.toString(16).padStart(2,'0')).join('');}

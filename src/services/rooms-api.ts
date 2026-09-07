import type { Principal } from '@icp-sdk/core/principal';
import { IDL } from '@icp-sdk/core/candid';
export interface RoomView { mapKey:string; offer:string; answer:[]|[string]; joined:boolean; sessionId:[]|[bigint] }
export type RoomResult={ok:RoomView}|{err:string};
export interface CoopStatistics {since:bigint;roomsCreated:bigint;guestsJoined:bigint;pairsConnected:bigint;expeditionsStarted:bigint;sessionsEvicted:bigint}
export type CoopEvent = 'connected' | 'started';
export type ReportResult={ok:null}|{err:string};
export interface CoopAdminApi {adminStatistics():Promise<{ok:CoopStatistics}|{err:string}>;setStatisticsReader(reader:Principal,enabled:boolean):Promise<ReportResult>;listStatisticsReaders():Promise<{ok:{reader:Principal;grantedBy:Principal}[]}|{err:string}>}
export interface RoomsApi extends CoopAdminApi {report(id:bigint,event:{connected:null}|{started:null}):Promise<ReportResult>;create(code:string,mapKey:string,offer:string):Promise<RoomResult>;join(code:string):Promise<RoomResult>;answer(code:string,sdp:string):Promise<RoomResult>;poll(code:string):Promise<RoomResult>;close(code:string):Promise<void>}
export const roomValue=(r:RoomResult):RoomView=>{if('err'in r)throw new Error(r.err);return r.ok;};
export const roomsIdl:IDL.InterfaceFactory=()=>{
  const view=IDL.Record({mapKey:IDL.Text,offer:IDL.Text,answer:IDL.Opt(IDL.Text),joined:IDL.Bool,sessionId:IDL.Opt(IDL.Nat)}),result=IDL.Variant({ok:view,err:IDL.Text});
  const reportResult=IDL.Variant({ok:IDL.Null,err:IDL.Text});
  return IDL.Service({
    report:IDL.Func([IDL.Nat,IDL.Variant({connected:IDL.Null,started:IDL.Null})],[reportResult],[]),
    adminStatistics:IDL.Func([],[IDL.Variant({ok:IDL.Record({since:IDL.Int,roomsCreated:IDL.Nat,guestsJoined:IDL.Nat,pairsConnected:IDL.Nat,expeditionsStarted:IDL.Nat,sessionsEvicted:IDL.Nat}),err:IDL.Text})],['query']),
    setStatisticsReader:IDL.Func([IDL.Principal,IDL.Bool],[reportResult],[]),
    listStatisticsReaders:IDL.Func([],[IDL.Variant({ok:IDL.Vec(IDL.Record({reader:IDL.Principal,grantedBy:IDL.Principal})),err:IDL.Text})],['query']),
    create:IDL.Func([IDL.Text,IDL.Text,IDL.Text],[result],[]),join:IDL.Func([IDL.Text],[result],[]),answer:IDL.Func([IDL.Text,IDL.Text],[result],[]),poll:IDL.Func([IDL.Text],[result],[]),close:IDL.Func([IDL.Text],[],[])});
};

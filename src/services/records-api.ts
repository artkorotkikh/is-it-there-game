import { IDL } from '@icp-sdk/core/candid';
import type { BusSkin } from '../game/skin';
export interface DriverProfile { nickname: string; skin: BusSkin; listed: boolean }
export interface Leader { nickname: string; skin: BusSkin; bestMs: bigint; completions: bigint; isYou: boolean }
export interface RunRecord { track: string; rulesVersion: bigint; bestMs: bigint; lastMs: bigint; completions: bigint; updatedAt: bigint }
export interface Ticket { id: bigint; track: string; rulesVersion: bigint; startedAt: bigint }
export interface Receipt { id: bigint; record: RunRecord; newBest: boolean }
export interface CourseStats { track: string; rulesVersion: bigint; starts: bigint; finishes: bigint; saved: bigint }
export interface Statistics { since: bigint; opens: bigint; courses: CourseStats[] }
export type Result<T> = { ok: T } | { err: string };
export interface RecordsApi {
  version(): Promise<string>;
  statistics(): Promise<Result<Statistics>>;
  gameOpened(key: Uint8Array): Promise<Result<null>>;
  beginDelivery(key: Uint8Array, track: string, rulesVersion: bigint): Promise<Result<Ticket>>;
  completeDelivery(key: Uint8Array, id: bigint, elapsedMs: bigint): Promise<Result<null>>;
  claimDelivery(key: Uint8Array, id: bigint, publish: boolean): Promise<Result<Receipt>>;
  myRecords(): Promise<Result<RunRecord[]>>;
  myProfile(): Promise<Result<[] | [DriverProfile]>>;
  ensureProfile(): Promise<Result<DriverProfile>>;
  saveProfile(profile: DriverProfile): Promise<Result<DriverProfile>>;
  leaderboard(track: string, rulesVersion: bigint): Promise<Result<Leader[]>>;
  startRun(track: string, rulesVersion: bigint): Promise<Result<Ticket>>;
  finishRun(id: bigint, elapsedMs: bigint): Promise<Result<Receipt>>;
}
// Kept compatible with the generated src/backend/records.did by PocketIC integration tests.
export const idlFactory: IDL.InterfaceFactory = () => {
  const record = IDL.Record({track:IDL.Text,rulesVersion:IDL.Nat,bestMs:IDL.Nat,lastMs:IDL.Nat,completions:IDL.Nat,updatedAt:IDL.Int});
  const ticket = IDL.Record({id:IDL.Nat,track:IDL.Text,rulesVersion:IDL.Nat,startedAt:IDL.Int});
  const receipt = IDL.Record({id:IDL.Nat,record,newBest:IDL.Bool});
  const result = (ok: IDL.Type) => IDL.Variant({ok,err:IDL.Text});
  const skin = IDL.Record({color:IDL.Text,wheels:IDL.Text,decal:IDL.Text});
  const profile = IDL.Record({nickname:IDL.Text,skin,listed:IDL.Bool});
  const leader = IDL.Record({nickname:IDL.Text,skin,bestMs:IDL.Nat,completions:IDL.Nat,isYou:IDL.Bool});
  const course = IDL.Record({track:IDL.Text,rulesVersion:IDL.Nat,starts:IDL.Nat,finishes:IDL.Nat,saved:IDL.Nat});
  const stats = IDL.Record({since:IDL.Int,opens:IDL.Nat,courses:IDL.Vec(course)});
  const key = IDL.Vec(IDL.Nat8);
  return IDL.Service({statistics:IDL.Func([],[result(stats)],['query']),gameOpened:IDL.Func([key],[result(IDL.Null)],[]),
    beginDelivery:IDL.Func([key,IDL.Text,IDL.Nat],[result(ticket)],[]),completeDelivery:IDL.Func([key,IDL.Nat,IDL.Nat],[result(IDL.Null)],[]),claimDelivery:IDL.Func([key,IDL.Nat,IDL.Bool],[result(receipt)],[]),version:IDL.Func([],[IDL.Text],['query']),myRecords:IDL.Func([],[result(IDL.Vec(record))],['query']),startRun:IDL.Func([IDL.Text,IDL.Nat],[result(ticket)],[]),finishRun:IDL.Func([IDL.Nat,IDL.Nat],[result(receipt)],[]),
    myProfile:IDL.Func([],[result(IDL.Opt(profile))],['query']),ensureProfile:IDL.Func([],[result(profile)],[]),saveProfile:IDL.Func([profile],[result(profile)],[]),leaderboard:IDL.Func([IDL.Text,IDL.Nat],[result(IDL.Vec(leader))],['query'])});
};
export function unwrap<T>(result: Result<T>): T { if ('err' in result) throw new Error(result.err); return result.ok; }

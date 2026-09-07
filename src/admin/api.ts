import { IDL } from '@icp-sdk/core/candid';
import type { Principal } from '@icp-sdk/core/principal';
import type { Result, Statistics } from '../services/records-api';

export interface AdminApi {
  adminStatistics(): Promise<Result<Statistics>>;
  setStatisticsReader(reader: Principal, enabled: boolean): Promise<Result<null>>;
  listStatisticsReaders(): Promise<Result<{reader: Principal; grantedBy: Principal}[]>>;
}
export const adminIdl: IDL.InterfaceFactory = () => {
  const result = (ok: IDL.Type) => IDL.Variant({ok, err: IDL.Text});
  const course = IDL.Record({track: IDL.Text, rulesVersion: IDL.Nat, starts: IDL.Nat, finishes: IDL.Nat, saved: IDL.Nat});
  return IDL.Service({
    adminStatistics: IDL.Func([], [result(IDL.Record({since: IDL.Int, opens: IDL.Nat, courses: IDL.Vec(course)}))], ['query']),
    setStatisticsReader: IDL.Func([IDL.Principal, IDL.Bool], [result(IDL.Null)], []),
    listStatisticsReaders: IDL.Func([], [result(IDL.Vec(IDL.Record({reader: IDL.Principal, grantedBy: IDL.Principal})))], ['query']),
  });
};

import type { Statistics } from '../services/records-api';

export const courseNames: Record<string, string> = {'old-road':'The old road', 'relay-ridge':'Relay ridge', 'finality-quarry':'Finality quarry'};
export const currentRules: Record<string, bigint> = {'old-road':5n, 'relay-ridge':4n, 'finality-quarry':4n};
export const count = (value: bigint) => value.toLocaleString('en-US');
/** Integer arithmetic keeps arbitrary-size Candid Nat values exact; ratios are event ratios, not cohorts. */
export const ratio = (part: bigint, total: bigint) => total === 0n ? '—' : `${part * 1000n / total / 10n}.${part * 1000n / total % 10n}%`;
export const totals = (stats: Statistics) => stats.courses.reduce((sum, row) => ({starts:sum.starts+row.starts, finishes:sum.finishes+row.finishes, saved:sum.saved+row.saved}), {starts:0n,finishes:0n,saved:0n});
export const timestamp = (ns: bigint) => new Date(Number(ns / 1_000_000n));
export function statisticsCsv(stats: Statistics, fetchedAt: Date): string {
  // Prefix spreadsheet formulas even for future, server-supplied track names.
  const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'"+value : value).replaceAll('"','""')}"`;
  const rows = [
    ['collected_since_utc','fetched_at_utc','opens','track','rules_version','starts','finishes','saved'],
    [timestamp(stats.since).toISOString(), fetchedAt.toISOString(), stats.opens.toString(),'ALL','',totals(stats).starts.toString(),totals(stats).finishes.toString(),totals(stats).saved.toString()],
    ...stats.courses.map(row => [timestamp(stats.since).toISOString(),fetchedAt.toISOString(),'',row.track,row.rulesVersion.toString(),row.starts.toString(),row.finishes.toString(),row.saved.toString()]),
  ];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}

/** Raw room/team counts, kept separate from solo CSV and its collection date. */
export function coopStatisticsCsv(stats:import('../services/rooms-api').CoopStatistics,fetchedAt:Date):string {
  const rows=[['metric','count','collected_since_utc','fetched_at_utc'],...(['roomsCreated','guestsJoined','pairsConnected','expeditionsStarted','sessionsEvicted'] as const).map(key=>[key,stats[key].toString(),timestamp(stats.since).toISOString(),fetchedAt.toISOString()])];
  return '\uFEFF'+rows.map(row=>row.join(',')).join('\r\n')+'\r\n';
}

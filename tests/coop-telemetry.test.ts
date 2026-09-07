import {expect,it,vi,afterEach} from 'vitest';
import {CoopTelemetry} from '../src/services/coop-telemetry';
import {coopStatisticsCsv} from '../src/admin/statistics';
afterEach(()=>vi.useRealTimers());
it('deduplicates milestones and preserves order while returning immediately to gameplay',async()=>{
 let release:()=>void=()=>{};const waiting=new Promise<void>(resolve=>{release=resolve;});
 const report=vi.fn(async()=>{await waiting;return {ok:null};});const telemetry=new CoopTelemetry({report},12n);
 const connected=telemetry.report('connected');void telemetry.report('connected');const started=telemetry.report('started');
 await Promise.resolve();expect(report).toHaveBeenCalledTimes(1);release();await connected;await started;
 expect(report.mock.calls).toEqual([[12n,{connected:null}],[12n,{started:null}]]);
});
it('retries unknown transport outcomes with the same session key, but never retries permission errors',async()=>{
 vi.useFakeTimers();const report=vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue({ok:null});const t=new CoopTelemetry({report},4n,10,1);
 const task=t.report('connected');await vi.runAllTimersAsync();await task;expect(report).toHaveBeenCalledTimes(2);expect(report.mock.calls[0]).toEqual(report.mock.calls[1]);
 report.mockResolvedValue({err:'expired'});const start=t.report('started');await vi.runAllTimersAsync();await start;expect(report).toHaveBeenCalledTimes(3);
});
it('bounds hung calls and stops queued work after leaving the team',async()=>{
 vi.useFakeTimers();const report=vi.fn(()=>new Promise<never>(()=>{})),t=new CoopTelemetry({report},4n,10,1);
 const task=t.report('connected');await vi.runAllTimersAsync();await task;expect(report).toHaveBeenCalledTimes(3);
 t.stop();await t.report('started');expect(report).toHaveBeenCalledTimes(3);
});
it('co-op CSV keeps exact counts and a separate collection timestamp',()=>{
 const csv=coopStatisticsCsv({since:0n,roomsCreated:99999999999999999n,guestsJoined:2n,pairsConnected:1n,expeditionsStarted:1n,sessionsEvicted:0n},new Date(1000));
 expect(csv).toContain('roomsCreated,99999999999999999,1970-01-01T00:00:00.000Z');expect(csv).toContain('expeditionsStarted,1,');expect(csv).not.toContain('finishes');
});

import { expect, it } from 'vitest';
import { ratio, statisticsCsv, totals } from '../src/admin/statistics';
it('keeps totals exact beyond JS integer precision and undefined conversion distinct from zero',()=>{
  expect(ratio(0n,0n)).toBe('—');expect(ratio(0n,10n)).toBe('0.0%');expect(ratio(1n,3n)).toBe('33.3%');
  const huge=10n**30n;
  expect(ratio(huge,huge*2n)).toBe('50.0%');
  expect(totals({since:0n,opens:0n,courses:[{track:'old-road',rulesVersion:4n,starts:huge,finishes:1n,saved:0n},{track:'old-road',rulesVersion:5n,starts:1n,finishes:0n,saved:0n}]})).toEqual({starts:huge+1n,finishes:1n,saved:0n});
});
it('exports collection and snapshot times, empty totals, exact numbers and safe CSV cells',()=>{
  const now=new Date('2026-09-06T12:00:00Z');
  expect(statisticsCsv({since:0n,opens:3n,courses:[]},now)).toContain('"3","ALL","","0","0","0"');
  const csv=statisticsCsv({since:0n,opens:10n**30n,courses:[{track:'=HYPERLINK("evil")',rulesVersion:5n,starts:1n,finishes:0n,saved:0n}]},now);
  expect(csv).toContain('"\'=HYPERLINK(""evil"")"');expect(csv).toContain('1000000000000000000000000000000');
  expect(csv).toContain('1970-01-01T00:00:00.000Z');expect(csv).toContain(now.toISOString());
});

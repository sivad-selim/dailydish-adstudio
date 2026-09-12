import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/calendarModel.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { localDateKey, monthDays, movePublication, placeUnscheduled } = exports;
test('calendar spans six complete Monday-first weeks across year boundaries', () => {
  const days = monthDays(new Date(2027, 0, 1));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(localDateKey(days[0]), '2026-12-28');
  assert.equal(localDateKey(days[41]), '2027-02-07');
  assert.equal(days.filter(day => day.getMonth() === 0).length, 31);
});
test('calendar includes leap days and keeps local date rather than UTC date', () => {
  assert.ok(monthDays(new Date(2028, 1, 1)).some(day => localDateKey(day) === '2028-02-29'));
  assert.equal(localDateKey(new Date(2026, 8, 11, 23, 59)), '2026-09-11');
});
test('reordering preserves dates and published status without modifying source data', () => {
  const entries = [{ id: 'a', date: '', publishedAt: '' }, { id: 'b', date: '2026-09-11', publishedAt: '2026-09-10' }, { id: 'c', date: '', publishedAt: '' }];
  const moved = movePublication(entries, 'c', 'a');
  assert.equal(moved.map(item => item.id).join(','), 'c,a,b');
  assert.equal(entries.map(item => item.id).join(','), 'a,b,c');
  assert.equal(moved[2], entries[1]);
  assert.equal(movePublication(entries, 'missing', 'a'), entries);
  assert.equal(movePublication(entries, 'a', 'a'), entries);
});

test('moving a dated post into the reserve clears its date and preserves history', () => {
  const items = [{ id: 'a', date: '', publishedAt: '' }, { id: 'b', date: '2026-09-11', publishedAt: '2026-09-10' }];
  const result = placeUnscheduled(items, 'b', 'a');
  assert.equal(result.map(item => item.id).join(','), 'b,a');
  assert.equal(result[0].date, '');
  assert.equal(result[0].publishedAt, '2026-09-10');
  assert.equal(items[1].date, '2026-09-11');
  assert.equal(placeUnscheduled(result, 'b').map(item => item.id).join(','), 'a,b');
  assert.equal(placeUnscheduled(items, 'missing'), items);
});

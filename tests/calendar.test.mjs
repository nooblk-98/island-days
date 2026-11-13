import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { colomboToday, monthCells, createICS, longWeekends } from '../src/calendar.js';
import { parseSource, mergeDatasets, validateDataset } from '../scripts/holidays.mjs';
const data = JSON.parse(await readFile(new URL('../public/data/holidays.json', import.meta.url)));
function fixture(year = 2026) {
  const rows = Array.from({ length: 20 }, (_, index) => {
    const day = index + 1;
    const weekday = new Date(Date.UTC(year, 0, day)).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    return `<tr><td>${day} Jan</td><td>${weekday}</td><td><a href="/poya-day/">Example ${day} Poya Day</a></td></tr>`;
  }).join('');
  return `<h2>${year} Public Holidays</h2><table class="publicholidays"><tbody>${rows}<tr><td colspan="3">These dates are an estimate.</td></tr></tbody></table>`;
}
test('Sri Lanka day rolls over independently of the browser timezone', () => {
  assert.equal(colomboToday(new Date('2026-11-12T18:29:59Z')), '2026-11-12');
  assert.equal(colomboToday(new Date('2026-11-12T18:30:00Z')), '2026-11-13');
});
test('Monday-first month cells handle six-week months and leap days', () => {
  const november = monthCells(2026, 10);
  assert.equal(november[0].date, '2026-10-26');
  assert.equal(november.length, 42);
  assert.equal(november.filter(d => d.inMonth).length, 30);
  assert.equal(monthCells(2028, 1).filter(d => d.inMonth).length, 29);
});
test('parser keeps estimate labels, ignores ad rows, and decodes holiday text', () => {
  const fresh = parseSource(fixture().replace('Example 1 Poya Day', 'Sinhala &amp; Tamil New Year Day').replace('</tbody>', '<tr><td colspan="3">Ad</td></tr></tbody>'));
  assert.equal(fresh.holidays.length, 20);
  assert.equal(fresh.years[2026].estimated, true);
  assert.equal(fresh.holidays[0].name, 'Sinhala & Tamil New Year Day');
  assert.equal(fresh.holidays[0].type, 'public');
  assert.equal(fresh.holidays[1].type, 'poya');
});
test('parser rejects blocked responses, changed layout, partial tables and impossible dates', () => {
  assert.throws(() => parseSource('<h1>Access denied</h1>'), /No holiday tables/);
  assert.throws(() => parseSource(fixture().replace('class="publicholidays"', 'class="new-format"')), /Missing holiday table/);
  assert.throws(() => parseSource(fixture().replace(/<tr><td>20 Jan[\s\S]*?<\/tr>/, '')), /Incomplete table/);
  assert.throws(() => parseSource(fixture().replace('1 Jan', '32 Jan')), /Invalid date/);
  assert.throws(() => parseSource(fixture().replace('<td>Thu</td>', '<td>Fri</td>')), /Weekday mismatch/);
});
test('multiple holidays on the same day survive validation and export', () => {
  validateDataset(data);
  const sameDay = data.holidays.filter(h => h.date === '2026-05-01');
  assert.equal(sameDay.length, 2);
  const ics = createICS(sameDay, data.fetchedAt, data.years);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTEND;VALUE=DATE:20260502/);
  assert.equal(new Set(sameDay.map(h => h.id)).size, 2);
});
test('refresh refuses a missing current year and unexplained loss; archives prior years', () => {
  const fresh = parseSource(fixture(2027));
  assert.throws(() => mergeDatasets(data, fresh, 2026), /missing current year/);
  assert.throws(() => mergeDatasets(data, parseSource(fixture(2026)), 2026), /missing previously available year/);
  const only2026 = { ...data, years: { 2026: data.years[2026] }, holidays: data.holidays.filter(h => h.date.startsWith('2026')) };
  assert.throws(() => mergeDatasets(only2026, parseSource(fixture(2026)), 2026), /Unexpected holiday loss/);
  const archived = mergeDatasets(parseSource(fixture(2025)), parseSource(fixture(2026)), 2026);
  assert.equal(archived.holidays.length, 40);
  assert.equal(archived.years[2025].estimated, true);
});
test('ICS uses exclusive next-day end dates across year boundaries and marks estimates', () => {
  const ics = createICS([{ id: 'test', date: '2026-12-31', name: 'Example, festival; day', sourceUrl: 'https://publicholidays.lk/' }], data.fetchedAt, { 2026: { estimated: true } });
  assert.match(ics, /DTSTART;VALUE=DATE:20261231/);
  assert.match(ics, /DTEND;VALUE=DATE:20270101/);
  assert.match(ics, /SUMMARY:Example\\, festival\\; day \(estimated\)/);
  assert.ok(ics.endsWith('\r\n'));
  assert.ok(ics.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
});
test('long weekends combine adjacent holidays without counting a weekend twice', () => {
  const weekends = longWeekends([{ date: '2026-04-03' }, { date: '2026-04-06' }, { date: '2026-04-03' }], 2026);
  assert.deepEqual(weekends, [{ start: '2026-04-03', end: '2026-04-06', days: 4 }]);
});

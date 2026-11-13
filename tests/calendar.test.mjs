import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { colomboToday, monthCells, createICS, longWeekends, holidayClass, isMercantileDayOff, leavePlans } from '../src/calendar.js';
import { parseCBSL, buildDataset, mergeDatasets, validateDataset, SOURCE } from '../scripts/holidays.mjs';
const data = JSON.parse(await readFile(new URL('../public/data/holidays.json', import.meta.url)));
const weekday = (year, month, day) => new Date(Date.UTC(year, month, day)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
// A Central Bank page with `count` January holidays, in the bank's table layout.
function page(year = 2026, count = 20, extra = '') {
  const rows = Array.from({ length: count }, (_, i) => `<tr><td>January ${String(i + 1).padStart(2, '0')}, ${weekday(year, 0, i + 1)}</td><td>Example ${i + 1} Full Moon Poya Day    B. P.</td></tr>`).join('');
  return `<h1>Central Bank of Sri Lanka - Bank Holidays for ${year}</h1><table border="0"><tbody><tr><td><h3>Date</h3></td><td><h3>Description</h3></td></tr>${extra}${rows}<tr><td> </td><td> </td></tr></tbody></table>`;
}
const dataset = (year, count) => buildDataset({ [year]: parseCBSL(page(year, count), year) });

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
test('Central Bank parser reads both date styles, B/P/M codes, entities and skips bank-only days', () => {
  const extra = '<tr><td>May 01, Friday</td><td>May Day (International Workers’ Day)    B. P. M. </td></tr>'
    + '<tr><td>01 May, Friday</td><td>Vesak Full Moon Poya Day    B. P.</td></tr>'
    + '<tr><td>May 02, Saturday</td><td>Day following Vesak Full Moon Poya Day    B. P. M.</td></tr>'
    + '<tr><td>April 13, Monday</td><td>Day prior to Sinhala &amp; Tamil New Year Day    B. P. M.</td></tr>'
    + '<tr><td>December 31, Thursday</td><td>Special Bank Holiday    B.</td></tr>';
  const rows = parseCBSL(page(2026, 20, extra), 2026);
  const find = name => rows.find(r => r.name.startsWith(name));
  assert.deepEqual([find('May Day').bank, find('May Day').mercantile, find('May Day').type], [true, true, 'public']);
  assert.deepEqual([find('Vesak').mercantile, find('Vesak').type], [false, 'poya']);
  assert.equal(find('Day following Vesak').type, 'public');
  assert.equal(find('Day prior').name, 'Day prior to Sinhala & Tamil New Year Day');
  assert.equal(rows.some(r => r.name.startsWith('Special Bank')), false);
  assert.ok(rows.every(r => r.sourceUrl.endsWith('bank-holidays-2026')));
});
test('Central Bank parser rejects blocked pages, changed layout, partial lists and impossible dates', () => {
  assert.throws(() => parseCBSL('<h1>Access denied</h1>', 2026), /No holiday table/);
  assert.throws(() => parseCBSL(page(2026, 19), 2026), /Incomplete/);
  assert.throws(() => parseCBSL(page(2026).replace('January 01,', 'January 32,'), 2026), /Invalid date/);
  assert.throws(() => parseCBSL(page(2026).replace(`January 01, ${weekday(2026, 0, 1)}`, 'January 01, Monday'), 2026), /Weekday mismatch/);
});
test('saved data comes only from the Central Bank and passes validation', () => {
  validateDataset(data);
  assert.equal(data.source, SOURCE);
  assert.ok(data.holidays.every(h => h.sourceUrl.startsWith('https://www.cbsl.gov.lk/') && typeof h.bank === 'boolean' && typeof h.mercantile === 'boolean'));
  assert.ok(Object.values(data.years).every(y => y.estimated === false));
  // Gazetted 2027 dates (Gazette No. 2493/05), which the old source had a day out.
  const on = (date, name) => data.holidays.some(h => h.date === date && h.name.startsWith(name));
  if (data.years[2027]) {
    assert.ok(on('2027-03-22', 'Medin Full Moon Poya'));
    assert.ok(on('2027-05-19', 'Vesak Full Moon Poya'));
    assert.ok(on('2027-05-20', 'Day following Vesak'));
  }
});
test('multiple holidays on the same day survive validation and export', () => {
  const sameDay = data.holidays.filter(h => h.date === '2026-05-01');
  assert.equal(sameDay.length, 2);
  const ics = createICS(sameDay, data.fetchedAt, data.years);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTEND;VALUE=DATE:20260502/);
  assert.equal(new Set(sameDay.map(h => h.id)).size, 2);
});
test('refresh refuses a missing current year and unexplained loss; archives prior years', () => {
  assert.throws(() => mergeDatasets(data, dataset(2027, 20), 2026), /missing current year/);
  const both = buildDataset({ 2026: parseCBSL(page(2026, 25), 2026), 2027: parseCBSL(page(2027, 25), 2027) });
  assert.throws(() => mergeDatasets(both, dataset(2026, 25), 2026), /missing previously available year/);
  assert.throws(() => mergeDatasets(dataset(2026, 30), dataset(2026, 20), 2026), /Unexpected holiday loss/);
  const archived = mergeDatasets(dataset(2025, 20), dataset(2026, 20), 2026);
  assert.equal(archived.holidays.length, 40);
  assert.deepEqual(Object.keys(archived.years), ['2025', '2026']);
  // Data saved from another source is replaced, not merged.
  const foreign = { ...both, source: 'https://example.com/' };
  assert.equal(mergeDatasets(foreign, dataset(2026, 20), 2026).holidays.length, 20);
});
test('ICS uses exclusive next-day end dates across year boundaries and marks estimates', () => {
  const ics = createICS([{ id: 'test', date: '2026-12-31', name: 'Example, festival; day', sourceUrl: 'https://www.cbsl.gov.lk/' }], data.fetchedAt, { 2026: { estimated: true } });
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
test('holiday type uses the Central Bank codes, with name rules as a fallback', () => {
  assert.deepEqual(holidayClass({ name: 'Anything', bank: true, mercantile: true }), { bank: true, mercantile: true });
  for (const name of ['Tamil Thai Pongal Day', 'Independence Day', 'Day prior to Sinhala & Tamil New Year Day', 'Sinhala & Tamil New Year Day', 'May Day (International Workers’ Day)', 'Day following Vesak Full Moon Poya Day', 'Milad-Un-Nabi (Holy Prophet\'s Birthday)', 'Christmas Day']) {
    assert.deepEqual(holidayClass(name), { bank: true, mercantile: true }, name);
  }
  for (const name of ['Vesak Full Moon Poya Day', 'Mahasivarathri Day', 'Id-Ul-Fitre (Ramazan Festival Day)', 'Eid-Ul-Allha (Hadji Festival Day)', 'Good Friday', 'Deepawali Festival Day']) {
    assert.deepEqual(holidayClass(name), { bank: true, mercantile: false }, name);
  }
  // The rules agree with the bank's own codes for every saved holiday.
  for (const h of data.holidays) assert.deepEqual(holidayClass(h.name), { bank: h.bank, mercantile: h.mercantile }, h.name);
});
test('Mercantile days off include every Poya day while preserving official source flags', () => {
  const included = data.holidays.filter(isMercantileDayOff);
  for (const holiday of data.holidays) {
    assert.equal(included.includes(holiday), holiday.type === 'poya' || holiday.mercantile);
  }
  const poya = data.holidays.find(h => h.type === 'poya' && !h.mercantile);
  assert.ok(poya && included.includes(poya));
  assert.equal(holidayClass(poya).mercantile, false);
  const exported = createICS(included, data.fetchedAt, data.years);
  assert.ok(exported.includes(`UID:${poya.id}@island-days.local`));
});
test('leave planner bridges holidays to weekends without overlapping plans', () => {
  // Thursday 2 Apr 2026 off -> Wed 1 Apr holiday through Sun 5 Apr (Good Friday on the 3rd).
  const plans = leavePlans([{ date: '2026-04-01' }, { date: '2026-04-03' }], 2026);
  assert.deepEqual(plans, [{ start: '2026-04-01', end: '2026-04-05', days: 5, leave: 1, leaveDates: ['2026-04-02'] }]);
  const real = leavePlans(data.holidays, 2026);
  assert.ok(real.length > 3);
  for (const [i, p] of real.entries()) {
    assert.ok(p.leave >= 1 && p.leave <= 3 && p.days / p.leave >= 2);
    if (i) assert.ok(real[i - 1].end < p.start);
  }
  assert.ok(leavePlans(data.holidays, 2026, { from: '2026-12-01' }).every(p => p.end >= '2026-12-01'));
});
test('subscription feeds refresh daily and tag holiday types', () => {
  const ics = createICS(data.holidays.filter(h => h.date === '2026-12-25'), data.fetchedAt, data.years, { name: 'Feed', feed: true });
  assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:P1D/);
  assert.match(ics, /CATEGORIES:Public holiday,Bank holiday,Mercantile holiday/);
});
test('reminder feeds add a day-before and week-before alert to every holiday', () => {
  const plain = createICS(data.holidays.slice(0, 3), data.fetchedAt, data.years, { feed: true });
  const withAlerts = createICS(data.holidays.slice(0, 3), data.fetchedAt, data.years, { feed: true, reminders: true });
  assert.equal((plain.match(/BEGIN:VALARM/g) || []).length, 0);
  assert.equal((withAlerts.match(/BEGIN:VALARM/g) || []).length, 6);
  assert.match(withAlerts, /TRIGGER:-PT15H/);
  assert.match(withAlerts, /TRIGGER:-P6DT15H/);
  assert.ok(withAlerts.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
});
test('Il Poya is spelled so it cannot be read as the numeral III', () => {
  const rows = parseCBSL(page(2026, 20, '<tr><td>November 24, Tuesday</td><td>Ill Full Moon Poya Day    B. P.</td></tr>'), 2026);
  assert.ok(rows.some(r => r.name === 'Il Full Moon Poya Day' && r.id === '2026-11-24-il-full-moon-poya-day'));
  assert.ok(!data.holidays.some(h => /^Ill /.test(h.name)));
});

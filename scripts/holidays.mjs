import { load } from 'cheerio';
export const SOURCE = 'https://publicholidays.lk/';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function parseSource(html) {
  const $ = load(html);
  const years = {};
  const holidays = [];
  $('h2').each((_, heading) => {
    const match = $(heading).text().trim().match(/^(20\d{2}) Public Holidays$/i);
    if (!match) return;
    const year = Number(match[1]);
    const table = $(heading).nextUntil('h2').filter('table.publicholidays').first();
    if (!table.length) throw new Error(`Missing holiday table for ${year}`);
    if (years[year]) throw new Error(`Duplicate table for ${year}`);
    years[year] = { estimated: /\bestimate(?:d)?\b/i.test(table.text()), sourceUrl: `${SOURCE}#${year}-public-holidays` };
    table.find('tbody tr').each((__, row) => {
      const cells = $(row).children('td');
      if (cells.length !== 3 || cells.toArray().some(cell => $(cell).attr('colspan'))) return;
      const rawDate = cells.eq(0).text().trim().replace(/\s+/g, ' ');
      const dateMatch = rawDate.match(/^(\d{1,2}) ([A-Za-z]{3})$/);
      if (!dateMatch) throw new Error(`Unrecognized date: ${rawDate}`);
      const month = months.indexOf(dateMatch[2]);
      const day = Number(dateMatch[1]);
      const date = new Date(Date.UTC(year, month, day));
      if (month < 0 || date.getUTCMonth() !== month || date.getUTCDate() !== day) throw new Error(`Invalid date: ${rawDate}`);
      const weekday = date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
      if (weekday !== cells.eq(1).text().trim()) throw new Error(`Weekday mismatch: ${rawDate} ${year}`);
      const name = cells.eq(2).text().trim().replace(/\s+/g, ' ');
      if (!name || name.length > 200) throw new Error('Missing or invalid holiday name');
      const link = new URL(cells.eq(2).find('a').attr('href') || SOURCE, SOURCE);
      if (link.origin !== new URL(SOURCE).origin) throw new Error('Unexpected source link');
      const iso = date.toISOString().slice(0, 10);
      holidays.push({ id: `${iso}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`, date: iso, name,
        type: isPoyaName(name) ? 'poya' : 'public', sourceUrl: link.href });
    });
    if (holidays.filter(h => h.date.startsWith(`${year}-`)).length < 20) throw new Error(`Incomplete table for ${year}`);
  });
  if (!Object.keys(years).length) throw new Error('No holiday tables found; source layout may have changed.');
  const result = { schemaVersion: 1, source: SOURCE, fetchedAt: new Date().toISOString(), years, holidays: holidays.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)) };
  validateDataset(result);
  return result;
}
export function validateDataset(data) {
  if (data.schemaVersion !== 1 || data.source !== SOURCE || !Number.isFinite(Date.parse(data.fetchedAt)) || !data.years || !Array.isArray(data.holidays) || !data.holidays.length) throw new Error('Invalid dataset');
  const seen = new Set();
  for (const h of data.holidays) {
    const date = new Date(`${h.date}T00:00:00Z`);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(h.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== h.date || !h.name || !h.id || seen.has(h.id) || !['poya', 'public'].includes(h.type) || !data.years[h.date.slice(0, 4)] || new URL(h.sourceUrl).origin !== new URL(SOURCE).origin) throw new Error(`Invalid holiday: ${h.id}`);
    for (const flag of ['bank', 'mercantile']) if (flag in h && typeof h[flag] !== 'boolean') throw new Error(`Invalid ${flag} flag: ${h.id}`);
    seen.add(h.id);
  }
  for (const [year, meta] of Object.entries(data.years)) {
    if (typeof meta.estimated !== 'boolean' || data.holidays.filter(h => h.date.startsWith(`${year}-`)).length < 20) throw new Error(`Incomplete year: ${year}`);
  }
}
export function mergeDatasets(previous, fresh, currentYear) {
  if (!fresh.years[currentYear]) throw new Error(`Source is missing current year ${currentYear}; keeping previous data.`);
  if (previous) {
    validateDataset(previous);
    for (const year of Object.keys(previous.years)) {
      if (Number(year) >= currentYear && !fresh.years[year]) throw new Error(`Source is missing previously available year ${year}; keeping previous data.`);
    }
    for (const year of Object.keys(fresh.years)) {
      const before = previous.holidays.filter(h => h.date.startsWith(year)).length;
      const after = fresh.holidays.filter(h => h.date.startsWith(year)).length;
      if (before && after < before * 0.8) throw new Error(`Unexpected holiday loss for ${year}; review source manually.`);
    }
  }
  const archived = (previous?.holidays || []).filter(h => !fresh.years[h.date.slice(0, 4)] && Number(h.date.slice(0, 4)) < currentYear);
  const years = Object.fromEntries(Object.entries(previous?.years || {}).filter(([y]) => Number(y) < currentYear));
  const merged = { ...fresh, years: { ...years, ...fresh.years }, holidays: [...archived, ...fresh.holidays].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)) };
  validateDataset(merged);
  return merged;
}
// Second source: the Central Bank of Sri Lanka publishes the gazetted list with B (bank), P (public) and M (mercantile) codes.
export const CBSL = year => `https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-${year}`;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function parseCBSL(html, year) {
  const $ = load(html);
  const rows = [];
  $('table tr').each((_, row) => {
    const cells = $(row).children('td');
    if (cells.length !== 2) return;
    // The bank writes both "January 15, Thursday" and "15 January, Friday".
    const text = cells.eq(0).text().trim().replace(/\s+/g, ' ');
    const when = text.match(/^([A-Z][a-z]+) (\d{1,2}), ([A-Z][a-z]+)$/) || text.match(/^(\d{1,2}) ([A-Z][a-z]+), ([A-Z][a-z]+)$/)?.slice(0, 4).map((v, i, m) => i === 1 ? m[2] : i === 2 ? m[1] : v);
    const what = cells.eq(1).text().trim().replace(/\s+/g, ' ').match(/^(.+?)\s+((?:[BPM]\.\s*)+)$/);
    if (!when || !what) return;
    const month = MONTH_NAMES.indexOf(when[1]);
    const date = new Date(Date.UTC(year, month, Number(when[2])));
    if (month < 0 || date.getUTCMonth() !== month) throw new Error(`CBSL: invalid date ${text}`);
    if (date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }) !== when[3]) throw new Error(`CBSL: weekday mismatch ${text} ${year}`);
    const codes = what[2].replace(/[\s.]/g, '');
    rows.push({ date: date.toISOString().slice(0, 10), name: what[1], bank: codes.includes('B'), public: codes.includes('P'), mercantile: codes.includes('M') });
  });
  if (rows.length < 20) throw new Error(`CBSL: incomplete list for ${year}`);
  return rows;
}
const isPoyaName = name => /poya/i.test(name) && !/following|prior/i.test(name);
const words = name => new Set(name.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['day', 'the', 'full', 'moon'].includes(w)));
// Copy bank/mercantile flags onto matching holidays and report dates the two sources disagree on.
export function applyCBSL(data, listsByYear) {
  const warnings = [];
  const holidays = data.holidays.map(h => ({ ...h }));
  for (const [year, list] of Object.entries(listsByYear)) {
    const ours = holidays.filter(h => h.date.startsWith(`${year}-`));
    const unused = [...list];
    for (const h of ours) {
      // Only pair holidays of the same kind: a Poya never takes the flags of a non-Poya holiday on that date.
      const candidates = unused.filter(c => c.date === h.date && isPoyaName(c.name) === isPoyaName(h.name));
      if (!candidates.length) { warnings.push(`${h.date} ${h.name}: not on the Central Bank list`); continue; }
      const mine = words(h.name);
      const score = c => [...words(c.name)].filter(w => mine.has(w)).length;
      const match = candidates.sort((a, b) => score(b) - score(a))[0];
      unused.splice(unused.indexOf(match), 1);
      h.bank = match.bank; h.mercantile = match.mercantile;
    }
    for (const c of unused) warnings.push(`${c.date} ${c.name}: on the Central Bank list but not on ${SOURCE}`);
  }
  const result = { ...data, holidays };
  validateDataset(result);
  return { data: result, warnings };
}
// Keep flags from the previous run when the second source is unavailable.
export function carryFlags(previous, data) {
  const flags = new Map((previous?.holidays || []).filter(h => 'bank' in h).map(h => [h.id, h]));
  return { ...data, holidays: data.holidays.map(h => 'bank' in h || !flags.has(h.id) ? h : { ...h, bank: flags.get(h.id).bank, mercantile: flags.get(h.id).mercantile }) };
}

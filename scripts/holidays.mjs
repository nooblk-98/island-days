import { load } from 'cheerio';
// Single source: the Central Bank of Sri Lanka's yearly holiday list, which follows the gazette issued under the
// Holidays Act No. 29 of 1971 and marks each day B (bank), P (public) and/or M (mercantile).
export const SOURCE = 'https://www.cbsl.gov.lk/';
export const CBSL = year => `https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-${year}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const isPoyaName = name => /poya/i.test(name) && !/following|prior/i.test(name);
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const byDate = (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name);

// Parse one year's page into public holidays. Bank-only days (no P code) are not public holidays and are skipped.
export function parseCBSL(html, year) {
  const $ = load(html);
  const holidays = [];
  let rows = 0;
  $('table tr').each((_, row) => {
    const cells = $(row).children('td');
    if (cells.length !== 2) return;
    // The bank writes both "January 15, Thursday" and "15 January, Friday".
    const text = cells.eq(0).text().trim().replace(/\s+/g, ' ');
    const a = text.match(/^([A-Z][a-z]+) (\d{1,2}), ([A-Z][a-z]+)$/);
    const b = text.match(/^(\d{1,2}) ([A-Z][a-z]+), ([A-Z][a-z]+)$/);
    const what = cells.eq(1).text().trim().replace(/\s+/g, ' ').match(/^(.+?)\s+((?:[BPM]\.\s*)+)$/);
    if (!(a || b) || !what) return;
    const [monthName, day, weekday] = a ? [a[1], a[2], a[3]] : [b[2], b[1], b[3]];
    const month = MONTHS.indexOf(monthName);
    const date = new Date(Date.UTC(year, month, Number(day)));
    if (month < 0 || date.getUTCMonth() !== month || date.getUTCDate() !== Number(day)) throw new Error(`Invalid date: ${text} ${year}`);
    if (date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }) !== weekday) throw new Error(`Weekday mismatch: ${text} ${year}`);
    const name = what[1].trim();
    if (!name || name.length > 200) throw new Error('Missing or invalid holiday name');
    const codes = what[2].replace(/[\s.]/g, '');
    rows++;
    if (!codes.includes('P')) return;
    const iso = date.toISOString().slice(0, 10);
    holidays.push({ id: `${iso}-${slug(name)}`, date: iso, name, type: isPoyaName(name) ? 'poya' : 'public', bank: codes.includes('B'), mercantile: codes.includes('M'), sourceUrl: CBSL(year) });
  });
  if (!rows) throw new Error(`No holiday table found for ${year}; the page layout may have changed.`);
  if (holidays.length < 20) throw new Error(`Incomplete holiday list for ${year}`);
  return holidays.sort(byDate);
}

export function buildDataset(listsByYear, fetchedAt = new Date().toISOString()) {
  const years = Object.fromEntries(Object.keys(listsByYear).map(year => [year, { estimated: false, sourceUrl: CBSL(year) }]));
  const result = { schemaVersion: 1, source: SOURCE, fetchedAt, years, holidays: Object.values(listsByYear).flat().sort(byDate) };
  validateDataset(result);
  return result;
}

export function validateDataset(data) {
  if (data.schemaVersion !== 1 || data.source !== SOURCE || !Number.isFinite(Date.parse(data.fetchedAt)) || !data.years || !Array.isArray(data.holidays) || !data.holidays.length) throw new Error('Invalid dataset');
  const seen = new Set();
  for (const h of data.holidays) {
    const date = new Date(`${h.date}T00:00:00Z`);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(h.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== h.date || !h.name || !h.id || seen.has(h.id) || !['poya', 'public'].includes(h.type) || !data.years[h.date.slice(0, 4)] || new URL(h.sourceUrl).origin !== new URL(SOURCE).origin) throw new Error(`Invalid holiday: ${h.id}`);
    for (const flag of ['bank', 'mercantile']) if (typeof h[flag] !== 'boolean') throw new Error(`Invalid ${flag} flag: ${h.id}`);
    seen.add(h.id);
  }
  for (const [year, meta] of Object.entries(data.years)) {
    if (typeof meta.estimated !== 'boolean' || data.holidays.filter(h => h.date.startsWith(`${year}-`)).length < 20) throw new Error(`Incomplete year: ${year}`);
  }
}

// Combine a fresh fetch with the saved data: keep past years, refuse to lose a year or most of one.
// Saved data from a different source is ignored entirely, so every year comes from the bank.
export function mergeDatasets(previous, fresh, currentYear) {
  if (!fresh.years[currentYear]) throw new Error(`Source is missing current year ${currentYear}; keeping previous data.`);
  const prior = previous?.source === SOURCE ? previous : null;
  if (prior) {
    validateDataset(prior);
    for (const year of Object.keys(prior.years)) {
      if (Number(year) >= currentYear && !fresh.years[year]) throw new Error(`Source is missing previously available year ${year}; keeping previous data.`);
    }
    for (const year of Object.keys(fresh.years)) {
      const before = prior.holidays.filter(h => h.date.startsWith(year)).length;
      const after = fresh.holidays.filter(h => h.date.startsWith(year)).length;
      if (before && after < before * 0.8) throw new Error(`Unexpected holiday loss for ${year}; review source manually.`);
    }
  }
  const archived = (prior?.holidays || []).filter(h => !fresh.years[h.date.slice(0, 4)] && Number(h.date.slice(0, 4)) < currentYear);
  const years = Object.fromEntries(Object.entries(prior?.years || {}).filter(([y]) => Number(y) < currentYear && !fresh.years[y]));
  const merged = { ...fresh, years: { ...years, ...fresh.years }, holidays: [...archived, ...fresh.holidays].sort(byDate) };
  validateDataset(merged);
  return merged;
}

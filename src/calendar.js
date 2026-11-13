export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const holidayDisplayName = holiday => holiday.name.replace(/^Ill?\s+(?=Full Moon Poya Day\b)/i, '');
export const parseDate = value => new Date(`${value}T00:00:00Z`);
export const isoDate = date => date.toISOString().slice(0, 10);
export const addDays = (value, days) => { const date = parseDate(value); date.setUTCDate(date.getUTCDate() + days); return isoDate(date); };
export function colomboToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export const formatDate = (value, options = { day: 'numeric', month: 'long', year: 'numeric' }) => parseDate(value).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
export const daysBetween = (from, to) => Math.round((parseDate(to) - parseDate(from)) / 86400000);
export function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month, index - offset + 1));
    return { date: isoDate(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month, weekend: [0, 6].includes(date.getUTCDay()) };
  });
}
export function longWeekends(holidays, year, { weekend = [0, 6] } = {}) {
  const days = new Set(holidays.filter(h => h.date.startsWith(`${year}-`)).map(h => h.date));
  const off = value => days.has(value) || isWeekend(value, weekend);
  const results = [];
  let start = `${year}-01-01`;
  const end = `${year}-12-31`;
  while (start <= end) {
    if (!off(start)) { start = addDays(start, 1); continue; }
    const from = start;
    while (off(start)) start = addDays(start, 1);
    const length = daysBetween(from, start);
    if (length >= 3) results.push({ start: from, end: addDays(start, -1), days: length });
  }
  return results;
}
// Bank / mercantile status per the Central Bank of Sri Lanka holiday lists (gazetted under the Holidays Act No. 29 of 1971).
// Every gazetted holiday is a bank holiday; only these are also mercantile (private-sector) holidays.
const MERCANTILE = [/thai pongal/, /^(national|independence) day/, /^day prior to sinhala/, /^sinhala (&|and) tamil new year/, /^may day/, /^day following vesak/, /milad/, /christmas/];
const BANK = [/full moon poya/, /mahasiv/, /^e?id[ -]ul[ -]?(fitr|al+a?ha|adha|allah)/, /good friday/, /deepa[vw]ali/, ...MERCANTILE];
// Accepts a holiday (official flags from the Central Bank list win) or a bare name (rules above).
export function holidayClass(holiday) {
  if (typeof holiday === 'object' && typeof holiday.bank === 'boolean') return { bank: holiday.bank, mercantile: holiday.mercantile === true };
  const n = String(typeof holiday === 'object' ? holiday.name : holiday).toLowerCase();
  const mercantile = MERCANTILE.some(rule => rule.test(n));
  return { bank: mercantile || BANK.some(rule => rule.test(n)), mercantile };
}
// The site's Mercantile view includes every Poya day, without changing the source's official flags.
export const isMercantileDayOff = holiday => holiday.type === 'poya' || holidayClass(holiday).mercantile;
export const isWeekend = (value, weekend = [0, 6]) => weekend.includes(parseDate(value).getUTCDay());
// Suggest short leave blocks that bridge holidays and weekends into longer breaks.
export function leavePlans(holidays, year, { maxLeave = 3, from = '', weekend = [0, 6] } = {}) {
  const days = new Set(holidays.map(h => h.date));
  const off = value => days.has(value) || isWeekend(value, weekend);
  const seen = new Set(), candidates = [];
  for (const anchor of [...days].filter(d => d.startsWith(`${year}-`) && !isWeekend(d, weekend)).sort()) {
    for (let s = -(maxLeave + 4); s <= 0; s++) for (let e = 0; e <= maxLeave + 4; e++) {
      const start = addDays(anchor, s), end = addDays(anchor, e), key = `${start}/${end}`;
      if (seen.has(key) || off(addDays(start, -1)) || off(addDays(end, 1))) continue;
      seen.add(key);
      const leaveDates = [];
      for (let d = start; d <= end; d = addDays(d, 1)) if (!off(d)) leaveDates.push(d);
      const total = daysBetween(start, end) + 1;
      if (!leaveDates.length || leaveDates.length > maxLeave || total < 4 || total / leaveDates.length < 2) continue;
      candidates.push({ start, end, days: total, leave: leaveDates.length, leaveDates });
    }
  }
  candidates.sort((a, b) => b.days / b.leave - a.days / a.leave || b.days - a.days || a.start.localeCompare(b.start));
  const picked = [];
  for (const plan of candidates) if (!picked.some(p => plan.start <= p.end && p.start <= plan.end)) picked.push(plan);
  return picked.filter(p => p.start.startsWith(`${year}-`) && p.end >= from).sort((a, b) => a.start.localeCompare(b.start));
}
const escapeICS = value => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
function foldLine(line) {
  const encoder = new TextEncoder();
  let result = '', current = '', bytes = 0;
  for (const char of line) {
    const length = encoder.encode(char).length;
    if (bytes + length > 75) { result += `${current}\r\n`; current = ' '; bytes = 1; }
    current += char; bytes += length;
  }
  return result + current;
}
// Alerts at 9 am the day before and 9 am a week before (all-day events start at midnight).
export const REMINDERS = [['-PT15H', 'Tomorrow'], ['-P6DT15H', 'In a week']];
const reminderLines = h => REMINDERS.flatMap(([trigger, when]) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeICS(`${when}: ${holidayDisplayName(h)}`)}`, `TRIGGER:${trigger}`, 'END:VALARM']);
export function createICS(holidays, fetchedAt, estimatedYears = {}, { name = 'Sri Lanka Public Holidays', description = '', feed = false, reminders = false } = {}) {
  const stamp = new Date(fetchedAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Island Days//Sri Lanka Holidays//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeICS(name)}`];
  if (description) lines.push(`X-WR-CALDESC:${escapeICS(description)}`);
  if (feed) lines.push('REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D');
  for (const h of holidays) {
    const estimated = estimatedYears[h.date.slice(0, 4)]?.estimated;
    const kind = holidayClass(h);
    const categories = [h.type === 'poya' ? 'Poya day' : 'Public holiday', ...(kind.bank ? ['Bank holiday'] : []), ...(kind.mercantile ? ['Mercantile holiday'] : [])];
    lines.push('BEGIN:VEVENT', `UID:${h.id}@island-days.local`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${h.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(h.date, 1).replace(/-/g, '')}`, `SUMMARY:${escapeICS(holidayDisplayName(h))}${estimated ? ' (estimated)' : ''}`, `CATEGORIES:${categories.map(escapeICS).join(',')}`, `DESCRIPTION:${escapeICS(`${categories.join(' · ')}\nSource: ${h.sourceUrl}\n${estimated ? 'Estimated date. ' : ''}Dates may change. Verify before making plans.`)}`, `URL:${h.sourceUrl}`, 'TRANSP:TRANSPARENT', ...(reminders ? reminderLines(h) : []), 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
// One all-day event covering a whole break, marked busy so it blocks the calendar.
export function createBreakICS(plan, fetchedAt) {
  const stamp = new Date(fetchedAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const leave = plan.leaveDates.map(d => parseDate(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }));
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Island Days//Sri Lanka Holidays//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:break-${plan.start}-${plan.end}@island-days.local`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${plan.start.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(plan.end, 1).replace(/-/g, '')}`,
    `SUMMARY:${escapeICS(`Break: ${plan.days} days off`)}`, `DESCRIPTION:${escapeICS(`Leave to apply for: ${leave.join(', ')}.\nPlanned with Island Days. Verify holiday dates before booking.`)}`, 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

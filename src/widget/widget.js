// Embeddable "next holiday" card. Options in the query string:
//   theme=light|dark|auto (default auto)   holidays=mercantile (private-sector holidays only)
import { colomboToday, daysBetween, formatDate, holidayClass, longWeekends } from '/calendar.js';
const params = new URLSearchParams(location.search);
const theme = ['light', 'dark'].includes(params.get('theme')) ? params.get('theme') : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
document.documentElement.dataset.theme = theme;
const mercantileOnly = params.get('holidays') === 'mercantile';
const $ = id => document.getElementById(id);
const today = colomboToday();
try {
  const data = await (await fetch('/data/holidays.json', { cache: 'no-cache' })).json();
  const holidays = mercantileOnly ? data.holidays.filter(h => holidayClass(h).mercantile) : data.holidays;
  const next = holidays.find(h => h.date >= today);
  if (!next) throw new Error('No upcoming holiday');
  const delta = daysBetween(today, next.date);
  $('label').textContent = mercantileOnly ? 'Next mercantile holiday' : 'Next holiday in Sri Lanka';
  $('day').textContent = Number(next.date.slice(-2));
  $('month').textContent = formatDate(next.date, { month: 'short', year: 'numeric' }).toUpperCase();
  $('weekday').textContent = formatDate(next.date, { weekday: 'long' });
  $('name').textContent = next.name;
  $('countdown').textContent = delta === 0 ? 'Today' : delta === 1 ? 'Tomorrow' : `In ${delta} days`;
  const years = [...new Set(holidays.map(h => Number(h.date.slice(0, 4))))].filter(y => y >= Number(today.slice(0, 4)));
  const nextBreak = years.flatMap(y => longWeekends(holidays, y)).find(w => w.end >= today);
  if (nextBreak) {
    $('break').textContent = `Long weekend: ${formatDate(nextBreak.start, { weekday: 'short', day: 'numeric', month: 'short' })} – ${formatDate(nextBreak.end, { weekday: 'short', day: 'numeric', month: 'short' })}`;
    $('break').hidden = false;
  }
  $('card').setAttribute('aria-label', `Next holiday: ${next.name}, ${formatDate(next.date)}. Open Island Days.`);
} catch {
  $('month').textContent = 'See all Sri Lanka holidays';
  $('day').textContent = '✳';
}

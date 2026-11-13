import { MONTHS, monthCells, colomboToday, formatDate, parseDate, daysBetween, longWeekends, createICS, createBreakICS, holidayClass, holidayDisplayName, isMercantileDayOff, leavePlans, addDays, isWeekend } from './calendar.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const today = colomboToday();
const thisYear = Number(today.slice(0, 4));
let data, availableYears = [], focusedBeforeDialog, toastTimer, lastURL = '';
const state = { year: thisYear, month: Number(today.slice(5, 7)) - 1, view: 'month', filter: 'all', search: '' };
const calendarKey = $('.calendar-bottom');
const keyBesideCalendar = window.matchMedia('(min-width: 901px)');
function positionCalendarKey() {
  if (state.view === 'list') { calendarKey.remove(); return; }
  if (keyBesideCalendar.matches) $('.sidebar').prepend(calendarKey);
  else {
    const dates = $('#calendar > .cal, #calendar > .year-grid');
    if (dates) dates.after(calendarKey);
  }
}
keyBesideCalendar.addEventListener('change', positionCalendarKey);
// Personal settings, remembered in this browser only.
const PREFS_KEY = 'island-days:prefs';
const prefs = { holidays: 'all', saturday: false, maxLeave: 3 };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch {}
prefs.maxLeave = Math.min(5, Math.max(1, Number(prefs.maxLeave) || 3));
prefs.holidays = prefs.holidays === 'mercantile' ? 'mercantile' : 'all';
state.filter = prefs.holidays;
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} };
const weekendDays = () => prefs.saturday ? [0] : [0, 6];
const breakSource = () => data.holidays.filter(holidayScope);
const yourLongWeekends = () => longWeekends(breakSource(), state.year, { weekend: weekendDays() });
const yourLeavePlans = (from = '') => leavePlans(breakSource(), state.year, { from, weekend: weekendDays(), maxLeave: prefs.maxLeave });
const yearHolidays = () => data.holidays.filter(h => Number(h.date.slice(0, 4)) === state.year);
const isMercantile = h => holidayClass(h).mercantile;
const holidayScope = h => state.filter !== 'mercantile' || isMercantileDayOff(h);
const matches = h => holidayScope(h) && holidayDisplayName(h).toLowerCase().includes(state.search.toLowerCase());
const typeLabel = h => h.type === 'poya' ? 'Poya day' : 'Public holiday';
const shortDate = (value, extra = {}) => formatDate(value, { day: 'numeric', month: 'short', ...extra });
const isEstimated = year => data.years[year]?.estimated;
function notify(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
function openDialog(content, kind = '', holiday = '') {
  const dialog = $('#detail-dialog');
  if (!dialog.open) focusedBeforeDialog = document.activeElement;
  $('#dialog-content').innerHTML = content;
  dialog.dataset.kind = kind; dialog.dataset.holiday = holiday;
  if (!dialog.open) dialog.showModal();
  $('#close-dialog').focus();
  if (data) writeURL();
}
function showHoliday(id) {
  const h = data.holidays.find(holiday => holiday.id === id);
  if (!h) return;
  openDialog(`<span class="dialog-symbol" aria-hidden="true">${h.type === 'poya' ? '☾' : '✳'}</span><span class="dialog-tag ${h.type}">${typeLabel(h)}</span><h2 class="dialog-heading" id="dialog-title">${esc(holidayDisplayName(h))}</h2><p class="dialog-date">${formatDate(h.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Sri Lanka</p>${isEstimated(h.date.slice(0, 4)) ? '<p class="notice">This date is an estimate from the source and may change.</p>' : ''}${classNote(h)}<p class="dialog-body">A little room to slow down. Check the source for the latest details before making plans.</p><button class="dialog-action" data-download="${esc(h.id)}">↓ Add to my calendar</button><a class="dialog-source" href="${esc(h.sourceUrl)}" target="_blank" rel="noopener noreferrer">Central Bank holiday list ↗</a>`, 'holiday', h.id);
}
function classNote(h) {
  const kind = holidayClass(h);
  const tags = ['Public', ...(kind.bank ? ['Bank'] : []), ...(kind.mercantile ? ['Mercantile'] : [])].map(t => `<span class="class-tag${t === 'Mercantile' ? ' mercantile' : ''}">${t}</span>`).join('');
  const note = kind.mercantile ? 'Most private-sector offices are closed too.' : kind.bank ? 'Not a mercantile holiday, so many private-sector offices stay open.' : 'Check with your employer whether private-sector offices close.';
  return `<div class="class-tags" aria-label="Holiday type">${tags}</div><p class="dialog-body class-note">${note}</p>`;
}
function showDate(date) {
  const events = data.holidays.filter(h => h.date === date && matches(h));
  if (events.length === 1) return showHoliday(events[0].id);
  openDialog(`<span class="dialog-symbol" aria-hidden="true">✳</span><h2 class="dialog-heading" id="dialog-title">${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2><p class="dialog-body">${events.length} holidays fall on this day.</p><div class="holiday-list">${events.map(h => holidayRow(h)).join('')}</div>`);
}
function holidayRow(h, full = false) {
  return `<button class="upcoming-item" data-holiday="${esc(h.id)}"><span class="date-tile ${h.type}"><b>${Number(h.date.slice(-2))}</b><small>${MONTHS[Number(h.date.slice(5, 7)) - 1].slice(0, 3).toUpperCase()}</small></span><span><span class="upcoming-title">${esc(holidayDisplayName(h))}</span><span class="upcoming-meta">${formatDate(h.date, { weekday: 'long' })} · ${typeLabel(h)}${isEstimated(h.date.slice(0, 4)) ? ' · Estimated' : ''}</span></span>${full ? `<span class="list-type ${h.type}">${typeLabel(h)}</span>` : ''}<span class="upcoming-arrow" aria-hidden="true">↗</span></button>`;
}
function renderHero() {
  const next = breakSource().find(h => h.date >= today);
  if (!next) {
    $('#next-content').innerHTML = '<h2 class="next-name">More good days are on the way.</h2><p class="dialog-body">The next year’s dates have not been published yet.</p>';
    return;
  }
  const delta = daysBetween(today, next.date);
  $('#next-content').innerHTML = `<div class="next-date"><span class="next-day">${Number(next.date.slice(-2))}</span><span class="next-month">${MONTHS[Number(next.date.slice(5, 7)) - 1].slice(0, 3).toUpperCase()} ${next.date.slice(0, 4)}<br>${formatDate(next.date, { weekday: 'long' })}</span></div><h2 class="next-name">${esc(holidayDisplayName(next))}</h2><span class="next-pill"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 6v4h4"/></svg> ${delta === 0 ? 'A LITTLE PAUSE, TODAY' : `${delta} DAY${delta === 1 ? '' : 'S'} TO GO`}${isEstimated(next.date.slice(0, 4)) ? ' · ESTIMATED' : ''}</span>`;
  // The next long weekend (no leave needed), following the visitor's own work week and holidays.
  const source = breakSource();
  const nextBreak = availableYears.filter(y => y >= thisYear).flatMap(y => longWeekends(source, y, { weekend: weekendDays() })).find(w => w.end >= today);
  if (nextBreak) $('#next-content').insertAdjacentHTML('beforeend', `<p class="next-break"><span>Next long weekend</span><strong>${shortDate(nextBreak.start, { weekday: 'short' })} – ${shortDate(nextBreak.end, { weekday: 'short' })}</strong><em>${nextBreak.days} days off${nextBreak.start <= today ? ' · now' : ` · in ${daysBetween(today, nextBreak.start)} days`}</em></p>`);
  $('#next-holiday').disabled = false;
  $('#next-holiday').onclick = () => showHoliday(next.id);
  $('#next-holiday').setAttribute('aria-label', `Next holiday: ${holidayDisplayName(next)}, ${formatDate(next.date)}`);
}
// Days that belong to a long weekend, so the calendars can draw one band across each break.
// Leave breaks (dashed) need one to three leave days; long weekends (solid) need none.
function spanDays(spans) {
  const days = new Map();
  for (const s of spans) for (let d = s.start; d <= s.end; d = addDays(d, 1)) days.set(d, { ...s, first: d === s.start, last: d === s.end, isLeave: s.leaveDates?.includes(d) });
  return days;
}
function breakDays() {
  return { weekends: spanDays(yourLongWeekends()), leave: spanDays(yourLeavePlans()) };
}
const isOff = date => isWeekend(date, weekendDays());
const spanClass = (info, column, prefix) => info ? ` ${prefix}${info.first || column === 0 ? ` ${prefix}-start` : ''}${info.last || column === 6 ? ` ${prefix}-end` : ''}${column === 0 && !info.first ? ` ${prefix}-wrap-in` : ''}${column === 6 && !info.last ? ` ${prefix}-wrap-out` : ''}` : '';
const breakClass = (breaks, date, column) => spanClass(breaks.weekends.get(date), column, 'lw') + spanClass(breaks.leave.get(date), column, 'lp');
function breakBadges(days, leave = 0) {
  return `<span class="break-metrics"><span class="break-metric off"><b>${days}</b> days off</span><span class="break-metric ${leave ? 'leave' : 'no-leave'}">${leave ? `<b>${leave}</b> leave day${leave === 1 ? '' : 's'}` : 'No leave needed'}</span></span>`;
}
// Plain-language list of this month's breaks, so nobody has to decode the bands.
function monthBreaks() {
  const prefix = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
  const inMonth = s => s.start.slice(0, 7) <= prefix && s.end.slice(0, 7) >= prefix;
  const range = s => `${shortDate(s.start, { weekday: 'short' })} – ${shortDate(s.end, { weekday: 'short' })}`;
  const leave = yourLeavePlans().filter(inMonth).map(p => ({ start: p.start, past: p.end < today, html: `<button class="break-item is-leave-plan" data-break="${p.start}"><span class="break-body">${breakBadges(p.days, p.leave)}<span class="break-text"><strong>Take ${p.leaveDates.map(d => shortDate(d, { weekday: 'short' })).join(' and ')} off</strong><small>${range(p)}</small></span></span><span class="break-go" aria-hidden="true">›</span></button>` }));
  const free = yourLongWeekends().filter(inMonth).map(w => ({ start: w.start, past: w.end < today, html: `<div class="break-item is-free"><span class="break-body">${breakBadges(w.days)}<span class="break-text"><strong>Long weekend</strong><small>${range(w)}</small></span></span></div>` }));
  const items = [...leave, ...free].sort((a, b) => a.start.localeCompare(b.start));
  const body = items.length ? items.map(i => i.past ? i.html.replace('class="break-item', 'class="break-item is-past') : i.html).join('') : '<p class="break-empty">No long weekends or leave ideas this month.</p>';
  return `<section class="month-breaks" aria-label="Breaks this month"><h3>Breaks this month</h3>${body}</section>`;
}
// One break explained day by day, with the leave days called out.
function breakContent(start) {
  const p = yourLeavePlans().find(plan => plan.start === start);
  if (!p) return '';
  const rows = [];
  for (let d = p.start; d <= p.end; d = addDays(d, 1)) {
    const names = data.holidays.filter(h => h.date === d).map(h => esc(holidayDisplayName(h)));
    const isLeave = p.leaveDates.includes(d);
    const label = isLeave ? '<span class="day-kind leave">Take leave</span>' : names.length ? `<span class="day-kind holiday">${names.join(' · ')}</span>` : '<span class="day-kind weekend">Weekend</span>';
    rows.push(`<li class="${isLeave ? 'is-leave-day' : ''}"><span class="day-date">${formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</span>${label}</li>`);
  }
  return `<span class="dialog-symbol" aria-hidden="true">✦</span><h2 id="dialog-title" class="dialog-heading">${p.days} days off for ${p.leave} leave day${p.leave === 1 ? '' : 's'}.</h2><p class="dialog-body">Apply for leave on <strong>${p.leaveDates.map(d => formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })).join(' and ')}</strong>. Together with the holiday and your weekend, that gives you ${range(p)} off in a row.</p><ol class="break-days-list">${rows.join('')}</ol><button class="dialog-action" data-plan="${p.start}">↓ Add this break to my calendar</button><p class="dialog-body planner-hint">Your leave rules may differ. Verify dates before booking.</p>`;
  function range(x) { return `${shortDate(x.start, { weekday: 'short' })} – ${shortDate(x.end, { weekday: 'short' })}`; }
}
function renderMonth() {
  const breaks = breakDays();
  const cells = monthCells(state.year, state.month);
  const byDate = new Map();
  for (const h of data.holidays.filter(matches)) {
    if (!byDate.has(h.date)) byDate.set(h.date, []);
    byDate.get(h.date).push(h);
  }
  const showsToday = today.startsWith(`${state.year}-${String(state.month + 1).padStart(2, '0')}-`);
  const todayColumn = (parseDate(today).getUTCDay() + 6) % 7;
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => `<span${showsToday && i === todayColumn ? ' class="is-current"' : ''}>${d}</span>`).join('');
  const days = cells.map((cell, index) => {
    if (!cell.inMonth) return '<div class="cal-day is-empty" aria-hidden="true"></div>';
    const events = byDate.get(cell.date) || [];
    const isToday = cell.date === today;
    const info = breaks.weekends.get(cell.date);
    const plan = breaks.leave.get(cell.date);
    const day = `cal-day${breakClass(breaks, cell.date, index % 7)}`;
    const span = plan || info;
    const wrapsIn = index % 7 === 0 && span && !span.first;
    const wrapsOut = index % 7 === 6 && span && !span.last;
    const spanLabel = span && (span.start.slice(0, 7) === span.end.slice(0, 7) ? `${Number(span.start.slice(-2))}–${Number(span.end.slice(-2))}` : `${shortDate(span.start)}–${shortDate(span.end)}`);
    const continuation = wrapsIn || wrapsOut ? `<span class="break-wrap" aria-hidden="true" title="${esc(`Same break: ${shortDate(span.start)} – ${shortDate(span.end)}`)}">${wrapsIn ? '↳ ' : ''}${esc(spanLabel)}${wrapsOut ? ' ↴' : ''}</span>` : '';
    const cls = ['cal-dot', isOff(cell.date) && 'is-weekend', plan?.isLeave && 'is-leave', events.length && (events.some(h => h.type === 'poya') ? 'is-poya' : 'is-public'), events.some(isMercantile) && 'is-mercantile', isToday && 'is-today'].filter(Boolean).join(' ');
    const current = isToday ? ' aria-current="date"' : '';
    const breakNote = info ? `, part of a ${info.days}-day long weekend` : '';
    if (plan?.isLeave) return `<div class="${day}"><button class="${cls}" data-break="${plan.start}"${current} aria-label="${esc(`Take leave on ${formatDate(cell.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${plan.days} days off for ${plan.leave} leave day${plan.leave === 1 ? '' : 's'}`)}">${cell.day}<span class="leave-badge" aria-hidden="true">Leave</span></button>${continuation}</div>`;
    if (!events.length) return `<div class="${day}"><span class="${cls}"${current}${span ? ` title="${esc(`${span.days}-day break: ${shortDate(span.start)} – ${shortDate(span.end)}`)}"` : ''}>${cell.day}</span>${continuation}</div>`;
    const names = events.map(h => holidayDisplayName(h));
    return `<div class="${day}"><button class="${cls}" data-date="${cell.date}"${current} aria-label="${esc(`${formatDate(cell.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${names.join(', ')}${breakNote}`)}">${cell.day}</button><span class="cal-name" aria-hidden="true">${esc(names.join(' · '))}</span>${continuation}</div>`;
  }).join('');
  $('#calendar').innerHTML = `<div class="cal${prefs.saturday ? ' works-saturday' : ''}"><div class="cal-weekdays">${weekdays}</div><div class="cal-grid">${days}</div></div>${monthBreaks()}`;
}
function renderYear() {
  const holidays = yearHolidays().filter(matches);
  const breaks = breakDays();
  $('#calendar').innerHTML = `<div class="year-grid${prefs.saturday ? ' works-saturday' : ''}">${MONTHS.map((name, month) => `<button class="mini-month" data-month="${month}" aria-label="Open ${name} ${state.year}"><h3>${name}</h3><div class="mini-week">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div><div class="mini-dates">${monthCells(state.year, month).map((cell, index) => {
    if (!cell.inMonth) return '<span></span>';
    const band = breakClass(breaks, cell.date, index % 7).trim();
    const events = holidays.filter(h => h.date === cell.date);
    const cls = ['mini-dot', isOff(cell.date) && 'is-weekend', breaks.leave.get(cell.date)?.isLeave && 'is-leave', events.length && (events.some(h => h.type === 'poya') ? 'is-poya' : 'is-public'), events.some(isMercantile) && 'is-mercantile', cell.date === today && 'is-today'].filter(Boolean).join(' ');
    return `<span${band ? ` class="${band}"` : ''}><i class="${cls}">${cell.day}</i></span>`;
  }).join('')}</div></button>`).join('')}</div>`;
}
function render() {
  if (!data) return;
  renderHero();
  const all = yearHolidays();
  const selected = all.filter(matches);
  const monthSelected = selected.filter(h => Number(h.date.slice(5, 7)) - 1 === state.month);
  $('#month-title').textContent = state.view === 'year' ? `${state.year} at a glance` : state.view === 'list' ? `${state.year} holidays` : `${MONTHS[state.month]} ${state.year}`;
  document.querySelectorAll('[data-year]').forEach(b => { const on = Number(b.dataset.year) === state.year; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  const amount = state.view === 'month' ? monthSelected.length : selected.length;
  $('#month-count').textContent = `${amount} holiday${amount === 1 ? '' : 's'}`;
  $('#estimate-note').hidden = !isEstimated(state.year);
  $('#month-view').classList.toggle('selected', state.view === 'month');
  $('#list-view').classList.toggle('selected', state.view === 'list');
  $('#month-view').setAttribute('aria-pressed', state.view === 'month');
  $('#list-view').setAttribute('aria-pressed', state.view === 'list');
  for (const [id, active] of [['#nav-calendar', state.view !== 'year'], ['#nav-year', state.view === 'year']]) {
    $(id).classList.toggle('active', active);
    if (active) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
  }
  const index = availableYears.indexOf(state.year);
  $('#prev').disabled = index === 0 && (state.view !== 'month' || state.month === 0);
  $('#next').disabled = index === availableYears.length - 1 && (state.view !== 'month' || state.month === 11);
  $('#prev').setAttribute('aria-label', `Previous ${state.view === 'month' ? 'month' : 'year'}`);
  $('#next').setAttribute('aria-label', `Next ${state.view === 'month' ? 'month' : 'year'}`);
  document.querySelectorAll('[data-filter]').forEach(button => {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
  if (state.view === 'month') renderMonth();
  else if (state.view === 'year') renderYear();
  else $('#calendar').innerHTML = selected.length ? `<div class="holiday-list">${selected.map(h => holidayRow(h, true)).join('')}</div>` : '<div class="empty-state">No holidays match your search.<br>Try another name or choose “All public holidays”.</div>';
  positionCalendarKey();
  const coming = selected.filter(h => state.year === thisYear ? h.date >= today : true);
  $('#upcoming-count').textContent = state.search ? `${coming.length} found` : `${state.year}`;
  $('#upcoming-list').innerHTML = coming.length ? coming.slice(0, 3).map(h => holidayRow(h)).join('') : '<p class="empty-state">No upcoming holidays match.<br>Explore the full year below.</p>';
  $('#holiday-total').textContent = new Set(all.filter(holidayScope).map(h => h.date)).size;
  $('#weekend-total').textContent = yourLongWeekends().length;
  $('#summary-year').textContent = state.year;
  $('#week-note').textContent = `Based on ${prefs.saturday ? 'a Sunday-only' : 'a Saturday–Sunday'} weekend${state.filter === 'mercantile' ? ' and mercantile holidays' : ''}.`;
  $('#calendar').setAttribute('aria-busy', 'false');
  writeURL();
}
// The address keeps the month, view and filter, so any view can be shared or bookmarked.
function writeURL() {
  const params = new URLSearchParams();
  const defaultMonth = state.year === thisYear && state.month === Number(today.slice(5, 7)) - 1;
  if (state.view === 'month' && !defaultMonth) params.set('m', `${state.year}-${String(state.month + 1).padStart(2, '0')}`);
  if (state.view !== 'month') { params.set('view', state.view); if (state.year !== thisYear) params.set('y', state.year); }
  if (state.filter !== 'all') params.set('filter', state.filter);
  const holiday = $('#detail-dialog').open && $('#detail-dialog').dataset.holiday;
  if (holiday) params.set('holiday', holiday);
  const url = `${location.pathname}${params.size ? `?${params}` : ''}`;
  if (url === `${location.pathname}${location.search}`) { lastURL = url; return; }
  // Moving between months or views makes a history entry; filters and dialogs just update the address.
  const page = url.replace(/[?&](filter|holiday)=[^&]*/g, '');
  if (page !== lastURL.replace(/[?&](filter|holiday)=[^&]*/g, '') && lastURL) history.pushState(null, '', url); else history.replaceState(null, '', url);
  lastURL = url;
}
function readURL() {
  const params = new URLSearchParams(location.search);
  const month = params.get('m')?.match(/^(\d{4})-(\d{2})$/);
  const view = ['year', 'list'].includes(params.get('view')) ? params.get('view') : 'month';
  let year = month ? Number(month[1]) : Number(params.get('y')) || thisYear;
  if (!availableYears.includes(year)) year = availableYears.includes(thisYear) ? thisYear : availableYears[0];
  Object.assign(state, { view, year, month: month && Number(month[1]) === year ? Math.min(11, Math.max(0, Number(month[2]) - 1)) : year === thisYear ? Number(today.slice(5, 7)) - 1 : 0, filter: params.get('filter') === 'mercantile' ? 'mercantile' : 'all' });
  return params.get('holiday');
}
window.addEventListener('popstate', () => {
  if (!data) return;
  const holiday = readURL();
  resetSearch(); lastURL = `${location.pathname}${location.search}`;
  if ($('#detail-dialog').open && !holiday) $('#detail-dialog').close();
  render();
  if (holiday) showHoliday(holiday);
});
function navigate(direction) {
  if (!data) return;
  if (state.view === 'month') {
    state.month += direction;
    if (state.month < 0) { state.year = availableYears[availableYears.indexOf(state.year) - 1]; state.month = 11; }
    if (state.month > 11) { state.year = availableYears[availableYears.indexOf(state.year) + 1]; state.month = 0; }
  } else state.year = availableYears[availableYears.indexOf(state.year) + direction];
  render();
}
function resetSearch() { state.search = ''; $('#search').value = ''; }
function download(holidays, filename) {
  const content = typeof holidays === 'string' ? holidays : createICS(holidays, data.fetchedAt, data.years);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Calendar downloaded. Open the .ics file in your calendar app.');
}
$('#prev').onclick = () => navigate(-1);
$('#next').onclick = () => navigate(1);
$('#today').onclick = () => {
  if (!data) return;
  state.year = availableYears.includes(thisYear) ? thisYear : availableYears[0];
  state.month = Number(today.slice(5, 7)) - 1; state.view = 'month'; resetSearch(); render();
  if (state.year !== thisYear) notify(`Dates for ${thisYear} are not available yet. Showing ${state.year}.`);
};
$('#year').onclick = event => { const b = event.target.closest('[data-year]'); if (b) { state.year = Number(b.dataset.year); render(); } };
$('#month-view').onclick = () => { state.view = 'month'; resetSearch(); render(); };
$('#list-view').onclick = () => { state.view = 'list'; render(); };
$('#nav-calendar').onclick = () => { state.view = 'month'; resetSearch(); render(); };
$('#nav-year').onclick = () => { state.view = 'year'; resetSearch(); render(); };
$('#all-holidays').onclick = () => { state.view = 'list'; render(); $('#calendar-section').scrollIntoView({ block: 'start', behavior: 'smooth' }); };
$('#search').oninput = event => { state.search = event.target.value; if (state.search) state.view = 'list'; render(); };
document.querySelectorAll('[data-filter]').forEach(button => { button.onclick = () => { state.filter = button.dataset.filter; prefs.holidays = state.filter; savePrefs(); render(); }; });
document.addEventListener('click', event => {
  const holiday = event.target.closest('[data-holiday]');
  if (holiday) showHoliday(holiday.dataset.holiday);
  const date = event.target.closest('[data-date]');
  if (date) showDate(date.dataset.date);
  const pref = event.target.closest('[data-pref]');
  if (pref) {
    const [key, value] = pref.dataset.pref.split(':');
    prefs[key] = key === 'maxLeave' ? Number(value) : key === 'saturday' ? value === 'true' : value;
    savePrefs(); render();
    $('#dialog-content').innerHTML = plannerContent();
    $(`[data-pref="${pref.dataset.pref}"]`)?.focus();
  }
  const breakButton = event.target.closest('[data-break]');
  if (breakButton) { const content = breakContent(breakButton.dataset.break); if (content) openDialog(content, 'break'); }
  const plan = event.target.closest('[data-plan]');
  if (plan) {
    const found = yourLeavePlans().find(p => p.start === plan.dataset.plan);
    if (found) download(createBreakICS(found, data.fetchedAt), `break-${found.start}.ics`);
  }
  const reminder = event.target.closest('[data-reminders]');
  if (reminder) { withReminders = reminder.dataset.reminders === 'on'; $('#dialog-content').innerHTML = subscribeContent(); $(`[data-reminders="${reminder.dataset.reminders}"]`)?.focus(); }
  const embed = event.target.closest('[data-embed]');
  if (embed) { const [key, value] = embed.dataset.embed.split(':'); if (key === 'theme') embedTheme = value; else embedMercantile = value === 'mercantile'; $('#dialog-content').innerHTML = embedContent(); $(`[data-embed="${embed.dataset.embed}"]`)?.focus(); }
  if (event.target.closest('[data-copy-embed]')) { const code = embedCode().html; navigator.clipboard?.writeText(code).then(() => notify('Code copied. Paste it into your website’s HTML.'), () => { $('#embed-code').select(); notify('Select the code and copy it.'); }); }
  const copy = event.target.closest('[data-copy]');
  if (copy) copyLink(copy.dataset.copy);
  const month = event.target.closest('[data-month]');
  if (month) { state.month = Number(month.dataset.month); state.view = 'month'; render(); }
  const single = event.target.closest('[data-download]');
  if (single) download(data.holidays.filter(h => h.id === single.dataset.download), 'sri-lanka-holiday.ics');
});
$('#export').onclick = () => { if (data) download(yearHolidays().filter(holidayScope), `sri-lanka-${state.filter === 'mercantile' ? 'mercantile-' : ''}holidays-${state.year}.ics`); };
$('#weekend-button').onclick = () => {
  if (!data) return;
  const weekends = yourLongWeekends();
  openDialog(`<span class="dialog-symbol" aria-hidden="true">↟</span><h2 id="dialog-title" class="dialog-heading">A longer little break.</h2><p class="dialog-body">${state.year} breaks of three days or more, combining ${state.filter === 'mercantile' ? 'mercantile' : 'public'} holidays with your ${prefs.saturday ? 'Sunday' : 'Saturday and Sunday'}. No extra leave days included.${isEstimated(state.year) ? ' Holiday dates for this year are estimates.' : ''}</p>${weekends.map(w => `<div class="weekend-row"><span>${formatDate(w.start, { day: 'numeric', month: 'short' })} – ${formatDate(w.end, { day: 'numeric', month: 'short' })}<small>${formatDate(w.start, { weekday: 'long' })} to ${formatDate(w.end, { weekday: 'long' })}</small></span>${breakBadges(w.days)}</div>`).join('') || '<p class="dialog-body">No long weekends are listed for this year yet.</p>'}<p class="dialog-body">Your working week and holiday entitlement may differ. Verify dates before booking.</p>`);
};
function prefsControls() {
  const group = (label, key, options) => `<div class="pref-group"><span class="pref-label" id="pref-${key}">${label}</span><div class="filters" role="group" aria-labelledby="pref-${key}">${options.map(([value, text]) => {
    const active = String(prefs[key]) === String(value);
    return `<button class="filter${active ? ' active' : ''}" data-pref="${key}:${value}" aria-pressed="${active}">${text}</button>`;
  }).join('')}</div></div>`;
  return `<div class="prefs">${group('I work', 'saturday', [[false, 'Mon – Fri'], [true, 'Mon – Sat']])}${group('Leave days I can take', 'maxLeave', [1, 2, 3, 4, 5].map(n => [n, `Up to ${n}`]))}</div>`;
}
function plannerContent() {
  const plans = yourLeavePlans(state.year === thisYear ? today : '');
  const rows = plans.map(p => `<div class="weekend-row plan-row"><span>Take ${p.leaveDates.map(d => shortDate(d, { weekday: 'short' })).join(', ')} off<small>${shortDate(p.start, { weekday: 'short' })} – ${shortDate(p.end, { weekday: 'short' })}</small><button class="feed-link" data-plan="${p.start}">↓ Add break to my calendar</button></span>${breakBadges(p.days, p.leave)}</div>`).join('');
  return `<span class="dialog-symbol" aria-hidden="true">✦</span><h2 id="dialog-title" class="dialog-heading">More days off, less leave.</h2><p class="dialog-body">Leave days that join ${state.year} holidays to your weekend. The best value for each break is shown.${isEstimated(state.year) ? ' Holiday dates for this year are estimates.' : ''}</p>${prefsControls()}${rows || `<p class="dialog-body">No leave ideas ${state.year === thisYear ? 'left ' : ''}for ${state.year}.</p>`}<p class="dialog-body">Your leave rules may differ. Verify dates before booking.</p>`;
}
let withReminders = true;
function subscribeContent() {
  const suffix = withReminders ? '-reminders.ics' : '.ics';
  const feeds = [['holidays.ics', 'All public holidays', 'Poya, public and bank holidays. Best for government and bank workers.'], ['holidays-mercantile.ics', 'Mercantile + Poya holidays', 'Mercantile holidays and every full moon Poya day.']];
  return `<span class="dialog-symbol" aria-hidden="true">↻</span><h2 id="dialog-title" class="dialog-heading">Always up to date.</h2><p class="dialog-body">Subscribe once and your calendar app checks for changes automatically, including newly announced and corrected dates.</p><div class="filters reminder-switch" role="group" aria-label="Reminders"><button class="filter${withReminders ? ' active' : ''}" data-reminders="on" aria-pressed="${withReminders}">🔔 Remind me a day and a week before</button><button class="filter${withReminders ? '' : ' active'}" data-reminders="off" aria-pressed="${!withReminders}">No reminders</button></div><p class="dialog-body planner-hint">Reminders work in Apple Calendar and Outlook. Google Calendar uses its own notification settings for subscribed calendars.</p>${feeds.map(([file, title, text]) => {
    const path = file.replace('.ics', suffix);
    const https = `${location.origin}/${path}`, webcal = `webcal://${location.host}/${path}`;
    return `<section class="feed"><h3>${title}</h3><p>${text}</p><div class="feed-actions"><a class="dialog-action" href="${esc(webcal)}">Apple · Outlook</a><a class="feed-link" href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener noreferrer">Google Calendar ↗</a><button class="feed-link" data-copy="${esc(https)}">Copy link</button></div></section>`;
  }).join('')}<p class="dialog-body">Elsewhere, paste the link into your calendar’s “Subscribe” or “From URL” option. Updates can take a day to appear.</p>`;
}
async function copyLink(url) {
  try { await navigator.clipboard.writeText(url); notify('Link copied. Paste it into your calendar’s “Subscribe” option.'); }
  catch { notify(url); }
}
$('#planner-button').onclick = () => { if (data) openDialog(plannerContent(), 'planner'); };
const syncThemeButton = () => $('#theme-toggle').setAttribute('aria-label', `Switch to ${document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'} theme`);
$('#theme-toggle').onclick = () => { window.islandTheme?.toggle(); syncThemeButton(); };
syncThemeButton();
let embedTheme = 'auto', embedMercantile = false;
function embedCode() {
  const params = new URLSearchParams();
  if (embedTheme !== 'auto') params.set('theme', embedTheme);
  if (embedMercantile) params.set('holidays', 'mercantile');
  const src = `${location.origin}/widget/${params.size ? `?${params}` : ''}`;
  return { src, html: `<iframe src="${src}" width="320" height="200" style="border:0;border-radius:16px;max-width:100%" title="Next Sri Lanka holiday" loading="lazy"></iframe>
<p><a href="${location.origin}/">Sri Lanka holidays and long weekends</a> by Island Days</p>` };
}
function embedContent() {
  const { src, html } = embedCode();
  const chip = (key, value, label, on) => `<button class="filter${on ? ' active' : ''}" data-embed="${key}:${value}" aria-pressed="${on}">${label}</button>`;
  return `<span class="dialog-symbol" aria-hidden="true">✳</span><h2 id="dialog-title" class="dialog-heading">Add Island Days to your website.</h2><p class="dialog-body">Show the next Sri Lanka holiday on your blog, school or company site. It updates itself every day.</p><div class="pref-group"><span class="pref-label">Theme</span><div class="filters">${chip('theme', 'auto', 'Match visitor', embedTheme === 'auto')}${chip('theme', 'light', 'Light', embedTheme === 'light')}${chip('theme', 'dark', 'Dark', embedTheme === 'dark')}</div></div><div class="pref-group"><span class="pref-label">Holidays</span><div class="filters">${chip('holidays', 'all', 'All public holidays', !embedMercantile)}${chip('holidays', 'mercantile', 'Mercantile only', embedMercantile)}</div></div><div class="embed-preview"><iframe src="${esc(src)}" width="320" height="200" title="Widget preview" loading="lazy"></iframe></div><label class="pref-label" for="embed-code">Copy this code</label><textarea id="embed-code" class="embed-code" readonly rows="4">${esc(html)}</textarea><button class="dialog-action" data-copy-embed>Copy code</button>`;
}
$('#embed-link').onclick = () => openDialog(embedContent(), 'embed');
$('#subscribe').onclick = () => openDialog(subscribeContent());
$('#about').onclick =() => openDialog('<span class="dialog-symbol" aria-hidden="true">✳</span><h2 id="dialog-title" class="dialog-heading">For a little more living.</h2><p class="dialog-body">Island Days is an independent calendar for Sri Lanka’s public holidays. Find Poya days, plan a long weekend, and save the year to your favourite calendar.</p><p class="dialog-body">Holiday dates come from the Central Bank of Sri Lanka’s holiday list, which follows the government gazette and marks each day as a public, bank and/or mercantile holiday. A new year appears here once it has been gazetted. The calendar displays the last successful data check; estimated years are labelled. Poya days are public holidays too, and are highlighted separately for easy browsing.</p><p class="dialog-body">All dates use the Sri Lanka calendar day (Asia/Colombo). Holiday dates and working arrangements can change. Verify with the source or your employer before making plans.</p><a class="dialog-action" href="https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-2026" target="_blank" rel="noopener noreferrer">Visit the source ↗</a>');
$('#close-dialog').onclick = () => $('#detail-dialog').close();
$('#detail-dialog').addEventListener('close', () => {
  $('#detail-dialog').dataset.kind = ''; $('#detail-dialog').dataset.holiday = '';
  if (data) writeURL();
  if (focusedBeforeDialog?.isConnected) focusedBeforeDialog.focus();
});
$('#detail-dialog').addEventListener('click', event => { if (event.target === $('#detail-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
async function init() {
  try {
    const response = await fetch('/data/holidays.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Data could not be loaded');
    data = await response.json();
    if (data.schemaVersion !== 1 || !data.holidays?.length || !data.years || !Number.isFinite(Date.parse(data.fetchedAt))) throw new Error('Invalid calendar data');
    availableYears = Object.keys(data.years).map(Number).sort();
    if (!availableYears.includes(state.year)) state.year = availableYears.reduce((best, year) => Math.abs(year - thisYear) < Math.abs(best - thisYear) ? year : best);
    const linkedHoliday = location.search ? readURL() : null;
    $('#year').innerHTML = availableYears.map(year => `<button type="button" data-year="${year}" aria-pressed="false">${year}</button>`).join('');
    const stale = Date.now() - Date.parse(data.fetchedAt) > 45 * 86400000;
    $('.data-line').classList.toggle('stale', stale);
    const checked = colomboToday(new Date(data.fetchedAt));
    $('#sync-status').textContent = `${stale ? 'Update overdue · Last checked' : 'Last checked'} ${formatDate(checked, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const sourceUrl = (data.years[thisYear] || data.years[availableYears.at(-1)])?.sourceUrl;
    if (sourceUrl?.startsWith('https://www.cbsl.gov.lk/')) $('#source-link').href = sourceUrl;
    lastURL = `${location.pathname}${location.search}`;
    renderHero(); render();
    if (linkedHoliday) showHoliday(linkedHoliday);
  } catch (error) {
    console.error(error);
    data = undefined;
    $('#calendar').innerHTML = '<div class="empty-state">Your calendar couldn’t load.<br><button class="dialog-action" id="retry">Try again</button><br>Or see the <a href="https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-2026">Central Bank holiday list</a>.</div>';
    $('#calendar').setAttribute('aria-busy', 'false');
    $('#retry').onclick = init;
    $('#sync-status').textContent = 'Calendar data is unavailable';
    $('#next-content').innerHTML = '<h2 class="next-name">Good days ahead.</h2><p>Reload the calendar to find your next holiday.</p>';
  }
}
init();

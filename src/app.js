import { MONTHS, monthCells, colomboToday, formatDate, parseDate, daysBetween, longWeekends, createICS } from './calendar.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const today = colomboToday();
const thisYear = Number(today.slice(0, 4));
let data, availableYears = [], focusedBeforeDialog, toastTimer;
const state = { year: thisYear, month: Number(today.slice(5, 7)) - 1, view: 'month', filter: 'all', search: '' };
const yearHolidays = () => data.holidays.filter(h => Number(h.date.slice(0, 4)) === state.year);
const matches = h => (state.filter === 'all' || h.type === state.filter) && h.name.toLowerCase().includes(state.search.toLowerCase());
const typeLabel = h => h.type === 'poya' ? 'Poya day' : 'Public holiday';
const isEstimated = year => data.years[year]?.estimated;
function notify(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
function openDialog(content) {
  focusedBeforeDialog = document.activeElement;
  $('#dialog-content').innerHTML = content;
  $('#detail-dialog').showModal();
  $('#close-dialog').focus();
}
function showHoliday(id) {
  const h = data.holidays.find(holiday => holiday.id === id);
  if (!h) return;
  openDialog(`<span class="dialog-symbol" aria-hidden="true">${h.type === 'poya' ? '☾' : '✳'}</span><span class="dialog-tag ${h.type}">${typeLabel(h)}</span><h2 class="dialog-heading" id="dialog-title">${esc(h.name)}</h2><p class="dialog-date">${formatDate(h.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Sri Lanka</p>${isEstimated(h.date.slice(0, 4)) ? '<p class="notice">This date is an estimate from the source and may change.</p>' : ''}<p class="dialog-body">A little room to slow down. This holiday is listed in the Sri Lanka public holiday calendar. Check the source for the latest details before making plans.</p><button class="dialog-action" data-download="${esc(h.id)}">↓ Add to my calendar</button><a class="dialog-source" href="${esc(h.sourceUrl)}" target="_blank" rel="noopener noreferrer">Read more at PublicHolidays.lk ↗</a>`);
}
function holidayRow(h, full = false) {
  return `<button class="upcoming-item" data-holiday="${esc(h.id)}"><span class="date-tile ${h.type}"><b>${Number(h.date.slice(-2))}</b><small>${MONTHS[Number(h.date.slice(5, 7)) - 1].slice(0, 3).toUpperCase()}</small></span><span><span class="upcoming-title">${esc(h.name)}</span><span class="upcoming-meta">${formatDate(h.date, { weekday: 'long' })} · ${typeLabel(h)}${isEstimated(h.date.slice(0, 4)) ? ' · Estimated' : ''}</span></span>${full ? `<span class="list-type ${h.type}">${typeLabel(h)}</span>` : ''}<span class="upcoming-arrow" aria-hidden="true">↗</span></button>`;
}
function renderHero() {
  const next = data.holidays.find(h => h.date >= today);
  if (!next) {
    $('#next-content').innerHTML = '<h2 class="next-name">More good days are on the way.</h2><p class="dialog-body">The next year’s dates have not been published yet.</p>';
    return;
  }
  const delta = daysBetween(today, next.date);
  $('#next-content').innerHTML = `<div class="next-date"><span class="next-day">${Number(next.date.slice(-2))}</span><span class="next-month">${MONTHS[Number(next.date.slice(5, 7)) - 1].slice(0, 3).toUpperCase()} ${next.date.slice(0, 4)}<br>${formatDate(next.date, { weekday: 'long' })}</span></div><h2 class="next-name">${esc(next.name)}</h2><span class="next-pill"><span aria-hidden="true">◷</span> ${delta === 0 ? 'A LITTLE PAUSE, TODAY' : `${delta} DAY${delta === 1 ? '' : 'S'} TO GO`}${isEstimated(next.date.slice(0, 4)) ? ' · ESTIMATED' : ''}</span>`;
  $('#next-holiday').disabled = false;
  $('#next-holiday').onclick = () => showHoliday(next.id);
  $('#next-holiday').setAttribute('aria-label', `Next holiday: ${next.name}, ${formatDate(next.date)}`);
}
function renderMonth() {
  const cells = monthCells(state.year, state.month);
  const byDate = new Map();
  for (const h of data.holidays.filter(matches)) {
    if (!byDate.has(h.date)) byDate.set(h.date, []);
    byDate.get(h.date).push(h);
  }
  $('#calendar').innerHTML = `<div class="calendar-shell"><div class="weekdays">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span>${d}</span>`).join('')}</div><div class="month-grid">${cells.map(cell => `<div class="day-cell${cell.inMonth ? '' : ' outside'}${cell.weekend ? ' weekend' : ''}${cell.date === today ? ' today' : ''}"><span class="day-number"${cell.date === today ? ' aria-current="date"' : ''}>${cell.day}</span>${cell.date === today ? '<span class="today-word">TODAY</span>' : ''}${(byDate.get(cell.date) || []).map(h => `<button class="holiday-chip ${h.type}" data-holiday="${esc(h.id)}" aria-label="${esc(`${h.name}, ${formatDate(h.date)}`)}">${esc(h.name)}</button>`).join('')}</div>`).join('')}</div></div>`;
}
function renderYear() {
  const holidays = yearHolidays().filter(matches);
  $('#calendar').innerHTML = `<div class="year-grid">${MONTHS.map((name, month) => `<button class="mini-month" data-month="${month}" aria-label="Open ${name} ${state.year}"><h3>${name}</h3><div class="mini-week">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div><div class="mini-dates">${monthCells(state.year, month).map(cell => {
    const events = holidays.filter(h => h.date === cell.date);
    return `<span class="${cell.inMonth ? '' : 'is-outside'} ${events.some(h => h.type === 'poya') ? 'is-poya' : events.length ? 'is-public' : ''} ${cell.date === today ? 'is-today' : ''}">${cell.day}</span>`;
  }).join('')}</div></button>`).join('')}</div>`;
}
function render() {
  if (!data) return;
  const all = yearHolidays();
  const selected = all.filter(matches);
  const monthSelected = selected.filter(h => Number(h.date.slice(5, 7)) - 1 === state.month);
  $('#month-title').textContent = state.view === 'year' ? `${state.year} at a glance` : state.view === 'list' ? `${state.year} holidays` : `${MONTHS[state.month]} ${state.year}`;
  $('#year').value = state.year;
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
  else $('#calendar').innerHTML = selected.length ? `<div class="holiday-list">${selected.map(h => holidayRow(h, true)).join('')}</div>` : '<div class="empty-state">No holidays match your search.<br>Try another name or choose “All holidays”.</div>';
  const coming = selected.filter(h => state.year === thisYear ? h.date >= today : true);
  $('#upcoming-count').textContent = state.search ? `${coming.length} found` : `${state.year}`;
  $('#upcoming-list').innerHTML = coming.length ? coming.slice(0, 3).map(h => holidayRow(h)).join('') : '<p class="empty-state">No upcoming holidays match.<br>Explore the full year below.</p>';
  $('#holiday-total').textContent = new Set(all.map(h => h.date)).size;
  $('#weekend-total').textContent = longWeekends(data.holidays, state.year).length;
  $('#summary-year').textContent = state.year;
  $('#calendar').setAttribute('aria-busy', 'false');
}
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
  const blob = new Blob([createICS(holidays, data.fetchedAt, data.years)], { type: 'text/calendar;charset=utf-8' });
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
  state.month = Number(today.slice(5, 7)) - 1; state.view = 'month'; state.filter = 'all'; resetSearch(); render();
  if (state.year !== thisYear) notify(`Dates for ${thisYear} are not available yet. Showing ${state.year}.`);
};
$('#year').onchange = event => { state.year = Number(event.target.value); render(); };
$('#month-view').onclick = () => { state.view = 'month'; resetSearch(); render(); };
$('#list-view').onclick = () => { state.view = 'list'; render(); };
$('#nav-calendar').onclick = () => { state.view = 'month'; resetSearch(); render(); };
$('#nav-year').onclick = () => { state.view = 'year'; resetSearch(); render(); };
$('#all-holidays').onclick = () => { state.view = 'list'; render(); $('#calendar-section').scrollIntoView({ block: 'start', behavior: 'smooth' }); };
$('#search').oninput = event => { state.search = event.target.value; if (state.search) state.view = 'list'; render(); };
document.querySelectorAll('[data-filter]').forEach(button => { button.onclick = () => { state.filter = button.dataset.filter; render(); }; });
document.addEventListener('click', event => {
  const holiday = event.target.closest('[data-holiday]');
  if (holiday) showHoliday(holiday.dataset.holiday);
  const month = event.target.closest('[data-month]');
  if (month) { state.month = Number(month.dataset.month); state.view = 'month'; render(); }
  const single = event.target.closest('[data-download]');
  if (single) download(data.holidays.filter(h => h.id === single.dataset.download), 'sri-lanka-holiday.ics');
});
$('#export').onclick = () => { if (data) download(yearHolidays(), `sri-lanka-holidays-${state.year}.ics`); };
$('#weekend-button').onclick = () => {
  if (!data) return;
  const weekends = longWeekends(data.holidays, state.year);
  openDialog(`<span class="dialog-symbol" aria-hidden="true">↟</span><h2 id="dialog-title" class="dialog-heading">A longer little break.</h2><p class="dialog-body">${state.year} breaks of three days or more, combining public holidays with Saturday and Sunday. No extra leave days included.${isEstimated(state.year) ? ' Holiday dates for this year are estimates.' : ''}</p>${weekends.map(w => `<div class="weekend-row"><span>${formatDate(w.start, { day: 'numeric', month: 'short' })} – ${formatDate(w.end, { day: 'numeric', month: 'short' })}<small>${formatDate(w.start, { weekday: 'long' })} to ${formatDate(w.end, { weekday: 'long' })}</small></span><strong>${w.days}<small>days off</small></strong></div>`).join('') || '<p class="dialog-body">No long weekends are listed for this year yet.</p>'}<p class="dialog-body">Your working week and holiday entitlement may differ. Verify dates before booking.</p>`);
};
$('#about').onclick = () => openDialog('<span class="dialog-symbol" aria-hidden="true">✳</span><h2 id="dialog-title" class="dialog-heading">For a little more living.</h2><p class="dialog-body">Island Days is an independent calendar for Sri Lanka’s public holidays. Find Poya days, plan a long weekend, and save the year to your favourite calendar.</p><p class="dialog-body">Holiday dates are sourced from PublicHolidays.lk. The calendar displays the last successful data check; estimated years are labelled. Poya days are public holidays too, and are highlighted separately for easy browsing.</p><p class="dialog-body">All dates use the Sri Lanka calendar day (Asia/Colombo). Holiday dates and working arrangements can change. Verify with the source or your employer before making plans.</p><a class="dialog-action" href="https://publicholidays.lk/" target="_blank" rel="noopener noreferrer">Visit the source ↗</a>');
$('#close-dialog').onclick = () => $('#detail-dialog').close();
$('#detail-dialog').addEventListener('close', () => { if (focusedBeforeDialog?.isConnected) focusedBeforeDialog.focus(); });
$('#detail-dialog').addEventListener('click', event => { if (event.target === $('#detail-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
async function init() {
  try {
    const response = await fetch('/data/holidays.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Data could not be loaded');
    data = await response.json();
    if (data.schemaVersion !== 1 || !data.holidays?.length || !data.years || !Number.isFinite(Date.parse(data.fetchedAt))) throw new Error('Invalid calendar data');
    availableYears = Object.keys(data.years).map(Number).sort();
    if (!availableYears.includes(state.year)) state.year = availableYears.reduce((best, year) => Math.abs(year - thisYear) < Math.abs(best - thisYear) ? year : best);
    $('#year').innerHTML = availableYears.map(year => `<option value="${year}">${year}</option>`).join('');
    const stale = Date.now() - Date.parse(data.fetchedAt) > 45 * 86400000;
    $('.data-line').classList.toggle('stale', stale);
    const checked = colomboToday(new Date(data.fetchedAt));
    $('#sync-status').textContent = `${stale ? 'Update overdue · Last checked' : 'Last checked'} ${formatDate(checked, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    renderHero(); render();
  } catch (error) {
    console.error(error);
    data = undefined;
    $('#calendar').innerHTML = '<div class="empty-state">Your calendar couldn’t load.<br><button class="dialog-action" id="retry">Try again</button><br>Or visit <a href="https://publicholidays.lk/">PublicHolidays.lk</a> for dates.</div>';
    $('#calendar').setAttribute('aria-busy', 'false');
    $('#retry').onclick = init;
    $('#sync-status').textContent = 'Calendar data is unavailable';
    $('#next-content').innerHTML = '<h2 class="next-name">Good days ahead.</h2><p>Reload the calendar to find your next holiday.</p>';
  }
}
init();

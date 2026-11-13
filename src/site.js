const $ = selector => document.querySelector(selector);
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
let clockTimer;
function tickClock() {
  clearTimeout(clockTimer);
  const now = new Date();
  const parts = Object.fromEntries(clockFormat.formatToParts(now).map(p => [p.type, p.value]));
  $('#clock-hours').textContent = parts.hour;
  $('#clock-minutes').textContent = parts.minute;
  $('#clock-seconds').textContent = parts.second;
  $('#sri-time').dateTime = now.toISOString();
  if (!document.hidden) clockTimer = setTimeout(tickClock, 1000 - Date.now() % 1000);
}
document.addEventListener('visibilitychange', () => document.hidden || !$('#sri-time') ? clearTimeout(clockTimer) : tickClock());
if ($('#sri-time')) tickClock();
// A page open counts once; navigation within the calendar never adds a visit.
async function recordVisit() {
  try {
    const response = await fetch('/api/visits', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
    const { total, since } = await response.json();
    if (!Number.isSafeInteger(total) || total < 0) return;
    $('#visit-total').textContent = new Intl.NumberFormat('en-GB').format(total);
    $('#visit-counter').title = `Page visits since ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(since + 'T00:00:00Z'))}. Includes repeat visits.`;
    $('#visit-counter').hidden = false;
  } catch { /* The calendar and clock remain available if the counter is offline. */ }
}
recordVisit();

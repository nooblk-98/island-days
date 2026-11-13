// Layout audit: open the site (npm run build && npm run dev), paste this file into the browser console,
// then run __audit("label") on any page state. Reports sideways scrolling, overflow, clipped text,
// overlapping controls, labels crossed by break bands, misaligned bands and small tap targets on phones.
// Layout audit for one page state. Returns a list of problems (strings).
window.__audit = function audit(label) {
  const issues = [];
  const vw = document.documentElement.clientWidth;
  const name = el => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    const c = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${c}${t ? ` "${t}"` : ''}`;
  };
  const shown = el => {
    if (el.closest('[hidden]') || (el.closest('dialog') && !el.closest('dialog').open)) return false;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05;
  };
  const inDialog = !!document.querySelector('dialog[open]');
  const scope = inDialog ? document.querySelector('dialog[open]') : document.body;
  // 1. Sideways scrolling
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways by ${document.documentElement.scrollWidth - vw}px`);
  // 2. Elements sticking out of the viewport or of their card
  const cards = '.cal, .mini-month, .holiday-list, .year-summary, .next-card, dialog, .table-wrap, .maker-card, .break-item, .search, .feed, .embed-preview';
  for (const el of scope.querySelectorAll('*')) {
    if (!shown(el) || el.closest('svg') || el.matches('.sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      if (!el.parentElement || el.parentElement.getBoundingClientRect().right <= vw + 1) issues.push(`off screen (${Math.round(r.left)}..${Math.round(r.right)} of ${vw}): ${name(el)}`);
    }
    const card = el.parentElement && el.parentElement.closest(cards);
    if (card && !el.matches('.cal-day::before') && getComputedStyle(card).overflow === 'visible') {
      const c = card.getBoundingClientRect();
      if (r.right > c.right + 2 || r.left < c.left - 2) issues.push(`sticks out of ${name(card).split(' ')[0]} by ${Math.round(Math.max(r.right - c.right, c.left - r.left))}px: ${name(el)}`);
    }
  }
  // 3. Clipped text (cut off without an ellipsis or a deliberate line clamp)
  for (const el of scope.querySelectorAll('button, a, span, p, strong, small, h1, h2, h3, li, td, th, label, em, b')) {
    if (!shown(el) || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el);
    const clamped = s.webkitLineClamp && s.webkitLineClamp !== 'none';
    if (s.overflow !== 'visible' && !clamped && s.textOverflow !== 'ellipsis' && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)) issues.push(`text cut off: ${name(el)}`);
  }
  // 4. Overlapping controls, badges and labels (not nested in each other)
  const items = [...scope.querySelectorAll('button, a, select, input, .leave-badge, .cal-name, .tag, .class-tag, .filter, .break-metric, .legend > span, .dialog-tag, .next-pill, h1, h2, h3, .upcoming-title, .upcoming-meta')].filter(shown);
  // Only the visible part counts: clip each box by any scrolling/hidden-overflow ancestor.
  const visibleRect = el => {
    let r = el.getBoundingClientRect(); let { left, right, top, bottom } = r;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflow === 'visible') continue;
      const c = p.getBoundingClientRect();
      left = Math.max(left, c.left); right = Math.min(right, c.right); top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom);
    }
    return { left, right, top, bottom };
  };
  const rects = items.map(visibleRect);
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.contains(b) || b.contains(a)) continue;
    const x = Math.min(rects[i].right, rects[j].right) - Math.max(rects[i].left, rects[j].left);
    const y = Math.min(rects[i].bottom, rects[j].bottom) - Math.max(rects[i].top, rects[j].top);
    if (x > 2 && y > 2) issues.push(`overlap ${Math.round(x)}x${Math.round(y)}px: ${name(a)} <> ${name(b)}`);
  }
  // 5. Holiday names under days running into the next row's circles
  for (const label of scope.querySelectorAll('.cal-name')) {
    if (!shown(label)) continue;
    const r = label.getBoundingClientRect();
    for (const dot of scope.querySelectorAll('.cal-dot')) {
      const d = dot.getBoundingClientRect();
      if (dot.closest('.cal-day') === label.closest('.cal-day')) continue;
      if (Math.min(r.right, d.right) - Math.max(r.left, d.left) > 1 && Math.min(r.bottom, d.bottom) - Math.max(r.top, d.top) > 1) issues.push(`day label overlaps day ${dot.firstChild.textContent.trim()}: ${name(label)}`);
    }
  }
  // 6. Calendar bands: never two on one day; ends hug their circle
  for (const day of scope.querySelectorAll('.cal-day')) {
    if (day.matches('.lw.lp')) issues.push(`two bands on day ${day.textContent.trim().slice(0, 2)}`);
    for (const [cls, pseudo] of [['lw', '::before'], ['lp', '::after']]) {
      if (!day.classList.contains(cls)) continue;
      const dot = day.querySelector('.cal-dot').getBoundingClientRect(), cell = day.getBoundingClientRect(), s = getComputedStyle(day, pseudo);
      const left = cell.left + parseFloat(s.left), right = cell.right - parseFloat(s.right), top = cell.top + parseFloat(s.top), h = parseFloat(s.height);
      const startCap = day.classList.contains(`${cls}-start`) || day.classList.contains(`${cls}-wrap-in`);
      const endCap = day.classList.contains(`${cls}-end`) || day.classList.contains(`${cls}-wrap-out`);
      if (startCap && Math.abs(dot.left - left - 4) > 1.5) issues.push(`band start not hugging day ${day.querySelector('.cal-dot').firstChild.textContent.trim()} (${Math.round(dot.left - left)}px)`);
      if (endCap && Math.abs(right - dot.right - 4) > 1.5) issues.push(`band end not hugging day ${day.querySelector('.cal-dot').firstChild.textContent.trim()} (${Math.round(right - dot.right)}px)`);
      if (Math.abs(top + h / 2 - (dot.top + dot.height / 2)) > 1.5) issues.push(`band off-centre on day ${day.querySelector('.cal-dot').firstChild.textContent.trim()}`);
    }
  }
  // 6b. Holiday names must start below their band's outline
  for (const label of scope.querySelectorAll('.cal-day.lw .cal-name, .cal-day.lp .cal-name')) {
    if (!shown(label)) continue;
    const day = label.closest('.cal-day'), cell = day.getBoundingClientRect();
    const s = getComputedStyle(day, day.classList.contains('lp') ? '::after' : '::before');
    const bandBottom = cell.top + parseFloat(s.top) + parseFloat(s.height);
    if (label.getBoundingClientRect().top < bandBottom + 3) issues.push(`band outline crosses label: ${name(label)}`);
  }
  // 6c. Leave badges must not cover a holiday name
  for (const badge of scope.querySelectorAll('.leave-badge')) {
    const b = badge.getBoundingClientRect();
    for (const label of scope.querySelectorAll('.cal-name, .break-wrap')) {
      if (!shown(label)) continue;
      const r = label.getBoundingClientRect();
      if (Math.min(r.right, b.right) - Math.max(r.left, b.left) > 1 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 1) issues.push(`leave badge covers label: ${name(label)}`);
    }
  }
  // 7. Small tap targets on phones
  if (vw <= 600) for (const el of scope.querySelectorAll('button, a, select, input')) {
    if (!shown(el) || el.closest('.mini-month, .cal-name, p, li, td, .break-text, .dialog-body, .crumbs, .footer-years')) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 28 || r.width < 28) issues.push(`small tap target ${Math.round(r.width)}x${Math.round(r.height)}: ${name(el)}`);
  }
  return { label, count: issues.length, issues: [...new Set(issues)] };
};
'audit loaded';

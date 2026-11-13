import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateDataset } from './holidays.mjs';
import { createICS, holidayClass, colomboToday, addDays } from '../src/calendar.js';
const data = JSON.parse(await readFile(new URL('../public/data/holidays.json', import.meta.url), 'utf8'));
validateDataset(data);
const site = (process.env.SITE_URL || 'https://dayoff.itsnooblk.com').replace(/\/+$/, '');
const dist = new URL('../dist/', import.meta.url);
await mkdir(dist, { recursive: true });
await cp(new URL('../public/', import.meta.url), dist, { recursive: true });
for (const file of ['app.js', 'styles.css', 'calendar.js']) {
  await cp(new URL(`../src/${file}`, import.meta.url), new URL(file, dist));
}
await cp(new URL('../docs/preview.jpg', import.meta.url), new URL('og.jpg', dist));

// Subscribable calendar feeds: calendar apps re-fetch these, so every deploy reaches subscribers.
const feeds = [
  { file: 'holidays.ics', holidays: data.holidays, name: 'Sri Lanka Public Holidays', description: 'Sri Lanka public, bank and Poya holidays from Island Days.' },
  { file: 'holidays-mercantile.ics', holidays: data.holidays.filter(h => holidayClass(h.name).mercantile), name: 'Sri Lanka Mercantile Holidays', description: 'Sri Lanka mercantile (private-sector) holidays from Island Days.' }
];
for (const feed of feeds) await writeFile(new URL(feed.file, dist), createICS(feed.holidays, data.fetchedAt, data.years, { ...feed, feed: true }));

const lastmod = data.fetchedAt.slice(0, 10);
await writeFile(new URL('robots.txt', dist), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(new URL('sitemap.xml', dist), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}/</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq></url>\n</urlset>\n`);

// Structured data for search engines: the site plus the coming year of holidays.
const today = colomboToday();
const horizon = addDays(today, 366);
const jsonLd = [
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Island Days', url: `${site}/`, description: 'Sri Lanka public holidays, Poya days and long weekends.' },
  { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Upcoming Sri Lanka public holidays', itemListElement: data.holidays.filter(h => h.date >= today && h.date < horizon).map((h, index) => ({
    '@type': 'ListItem', position: index + 1,
    item: { '@type': 'Event', name: h.name, startDate: h.date, endDate: h.date, eventStatus: 'https://schema.org/EventScheduled', location: { '@type': 'Country', name: 'Sri Lanka' }, url: h.sourceUrl }
  })) }
];
const ld = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
const html = (await readFile(new URL('../src/index.html', import.meta.url), 'utf8'))
  .replaceAll('__SITE__', site)
  .replace('</head>', `  <script type="application/ld+json">${ld}</script>\n</head>`);
await writeFile(new URL('index.html', dist), html);
await writeFile(new URL('404.html', dist), html);
console.log(`Built Island Days with ${data.holidays.length} holidays across ${Object.keys(data.years).join(', ')} for ${site}.`);

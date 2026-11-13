import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateDataset } from './holidays.mjs';
import { createICS, holidayClass, formatDate, longWeekends } from '../src/calendar.js';
const data = JSON.parse(await readFile(new URL('../public/data/holidays.json', import.meta.url), 'utf8'));
validateDataset(data);
const site = (process.env.SITE_URL || 'https://dayoff.itsnooblk.com').replace(/\/+$/, '');
const dist = new URL('../dist/', import.meta.url);
await mkdir(dist, { recursive: true });
await cp(new URL('../public/', import.meta.url), dist, { recursive: true });
for (const file of ['app.js', 'styles.css', 'calendar.js', 'theme.js']) {
  await cp(new URL(`../src/${file}`, import.meta.url), new URL(file, dist));
}

// Subscribable calendar feeds: calendar apps re-fetch these, so every deploy reaches subscribers.
const feeds = [
  { file: 'holidays.ics', holidays: data.holidays, name: 'Sri Lanka Public Holidays', description: 'Sri Lanka public, bank and Poya holidays from Island Days.' },
  { file: 'holidays-mercantile.ics', holidays: data.holidays.filter(h => holidayClass(h).mercantile), name: 'Sri Lanka Mercantile Holidays', description: 'Sri Lanka mercantile (private-sector) holidays from Island Days.' }
];
for (const feed of feeds) await writeFile(new URL(feed.file, dist), createICS(feed.holidays, data.fetchedAt, data.years, { ...feed, feed: true }));

const lastmod = data.fetchedAt.slice(0, 10);
const years = Object.keys(data.years).sort();
const yearPath = year => `/sri-lanka-holidays-${year}/`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ldScript = items => `  <script type="application/ld+json">${JSON.stringify(items).replace(/</g, '\\u003c')}</script>\n</head>`;

// Search engine verification tokens are public by design: set them as build variables or put them in the defaults here.
const verify = [
  ['google-site-verification', process.env.GOOGLE_SITE_VERIFICATION || ''],
  ['msvalidate.01', process.env.BING_SITE_VERIFICATION || '']
].filter(([, token]) => token).map(([name, token]) => `\n  <meta name="${name}" content="${esc(token)}">`).join('');

const yearSpan = years.length > 1 ? `${years[0]} and ${years.at(-1)}` : years[0];
const title = `Island Days: Sri Lanka Holidays ${yearSpan}`;
const description = `Sri Lanka public holidays ${yearSpan} from the official gazette: Poya days, bank and mercantile holidays, long weekends and leave ideas. Free calendar you can subscribe to.`;
const author = { '@type': 'Person', name: 'Lahiru Sandaruwan', url: 'https://github.com/nooblk-98' };

// Structured data: the site, the app, and the holiday list as a dataset. Holidays are not events, so no Event markup.
const jsonLd = [
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Island Days', alternateName: 'Sri Lanka Holiday Calendar', url: `${site}/`, inLanguage: 'en', description },
  { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Island Days', url: `${site}/`, applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'LKR' }, description, author },
  { '@context': 'https://schema.org', '@type': 'Dataset', name: `Sri Lanka public holidays ${yearSpan}`, description: 'Gazetted Sri Lanka public holidays with Poya days and bank and mercantile status, taken from the Central Bank of Sri Lanka holiday list and refreshed monthly.', url: `${site}/`, isAccessibleForFree: true, spatialCoverage: { '@type': 'Place', name: 'Sri Lanka' }, temporalCoverage: `${years[0]}-01-01/${years.at(-1)}-12-31`, dateModified: lastmod, creator: author, isBasedOn: years.map(y => data.years[y].sourceUrl), keywords: ['Sri Lanka public holidays', 'Poya days', 'mercantile holidays', 'bank holidays', 'long weekends'], distribution: [
    { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${site}/data/holidays.json` },
    { '@type': 'DataDownload', encodingFormat: 'text/calendar', contentUrl: `${site}/holidays.ics` }
  ] }
];
const yearLinks = years.map(y => `<a href="${yearPath(y)}">Sri Lanka holidays ${y}</a>`).join('');
const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const page = template.replaceAll('__SITE__', site).replaceAll('__TITLE__', esc(title)).replaceAll('__DESCRIPTION__', esc(description)).replace('__VERIFY__', verify).replace('__YEAR_LINKS__', yearLinks);
await writeFile(new URL('index.html', dist), page.replace('</head>', ldScript(jsonLd)));
// The not-found page reuses the app but must never be indexed.
await writeFile(new URL('404.html', dist), page.replace('content="index, follow, max-image-preview:large"', 'content="noindex"').replace(/\n  <link rel="canonical"[^>]*>/, ''));

// One static, crawlable page per year: a full table that search engines can read without JavaScript.
for (const year of years) {
  const list = data.holidays.filter(h => h.date.startsWith(`${year}-`));
  const poya = list.filter(h => h.type === 'poya').length;
  const mercantile = list.filter(h => holidayClass(h).mercantile).length;
  const breaks = longWeekends(data.holidays, Number(year));
  const url = `${site}${yearPath(year)}`;
  const pageTitle = `Sri Lanka Public Holidays ${year}: Poya Days and Long Weekends`;
  const pageDescription = `All ${list.length} Sri Lanka public holidays in ${year} from the official gazette, including ${poya} Poya days, ${mercantile} mercantile holidays and ${breaks.length} long weekends.`;
  const rows = list.map(h => {
    const kind = holidayClass(h);
    const tags = `<span class="tag ${h.type}">${h.type === 'poya' ? 'Poya day' : 'Public'}</span>${kind.mercantile ? '<span class="tag mercantile">Mercantile</span>' : ''}`;
    return `        <tr><td><time datetime="${h.date}">${formatDate(h.date, { day: 'numeric', month: 'long' })}</time></td><td>${formatDate(h.date, { weekday: 'long' })}</td><td>${esc(h.name)}</td><td>${tags}</td></tr>`;
  }).join('\n');
  const weekendRows = breaks.map(w => `      <li><strong>${w.days} days</strong> ${formatDate(w.start, { weekday: 'long', day: 'numeric', month: 'long' })} to ${formatDate(w.end, { weekday: 'long', day: 'numeric', month: 'long' })}</li>`).join('\n');
  const others = years.filter(y => y !== year).map(y => `<a href="${yearPath(y)}">Sri Lanka holidays ${y}</a>`).join(' · ');
  const yearLd = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: pageTitle, url, description: pageDescription, inLanguage: 'en', dateModified: lastmod, author, isPartOf: { '@type': 'WebSite', name: 'Island Days', url: `${site}/` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Island Days', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name: `Sri Lanka holidays ${year}`, item: url }
    ] }
  ];
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#254e3b">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(pageDescription)}">
  <meta name="robots" content="index, follow, max-image-preview:large">${verify}
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Island Days">
  <meta property="og:locale" content="en_LK">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(pageDescription)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${site}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script src="/theme.js"></script>
  <link rel="stylesheet" href="/styles.css">
${ldScript(yearLd)}
<body class="year-page">
  <header class="site-header"><a class="brand" href="/" aria-label="Island Days home"><span class="brand-icon" aria-hidden="true">✳</span><span>island<span class="brand-light">days</span><span class="brand-dot">.</span></span></a><a class="year-page-cta" href="/?view=list&amp;y=${year}"><span class="cta-long">Open the interactive calendar</span><span class="cta-short">Calendar</span> ↗</a></header>
  <main class="year-main">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Island Days</a> › <span>Sri Lanka holidays ${year}</span></nav>
    <h1>Sri Lanka Public Holidays ${year}</h1>
    <p class="year-lead">Sri Lanka has <strong>${list.length} public holidays in ${year}</strong>, including ${poya} full moon Poya days. ${mercantile} of them are also mercantile holidays, when most private-sector offices close. Dates follow the government gazette published under the Holidays Act No. 29 of 1971, as listed by the <a href="${esc(data.years[year].sourceUrl)}" rel="noopener">Central Bank of Sri Lanka</a>.</p>
    <div class="table-wrap"><table class="holiday-table">
      <caption>Public holidays in Sri Lanka, ${year}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Day</th><th scope="col">Holiday</th><th scope="col">Type</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table></div>
    <h2>Long weekends in ${year}</h2>
    <p>Breaks of three days or more where a holiday joins a Saturday and Sunday, with no leave needed.</p>
    <ul class="break-list">
${weekendRows || '      <li>No long weekends this year.</li>'}
    </ul>
    <h2>Public, bank and mercantile holidays</h2>
    <p>Every holiday on this list is a <strong>public holiday</strong> and a <strong>bank holiday</strong>. Only those marked <strong>mercantile</strong> are also holidays for most private-sector (mercantile) offices. Poya days are public holidays on each full moon.</p>
    <p class="year-actions"><a class="dialog-action" href="/?view=list&amp;y=${year}">Plan leave in the calendar</a> <a class="dialog-action ghost" href="/holidays.ics">Subscribe (.ics)</a></p>
    ${others ? `<p class="other-years">Also see: ${others}</p>` : ''}
    <p class="small-note">Last checked ${formatDate(lastmod, { day: 'numeric', month: 'long', year: 'numeric' })}. The government can declare or move holidays after the gazette, so please verify before booking.</p>
  </main>
  <footer class="site-footer"><div class="footer-bottom"><span>Island Days by <a href="https://github.com/nooblk-98" rel="noopener">Lahiru Sandaruwan</a></span><a href="/">Back to the calendar</a></div></footer>
</body>
</html>
`;
  await mkdir(new URL(`sri-lanka-holidays-${year}/`, dist), { recursive: true });
  await writeFile(new URL(`sri-lanka-holidays-${year}/index.html`, dist), html);
}

await writeFile(new URL('robots.txt', dist), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
const urls = [{ loc: `${site}/`, priority: '1.0' }, ...years.map(y => ({ loc: `${site}${yearPath(y)}`, priority: '0.8' }))];
await writeFile(new URL('sitemap.xml', dist), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`);
console.log(`Built Island Days with ${data.holidays.length} holidays across ${years.join(', ')} for ${site}, plus ${years.length} yearly pages.`);

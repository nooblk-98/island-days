import { readFile, writeFile, rename } from 'node:fs/promises';
import { CBSL, parseCBSL, buildDataset, mergeDatasets } from './holidays.mjs';
const destination = new URL('../public/data/holidays.json', import.meta.url);
let previous;
try { previous = JSON.parse(await readFile(destination, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

// Returns the page HTML, or null when the bank has not published that year yet (HTTP 404).
async function fetchYear(year) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(CBSL(year), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IslandDays/1.0; Sri Lanka holiday calendar)', 'Accept': 'text/html' }, signal: AbortSignal.timeout(30000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Central Bank returned HTTP ${response.status} for ${year}`);
      if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Central Bank did not return HTML');
      return await response.text();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
}

const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date()));
const lists = {};
// The current year must exist; later years are added as soon as they are gazetted.
for (let year = currentYear; year <= currentYear + 2; year++) {
  const html = await fetchYear(year);
  if (!html) {
    if (year === currentYear) throw new Error(`The Central Bank list for ${year} is not available; keeping previous data.`);
    console.log(`The Central Bank has not published ${year} yet.`);
    break;
  }
  lists[year] = parseCBSL(html, year);
}
const merged = mergeDatasets(previous, buildDataset(lists), currentYear);
await writeFile(new URL('holidays.json.tmp', destination), `${JSON.stringify(merged, null, 2)}\n`);
await rename(new URL('holidays.json.tmp', destination), destination);
console.log(`Updated ${merged.holidays.length} holidays for ${Object.keys(merged.years).join(', ')} from the Central Bank of Sri Lanka.`);

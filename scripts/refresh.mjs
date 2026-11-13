import { readFile, writeFile, rename } from 'node:fs/promises';
import { parseSource, mergeDatasets, SOURCE, CBSL, parseCBSL, applyCBSL, carryFlags } from './holidays.mjs';
const destination = new URL('../public/data/holidays.json', import.meta.url);
let previous;
try { previous = JSON.parse(await readFile(destination, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let response;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    response = await fetch(SOURCE, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IslandDays/1.0; Sri Lanka holiday calendar)', 'Accept': 'text/html' }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Source did not return HTML');
    break;
  } catch (error) {
    if (attempt === 2) throw error;
    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
  }
}
const fresh = parseSource(await response.text());
const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date()));
let merged = carryFlags(previous, mergeDatasets(previous, fresh, currentYear));
// The Central Bank list is optional: if it is down or not yet published, keep last month's flags.
const lists = {};
for (const year of Object.keys(merged.years).map(Number).filter(y => y >= currentYear)) {
  try {
    const page = await fetch(CBSL(year), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IslandDays/1.0; Sri Lanka holiday calendar)', 'Accept': 'text/html' }, signal: AbortSignal.timeout(30000) });
    if (page.status === 404) { console.log(`Central Bank list for ${year} is not published yet.`); continue; }
    if (!page.ok) throw new Error(`HTTP ${page.status}`);
    lists[year] = parseCBSL(await page.text(), year);
  } catch (error) {
    console.log(`::warning::Central Bank list for ${year} unavailable (${error.message}); keeping previous bank/mercantile flags.`);
  }
}
const checked = applyCBSL(merged, lists);
merged = checked.data;
for (const warning of checked.warnings) console.log(`::warning::Sources disagree: ${warning}`);
await writeFile(new URL('holidays.json.tmp', destination), `${JSON.stringify(merged, null, 2)}\n`);
await rename(new URL('holidays.json.tmp', destination), destination);
console.log(`Updated ${merged.holidays.length} holidays for ${Object.keys(merged.years).join(', ')} from ${SOURCE}`);

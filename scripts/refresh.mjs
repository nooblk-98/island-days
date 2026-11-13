import { readFile, writeFile, rename } from 'node:fs/promises';
import { parseSource, mergeDatasets, SOURCE } from './holidays.mjs';
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
const merged = mergeDatasets(previous, fresh, currentYear);
await writeFile(new URL('holidays.json.tmp', destination), `${JSON.stringify(merged, null, 2)}\n`);
await rename(new URL('holidays.json.tmp', destination), destination);
console.log(`Updated ${merged.holidays.length} holidays for ${Object.keys(merged.years).join(', ')} from ${SOURCE}`);

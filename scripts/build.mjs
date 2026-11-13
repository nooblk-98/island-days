import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateDataset } from './holidays.mjs';
const data = JSON.parse(await readFile(new URL('../public/data/holidays.json', import.meta.url), 'utf8'));
validateDataset(data);
const dist = new URL('../dist/', import.meta.url);
await mkdir(dist, { recursive: true });
await cp(new URL('../public/', import.meta.url), dist, { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'calendar.js']) {
  await cp(new URL(`../src/${file}`, import.meta.url), new URL(file, dist));
}
await writeFile(new URL('404.html', dist), await readFile(new URL('index.html', dist)));
console.log(`Built Island Days with ${data.holidays.length} holidays across ${Object.keys(data.years).join(', ')}.`);

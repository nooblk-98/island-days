// Prints "true" when the holiday data differs from the committed version, ignoring the fetchedAt timestamp.
// Used by the workflow so a monthly check that finds nothing new does not create a commit.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const path = 'public/data/holidays.json';
const strip = ({ fetchedAt, ...rest }) => JSON.stringify(rest);
const current = JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
let committed = null;
try { committed = JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' })); } catch {}
console.log(!committed || strip(committed) !== strip(current) ? 'true' : 'false');

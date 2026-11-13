// Renders scripts/og.html to public/og.png (1200x630) with a locally installed Edge or Chrome.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const browsers = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'
].filter(Boolean);
const browser = browsers.find(path => existsSync(path));
if (!browser) throw new Error('No Chrome or Edge found. Set BROWSER to its executable path.');
const output = fileURLToPath(new URL('../public/og.png', import.meta.url));
const source = pathToFileURL(fileURLToPath(new URL('og.html', import.meta.url))).href;
execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', `--screenshot=${output}`, source], { stdio: 'inherit' });
console.log(`Wrote ${output}`);

// Renders the static images with a locally installed Edge or Chrome:
//   npm run og      scripts/og.html     -> public/og.png    (1200x630 link preview)
//   npm run banner  scripts/banner.html -> docs/preview.png (README banner; needs `npm run dev` running)
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const targets = {
  og: { source: 'og.html', output: '../public/og.png', size: '1200,630', extra: [] },
  banner: { source: 'banner.html', output: '../docs/preview.png', size: '1480,1000', extra: ['--default-background-color=00000000', '--virtual-time-budget=6000'] }
};
const target = targets[process.argv[2] || 'og'];
if (!target) throw new Error(`Unknown image: ${process.argv[2]}. Use one of: ${Object.keys(targets).join(', ')}`);
const browsers = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'
].filter(Boolean);
const browser = browsers.find(path => existsSync(path));
if (!browser) throw new Error('No Chrome or Edge found. Set BROWSER to its executable path.');
const output = fileURLToPath(new URL(target.output, import.meta.url));
const source = pathToFileURL(fileURLToPath(new URL(target.source, import.meta.url))).href;
execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${target.size}`, ...target.extra, `--screenshot=${output}`, source], { stdio: 'inherit' });
console.log(`Wrote ${output}`);

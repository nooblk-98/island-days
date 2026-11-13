// Renders the static images with a locally installed Edge or Chrome:
//   npm run og      scripts/og.html     -> public/og.png    (1200x630 link preview)
//   npm run banner  scripts/banner.html -> docs/preview.png (README banner; needs `npm run dev` running)
// The browser is driven over the DevTools protocol so the page can load its data and settle for a few
// real seconds before the screenshot (the live clock would otherwise use up a simulated time budget).
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const targets = {
  og: { source: 'og.html', output: '../public/og.png', width: 1200, height: 630, wait: 500, transparent: false },
  banner: { source: 'banner.html', output: '../docs/preview.png', width: 1480, height: 1400, wait: 4000, transparent: true }
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
const browserPath = browsers.find(path => existsSync(path));
if (!browserPath) throw new Error('No Chrome or Edge found. Set BROWSER to its executable path.');
const output = fileURLToPath(new URL(target.output, import.meta.url));
const source = pathToFileURL(fileURLToPath(new URL(target.source, import.meta.url))).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'island-days-shot-'));
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${target.width},${target.height}`, 'about:blank'], { stdio: 'ignore' });
try {
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    await sleep(200);
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
  }
  if (!page) throw new Error('Could not connect to the headless browser.');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0; const pending = new Map(); const events = [];
  socket.onmessage = ({ data }) => { const msg = JSON.parse(data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else if (msg.method) events.push(msg.method); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, msg => msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)); socket.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: target.width, height: target.height, deviceScaleFactor: 1, mobile: false });
  if (target.transparent) await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send('Page.navigate', { url: source });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  await sleep(target.wait);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(output, Buffer.from(data, 'base64'));
  socket.close();
  console.log(`Wrote ${output}`);
} finally {
  browser.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

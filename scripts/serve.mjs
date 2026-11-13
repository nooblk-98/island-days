import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/visits.js';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
// Keep preview visits in a separate local database, never in the production total.
await mkdir('.wrangler', { recursive: true });
const visits = new DatabaseSync('.wrangler/preview-visits.sqlite');
visits.exec(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
const VISITS_DB = { prepare: sql => ({ first: async () => visits.prepare(sql).get() }) };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ics': 'text/calendar', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg' };
http.createServer(async (req, res) => {
  if (new URL(req.url, 'http://localhost').pathname === '/api/visits') {
    const response = await onRequest({ request: new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers }), env: { VISITS_DB } });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
    return;
  }
  const path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    // Like Cloudflare Pages: a folder serves its index.html.
    const file = path === root || req.url.split('?')[0].endsWith('/') ? resolve(path, 'index.html') : path;
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': `${mime[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));

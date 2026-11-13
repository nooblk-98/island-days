const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer'
};
const json = (data, status = 200) => Response.json(data, { status, headers });

export async function onRequest({ request, env }) {
  if (!['GET', 'POST'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
  const origin = request.headers.get('Origin');
  if (request.method === 'POST' && (origin !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site')) return json({ error: 'Forbidden' }, 403);
  if (!env.VISITS_DB) return json({ error: 'Counter unavailable' }, 503);
  try {
    // One atomic increment avoids losing visits when several people open the page together.
    // Only a number and start date are stored: no IP addresses, cookies or visitor identifiers.
    const query = request.method === 'POST'
      ? 'UPDATE visit_counter SET total = total + 1 WHERE id = 1 RETURNING total, since'
      : 'SELECT total, since FROM visit_counter WHERE id = 1';
    const result = await env.VISITS_DB.prepare(query).first();
    if (!result || !Number.isSafeInteger(result.total)) return json({ error: 'Counter unavailable' }, 503);
    return json(result);
  } catch { return json({ error: 'Counter unavailable' }, 503); }
}

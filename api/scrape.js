import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MAX_BODY_BYTES = 512 * 1024; // 512 KB
// Blocks loopback, private ranges, and IMDS
const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc00:|fe80:)/;

function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return 'Invalid URL'; }
  if (u.protocol !== 'https:') return 'Only HTTPS URLs are supported';
  if (PRIVATE_IP.test(u.hostname)) return 'Disallowed host';
  return null;
}

export default async function handler(req, res) {
  // Require a valid Supabase session
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return res.status(401).json({ error: 'Unauthorised' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  const urlError = validateUrl(url);
  if (urlError) return res.status(400).json({ error: urlError });

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FutureSignals/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch: ${response.status}` });
    }

    // Stream with a size cap — prevents memory exhaustion on large/slow responses
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BODY_BYTES) { reader.cancel(); break; }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');

    const titleMatch    = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch  = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const title         = ogTitleMatch?.[1] || titleMatch?.[1] || '';

    const ogDescMatch   = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description   = ogDescMatch?.[1] || metaDescMatch?.[1] || '';

    return res.status(200).json({ title: title.trim(), description: description.trim() });

  } catch (error) {
    console.error('[scrape] error:', error);
    return res.status(400).json({ error: 'Could not fetch URL' });
  }
}

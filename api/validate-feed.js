import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MAX_BODY_BYTES = 512 * 1024; // 512 KB — same cap as api/scrape.js
const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc00:|fe80:)/;

function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return 'Invalid URL'; }
  if (u.protocol !== 'https:') return 'Only HTTPS URLs are supported';
  if (PRIVATE_IP.test(u.hostname)) return 'Disallowed host';
  return null;
}

const parser = new Parser();

export default async function handler(req, res) {
  // Require a valid Supabase session (same pattern as api/scrape.js)
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
    // Fetch manually so we can cap the response size
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FutureSignals/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch: ${response.status}` });
    }

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
    const xml = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');

    // parseString throws if content is not valid RSS/Atom
    const feed = await parser.parseString(xml);

    const feedTitle = (feed.title || '').trim();
    const items = (feed.items || [])
      .slice(0, 3)
      .map((item) => (item.title || '').trim())
      .filter(Boolean);

    return res.status(200).json({ feedTitle, items });

  } catch (error) {
    console.error('[validate-feed] error:', error.message);
    return res.status(400).json({ error: 'Not a valid RSS or Atom feed' });
  }
}

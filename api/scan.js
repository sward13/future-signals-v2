import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

export const config = {
  maxDuration: 60,
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const parser = new Parser({ timeout: 10000 });

const MAX_CANDIDATES_PER_SOURCE = 20;
const SOURCE_CONCURRENCY = 10;     // parallel RSS fetches at a time

// ── Per-source fetch + dedup + insert ──────────────────────────────────────────
// Index note: candidates.url has a unique constraint (see 23505 handling below),
// which implicitly creates a B-tree index — no separate CREATE INDEX needed.

async function processSource(source, results) {
  try {
    const feed = await parser.parseURL(source.url);
    results.sources_processed++;

    const items = feed.items
      .slice(0, MAX_CANDIDATES_PER_SOURCE)
      .filter((item) => item.link && item.title && typeof item.title !== 'object');

    if (items.length === 0) return;

    // Batch dedup: one query for all URLs in this feed (replaces N individual queries)
    const urls = items.map((item) => item.link);
    const { data: existing } = await supabase
      .from('candidates')
      .select('url')
      .in('url', urls);

    const existingUrls = new Set((existing || []).map((r) => r.url));
    const newItems = items.filter((item) => !existingUrls.has(item.link));

    if (newItems.length > 0) {
      results.candidates_fetched += newItems.length;

      // Bulk insert all new candidates in a single query (replaces N individual inserts)
      const { error: insertError } = await supabase
        .from('candidates')
        .insert(
          newItems.map((item) => ({
            source_id: source.id,
            title: item.title.trim(),
            url: item.link,
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
            summary_raw: item.contentSnippet || item.summary || null,
            status: 'pending',
          }))
        );

      if (insertError && insertError.code !== '23505') {
        // 23505 = unique violation (race condition between parallel sources) — safe to ignore
        results.errors.push(`Insert error for source ${source.name}: ${insertError.message}`);
      }
    }

    // Update last_fetched_at
    await supabase
      .from('sources')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', source.id);

  } catch (sourceError) {
    results.errors.push(`Source ${source.name}: ${sourceError.message}`);
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorised triggers
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const results = {
    sources_processed: 0,
    candidates_fetched: 0,
    errors: [],
  };

  try {
    // Step 1: Fetch all active sources
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*')
      .eq('active', true);

    if (sourcesError) throw sourcesError;

    // Step 2: Fetch + dedup all sources concurrently
    await Promise.allSettled((sources || []).map((source) => processSource(source, results)));

    // Trigger classify + embed in a separate function — fire and forget so scan
    // doesn't share its timeout budget with the AI classification phase
    fetch(`${process.env.APP_URL}/api/classify`, {
      method: 'GET',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
    }).catch((e) => {
      // Non-fatal — classify will pick up pending candidates on next run
      console.error('Classify trigger failed:', e.message);
    });

    return res.status(200).json({ success: true, results });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, results });
  }
}

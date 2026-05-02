import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Parser from 'rss-parser';

export const config = {
  maxDuration: 60,
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const parser = new Parser({ timeout: 10000 });

const MAX_CANDIDATES_PER_SOURCE = 20;
const SOURCE_CONCURRENCY = 10;     // parallel RSS fetches at a time

// ── Change 3: URL-pattern rejection (synchronous, no API call) ────────────────
// Catches the most obvious commercial content before spending tokens on relevance.
const COMMERCIAL_PATH_PATTERNS = [
  '/deals', '/coupons', '/promo', '/discount',
  '/gift-guide', '/reviews/best', '/shopping',
  '/sponsored', '/affiliate',
];

function isCommercialUrl(url) {
  return COMMERCIAL_PATH_PATTERNS.some((pattern) => url.includes(pattern));
}

// ── Change 1: LLM relevance gate ──────────────────────────────────────────────
// Returns true (insert) on "1" or on any failure — fail open so a flaky API
// call never blocks ingestion. Returns false only on a confident "0".
const RELEVANCE_SYSTEM_PROMPT =
  'You are a filter for a strategic foresight platform. Return 1 if this item is relevant ' +
  'to strategic foresight — evidence of structural change in society, technology, economics, ' +
  'policy, environment, or culture that a professional analyst would track. Return 0 if it is ' +
  'commercial content (deals, discounts, promo codes, product roundups, gift guides, sponsored ' +
  'content, advertisements, or product reviews). Return only 1 or 0. No other output.';

async function checkRelevance(title, summaryRaw, sourceName) {
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1,
      messages: [
        { role: 'system', content: RELEVANCE_SYSTEM_PROMPT },
        { role: 'user',   content: `${title}\n\n${summaryRaw || ''}`.trim() },
      ],
    });
    const answer = resp.choices[0]?.message?.content?.trim();
    if (answer === '0') {
      console.debug(`[scan] rejected: ${title} (${sourceName})`);
      return false;
    }
    return true;
  } catch (err) {
    // Fail open — a flaky relevance check never blocks ingestion
    console.error(`[scan] relevance check failed for "${title}":`, err.message);
    return true;
  }
}

// ── Per-source fetch + dedup + filter + insert ─────────────────────────────────
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
      // Change 3: URL pattern filter — synchronous, no API cost
      const urlFiltered = newItems.filter((item) => {
        if (isCommercialUrl(item.link)) {
          console.debug(`[scan] url-filtered: ${item.title.trim()} (${item.link})`);
          return false;
        }
        return true;
      });

      if (urlFiltered.length === 0) return;

      // Change 1: Batch relevance checks in parallel before insert.
      // Failures default to true (insert) so the gate never blocks on flaky API calls.
      const relevanceResults = await Promise.allSettled(
        urlFiltered.map((item) =>
          checkRelevance(
            item.title.trim(),
            item.contentSnippet || item.summary || null,
            source.name,
          )
        )
      );

      const relevantItems = urlFiltered.filter((_, i) => {
        const r = relevanceResults[i];
        return r.status === 'rejected' || r.value === true;
      });

      if (relevantItems.length === 0) return;

      // Only count items that pass all filters and will be inserted
      results.candidates_fetched += relevantItems.length;

      // Bulk insert relevant candidates in a single query
      const { error: insertError } = await supabase
        .from('candidates')
        .insert(
          relevantItems.map((item) => ({
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

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Parser from 'rss-parser';

export const config = {
  maxDuration: 60,
};

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const parser = new Parser({ timeout: 10000 });

const STEEPLED = [
  'Social', 'Technological', 'Economic', 'Environmental',
  'Political', 'Legal', 'Ethical', 'Demographic'
];

const BATCH_SIZE = 200;            // candidates to classify/embed per run
const MAX_CANDIDATES_PER_SOURCE = 20;
const SOURCE_CONCURRENCY = 10;     // parallel RSS fetches at a time
const CLASSIFY_CONCURRENCY = 25;   // parallel classify calls at a time

const SYSTEM_PROMPT = `You are a strategic foresight analyst. Given a news item, return JSON only with two fields:
- "steepled": array of applicable categories from [${STEEPLED.join(', ')}] (1-3 categories)
- "summary": 2-3 sentence summary focusing on future implications

Return only valid JSON, no markdown.`;

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
    candidates_deduped: 0,
    candidates_classified: 0,
    candidates_embedded: 0,
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

    // Step 3: Classify + embed pending candidates in parallel
    const { data: pending } = await supabase
      .from('candidates')
      .select('*')
      .eq('status', 'pending')
      .limit(BATCH_SIZE);

    const candidates = pending || [];

    if (candidates.length > 0) {
      // Step 3a: Classify in parallel, CLASSIFY_CONCURRENCY at a time
      const classifyResults = [];
      for (let i = 0; i < candidates.length; i += CLASSIFY_CONCURRENCY) {
        const chunk = candidates.slice(i, i + CLASSIFY_CONCURRENCY);
        const chunkResults = await Promise.allSettled(
          chunk.map((candidate) =>
            openai.chat.completions.create({
              model: 'gpt-4o-mini',
              max_tokens: 300,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `${candidate.title}\n\n${candidate.summary_raw || ''}`.trim() },
              ],
            })
          )
        );
        classifyResults.push(...chunkResults);
      }

      // Step 3b: Parse classify results — split into classified vs failed
      const classified = [];
      const failedIds = [];

      candidates.forEach((candidate, i) => {
        const result = classifyResults[i];
        if (result.status === 'rejected') {
          results.errors.push(`Classify ${candidate.id}: ${result.reason?.message}`);
          failedIds.push(candidate.id);
          return;
        }
        let steepled = [];
        let summaryAi = null;
        try {
          const parsed = JSON.parse(result.value.choices[0].message.content);
          steepled = parsed.steepled || [];
          summaryAi = parsed.summary || null;
        } catch {
          // JSON parse failed — continue with empty steepled
        }
        classified.push({ ...candidate, steepled, summaryAi, classifyUsage: result.value.usage });
      });

      // Mark failed candidates as expired so they don't block the queue
      if (failedIds.length > 0) {
        await Promise.allSettled(
          failedIds.map((id) =>
            supabase.from('candidates').update({ status: 'expired' }).eq('id', id)
          )
        );
      }

      if (classified.length > 0) {
        // Step 3c: Batch embed all classified candidates in a single API call
        const embeddingTexts = classified.map((c) =>
          `${c.title}\n${c.summaryAi || c.summary_raw || ''}`.trim()
        );

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingTexts,
        });

        // Step 3d: Write results back to DB in parallel
        await Promise.allSettled(
          classified.map((candidate, i) =>
            supabase
              .from('candidates')
              .update({
                summary_ai: candidate.summaryAi,
                steepled: candidate.steepled,
                embedding: embeddingResponse.data[i].embedding,
                status: 'scored',
              })
              .eq('id', candidate.id)
          )
        );

        // Single aggregate usage log entry for the batch
        const totalInputTokens  = classified.reduce((s, c) => s + (c.classifyUsage?.prompt_tokens     || 0), 0);
        const totalOutputTokens = classified.reduce((s, c) => s + (c.classifyUsage?.completion_tokens || 0), 0);

        await supabase.from('ai_usage_log').insert({
          workspace_id: null,
          model: 'gpt-4o-mini + text-embedding-3-small',
          operation: 'scan_classify_embed',
          input_tokens:  totalInputTokens  || null,
          output_tokens: totalOutputTokens || null,
        });

        results.candidates_classified = classified.length;
        results.candidates_embedded   = classified.length;
      }
    }

    results.candidates_deduped = results.candidates_fetched - candidates.length;

    // Trigger scoring after ingestion — fire and forget so scan doesn't
    // share its timeout budget with the score run
    fetch(`${process.env.VITE_APP_URL}/api/score`, {
      method: 'GET',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
    }).catch((e) => {
      // Non-fatal — scoring will catch up on next run
      console.error('Score trigger failed:', e.message);
    });

    return res.status(200).json({ success: true, results });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, results });
  }
}

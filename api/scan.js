import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Parser from 'rss-parser';

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

const BATCH_SIZE = 10; // candidates to classify/embed per run
const MAX_CANDIDATES_PER_SOURCE = 20;

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

    // Step 2: Fetch + dedup each source
    for (const source of sources) {
      try {
        const feed = await parser.parseURL(source.url);
        results.sources_processed++;

        const items = feed.items.slice(0, MAX_CANDIDATES_PER_SOURCE);

        for (const item of items) {
          const title = String(item.title || '').trim();
          if (!item.link || !title) continue;

          // URL-based dedup — skip if already ingested
          const { data: existing } = await supabase
            .from('candidates')
            .select('id')
            .eq('url', item.link)
            .single();

          if (existing) continue;

          results.candidates_fetched++;

          // Insert as pending — classify and embed in batch step below
          const { error: insertError } = await supabase
            .from('candidates')
            .insert({
              source_id: source.id,
              title,
              url: item.link,
              published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
              summary_raw: item.contentSnippet || item.summary || null,
              status: 'pending',
            });

          if (insertError && insertError.code !== '23505') {
            // 23505 = unique violation (race condition) — safe to ignore
            results.errors.push(`Insert error for ${item.link}: ${insertError.message}`);
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

    // Step 3: Classify + embed pending candidates in batches
    const { data: pending } = await supabase
      .from('candidates')
      .select('*')
      .eq('status', 'pending')
      .limit(BATCH_SIZE);

    for (const candidate of (pending || [])) {
      try {
        const textForAI = `${candidate.title}\n\n${candidate.summary_raw || ''}`.trim();

        // Classify: STEEPLED categories + AI summary
        const classification = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 300,
          messages: [{
            role: 'system',
            content: `You are a strategic foresight analyst. Given a news item, return JSON only with two fields:
- "steepled": array of applicable categories from [${STEEPLED.join(', ')}] (1-3 categories)
- "summary": 2-3 sentence summary focusing on future implications

Return only valid JSON, no markdown.`
          }, {
            role: 'user',
            content: textForAI,
          }]
        });

        let steepled = [];
        let summaryAi = null;

        try {
          const parsed = JSON.parse(classification.choices[0].message.content);
          steepled = parsed.steepled || [];
          summaryAi = parsed.summary || null;
        } catch {
          // JSON parse failed — leave steepled empty, continue
        }

        // Embed: title + summary for vector similarity
        const embeddingText = `${candidate.title}\n${summaryAi || candidate.summary_raw || ''}`.trim();
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingText,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Update candidate with classification + embedding
        await supabase
          .from('candidates')
          .update({
            summary_ai: summaryAi,
            steepled,
            embedding,
            status: 'scored',
          })
          .eq('id', candidate.id);

        // Log AI usage
        await supabase.from('ai_usage_log').insert({
          workspace_id: null, // platform-level operation
          model: 'gpt-4o-mini + text-embedding-3-small',
          operation: 'scan_classify_embed',
          input_tokens: classification.usage?.prompt_tokens || null,
          output_tokens: classification.usage?.completion_tokens || null,
        });

        results.candidates_classified++;
        results.candidates_embedded++;

      } catch (candidateError) {
        results.errors.push(`Candidate ${candidate.id}: ${candidateError.message}`);
        // Mark as expired so it doesn't block the queue
        await supabase
          .from('candidates')
          .update({ status: 'expired' })
          .eq('id', candidate.id);
      }
    }

    results.candidates_deduped = results.candidates_fetched - (pending?.length || 0);

    return res.status(200).json({ success: true, results });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, results });
  }
}

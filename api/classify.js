import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const config = {
  maxDuration: 60,
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STEEPLED = [
  'Social', 'Technological', 'Economic', 'Environmental',
  'Political', 'Legal', 'Ethical', 'Demographic'
];

const BATCH_SIZE = 100;           // reduced from 200 — safer within 60s budget
const CLASSIFY_CONCURRENCY = 25;

const SYSTEM_PROMPT = `You are a strategic foresight analyst. Given a news item, first determine whether it is relevant to strategic foresight — evidence of structural change in society, technology, economics, policy, environment, or culture that a professional analyst would track.

If it is NOT relevant (commercial content, deals, product promotions, sponsored content, lifestyle content with no structural implications): return exactly: {"relevant": false}

If it IS relevant, return JSON with three fields:
- "relevant": true
- "steepled": array of 1-3 categories from [${STEEPLED.join(', ')}]
- "summary": 2-3 sentence summary focusing on future implications

Return only valid JSON, no markdown.`;

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const results = {
    candidates_classified: 0,
    candidates_embedded: 0,
    errors: [],
  };

  try {
    const { data: pending } = await supabase
      .from('candidates')
      .select('*')
      .eq('status', 'pending')
      .limit(BATCH_SIZE);

    const candidates = pending || [];

    if (candidates.length > 0) {
      // Classify in parallel, CLASSIFY_CONCURRENCY at a time
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

      // Parse classify results — split into classified, rejected, and failed
      const classified  = [];
      const rejectedIds = [];
      const failedIds   = [];

      candidates.forEach((candidate, i) => {
        const result = classifyResults[i];
        if (result.status === 'rejected') {
          results.errors.push(`Classify ${candidate.id}: ${result.reason?.message}`);
          failedIds.push(candidate.id);
          return;
        }
        let steepled  = [];
        let summaryAi = null;
        try {
          const parsed = JSON.parse(result.value.choices[0].message.content);
          // Change 2: check relevant flag before processing
          if (parsed.relevant === false) {
            rejectedIds.push(candidate.id);
            return; // skip embedding and scored update
          }
          // relevant === true or field absent (backwards compat with old prompt) — proceed
          steepled  = parsed.steepled || [];
          summaryAi = parsed.summary  || null;
        } catch {
          // JSON parse failed — proceed with empty steepled (fail open)
        }
        classified.push({ ...candidate, steepled, summaryAi, classifyUsage: result.value.usage });
      });

      // Mark API-failed candidates as expired so they don't block the queue
      if (failedIds.length > 0) {
        await Promise.allSettled(
          failedIds.map((id) =>
            supabase.from('candidates').update({ status: 'expired' }).eq('id', id)
          )
        );
      }

      // Mark relevance-rejected candidates — no embedding needed
      if (rejectedIds.length > 0) {
        await Promise.allSettled(
          rejectedIds.map((id) =>
            supabase.from('candidates').update({ status: 'rejected' }).eq('id', id)
          )
        );
      }

      if (classified.length > 0) {
        // Batch embed all classified candidates in a single API call
        const embeddingTexts = classified.map((c) =>
          `${c.title}\n${c.summaryAi || c.summary_raw || ''}`.trim()
        );

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingTexts,
        });

        // Write results back to DB in parallel
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

    // Trigger scoring — fire and forget so classify doesn't share its timeout budget
    fetch(`${process.env.APP_URL}/api/score`, {
      method: 'GET',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
    }).catch((e) => {
      console.error('Score trigger failed:', e.message);
    });

    return res.status(200).json({ success: true, results });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, results });
  }
}

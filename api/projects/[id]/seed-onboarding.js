import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { scoreCandidate } from '../../lib/scoring.js';

export const config = { maxDuration: 60 };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SOURCE_DIVERSITY_CAP = 4;
const RESULT_LIMIT = 15;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id: projectId } = req.query;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  const token = authHeader.slice(7);

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorised' });

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (wsError || !workspace) return res.status(401).json({ error: 'Workspace not found' });

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, domain, question')
      .eq('id', projectId)
      .eq('workspace_id', workspace.id)
      .single();
    if (projectError || !project) return res.status(404).json({ error: 'Project not found' });

    if (!project.domain) return res.status(200).json({ candidates: [] });

    // ── Primary: read from inputs promoted by the Layer 3 scorer (score.js) ──
    //
    // score.js writes high-scoring candidates into the workspace inbox as inputs
    // with metadata.suggested_projects: [{ id, name, score, classification }, …]
    // The score lives inside that array — NOT at the top-level metadata field.
    // We find this project's entry with .find() and read score from there.

    const { data: taggedInputs } = await supabase
      .from('inputs')
      .select('id, name, description, source_url, steepled, metadata')
      .eq('workspace_id', workspace.id)
      .is('project_id', null)
      .eq('metadata->>source', 'scanner');

    const fromInputs = (taggedInputs || [])
      .flatMap(input => {
        const suggestion = input.metadata?.suggested_projects?.find(
          p => p.id === projectId
        );
        if (!suggestion) return [];
        return [{
          input,
          score:          suggestion.score,
          classification: suggestion.classification,
        }];
      })
      .sort((a, b) => b.score - a.score);

    // Resolve source_name and source_credibility for each inbox input.
    // score.js stores candidate_id in metadata; follow that to candidates → sources.
    let inputCandidates = [];
    if (fromInputs.length > 0) {
      const rawCandidateIds = fromInputs
        .map(c => c.input.metadata?.candidate_id)
        .filter(Boolean);

      const [{ data: rawCandidates }] = await Promise.all([
        supabase.from('candidates').select('id, source_id').in('id', rawCandidateIds),
      ]);

      const sourceIds = [...new Set((rawCandidates || []).map(c => c.source_id).filter(Boolean))];
      const { data: sources } = await supabase
        .from('sources').select('id, name, credibility').in('id', sourceIds);

      const candidateMap = Object.fromEntries((rawCandidates || []).map(c => [c.id, c]));
      const sourceMap    = Object.fromEntries((sources    || []).map(s => [s.id, s]));

      inputCandidates = fromInputs.map(({ input, score, classification }) => {
        const cand = candidateMap[input.metadata?.candidate_id];
        const src  = cand ? sourceMap[cand.source_id] : null;
        return {
          id:                 input.id,
          title:              input.name,
          summary_ai:         input.description || '',
          source_url:         input.source_url,
          source_name:        src?.name        ?? 'Unknown source',
          source_credibility: src?.credibility ?? 'general',
          steepled_tags:      input.steepled   ?? [],
          published_at:       null,
          score,
          classification,
        };
      });
    }

    // Apply diversity cap then take top RESULT_LIMIT.
    const sourceCounts = {};
    const primary = [];
    const overflow = [];
    for (const c of inputCandidates) {
      const n = sourceCounts[c.source_name] ?? 0;
      if (n < SOURCE_DIVERSITY_CAP) { primary.push(c); sourceCounts[c.source_name] = n + 1; }
      else                          { overflow.push(c); }
    }
    const result = primary.slice(0, RESULT_LIMIT);
    if (result.length < RESULT_LIMIT) {
      result.push(...overflow.slice(0, RESULT_LIMIT - result.length));
    }

    // ── Fallback: candidates table when inputs pool is thin ───────────────────
    //
    // score.js fires as fire-and-forget after project creation, so for brand-new
    // projects there are no promoted inputs yet. We also use this to fill any gap
    // when the inbox has fewer than RESULT_LIMIT suggestions for this project.
    // Candidates already present in result are excluded by source_url.

    if (result.length < RESULT_LIMIT) {
      const existingUrls = new Set(result.map(c => c.source_url));

      let keyQuestionEmbedding = null;
      if (project.question?.trim()) {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: project.question,
        });
        keyQuestionEmbedding = embeddingResponse.data[0].embedding;
      }

      const { data: pool } = await supabase.rpc('get_seeding_candidates', {
        p_domain: project.domain,
      });

      const fallbackScored = (pool || [])
        .filter(c => !existingUrls.has(c.url))
        .map(c => {
          const embedding = c.embedding
            ? (typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding)
            : null;
          return {
            id:                 c.id,
            title:              c.title,
            summary_ai:         c.summary_ai         ?? '',
            source_url:         c.url,
            source_name:        c.source_name,
            source_credibility: c.source_credibility,
            steepled_tags:      c.steepled            ?? [],
            published_at:       c.published_at        ?? null,
            score: scoreCandidate({
              embedding,
              keyQuestionEmbedding,
              credibility: c.source_credibility,
              publishedAt: c.published_at,
            }),
          };
        })
        .sort((a, b) => b.score - a.score);

      result.push(...fallbackScored.slice(0, RESULT_LIMIT - result.length));
    }

    return res.status(200).json({ candidates: result });

  } catch (error) {
    console.error('[seed-onboarding]', error);
    return res.status(500).json({ error: error.message });
  }
}

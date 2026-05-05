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

  // Require bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  const token = authHeader.slice(7);

  try {
    // Verify JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorised' });
    }

    // Fetch workspace for this user
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (wsError || !workspace) {
      return res.status(401).json({ error: 'Workspace not found' });
    }

    // Fetch project and verify ownership in one query
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, domain, question')
      .eq('id', projectId)
      .eq('workspace_id', workspace.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.domain) {
      return res.status(200).json({ candidates: [] });
    }

    // Embed key question if present; skip if empty
    let keyQuestionEmbedding = null;
    if (project.question?.trim()) {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: project.question,
      });
      keyQuestionEmbedding = embeddingResponse.data[0].embedding;
    }

    // Fetch domain-matched candidates with embeddings via RPC.
    // The RPC uses a SQL-level IS NOT NULL filter, bypassing the PostgREST
    // pgvector filter bug that makes .not('embedding', 'is', null) unreliable.
    const { data: candidates, error: candidatesError } = await supabase
      .rpc('get_seeding_candidates', { p_domain: project.domain });

    if (candidatesError) throw candidatesError;

    if (!candidates?.length) {
      return res.status(200).json({ candidates: [] });
    }

    // Score all candidates
    const scored = candidates.map(c => {
      const embedding = c.embedding
        ? (typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding)
        : null;

      const score = scoreCandidate({
        embedding,
        keyQuestionEmbedding,
        credibility: c.source_credibility,
        publishedAt: c.published_at,
      });

      return {
        id: c.id,
        title: c.title,
        summary_ai: c.summary_ai ?? '',
        source_name: c.source_name,
        source_url: c.url,
        source_credibility: c.source_credibility,
        steepled_tags: c.steepled ?? [],
        published_at: c.published_at ?? null,
        score,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Diversity cap: max SOURCE_DIVERSITY_CAP candidates per source.
    // Overflow candidates backfill slots if the primary pool is < RESULT_LIMIT.
    const sourceCounts = {};
    const primary = [];
    const overflow = [];

    for (const c of scored) {
      const count = sourceCounts[c.source_name] ?? 0;
      if (count < SOURCE_DIVERSITY_CAP) {
        primary.push(c);
        sourceCounts[c.source_name] = count + 1;
      } else {
        overflow.push(c);
      }
    }

    const result = primary.slice(0, RESULT_LIMIT);
    if (result.length < RESULT_LIMIT) {
      result.push(...overflow.slice(0, RESULT_LIMIT - result.length));
    }

    return res.status(200).json({ candidates: result });

  } catch (error) {
    console.error('[seed-onboarding]', error);
    return res.status(500).json({ error: error.message });
  }
}

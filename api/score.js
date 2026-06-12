import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { norm, dot, CREDIBILITY_SCORES } from './lib/scoring.js';

export const config = {
  maxDuration: 120,
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCORE_THRESHOLD = 30;
const CANDIDATE_LOOKBACK_DAYS = 30;
const INSERT_CHUNK = 500;

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const results = {
    projects_scored: 0,
    candidates_evaluated: 0,
    candidates_promoted: 0,
    errors: [],
  };

  try {
    // Fetch active projects with only the fields we need
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, workspace_id, name, question, key_question_embedding, scanning_enabled')
      .not('question', 'is', null)
      .neq('question', '');

    if (projectsError) throw projectsError;
    if (!projects?.length) return res.status(200).json({ success: true, results });

    // Fetch workspace scanning flags
    const workspaceIds = [...new Set(projects.map(p => p.workspace_id))];
    const { data: wsSettings } = await supabase
      .from('workspace_settings')
      .select('workspace_id, scanning_enabled')
      .in('workspace_id', workspaceIds);

    const disabledWorkspaces = new Set(
      (wsSettings || [])
        .filter(ws => ws.scanning_enabled === false)
        .map(ws => ws.workspace_id)
    );

    const activeProjects = projects.filter(p =>
      !disabledWorkspaces.has(p.workspace_id) && p.scanning_enabled !== false
    );

    if (!activeProjects.length) return res.status(200).json({ success: true, results });

    // ── Bulk-fetch recent candidates — field-selective, 30-day window ─────────
    // Previously fetched ALL scored/promoted candidates with select('*'), including
    // full embedding vectors for every row ever ingested. After weeks of operation
    // this ballooned into tens of MB, reliably timing out the function.
    const lookbackDate = new Date(Date.now() - CANDIDATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const { data: candidateRows, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, source_id, title, url, summary_ai, summary_raw, steepled, embedding')
      .in('status', ['scored', 'promoted'])
      .gte('ingested_at', lookbackDate.toISOString());

    if (candidatesError) throw candidatesError;

    const allCandidates = (candidateRows || [])
      .map(c => ({
        ...c,
        embedding: typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding,
      }))
      .filter(c => c.embedding)
      .map(c => ({ ...c, _norm: norm(c.embedding) }));

    if (!allCandidates.length) return res.status(200).json({ success: true, results });

    // ── Bulk-fetch sources for credibility lookup ─────────────────────────────
    const { data: sources } = await supabase
      .from('sources')
      .select('id, credibility');
    const sourceMap = Object.fromEntries((sources || []).map(s => [s.id, s]));

    // ── Bulk-fetch already-scored pairs for all active projects in one query ───
    // Previously fetched project_candidates per-project inside the scoring loop,
    // causing N round-trips and loading an ever-growing history each run.
    const projectIds = activeProjects.map(p => p.id);
    const { data: allAlreadyScored } = await supabase
      .from('project_candidates')
      .select('project_id, candidate_id')
      .in('project_id', projectIds);

    const scoredByProject = new Map();
    for (const row of (allAlreadyScored || [])) {
      if (!scoredByProject.has(row.project_id)) scoredByProject.set(row.project_id, new Set());
      scoredByProject.get(row.project_id).add(row.candidate_id);
    }

    // ── Per-project scoring ───────────────────────────────────────────────────
    const candidateProjectScores = {};

    for (const project of activeProjects) {
      try {
        // Resolve key question embedding (cached on the project row)
        let keyQuestionEmbedding = project.key_question_embedding;
        if (keyQuestionEmbedding) {
          keyQuestionEmbedding = typeof keyQuestionEmbedding === 'string'
            ? JSON.parse(keyQuestionEmbedding)
            : keyQuestionEmbedding;
        }

        if (!keyQuestionEmbedding) {
          const embResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: project.question,
          });
          keyQuestionEmbedding = embResp.data[0].embedding;
          await supabase
            .from('projects')
            .update({ key_question_embedding: keyQuestionEmbedding })
            .eq('id', project.id);
        }
        const kqNorm = norm(keyQuestionEmbedding);

        // Use cached input embeddings for corpus similarity — no OpenAI calls.
        // pgvector .not('embedding','is',null) is unreliable via PostgREST; filter in JS.
        const { data: inputRows } = await supabase
          .from('inputs')
          .select('embedding')
          .eq('project_id', project.id);

        const corpusEmbeddings = (inputRows || [])
          .map(i => typeof i.embedding === 'string' ? JSON.parse(i.embedding) : i.embedding)
          .filter(Boolean)
          .map(e => ({ embedding: e, _norm: norm(e) }));

        const alreadyScoredIds = scoredByProject.get(project.id) ?? new Set();
        const newCandidates = allCandidates.filter(c => !alreadyScoredIds.has(c.id));

        // Score in memory, then batch-upsert — one row-at-a-time insert per
        // candidate couldn't keep up with nightly volume (~1000 new candidates
        // x N projects) within the function's time limit.
        const rows = [];
        for (const candidate of newCandidates) {
          const keyQuestionSim = dot(candidate.embedding, keyQuestionEmbedding) / (candidate._norm * kqNorm);
          const corpusSim = corpusEmbeddings.length
            ? corpusEmbeddings.reduce((s, c) => s + dot(candidate.embedding, c.embedding) / (candidate._norm * c._norm), 0) / corpusEmbeddings.length
            : 0;

          const credibility = sourceMap[candidate.source_id]?.credibility || 'general';
          const credibilityScore = CREDIBILITY_SCORES[credibility] || 50;

          const score = Math.round(
            (keyQuestionSim * 0.6 * 100) +
            (corpusSim * 0.2 * 100) +
            (credibilityScore * 0.2)
          );

          let classification = 'noise';
          if (keyQuestionSim > 0.4 && corpusSim < 0.3) {
            classification = 'emerging';
          } else if (keyQuestionSim > 0.4 && corpusSim >= 0.3) {
            classification = 'reinforcing';
          }

          const surfaced = score >= SCORE_THRESHOLD && classification !== 'noise';

          rows.push({
            project_id: project.id,
            candidate_id: candidate.id,
            score,
            classification,
            key_question_sim: keyQuestionSim,
            corpus_sim: corpusSim,
            surfaced,
          });

          results.candidates_evaluated++;

          if (surfaced) {
            if (!candidateProjectScores[candidate.id]) {
              candidateProjectScores[candidate.id] = { candidate, projects: [] };
            }
            candidateProjectScores[candidate.id].projects.push({
              project_id: project.id,
              project_name: project.name,
              score,
              classification,
            });
          }
        }

        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
          const chunk = rows.slice(i, i + INSERT_CHUNK);
          // ignoreDuplicates: a concurrent scoring run may have already inserted
          // one of these (project_id, candidate_id) pairs — skip it, don't error.
          const { error: pcError } = await supabase
            .from('project_candidates')
            .upsert(chunk, { onConflict: 'project_id,candidate_id', ignoreDuplicates: true });
          if (pcError) throw pcError;
        }

        results.projects_scored++;

      } catch (projectError) {
        results.errors.push(`Project ${project.name}: ${projectError.message}`);
      }
    }

    // ── Promote high-scoring candidates to Inbox ──────────────────────────────
    for (const [candidateId, { candidate, projects: scoredProjects }] of Object.entries(candidateProjectScores)) {
      try {
        const { data: existing } = await supabase
          .from('inputs')
          .select('id')
          .eq('source_url', candidate.url)
          .single();

        if (existing) continue;

        const topProject = scoredProjects.sort((a, b) => b.score - a.score)[0];
        const { data: project } = await supabase
          .from('projects')
          .select('workspace_id')
          .eq('id', topProject.project_id)
          .single();

        if (!project) continue;

        const { data: source } = await supabase
          .from('sources')
          .select('credibility')
          .eq('id', candidate.source_id)
          .single();

        const signalQuality = source?.credibility === 'institutional'
          ? 'Confirmed'
          : source?.credibility === 'specialist'
            ? 'Established'
            : 'Emerging';

        await supabase.from('inputs').insert({
          workspace_id: project.workspace_id,
          project_id: null,
          name: candidate.title,
          description: candidate.summary_ai || candidate.summary_raw,
          source_url: candidate.url,
          subtype: 'Signal',
          steepled: candidate.steepled || [],
          signal_quality: signalQuality,
          is_seeded: true,
          metadata: {
            source: 'scanner',
            candidate_id: candidateId,
            suggested_projects: scoredProjects.map(p => ({
              id: p.project_id,
              name: p.project_name,
              score: p.score,
              classification: p.classification,
            })),
            top_score: topProject.score,
            classification: topProject.classification,
          },
        });

        results.candidates_promoted++;

        await supabase
          .from('candidates')
          .update({ status: 'promoted' })
          .eq('id', candidateId);

      } catch (promoteError) {
        results.errors.push(`Promote ${candidateId}: ${promoteError.message}`);
      }
    }

    // Health check — fire and forget
    fetch(`${process.env.SUPABASE_URL}/functions/v1/check-scanner-health`, {
      method: 'GET',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
    }).catch((e) => {
      console.error('Health check trigger failed:', e.message);
    });

    return res.status(200).json({ success: true, results });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, results });
  }
}

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { norm, dot, CREDIBILITY_SCORES } from '../server-lib/scoring.js';
import { cronSecretOk, bearerToken } from '../server-lib/cron-auth.js';

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
const PAGE_SIZE = 1000;

// PostgREST caps unpaginated responses at 1000 rows — page through with a
// stable order so scoredByProject reflects the true already-scored set.
async function fetchAllAlreadyScored(projectIds) {
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase
      .from('project_candidates')
      .select('project_id, candidate_id')
      .in('project_id', projectIds)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export default async function handler(req, res) {
  // Accept x-cron-secret (from classify's fire-and-forget) OR Authorization: Bearer
  // (Vercel's cron runner sends the latter automatically when CRON_SECRET is set)
  if (!cronSecretOk(req.headers['x-cron-secret'], bearerToken(req))) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const results = {
    projects_scored: 0,
    candidates_evaluated: 0,
    candidates_promoted: 0,
    errors: [],
    scope_out_hard_penalties: 0,
    scope_out_soft_penalties: 0,
  };

  try {
    // Fetch active projects — now includes focus, scope_in, scope_out for richer scoring.
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, workspace_id, name, domains, custom_domain, question, focus, scope_in, scope_out, key_question_embedding, scanning_enabled')
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

    // A project is scoring-active if it has at least one domain — predefined or
    // custom. Scoring is semantic (key-question embedding), not domain-filtered,
    // so a custom-only project still scores against user-added-source candidates.
    const activeProjects = projects.filter(p =>
      !disabledWorkspaces.has(p.workspace_id) && p.scanning_enabled !== false &&
      ((p.domains?.length ?? 0) > 0 || p.custom_domain)
    );

    if (!activeProjects.length) return res.status(200).json({ success: true, results });

    // ── Bulk-fetch recent candidates — field-selective, 30-day window ─────────
    // Paginate through all candidates to avoid PostgREST's 1000-row default cap.
    const lookbackDate = new Date(Date.now() - CANDIDATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const candidateRows = [];
    let candFrom = 0;
    while (true) {
      const { data: page, error: candidatesError } = await supabase
        .from('candidates')
        .select('id, source_id, title, url, summary_ai, summary_raw, steepled, embedding')
        .in('status', ['scored', 'promoted'])
        .gte('ingested_at', lookbackDate.toISOString())
        .order('ingested_at', { ascending: true })
        .range(candFrom, candFrom + PAGE_SIZE - 1);
      if (candidatesError) throw candidatesError;
      candidateRows.push(...(page ?? []));
      if (!page || page.length < PAGE_SIZE) break;
      candFrom += PAGE_SIZE;
    }

    const allCandidates = candidateRows
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
    const allAlreadyScored = await fetchAllAlreadyScored(projectIds);

    const scoredByProject = new Map();
    for (const row of allAlreadyScored) {
      if (!scoredByProject.has(row.project_id)) scoredByProject.set(row.project_id, new Set());
      scoredByProject.get(row.project_id).add(row.candidate_id);
    }

    // ── Per-project scoring ───────────────────────────────────────────────────
    const candidateProjectScores = {};

    for (const project of activeProjects) {
      try {
        // Resolve key question embedding (cached on the project row).
        // This cache is maintained for the question-only string. The richer
        // combined embedding built below is in-memory only and never written back.
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

        // ── Primary embedding: question + focus (in memory, not stored) ───────
        // Concatenate focus when present for a richer semantic signal. Falls
        // back to the cached question-only embedding when focus is absent.
        const hasFocus = Boolean(project.focus?.trim());
        let primaryEmbedding;
        let focusUsed = false;

        if (hasFocus) {
          const combinedText = `${project.question}\n${project.focus.trim()}`;
          const embResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: combinedText,
          });
          primaryEmbedding = embResp.data[0].embedding;
          focusUsed = true;
        } else {
          primaryEmbedding = keyQuestionEmbedding;
        }
        const primaryNorm = norm(primaryEmbedding);

        // ── Scope In embedding (once per project, reused across all candidates) ─
        let scopeInEmbedding = null;
        let scopeInNormVal = null;
        if (Array.isArray(project.scope_in) && project.scope_in.length > 0) {
          const embResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: project.scope_in.join(', '),
          });
          scopeInEmbedding = embResp.data[0].embedding;
          scopeInNormVal = norm(scopeInEmbedding);
        }

        // ── Scope Out embedding (once per project, reused across all candidates) ─
        let scopeOutEmbedding = null;
        let scopeOutNormVal = null;
        if (Array.isArray(project.scope_out) && project.scope_out.length > 0) {
          const embResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: project.scope_out.join(', '),
          });
          scopeOutEmbedding = embResp.data[0].embedding;
          scopeOutNormVal = norm(scopeOutEmbedding);
        }

        console.log(`[score] project="${project.name}" focus_used=${focusUsed} scope_in=${scopeInEmbedding !== null} scope_out=${scopeOutEmbedding !== null}`);

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
          // Primary similarity (question + focus combined)
          const primarySim = dot(candidate.embedding, primaryEmbedding) / (candidate._norm * primaryNorm);

          // Corpus similarity
          const corpusSim = corpusEmbeddings.length
            ? corpusEmbeddings.reduce((s, c) => s + dot(candidate.embedding, c.embedding) / (candidate._norm * c._norm), 0) / corpusEmbeddings.length
            : 0;

          // Source credibility
          const credibility = sourceMap[candidate.source_id]?.credibility || 'general';
          const credibilityScore = CREDIBILITY_SCORES[credibility] || 50;

          // Scope In similarity (null when scope_in is absent — contributes 0, no weight renorm)
          const scopeInSim = scopeInEmbedding !== null
            ? dot(candidate.embedding, scopeInEmbedding) / (candidate._norm * scopeInNormVal)
            : null;

          // Scope Out similarity (null when scope_out is absent — no penalty applied)
          const scopeOutSim = scopeOutEmbedding !== null
            ? dot(candidate.embedding, scopeOutEmbedding) / (candidate._norm * scopeOutNormVal)
            : null;

          // ── Weighted sum (normalised 0–1 before scaling) ──────────────────
          // Weights: primary 50% | corpus 20% | credibility 20% | scope_in 10%
          // Absent scope_in contributes 0; weights are not renormalised (per spec).
          let normalizedScore =
            (primarySim * 0.5) +
            (corpusSim * 0.2) +
            ((credibilityScore / 100) * 0.2) +
            (scopeInSim !== null ? scopeInSim * 0.1 : 0);

          // ── Scope Out penalty (applied post-sum, pre-scale) ───────────────
          // Hard (>0.75 sim): score × 0.25
          // Soft (0.5–0.75 sim): score − (sim − 0.5) × 0.4
          let scopeOutPenaltyApplied = null;
          if (scopeOutSim !== null) {
            if (scopeOutSim > 0.75) {
              normalizedScore *= 0.25;
              scopeOutPenaltyApplied = 'hard';
              results.scope_out_hard_penalties++;
            } else if (scopeOutSim > 0.5) {
              normalizedScore -= (scopeOutSim - 0.5) * 0.4;
              scopeOutPenaltyApplied = 'soft';
              results.scope_out_soft_penalties++;
            }
          }

          const score = Math.max(0, Math.round(normalizedScore * 100));

          if (scopeInSim !== null || scopeOutPenaltyApplied) {
            console.debug(
              `[score] candidate="${candidate.title?.slice(0, 60)}" ` +
              `focus_used=${focusUsed} ` +
              `scope_in_sim=${scopeInSim?.toFixed(3) ?? null} ` +
              `scope_out_sim=${scopeOutSim?.toFixed(3) ?? null} ` +
              `scope_out_penalty_applied=${scopeOutPenaltyApplied} ` +
              `score=${score}`
            );
          }

          let classification = 'noise';
          if (primarySim > 0.4 && corpusSim < 0.3) {
            classification = 'emerging';
          } else if (primarySim > 0.4 && corpusSim >= 0.3) {
            classification = 'reinforcing';
          }

          const surfaced = score >= SCORE_THRESHOLD && classification !== 'noise';

          rows.push({
            project_id: project.id,
            candidate_id: candidate.id,
            score,
            classification,
            key_question_sim: primarySim,
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

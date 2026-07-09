import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { CREDIBILITY_SCORES } from './server-lib/scoring.js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const SCORE_THRESHOLD = 30;
const CANDIDATE_LOOKBACK_DAYS = 30;
const PAGE_SIZE = 1000;
const INSERT_CHUNK = 500;

function norm(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function parseEmbedding(e) {
  return typeof e === 'string' ? JSON.parse(e) : e;
}

// PostgREST caps responses at 1000 rows — page through with a stable order.
async function fetchAll(table, build) {
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await build(sb.from(table))
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

console.log('Manual scoring backfill starting…\n');

const { data: allProjects, error: projErr } = await sb
  .from('projects')
  .select('id, workspace_id, name, question, key_question_embedding, scanning_enabled')
  .not('question', 'is', null)
  .neq('question', '');
if (projErr) throw projErr;

const workspaceIds = [...new Set(allProjects.map(p => p.workspace_id))];
const { data: wsSettings } = await sb
  .from('workspace_settings')
  .select('workspace_id, scanning_enabled')
  .in('workspace_id', workspaceIds);
const disabledWorkspaces = new Set(
  (wsSettings ?? []).filter(w => w.scanning_enabled === false).map(w => w.workspace_id)
);
const activeProjects = allProjects.filter(
  p => !disabledWorkspaces.has(p.workspace_id) && p.scanning_enabled !== false
);

console.log(`Active projects: ${activeProjects.length}`);

const lookbackDate = new Date(Date.now() - CANDIDATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
const candidateRows = await fetchAll('candidates', q => q
  .select('id, source_id, title, url, summary_ai, summary_raw, steepled, embedding')
  .in('status', ['scored', 'promoted'])
  .gte('ingested_at', lookbackDate)
);

const allCandidates = candidateRows
  .map(c => ({ ...c, embedding: parseEmbedding(c.embedding) }))
  .filter(c => c.embedding)
  .map(c => ({ ...c, _norm: norm(c.embedding) }));

console.log(`Eligible candidates (scored/promoted, last ${CANDIDATE_LOOKBACK_DAYS}d): ${allCandidates.length}`);

const { data: sources } = await sb.from('sources').select('id, credibility');
const sourceMap = Object.fromEntries((sources ?? []).map(s => [s.id, s]));

const projectIds = activeProjects.map(p => p.id);
const existingPairs = await fetchAll('project_candidates', q => q
  .select('project_id, candidate_id')
  .in('project_id', projectIds)
);
const scoredByProject = new Map();
for (const row of existingPairs) {
  if (!scoredByProject.has(row.project_id)) scoredByProject.set(row.project_id, new Set());
  scoredByProject.get(row.project_id).add(row.candidate_id);
}
console.log(`Existing project_candidates pairs: ${existingPairs.length}\n`);

const candidateProjectScores = {};
let totalEvaluated = 0;
let totalInserted = 0;

for (const project of activeProjects) {
  let kq = parseEmbedding(project.key_question_embedding);
  if (!kq) {
    const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: project.question });
    kq = resp.data[0].embedding;
    await sb.from('projects').update({ key_question_embedding: kq }).eq('id', project.id);
  }
  const kqNorm = norm(kq);

  const inputRows = await fetchAll('inputs', q => q.select('id, embedding').eq('project_id', project.id));
  const corpus = inputRows
    .map(r => parseEmbedding(r.embedding))
    .filter(Boolean)
    .map(e => ({ e, n: norm(e) }));

  const already = scoredByProject.get(project.id) ?? new Set();
  const newCandidates = allCandidates.filter(c => !already.has(c.id));

  const rows = [];
  for (const c of newCandidates) {
    const keyQuestionSim = dot(c.embedding, kq) / (c._norm * kqNorm);
    const corpusSim = corpus.length
      ? corpus.reduce((s, x) => s + dot(c.embedding, x.e) / (c._norm * x.n), 0) / corpus.length
      : 0;

    const credibility = sourceMap[c.source_id]?.credibility || 'general';
    const credibilityScore = CREDIBILITY_SCORES[credibility] || 50;
    const score = Math.round(keyQuestionSim * 0.6 * 100 + corpusSim * 0.2 * 100 + credibilityScore * 0.2);

    let classification = 'noise';
    if (keyQuestionSim > 0.4 && corpusSim < 0.3) classification = 'emerging';
    else if (keyQuestionSim > 0.4 && corpusSim >= 0.3) classification = 'reinforcing';

    const surfaced = score >= SCORE_THRESHOLD && classification !== 'noise';

    rows.push({
      project_id: project.id,
      candidate_id: c.id,
      score,
      classification,
      key_question_sim: keyQuestionSim,
      corpus_sim: corpusSim,
      surfaced,
    });

    totalEvaluated++;
    if (surfaced) {
      (candidateProjectScores[c.id] ??= { candidate: c, projects: [] }).projects.push({
        project_id: project.id,
        project_name: project.name,
        score,
        classification,
      });
    }
  }

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await sb
      .from('project_candidates')
      .upsert(chunk, { onConflict: 'project_id,candidate_id', ignoreDuplicates: true });
    if (error) throw error;
    totalInserted += chunk.length;
  }

  const surfacedCount = rows.filter(r => r.surfaced).length;
  console.log(`${project.name.padEnd(50)} new=${String(newCandidates.length).padStart(5)}  surfaced=${String(surfacedCount).padStart(3)}`);
}

console.log('\n── Scoring complete ───────────────────────────────');
console.log(`  Pairs evaluated: ${totalEvaluated}`);
console.log(`  Pairs inserted:  ${totalInserted}`);
console.log(`  Candidates surfaced (any project): ${Object.keys(candidateProjectScores).length}`);

// ── Promote surfaced candidates to the Inbox ──────────────────────────────
let promoted = 0;
let skippedExisting = 0;
for (const [candidateId, { candidate, projects: scoredProjects }] of Object.entries(candidateProjectScores)) {
  const { data: existing } = await sb.from('inputs').select('id').eq('source_url', candidate.url).single();
  if (existing) { skippedExisting++; continue; }

  const topProject = scoredProjects.sort((a, b) => b.score - a.score)[0];
  const { data: project } = await sb.from('projects').select('workspace_id').eq('id', topProject.project_id).single();
  if (!project) continue;

  const source = sourceMap[candidate.source_id];
  const signalQuality = source?.credibility === 'institutional'
    ? 'Confirmed'
    : source?.credibility === 'specialist'
      ? 'Established'
      : 'Emerging';

  const { error } = await sb.from('inputs').insert({
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
        id: p.project_id, name: p.project_name, score: p.score, classification: p.classification,
      })),
      top_score: topProject.score,
      classification: topProject.classification,
    },
  });
  if (error) { console.error(`Promote ${candidateId}: ${error.message}`); continue; }

  await sb.from('candidates').update({ status: 'promoted' }).eq('id', candidateId);
  promoted++;
}

console.log(`  Promoted to Inbox: ${promoted}`);
console.log(`  Skipped (already an input): ${skippedExisting}`);

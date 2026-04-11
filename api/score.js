import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCORE_THRESHOLD = 40;
const CREDIBILITY_SCORES = {
  institutional: 100,
  specialist: 75,
  general: 50,
  unvetted: 25,
};

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

function averageSimilarity(embedding, corpus) {
  if (!corpus.length) return 0;
  const sims = corpus.map(e => cosineSimilarity(embedding, e));
  return sims.reduce((a, b) => a + b, 0) / sims.length;
}

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
    // Fetch all active projects with a key question
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .not('question', 'is', null)
      .neq('question', '');

    if (projectsError) throw projectsError;

    // Fetch workspace scanning flags for all relevant workspaces
    const workspaceIds = [...new Set((projects || []).map(p => p.workspace_id))];
    const { data: wsSettings } = await supabase
      .from('workspace_settings')
      .select('workspace_id, scanning_enabled')
      .in('workspace_id', workspaceIds);

    const disabledWorkspaces = new Set(
      (wsSettings || [])
        .filter(ws => ws.scanning_enabled === false)
        .map(ws => ws.workspace_id)
    );

    // Fetch all scored candidates with their source credibility
    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('*')
      .in('status', ['scored', 'promoted']);

    if (candidatesError) throw candidatesError;

    // Fetch sources separately for credibility lookup
    const { data: sources } = await supabase
      .from('sources')
      .select('id, credibility');

    const sourceMap = Object.fromEntries(
      (sources || []).map(s => [s.id, s])
    );

    // Track which candidates score well for which projects
    // key: candidate_id, value: { candidate, projects: [...] }
    const candidateProjectScores = {};

    for (const project of projects) {
      // Skip if workspace scanning is disabled
      if (disabledWorkspaces.has(project.workspace_id)) continue;
      // Skip if project-level scanning is disabled
      if (project.scanning_enabled === false) continue;

      try {
        // Embed key question (or use cached embedding)
        let keyQuestionEmbedding = project.key_question_embedding;

        if (keyQuestionEmbedding) {
          keyQuestionEmbedding = typeof keyQuestionEmbedding === 'string'
            ? JSON.parse(keyQuestionEmbedding)
            : keyQuestionEmbedding;
        }

        if (!keyQuestionEmbedding) {
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: project.question,
          });
          keyQuestionEmbedding = embeddingResponse.data[0].embedding;

          // Cache it on the project
          await supabase
            .from('projects')
            .update({ key_question_embedding: keyQuestionEmbedding })
            .eq('id', project.id);
        }

        // Fetch existing project inputs for corpus similarity
        const { data: projectInputs } = await supabase
          .from('inputs')
          .select('name, description')
          .eq('project_id', project.id);

        // Embed corpus inputs
        let corpusEmbeddings = [];
        if (projectInputs?.length) {
          const corpusTexts = projectInputs.map(i =>
            `${i.name}\n${i.description || ''}`.trim()
          );
          const corpusResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: corpusTexts,
          });
          corpusEmbeddings = corpusResponse.data.map(d => d.embedding);
        }

        // Get already-scored candidates for this project
        const { data: alreadyScored } = await supabase
          .from('project_candidates')
          .select('candidate_id')
          .eq('project_id', project.id);

        const alreadyScoredIds = new Set(
          (alreadyScored || []).map(r => r.candidate_id)
        );

        // Score each candidate against this project
        for (const candidate of candidates) {
          if (alreadyScoredIds.has(candidate.id)) continue;

          const embedding = typeof candidate.embedding === 'string'
            ? JSON.parse(candidate.embedding)
            : candidate.embedding;
          if (!embedding) continue;

          // Compute similarities
          const keyQuestionSim = cosineSimilarity(embedding, keyQuestionEmbedding);
          const corpusSim = corpusEmbeddings.length
            ? averageSimilarity(embedding, corpusEmbeddings)
            : 0;

          // Credibility boost
          const credibility = sourceMap[candidate.source_id]?.credibility || 'general';
          const credibilityScore = CREDIBILITY_SCORES[credibility] || 50;

          // Final score (0-100)
          const score = Math.round(
            (keyQuestionSim * 0.6 * 100) +
            (corpusSim * 0.2 * 100) +
            (credibilityScore * 0.2)
          );

          // Classification
          let classification = 'noise';
          if (keyQuestionSim > 0.4 && corpusSim < 0.3) {
            classification = 'emerging';
          } else if (keyQuestionSim > 0.4 && corpusSim >= 0.3) {
            classification = 'reinforcing';
          }

          const surfaced = score >= SCORE_THRESHOLD && classification !== 'noise';

          // Write to project_candidates
          await supabase.from('project_candidates').insert({
            project_id: project.id,
            candidate_id: candidate.id,
            score,
            classification,
            key_question_sim: keyQuestionSim,
            corpus_sim: corpusSim,
            surfaced,
          });

          results.candidates_evaluated++;

          // Track high-scoring candidates for inbox promotion
          if (surfaced) {
            if (!candidateProjectScores[candidate.id]) {
              candidateProjectScores[candidate.id] = {
                candidate,
                projects: [],
              };
            }
            candidateProjectScores[candidate.id].projects.push({
              project_id: project.id,
              project_name: project.name,
              score,
              classification,
            });
          }
        }

        results.projects_scored++;

      } catch (projectError) {
        results.errors.push(`Project ${project.name}: ${projectError.message}`);
      }
    }

    // Promote high-scoring candidates to Inbox as AI-suggested inputs
    for (const [candidateId, { candidate, projects: scoredProjects }] of Object.entries(candidateProjectScores)) {
      try {
        // Check if already promoted to inputs
        const { data: existing } = await supabase
          .from('inputs')
          .select('id')
          .eq('source_url', candidate.url)
          .single();

        if (existing) continue;

        // Get workspace_id from the highest-scoring project
        const topProject = scoredProjects.sort((a, b) => b.score - a.score)[0];
        const { data: project } = await supabase
          .from('projects')
          .select('workspace_id')
          .eq('id', topProject.project_id)
          .single();

        if (!project) continue;

        // Get source credibility for signal_quality mapping
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

        // Insert into inputs as AI-suggested
        await supabase.from('inputs').insert({
          workspace_id: project.workspace_id,
          project_id: null, // goes to Inbox
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

        // Mark candidate as promoted
        await supabase
          .from('candidates')
          .update({ status: 'promoted' })
          .eq('id', candidateId);

      } catch (promoteError) {
        results.errors.push(`Promote ${candidateId}: ${promoteError.message}`);
      }
    }

    return res.status(200).json({ success: true, results });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, results });
  }
}

// Shared scoring primitives for the Layer 3 scanner pipeline.
// Used by the cron scoring job (api/score.js) and the onboarding seeding
// endpoint (api/projects/[id]/seed-onboarding.js).

export const CREDIBILITY_SCORES = {
  institutional: 100,
  specialist: 75,
  general: 50,
  unvetted: 25,
};

export function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// Exponential recency decay with a 90-day half-life. Returns 0–100.
// No published_at → neutral midpoint (50) rather than penalising undated content.
export function recencyScore(publishedAt) {
  if (!publishedAt) return 50;
  const ageDays = (Date.now() - new Date(publishedAt).getTime()) / 86_400_000;
  return 100 * Math.pow(0.5, ageDays / 90);
}

// Composite score for the onboarding seeding context (no corpus).
//
// With key question:  65% semantic similarity + 20% credibility + 15% recency
// Without key question: 60% credibility + 40% recency (domain + recency fallback)
//
// Both variants produce scores in roughly 0–100.
export function scoreCandidate({ embedding, keyQuestionEmbedding, credibility, publishedAt }) {
  const credScore = CREDIBILITY_SCORES[credibility] ?? 50;
  const recScore = recencyScore(publishedAt);

  if (keyQuestionEmbedding && embedding) {
    const sim = cosineSimilarity(embedding, keyQuestionEmbedding);
    return Math.round(sim * 65 + credScore * 0.20 + recScore * 0.15);
  }

  return Math.round(credScore * 0.60 + recScore * 0.40);
}

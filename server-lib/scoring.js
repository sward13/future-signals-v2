// Shared scoring primitives for the Layer 3 scanner pipeline.
// Used by the cron scoring job (api/score.js) and the onboarding seeding
// endpoint (api/projects/[id]/seed-onboarding.js).

export const CREDIBILITY_SCORES = {
  institutional: 100,
  specialist: 75,
  general: 50,
  unvetted: 25,
};

// Builds the text embedded for a project's primary relevance comparison:
// question + focus. scope_in is deliberately NOT folded in here — real
// production data (833 surfaced candidates, "Future of data centers" project,
// 2026-09-01) showed folding scope_in into one combined embedding measurably
// *reduced* its separation power against an on-topic/off-topic proxy (effect
// size 1.187) compared to keeping it a separate term (1.327) — scope_in is
// actually the single strongest individual signal measured (1.499, stronger
// than primarySim alone at 1.263), and folding diluted rather than amplified
// it. See scopeInWeight in blendRelevanceScore for where it's scored instead.
// Falls back to `question` alone when focus is absent — callers should embed
// the cached question-only embedding in that case rather than re-embedding.
export function buildPrimaryEmbeddingText({ question, focus }) {
  const trimmedFocus = focus?.trim();
  return trimmedFocus ? `${question}\n${trimmedFocus}` : question;
}

export function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// For batch scoring where the same embeddings are compared many times —
// precompute norm() once per vector, then use dot() for each pairwise
// similarity instead of recomputing both magnitudes on every call.
export function norm(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
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

// ── Level 3: negative pool (dismissed candidates) ───────────────────────────
// signal-scanner-spec.md § Graduated Scoring Refinement, Level 3.

export const NEGATIVE_POOL_HALF_LIFE_DAYS = 90;

// Decay weight for a dismissal `ageDays` old. 90-day half-life, matching the
// existing recency-decay convention above (recencyScore) and the spec's
// stated default: a dismissal from yesterday has full weight, one from three
// months ago has half weight, one from six months ago has quarter weight.
export function negativePoolDecayWeight(ageDays, halfLifeDays = NEGATIVE_POOL_HALF_LIFE_DAYS) {
  return Math.pow(0.5, ageDays / halfLifeDays);
}

// Decay-weighted average cosine similarity between a candidate and a pool of
// dismissed-candidate embeddings. `pool` entries are { embedding, norm, weight }
// — weight from negativePoolDecayWeight. Returns 0 for an empty pool (no
// dismissals yet), so callers that fold this into corpusSim − negativePoolSim
// degrade gracefully to plain corpusSim rather than erroring or wrongly
// zeroing out the score.
export function weightedPoolSimilarity(candidateEmbedding, candidateNorm, pool) {
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = pool.reduce(
    (sum, p) => sum + (dot(candidateEmbedding, p.embedding) / (candidateNorm * p.norm)) * p.weight,
    0,
  );
  return weightedSum / totalWeight;
}

// ── Blended relevance score (pre scope_out / negative-pool penalties) ──────
//
// Weights: primary (question+focus) 40% | scope_in 30% (separate term — see
// buildPrimaryEmbeddingText) | credibility 20% | corpus (positive pool) 10%.
//
// corpusSim's weight was cut from its original 20%, not left untouched, on
// the same evidence base as everything else here: the same real-data check
// that validated scope_in as a separate term also showed corpusSim is
// *backwards* for a project with a topically contaminated positive pool —
// on-topic candidates scored LOWER on corpusSim than off-topic ones (effect
// size -1.595, project "Future of data centers", 833 candidates,
// 2026-09-01). Halved rather than zeroed: this formula runs for every
// project, and corpusSim is presumably a genuine positive signal for
// projects whose promoted-input history isn't dominated by generic content —
// this only de-emphasizes it as a *default*, it doesn't assume every
// project's pool is contaminated.
//
// Always renormalizes by the actual weight used (PRIMARY+CORPUS+CREDIBILITY,
// plus SCOPE_IN only when scopeInSim is non-null) rather than assuming a
// fixed denominator — fixes a real bug in the pre-Level-3 formula, where an
// absent scope_in term silently left weights summing to 0.9 instead of 1.0,
// structurally capping the max achievable score for projects without scope_in.
export const PRIMARY_WEIGHT = 0.4;
export const SCOPE_IN_WEIGHT = 0.3;
export const CREDIBILITY_WEIGHT = 0.2;
export const CORPUS_WEIGHT = 0.1;

export function blendRelevanceScore({ primarySim, corpusSim, credibilityScore, scopeInSim }) {
  const hasScopeIn = scopeInSim !== null && scopeInSim !== undefined;
  const usedWeight = PRIMARY_WEIGHT + CORPUS_WEIGHT + CREDIBILITY_WEIGHT + (hasScopeIn ? SCOPE_IN_WEIGHT : 0);
  const raw =
    (primarySim * PRIMARY_WEIGHT) +
    (corpusSim * CORPUS_WEIGHT) +
    ((credibilityScore / 100) * CREDIBILITY_WEIGHT) +
    (hasScopeIn ? scopeInSim * SCOPE_IN_WEIGHT : 0);
  return raw / usedWeight;
}

// ── Scope Out penalty (applied post-sum, pre-scale) ─────────────────────────
// Hard (>0.75 sim): score × 0.25. Soft (0.5–0.75 sim): score − (sim−0.5)×0.4.
// No-op — returns the score unchanged, penalty: null — when scopeOutSim is
// null/undefined (the project has no scope_out set) or below the soft gate.
export function applyScopeOutPenalty(normalizedScore, scopeOutSim) {
  if (scopeOutSim === null || scopeOutSim === undefined) {
    return { normalizedScore, penalty: null };
  }
  if (scopeOutSim > 0.75) {
    return { normalizedScore: normalizedScore * 0.25, penalty: 'hard' };
  }
  if (scopeOutSim > 0.5) {
    return { normalizedScore: normalizedScore - (scopeOutSim - 0.5) * 0.4, penalty: 'soft' };
  }
  return { normalizedScore, penalty: null };
}

// ── Negative pool penalty (applied post scope_out, pre-scale) ───────────────
//
// corpusSim and negativePoolSim were found to be highly correlated (0.932,
// same real-data check as above) — a project's positive and negative pools
// draw from largely the same distribution, so a straight `corpusSim −
// negativePoolSim` delta mostly cancels out shared noise rather than
// isolating a real signal, and — worse — a plain subtraction with no gate
// or cap let a noisy negative pool drag every candidate down by roughly the
// same amount regardless of actual relevance (the flaw in the first version
// of this fix). This version only penalizes once negativePoolSim clears
// corpusSim by a real margin — not just the pools' shared noise floor — and
// caps the raw excess so one very-similar-to-dismissed candidate can't
// swing the score disproportionately.
//
// NEGATIVE_POOL_MARGIN is the median (negativePoolSim − corpusSim) among
// candidates where that difference is positive, from the same real-data
// check (0.0147, rounded). It's a reasoned default, not per-project-tuned —
// same category of fixed constant as SCORE_THRESHOLD or the scope_out gates.
export const NEGATIVE_POOL_MARGIN = 0.015;
export const NEGATIVE_POOL_CAP = 0.3;
export const NEGATIVE_POOL_PENALTY_WEIGHT = 0.15;

export function applyNegativePoolPenalty(normalizedScore, corpusSim, negativePoolSim) {
  const excess = Math.max(0, Math.min(NEGATIVE_POOL_CAP, (negativePoolSim - corpusSim) - NEGATIVE_POOL_MARGIN));
  return normalizedScore - (excess * NEGATIVE_POOL_PENALTY_WEIGHT);
}

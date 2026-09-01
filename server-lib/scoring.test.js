import { test } from "node:test";
import assert from "node:assert/strict";

import {
  norm,
  buildPrimaryEmbeddingText,
  negativePoolDecayWeight,
  weightedPoolSimilarity,
  blendRelevanceScore,
  applyScopeOutPenalty,
  applyNegativePoolPenalty,
  PRIMARY_WEIGHT,
  SCOPE_IN_WEIGHT,
  CREDIBILITY_WEIGHT,
  CORPUS_WEIGHT,
} from "./scoring.js";

// Fixtures ---------------------------------------------------------------------

// Two orthogonal-ish unit-ish vectors and one identical to `a`, so cosine
// similarity is exactly 1 (a vs a) or exactly 0 (a vs b) — easy to assert on.
const a = [1, 0, 0];
const b = [0, 1, 0];

function pooled(vec, weight) {
  return { embedding: vec, norm: norm(vec), weight };
}

// buildPrimaryEmbeddingText ------------------------------------------------------
// scope_in is deliberately NOT part of this text (see scoring.js) — it's
// scored as its own separate weighted term instead, per real-data evidence
// that folding it in underperforms.

test("buildPrimaryEmbeddingText falls back to question alone when focus is absent", () => {
  const text = buildPrimaryEmbeddingText({ question: "What happens to data centers?", focus: null });
  assert.equal(text, "What happens to data centers?");
});

test("buildPrimaryEmbeddingText treats a whitespace-only focus as absent", () => {
  const text = buildPrimaryEmbeddingText({ question: "Q", focus: "   " });
  assert.equal(text, "Q");
});

test("buildPrimaryEmbeddingText includes focus when present", () => {
  const text = buildPrimaryEmbeddingText({ question: "Q", focus: "F" });
  assert.equal(text, "Q\nF");
});

// negativePoolDecayWeight --------------------------------------------------------

test("negativePoolDecayWeight is 1 for a dismissal from right now", () => {
  assert.equal(negativePoolDecayWeight(0), 1);
});

test("negativePoolDecayWeight is 0.5 at the 90-day half-life", () => {
  assert.ok(Math.abs(negativePoolDecayWeight(90) - 0.5) < 1e-9);
});

test("negativePoolDecayWeight is 0.25 at twice the half-life (180 days)", () => {
  assert.ok(Math.abs(negativePoolDecayWeight(180) - 0.25) < 1e-9);
});

// weightedPoolSimilarity ----------------------------------------------------------

test("weightedPoolSimilarity returns 0 for an empty pool (no dismissals yet)", () => {
  const sim = weightedPoolSimilarity(a, norm(a), []);
  assert.equal(sim, 0);
});

test("weightedPoolSimilarity matches plain cosine similarity for a single full-weight pool entry", () => {
  // a vs a => similarity 1
  const sim = weightedPoolSimilarity(a, norm(a), [pooled(a, 1)]);
  assert.ok(Math.abs(sim - 1) < 1e-9);
});

test("weightedPoolSimilarity is 0 against an orthogonal pool entry", () => {
  const sim = weightedPoolSimilarity(a, norm(a), [pooled(b, 1)]);
  assert.ok(Math.abs(sim - 0) < 1e-9);
});

test("weightedPoolSimilarity weights recent dismissals more than decayed ones", () => {
  // Candidate identical to `a`. Pool has one entry identical to `a` (full weight)
  // and one orthogonal entry with much higher weight — the orthogonal one should
  // pull the average down proportionally to its weight share.
  const sim = weightedPoolSimilarity(a, norm(a), [pooled(a, 1), pooled(b, 3)]);
  // weighted avg = (1*1 + 0*3) / (1+3) = 0.25
  assert.ok(Math.abs(sim - 0.25) < 1e-9);
});

// blendRelevanceScore --------------------------------------------------------------

test("blendRelevanceScore weights (primary+corpus+credibility+scopeIn) sum to 1.0 when scope_in is present", () => {
  const score = blendRelevanceScore({ primarySim: 1, corpusSim: 1, credibilityScore: 100, scopeInSim: 1 });
  assert.ok(Math.abs(score - 1) < 1e-9);
});

test("blendRelevanceScore renormalizes correctly when scope_in is absent (null) — no 'sums to 0.9' gap", () => {
  // A project with no scope_in shouldn't be structurally capped below a
  // project that has one, for an otherwise-identical perfect match.
  const score = blendRelevanceScore({ primarySim: 1, corpusSim: 1, credibilityScore: 100, scopeInSim: null });
  assert.ok(Math.abs(score - 1) < 1e-9);
});

test("blendRelevanceScore matches a hand-computed weighted average with scope_in present", () => {
  const score = blendRelevanceScore({ primarySim: 0.6, corpusSim: 0.4, credibilityScore: 50, scopeInSim: 0.7 });
  const usedWeight = PRIMARY_WEIGHT + CORPUS_WEIGHT + CREDIBILITY_WEIGHT + SCOPE_IN_WEIGHT;
  const expected = ((0.6 * PRIMARY_WEIGHT) + (0.4 * CORPUS_WEIGHT) + (0.5 * CREDIBILITY_WEIGHT) + (0.7 * SCOPE_IN_WEIGHT)) / usedWeight;
  assert.ok(Math.abs(score - expected) < 1e-9);
});

test("blendRelevanceScore matches a hand-computed weighted average with scope_in absent", () => {
  const score = blendRelevanceScore({ primarySim: 0.6, corpusSim: 0.4, credibilityScore: 50, scopeInSim: null });
  const usedWeight = PRIMARY_WEIGHT + CORPUS_WEIGHT + CREDIBILITY_WEIGHT;
  const expected = ((0.6 * PRIMARY_WEIGHT) + (0.4 * CORPUS_WEIGHT) + (0.5 * CREDIBILITY_WEIGHT)) / usedWeight;
  assert.ok(Math.abs(score - expected) < 1e-9);
});

// applyScopeOutPenalty --------------------------------------------------------------

test("applyScopeOutPenalty is a no-op when scope_out is absent (null)", () => {
  const { normalizedScore, penalty } = applyScopeOutPenalty(0.7, null);
  assert.equal(normalizedScore, 0.7);
  assert.equal(penalty, null);
});

test("applyScopeOutPenalty is a no-op below the soft-penalty gate", () => {
  const { normalizedScore, penalty } = applyScopeOutPenalty(0.7, 0.5);
  assert.equal(normalizedScore, 0.7);
  assert.equal(penalty, null);
});

test("applyScopeOutPenalty applies the soft penalty between 0.5 and 0.75 similarity", () => {
  const { normalizedScore, penalty } = applyScopeOutPenalty(0.7, 0.6);
  assert.ok(Math.abs(normalizedScore - (0.7 - (0.6 - 0.5) * 0.4)) < 1e-9);
  assert.equal(penalty, "soft");
});

test("applyScopeOutPenalty applies the hard penalty above 0.75 similarity", () => {
  const { normalizedScore, penalty } = applyScopeOutPenalty(0.7, 0.9);
  assert.ok(Math.abs(normalizedScore - 0.7 * 0.25) < 1e-9);
  assert.equal(penalty, "hard");
});

// applyNegativePoolPenalty --------------------------------------------------------

test("applyNegativePoolPenalty does not penalize when there's no dismissal history (negativePoolSim=0)", () => {
  // negativePoolSim=0 is always <= corpusSim for any non-negative corpusSim,
  // so this should never trigger a penalty — the "zero dismissals" case.
  const score = applyNegativePoolPenalty(0.7, 0.4, 0);
  assert.equal(score, 0.7);
});

test("applyNegativePoolPenalty does not penalize when negativePoolSim is within the margin of corpusSim", () => {
  // Difference smaller than the margin — pools' shared noise floor, not a real signal.
  const score = applyNegativePoolPenalty(0.7, 0.4, 0.405);
  assert.equal(score, 0.7);
});

test("applyNegativePoolPenalty penalizes once negativePoolSim clears corpusSim by a real margin", () => {
  const score = applyNegativePoolPenalty(0.7, 0.3, 0.6); // excess well above the margin
  assert.ok(score < 0.7);
});

test("applyNegativePoolPenalty caps the penalty regardless of how large the excess is", () => {
  const moderateExcess = applyNegativePoolPenalty(0.7, 0.0, 0.5);
  const hugeExcess = applyNegativePoolPenalty(0.7, 0.0, 5.0); // absurdly large, must not swing further than the cap
  assert.ok(Math.abs(moderateExcess - hugeExcess) < 1e-9);
});

// End-to-end sanity: a project with no scope_in/scope_out at all, and zero dismissals ---

test("a project with no scope_in/scope_out and no dismissal history still produces a well-defined score", () => {
  const text = buildPrimaryEmbeddingText({ question: "Q", focus: null });
  assert.equal(text, "Q"); // falls back cleanly, no error
  const raw = blendRelevanceScore({ primarySim: 0.5, corpusSim: 0.2, credibilityScore: 50, scopeInSim: null });
  const { normalizedScore: afterScopeOut, penalty } = applyScopeOutPenalty(raw, null);
  const final = applyNegativePoolPenalty(afterScopeOut, 0.2, 0);
  assert.equal(penalty, null);
  assert.equal(final, afterScopeOut); // no negative pool history => unaffected
  assert.ok(final > 0 && final <= 1);
});

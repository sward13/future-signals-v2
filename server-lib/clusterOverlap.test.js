import { test } from "node:test";
import assert from "node:assert/strict";
import { rankClusterOverlaps, cosineSim } from "./clusterOverlap.js";

const V = {
  a1: [1, 0.02, 0],
  a2: [0.98, 0.06, 0],   // ~a1
  b:  [0, 1, 0],
  c:  [0, 0.1, 1],
};

test("returns pairs above floor, sorted by similarity desc", () => {
  const out = rankClusterOverlaps([V.a1, V.a2, V.b], { floor: 0.55, limit: 20 });
  assert.equal(out.length, 1);                 // only a1/a2 clear the floor
  assert.equal(out[0].i, 0);
  assert.equal(out[0].j, 1);
  assert.ok(out[0].similarity > 0.9);
});

test("floor filters out dissimilar pairs", () => {
  const out = rankClusterOverlaps([V.a1, V.b, V.c], { floor: 0.55 });
  assert.equal(out.length, 0);                 // no pair is similar enough
});

test("results are ranked strongest-first", () => {
  // a1~a2 (very high), a1~(slightly-off) medium
  const mid = [0.7, 0.7, 0];                    // ~0.5-ish with a1
  const out = rankClusterOverlaps([V.a1, V.a2, mid], { floor: 0.4 });
  for (let k = 1; k < out.length; k++) {
    assert.ok(out[k - 1].similarity >= out[k].similarity);
  }
  assert.equal(out[0].i, 0);
  assert.equal(out[0].j, 1);                    // strongest pair first
});

test("limit caps the number of returned pairs", () => {
  // 4 near-identical vectors → 6 pairs, all above floor; cap to 2
  const embs = [V.a1, V.a2, [0.99, 0.03, 0], [0.97, 0.05, 0]];
  const out = rankClusterOverlaps(embs, { floor: 0.5, limit: 2 });
  assert.equal(out.length, 2);
});

test("fewer than 2 clusters → no pairs", () => {
  assert.equal(rankClusterOverlaps([], {}).length, 0);
  assert.equal(rankClusterOverlaps([V.a1], {}).length, 0);
});

test("cosineSim basic sanity", () => {
  assert.ok(Math.abs(cosineSim([1, 0], [1, 0]) - 1) < 1e-9);
  assert.equal(cosineSim([1, 0], [0, 1]), 0);
});

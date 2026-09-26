import { test } from "node:test";
import assert from "node:assert/strict";
import { planNewClusterDedup, cosineSim } from "./clusterSuggestionDedup.js";

// Simple orthonormal-ish 3D vectors so cosine is easy to reason about.
const V = {
  community_a: [1, 0.02, 0],      // ~identical direction to community_b
  community_b: [0.98, 0.05, 0],
  community_c: [0.97, 0.08, 0.01],
  energy:      [0, 1, 0],         // orthogonal to community
  space:       [0, 0, 1],
};

const THRESH = 0.86;

test("cosineSim: identical vectors = 1, orthogonal = 0", () => {
  assert.ok(Math.abs(cosineSim([1, 0, 0], [1, 0, 0]) - 1) < 1e-9);
  assert.equal(cosineSim([1, 0, 0], [0, 1, 0]), 0);
});

test("collapses near-identical proposals into one survivor with merged inputs", () => {
  const { survivors, routes } = planNewClusterDedup(
    [V.community_a, V.community_b, V.energy],
    [["i1", "i2"], ["i2", "i3"], ["i9"]],
    [],            // no existing clusters
    THRESH,
  );
  assert.equal(routes.length, 0);
  // community_a + community_b collapse; energy stays separate → 2 survivors
  assert.equal(survivors.length, 2);
  const community = survivors.find((s) => s.index === 0 || s.index === 1);
  // survivor is index 0 or 1, inputs merged & deduped across both
  assert.deepEqual([...community.inputIds].sort(), ["i1", "i2", "i3"]);
  assert.ok(survivors.some((s) => s.index === 2)); // energy untouched
});

test("survivor is the proposal with the most inputs", () => {
  const { survivors } = planNewClusterDedup(
    [V.community_a, V.community_b],
    [["i1"], ["i1", "i2", "i3"]],   // proposal 1 is richer
    [],
    THRESH,
  );
  assert.equal(survivors.length, 1);
  assert.equal(survivors[0].index, 1);              // richer one wins
  assert.deepEqual([...survivors[0].inputIds].sort(), ["i1", "i2", "i3"]);
});

test("routes a proposal that duplicates an existing cluster to assignment", () => {
  const { survivors, routes } = planNewClusterDedup(
    [V.community_a, V.energy],
    [["i1", "i2"], ["i9"]],
    [V.community_c],                 // existing cluster ~identical to community_a
    THRESH,
  );
  // community_a routes to existing[0]; energy survives as a new cluster
  assert.equal(routes.length, 1);
  assert.equal(routes[0].index, 0);
  assert.equal(routes[0].existingIndex, 0);
  assert.deepEqual([...routes[0].inputIds].sort(), ["i1", "i2"]);
  assert.equal(survivors.length, 1);
  assert.equal(survivors[0].index, 1);
});

test("collapse then route: near-identical pair collapses, survivor routes to existing", () => {
  const { survivors, routes } = planNewClusterDedup(
    [V.community_a, V.community_b],
    [["i1"], ["i2"]],
    [V.community_c],
    THRESH,
  );
  assert.equal(survivors.length, 0);
  assert.equal(routes.length, 1);
  assert.deepEqual([...routes[0].inputIds].sort(), ["i1", "i2"]); // merged before routing
});

test("distinct proposals are left alone", () => {
  const { survivors, routes } = planNewClusterDedup(
    [V.community_a, V.energy, V.space],
    [["i1"], ["i2"], ["i3"]],
    [],
    THRESH,
  );
  assert.equal(routes.length, 0);
  assert.equal(survivors.length, 3);
});

test("empty proposals → empty plan", () => {
  const { survivors, routes } = planNewClusterDedup([], [], [V.community_a], THRESH);
  assert.equal(survivors.length, 0);
  assert.equal(routes.length, 0);
});

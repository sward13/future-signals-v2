import { test } from "node:test";
import assert from "node:assert/strict";
import { computeClusterMerge, repointRelationships } from "./clusterMerge.js";

const baseState = () => ({
  clusters: [
    { id: "A", name: "TARGET", subtype: "Trend", input_ids: ["i1"] },
    { id: "B", name: "SOURCE", subtype: "Tension", input_ids: ["i1", "i2"] },
    { id: "X", name: "X", input_ids: [] },
    { id: "Y", name: "Y", input_ids: [] },
    { id: "Z", name: "Z", input_ids: [] },
  ],
  scenarios: [
    { id: "S", cluster_ids: ["A", "B"] },
    { id: "S2", cluster_ids: ["X"] },
  ],
  relationships: [
    { id: "r1", fromClusterId: "B", toClusterId: "X", type: "Drives" }, // → A→X
    { id: "r2", fromClusterId: "Y", toClusterId: "B", type: "Drives" }, // → Y→A
    { id: "r3", fromClusterId: "B", toClusterId: "A", type: "Drives" }, // self-loop → dropped
    { id: "r4", fromClusterId: "A", toClusterId: "Z", type: "Drives" }, // existing
    { id: "r5", fromClusterId: "B", toClusterId: "Z", type: "Drives" }, // dup of A→Z → dropped
  ],
  canvasNodes: [
    { id: "n1", clusterId: "A" },
    { id: "n2", clusterId: "B" },
  ],
  connections: [{ id: "c1", clusterId: "B" }],
});

test("merges source into target: source removed, inputs unioned & deduped", () => {
  const out = computeClusterMerge(baseState(), "B", "A");
  assert.equal(out.merged, true);
  assert.equal(out.clusters.find((c) => c.id === "B"), undefined);
  const target = out.clusters.find((c) => c.id === "A");
  assert.deepEqual([...target.input_ids].sort(), ["i1", "i2"]);
  // target keeps its own identity (subtype), not the source's
  assert.equal(target.subtype, "Trend");
});

test("scenario cluster_ids repoint source→target and dedupe", () => {
  const out = computeClusterMerge(baseState(), "B", "A");
  assert.deepEqual(out.scenarios.find((s) => s.id === "S").cluster_ids, ["A"]);
  // untouched scenario unchanged
  assert.deepEqual(out.scenarios.find((s) => s.id === "S2").cluster_ids, ["X"]);
});

test("edges repoint, self-loops and duplicates dropped", () => {
  const out = computeClusterMerge(baseState(), "B", "A");
  const edges = out.relationships
    .map((r) => `${r.fromClusterId}->${r.toClusterId}`)
    .sort();
  assert.deepEqual(edges, ["A->X", "A->Z", "Y->A"]);
});

test("source canvas node dropped, target node kept", () => {
  const out = computeClusterMerge(baseState(), "B", "A");
  assert.deepEqual(out.canvasNodes.map((n) => n.clusterId).sort(), ["A"]);
});

test("connections repointed source→target", () => {
  const out = computeClusterMerge(baseState(), "B", "A");
  assert.equal(out.connections[0].clusterId, "A");
});

test("no-op when source or target missing, or equal", () => {
  const s = baseState();
  assert.equal(computeClusterMerge(s, "B", "nope").merged, false);
  assert.equal(computeClusterMerge(s, "nope", "A").merged, false);
  assert.equal(computeClusterMerge(s, "A", "A").merged, false);
});

test("edges not involving source pass through untouched", () => {
  const rels = [
    { id: "r1", fromClusterId: "X", toClusterId: "Y", type: "Drives" },
    { id: "r2", fromClusterId: "B", toClusterId: "X", type: "Blocks" },
  ];
  const out = repointRelationships(rels, "B", "A");
  assert.ok(out.find((r) => r.id === "r1" && r.fromClusterId === "X" && r.toClusterId === "Y"));
  assert.ok(out.find((r) => r.fromClusterId === "A" && r.toClusterId === "X" && r.type === "Blocks"));
});

test("edge dedupe is type-aware: same endpoints, different type is kept", () => {
  const rels = [
    { id: "r1", fromClusterId: "A", toClusterId: "X", type: "Drives" },
    { id: "r2", fromClusterId: "B", toClusterId: "X", type: "Blocks" }, // different type → kept
  ];
  const out = repointRelationships(rels, "B", "A");
  const keys = out.map((r) => `${r.fromClusterId}->${r.toClusterId}:${r.type}`).sort();
  assert.deepEqual(keys, ["A->X:Blocks", "A->X:Drives"]);
});

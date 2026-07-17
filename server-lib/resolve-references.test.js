import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DELETED_CLUSTER,
  buildClusterLookup,
  resolveClusterName,
  resolveRelationship,
  resolveDrivingForces,
  buildScenarioLookup,
  resolveScenarioRefs,
} from "./resolve-references.js";

// Fixtures ---------------------------------------------------------------------

const clusters = [
  { id: "c1", name: "AI regulation" },
  { id: "c2", name: "Insurance pricing models" },
  { id: "c3", name: "" }, // resolves but has no usable name
];

const scenarios = [
  { id: "s1", name: "Managed transition" },
  { id: "s2", name: "Fragmented markets" },
];

// buildClusterLookup ----------------------------------------------------------

test("buildClusterLookup maps ids to rows", () => {
  const lookup = buildClusterLookup(clusters);
  assert.equal(lookup.size, 3);
  assert.equal(lookup.get("c1").name, "AI regulation");
});

test("buildClusterLookup on empty array returns an empty Map", () => {
  const lookup = buildClusterLookup([]);
  assert.ok(lookup instanceof Map);
  assert.equal(lookup.size, 0);
});

test("buildClusterLookup tolerates non-array input", () => {
  assert.equal(buildClusterLookup(undefined).size, 0);
  assert.equal(buildClusterLookup(null).size, 0);
});

// resolveClusterName ----------------------------------------------------------

test("resolveClusterName resolves a known id", () => {
  const lookup = buildClusterLookup(clusters);
  assert.equal(resolveClusterName("c1", lookup), "AI regulation");
});

test("resolveClusterName falls back on a dangling id without throwing", () => {
  const lookup = buildClusterLookup(clusters);
  assert.equal(resolveClusterName("does-not-exist", lookup), DELETED_CLUSTER);
});

test("resolveClusterName falls back when the resolved row has no name", () => {
  const lookup = buildClusterLookup(clusters);
  assert.equal(resolveClusterName("c3", lookup), DELETED_CLUSTER);
});

// resolveRelationship ---------------------------------------------------------

test("resolveRelationship builds a natural sentence for a known type", () => {
  const lookup = buildClusterLookup(clusters);
  const result = resolveRelationship(
    { from_cluster_id: "c1", to_cluster_id: "c2", type: "Drives" },
    lookup,
  );
  assert.deepEqual(result, {
    fromName: "AI regulation",
    toName: "Insurance pricing models",
    type: "Drives",
    sentence: "AI regulation drives Insurance pricing models",
  });
});

test("resolveRelationship phrases Feedback Loop naturally", () => {
  const lookup = buildClusterLookup(clusters);
  const { sentence } = resolveRelationship(
    { from_cluster_id: "c1", to_cluster_id: "c2", type: "Feedback Loop" },
    lookup,
  );
  assert.equal(sentence, "AI regulation forms a feedback loop with Insurance pricing models");
});

test("resolveRelationship drops a custom/unknown type in verbatim", () => {
  const lookup = buildClusterLookup(clusters);
  const { sentence } = resolveRelationship(
    { from_cluster_id: "c1", to_cluster_id: "c2", type: "reshapes" },
    lookup,
  );
  assert.equal(sentence, "AI regulation reshapes Insurance pricing models");
});

test("resolveRelationship falls back on a dangling endpoint without throwing", () => {
  const lookup = buildClusterLookup(clusters);
  const result = resolveRelationship(
    { from_cluster_id: "c1", to_cluster_id: "missing", type: "Drives" },
    lookup,
  );
  assert.equal(result.toName, DELETED_CLUSTER);
  assert.equal(result.sentence, `AI regulation drives ${DELETED_CLUSTER}`);
});

test("resolveRelationship handles a missing type", () => {
  const lookup = buildClusterLookup(clusters);
  const { sentence } = resolveRelationship(
    { from_cluster_id: "c1", to_cluster_id: "c2" },
    lookup,
  );
  assert.equal(sentence, "AI regulation → Insurance pricing models");
});

// resolveDrivingForces --------------------------------------------------------

test("resolveDrivingForces resolves ids and skips dangling ones", () => {
  const lookup = buildClusterLookup(clusters);
  const names = resolveDrivingForces(
    { driving_forces: ["c1", "missing", "c2"] },
    lookup,
  );
  assert.deepEqual(names, ["AI regulation", "Insurance pricing models"]);
});

test("resolveDrivingForces returns [] for an empty or absent array", () => {
  const lookup = buildClusterLookup(clusters);
  assert.deepEqual(resolveDrivingForces({ driving_forces: [] }, lookup), []);
  assert.deepEqual(resolveDrivingForces({}, lookup), []);
  assert.deepEqual(resolveDrivingForces(undefined, lookup), []);
});

// buildScenarioLookup / resolveScenarioRefs -----------------------------------

test("buildScenarioLookup maps ids to rows", () => {
  const lookup = buildScenarioLookup(scenarios);
  assert.equal(lookup.get("s2").name, "Fragmented markets");
});

test("resolveScenarioRefs resolves titles and skips dangling ids", () => {
  const lookup = buildScenarioLookup(scenarios);
  const titles = resolveScenarioRefs(["s1", "gone", "s2"], lookup);
  assert.deepEqual(titles, ["Managed transition", "Fragmented markets"]);
});

test("resolveScenarioRefs returns [] for an empty or non-array input", () => {
  const lookup = buildScenarioLookup(scenarios);
  assert.deepEqual(resolveScenarioRefs([], lookup), []);
  assert.deepEqual(resolveScenarioRefs(undefined, lookup), []);
});

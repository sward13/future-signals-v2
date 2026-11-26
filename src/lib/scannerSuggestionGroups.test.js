import { test } from "node:test";
import assert from "node:assert/strict";

import {
  groupScannerSuggestions,
  suggestionClassification,
  MIN_INPUTS_FOR_GROUPING,
} from "./scannerSuggestionGroups.js";

const P = "proj-1";
const mk = (id, classification, projectId = P) => ({
  id,
  metadata: { suggested_projects: [{ id: projectId, classification }] },
});

test("suggestionClassification reads the active project's entry only", () => {
  const inp = { metadata: { suggested_projects: [{ id: "other", classification: "emerging" }, { id: P, classification: "reinforcing" }] } };
  assert.equal(suggestionClassification(inp, P), "reinforcing");
  assert.equal(suggestionClassification(inp, "missing"), undefined);
  assert.equal(suggestionClassification({}, P), undefined);
});

test("below the threshold: one ungrouped list, order preserved", () => {
  const list = [mk("a", "reinforcing"), mk("b", "emerging"), mk("c", "reinforcing")];
  const g = groupScannerSuggestions(list, P, MIN_INPUTS_FOR_GROUPING - 1);
  assert.equal(g.grouped, false);
  assert.deepEqual(g.other.map((i) => i.id), ["a", "b", "c"]);
  assert.deepEqual(g.emerging, []);
  assert.deepEqual(g.reinforcing, []);
});

test("zero / missing input count is treated as below the threshold", () => {
  assert.equal(groupScannerSuggestions([mk("a", "emerging")], P, 0).grouped, false);
  assert.equal(groupScannerSuggestions([mk("a", "emerging")], P, undefined).grouped, false);
});

test("at the threshold: grouped by classification", () => {
  const list = [mk("a", "reinforcing"), mk("b", "emerging"), mk("c", "reinforcing")];
  const g = groupScannerSuggestions(list, P, MIN_INPUTS_FOR_GROUPING);
  assert.equal(g.grouped, true);
  assert.deepEqual(g.emerging.map((i) => i.id), ["b"]);
  assert.deepEqual(g.reinforcing.map((i) => i.id), ["a", "c"]);
  assert.deepEqual(g.other, []);
});

test("grouped: unclassified suggestions land in `other` instead of being dropped", () => {
  // The old render path only showed unclassified rows when BOTH groups were
  // empty, so a mix silently hid them.
  const list = [mk("a", "emerging"), mk("b", undefined), mk("c", "noise"), mk("d", "reinforcing", "another-project")];
  const g = groupScannerSuggestions(list, P, 10);
  assert.deepEqual(g.emerging.map((i) => i.id), ["a"]);
  assert.deepEqual(g.other.map((i) => i.id), ["b", "c", "d"]);
});

test("handles a null list", () => {
  assert.deepEqual(groupScannerSuggestions(null, P, 10), { grouped: true, emerging: [], reinforcing: [], other: [] });
});

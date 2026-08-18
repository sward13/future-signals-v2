import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ROLE_LABELS,
  otherRoleOf,
  addClusterId,
  removeClusterId,
  needsCrossRoleConfirm,
  getOtherRoleTag,
  decideSelectAction,
  buildConfirmationMessage,
  filterClusterOptions,
  getEmptyStateReason,
  getNextActiveId,
  INITIAL_PICKER_STATE,
  pickerPanelReducer,
} from "./clusterForcePicker.js";

const clusters = [
  { id: "c1", name: "AI regulation", subtype: "Driver", horizon: "H1", likelihood: "Probable" },
  { id: "c2", name: "Insurance pricing models", subtype: "Trend", horizon: "H2", likelihood: "Plausible" },
  { id: "c3", name: "Climate migration", subtype: "Tension", horizon: null, likelihood: null },
];

// ─── Role helpers ────────────────────────────────────────────────────────────

test("otherRoleOf flips driving/suppressed", () => {
  assert.equal(otherRoleOf("driving"), "suppressed");
  assert.equal(otherRoleOf("suppressed"), "driving");
});

test("ROLE_LABELS has the expected display strings", () => {
  assert.deepEqual(ROLE_LABELS, { driving: "Driving", suppressed: "Suppressed" });
});

// ─── addClusterId / removeClusterId ──────────────────────────────────────────

test("addClusterId appends when absent", () => {
  assert.deepEqual(addClusterId(["c1"], "c2"), ["c1", "c2"]);
});

test("addClusterId is idempotent when already present", () => {
  assert.deepEqual(addClusterId(["c1", "c2"], "c1"), ["c1", "c2"]);
});

test("addClusterId tolerates a non-array selected list", () => {
  assert.deepEqual(addClusterId(undefined, "c1"), ["c1"]);
});

test("removeClusterId drops the id", () => {
  assert.deepEqual(removeClusterId(["c1", "c2"], "c1"), ["c2"]);
});

test("removeClusterId is a no-op when the id isn't present", () => {
  assert.deepEqual(removeClusterId(["c1"], "ghost"), ["c1"]);
});

// ─── Cross-role awareness ────────────────────────────────────────────────────

test("needsCrossRoleConfirm is true when the cluster is in the other field", () => {
  assert.equal(needsCrossRoleConfirm("c1", ["c1", "c2"]), true);
});

test("needsCrossRoleConfirm is false when it isn't", () => {
  assert.equal(needsCrossRoleConfirm("c3", ["c1", "c2"]), false);
});

test("needsCrossRoleConfirm tolerates a non-array otherSelected", () => {
  assert.equal(needsCrossRoleConfirm("c1", undefined), false);
});

test("getOtherRoleTag returns the other role's label when dual-assigned", () => {
  assert.equal(getOtherRoleTag("c1", ["c1"], "Driving"), "Driving");
});

test("getOtherRoleTag returns null when not dual-assigned", () => {
  assert.equal(getOtherRoleTag("c3", ["c1"], "Driving"), null);
});

test("decideSelectAction requires confirmation only when dual-assigning", () => {
  assert.equal(decideSelectAction("c1", ["c1"]), "confirm");
  assert.equal(decideSelectAction("c3", ["c1"]), "commit");
});

test("buildConfirmationMessage matches the exact copy from the spec", () => {
  assert.equal(
    buildConfirmationMessage("Driving", "Suppressed"),
    "Already added as Driving. Add as Suppressed too?"
  );
});

// ─── filterClusterOptions ─────────────────────────────────────────────────────

test("filterClusterOptions excludes already-selected clusters", () => {
  const opts = filterClusterOptions(clusters, { selected: ["c1"] });
  assert.deepEqual(opts.map((c) => c.id), ["c2", "c3"]);
});

test("filterClusterOptions matches search query case-insensitively against name", () => {
  const opts = filterClusterOptions(clusters, { query: "insurance" });
  assert.deepEqual(opts.map((c) => c.id), ["c2"]);
});

test("filterClusterOptions applies single-select facet filters (exact match)", () => {
  const opts = filterClusterOptions(clusters, { filters: { subtype: "Tension" } });
  assert.deepEqual(opts.map((c) => c.id), ["c3"]);
});

test("filterClusterOptions excludes null-valued clusters when a facet filter is active", () => {
  // c3 has horizon: null — filtering to H1 must not match it.
  const opts = filterClusterOptions(clusters, { filters: { horizon: "H1" } });
  assert.deepEqual(opts.map((c) => c.id), ["c1"]);
});

test("filterClusterOptions with no filters/query/selected returns all clusters in master-list order", () => {
  const opts = filterClusterOptions(clusters, {});
  assert.deepEqual(opts.map((c) => c.id), ["c1", "c2", "c3"]);
});

test("filterClusterOptions combines search and facet filters", () => {
  const opts = filterClusterOptions(clusters, { query: "climate", filters: { subtype: "Tension" } });
  assert.deepEqual(opts.map((c) => c.id), ["c3"]);
  assert.deepEqual(
    filterClusterOptions(clusters, { query: "climate", filters: { subtype: "Trend" } }),
    []
  );
});

test("filterClusterOptions tolerates non-array clusters", () => {
  assert.deepEqual(filterClusterOptions(undefined, {}), []);
});

// ─── getEmptyStateReason ──────────────────────────────────────────────────────

test("getEmptyStateReason: no clusters in the project at all", () => {
  assert.equal(getEmptyStateReason({ totalClusters: 0, selectedCount: 0, optionsCount: 0 }), "no-clusters");
});

test("getEmptyStateReason: every cluster already assigned to this field", () => {
  assert.equal(getEmptyStateReason({ totalClusters: 2, selectedCount: 2, optionsCount: 0 }), "all-assigned");
});

test("getEmptyStateReason: clusters remain but search/filters exclude them all", () => {
  assert.equal(getEmptyStateReason({ totalClusters: 3, selectedCount: 1, optionsCount: 0 }), "no-matches");
});

test("getEmptyStateReason: null when there are options to show", () => {
  assert.equal(getEmptyStateReason({ totalClusters: 3, selectedCount: 1, optionsCount: 2 }), null);
});

// ─── getNextActiveId ──────────────────────────────────────────────────────────

test("getNextActiveId moves forward and wraps around", () => {
  const ids = ["a", "b", "c"];
  assert.equal(getNextActiveId(ids, "a", 1), "b");
  assert.equal(getNextActiveId(ids, "c", 1), "a");
});

test("getNextActiveId moves backward and wraps around", () => {
  const ids = ["a", "b", "c"];
  assert.equal(getNextActiveId(ids, "a", -1), "c");
  assert.equal(getNextActiveId(ids, "b", -1), "a");
});

test("getNextActiveId starts at the first/last option when nothing is active yet", () => {
  const ids = ["a", "b", "c"];
  assert.equal(getNextActiveId(ids, null, 1), "a");
  assert.equal(getNextActiveId(ids, null, -1), "c");
});

test("getNextActiveId returns null for an empty option list", () => {
  assert.equal(getNextActiveId([], "a", 1), null);
});

// ─── pickerPanelReducer ───────────────────────────────────────────────────────

test("pickerPanelReducer OPEN sets isOpen without touching other state", () => {
  const state = pickerPanelReducer(INITIAL_PICKER_STATE, { type: "OPEN" });
  assert.equal(state.isOpen, true);
  assert.equal(state.query, "");
});

test("pickerPanelReducer CLOSE resets to initial state (no stale query/filters/confirm)", () => {
  const dirty = {
    isOpen: true,
    query: "insurance",
    filters: { subtype: "Trend", horizon: null, likelihood: null },
    activeId: "c2",
    pendingConfirmId: "c2",
  };
  assert.deepEqual(pickerPanelReducer(dirty, { type: "CLOSE" }), INITIAL_PICKER_STATE);
});

test("pickerPanelReducer SET_QUERY updates query and clears active/confirm", () => {
  const state = pickerPanelReducer(
    { ...INITIAL_PICKER_STATE, activeId: "c1", pendingConfirmId: "c1" },
    { type: "SET_QUERY", query: "ai" }
  );
  assert.equal(state.query, "ai");
  assert.equal(state.activeId, null);
  assert.equal(state.pendingConfirmId, null);
});

test("pickerPanelReducer SET_FILTER sets one facet without disturbing the others", () => {
  const state = pickerPanelReducer(INITIAL_PICKER_STATE, {
    type: "SET_FILTER", facet: "horizon", value: "H1",
  });
  assert.deepEqual(state.filters, { subtype: null, horizon: "H1", likelihood: null });
});

test("pickerPanelReducer CLEAR_FILTER nulls one facet", () => {
  const withFilter = pickerPanelReducer(INITIAL_PICKER_STATE, {
    type: "SET_FILTER", facet: "horizon", value: "H1",
  });
  const cleared = pickerPanelReducer(withFilter, { type: "CLEAR_FILTER", facet: "horizon" });
  assert.deepEqual(cleared.filters, { subtype: null, horizon: null, likelihood: null });
});

test("pickerPanelReducer SET_ACTIVE moves the keyboard-active option", () => {
  const state = pickerPanelReducer(INITIAL_PICKER_STATE, { type: "SET_ACTIVE", id: "c2" });
  assert.equal(state.activeId, "c2");
});

test("pickerPanelReducer SET_ACTIVE cancels a pending confirmation on a different row when moving away", () => {
  const confirming = pickerPanelReducer(
    { ...INITIAL_PICKER_STATE, activeId: "c1" },
    { type: "REQUEST_CONFIRM", id: "c1" }
  );
  const movedAway = pickerPanelReducer(confirming, { type: "SET_ACTIVE", id: "c2" });
  assert.equal(movedAway.activeId, "c2");
  assert.equal(movedAway.pendingConfirmId, null);
});

test("pickerPanelReducer SET_ACTIVE keeps the pending confirmation when re-targeting the same row", () => {
  const confirming = pickerPanelReducer(
    { ...INITIAL_PICKER_STATE, activeId: "c1" },
    { type: "REQUEST_CONFIRM", id: "c1" }
  );
  const same = pickerPanelReducer(confirming, { type: "SET_ACTIVE", id: "c1" });
  assert.equal(same.pendingConfirmId, "c1");
});

test("pickerPanelReducer REQUEST_CONFIRM / CANCEL_CONFIRM toggle pendingConfirmId", () => {
  const requested = pickerPanelReducer(INITIAL_PICKER_STATE, { type: "REQUEST_CONFIRM", id: "c1" });
  assert.equal(requested.pendingConfirmId, "c1");
  const cancelled = pickerPanelReducer(requested, { type: "CANCEL_CONFIRM" });
  assert.equal(cancelled.pendingConfirmId, null);
});

test("pickerPanelReducer ignores unknown action types", () => {
  const state = pickerPanelReducer(INITIAL_PICKER_STATE, { type: "NOT_A_REAL_ACTION" });
  assert.equal(state, INITIAL_PICKER_STATE);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSelection,
  pickerStateFromSelection,
  selectionFromPickerState,
  visibleSubtypes,
} from "./selectionModel.js";

const available = {
  scenarios: [{ id: "s1", name: "S1" }, { id: "s2", name: "S2" }],
  preferredFutures: [{ id: "pf1", name: "PF1" }],
  strategicOptions: [], // zero items
};

// ─── Pre-populating the picker ──────────────────────────────────────────────────

test("pickerStateFromSelection(null) pre-populates everything checked", () => {
  const s = pickerStateFromSelection(null, available);
  assert.equal(s.systemMap, true);
  assert.equal(s.systemAnalysis, true);
  assert.equal(s.futureModels, true);
  assert.deepEqual(s.scenarios, { enabled: true, selectedIds: ["s1", "s2"] });
  assert.deepEqual(s.preferredFutures, { enabled: true, selectedIds: ["pf1"] });
  assert.deepEqual(s.strategicOptions, { enabled: true, selectedIds: [] });
});

test("pickerStateFromSelection respects exactly which IDs were previously chosen", () => {
  const selection = {
    systemMap: true,
    systemAnalysis: false,
    futureModels: {
      enabled: true,
      scenarios: { enabled: true, ids: ["s2"] }, // only s2, not s1
      preferredFutures: { enabled: false },
      strategicOptions: { enabled: false },
    },
  };
  const s = pickerStateFromSelection(selection, available);
  assert.equal(s.systemMap, true);
  assert.equal(s.systemAnalysis, false);
  assert.equal(s.futureModels, true);
  assert.deepEqual(s.scenarios, { enabled: true, selectedIds: ["s2"] }); // specific id, not "group on"
  assert.equal(s.preferredFutures.enabled, false);
});

// ─── Zero-item sub-types are hidden ─────────────────────────────────────────────

test("visibleSubtypes hides a sub-type the project has zero items of", () => {
  const keys = visibleSubtypes(available).map((m) => m.key);
  assert.deepEqual(keys, ["scenarios", "preferredFutures"]); // strategicOptions (0 items) excluded
});

// ─── Constructing the payload (matches normalizeSelection shape) ─────────────────

test("selectionFromPickerState: all items checked collapses to ids:null; matches normalizeSelection", () => {
  const state = {
    systemMap: true,
    systemAnalysis: false,
    futureModels: true,
    scenarios: { enabled: true, selectedIds: ["s1", "s2"] }, // all → null
    preferredFutures: { enabled: true, selectedIds: ["pf1"] }, // all → null
    strategicOptions: { enabled: false, selectedIds: [] },
  };
  const payload = selectionFromPickerState(state, available);
  assert.deepEqual(payload, {
    version: 1,
    overview: true,
    systemMap: true,
    systemAnalysis: false,
    futureModels: {
      enabled: true,
      scenarios: { enabled: true, ids: null },
      preferredFutures: { enabled: true, ids: null },
      strategicOptions: { enabled: false, ids: null },
    },
    appendix: true,
  });
  // already canonical — normalizing it is a no-op
  assert.deepEqual(normalizeSelection(payload), payload);
});

test("selectionFromPickerState: a strict subset keeps the explicit id list", () => {
  const state = {
    systemMap: false,
    systemAnalysis: false,
    futureModels: true,
    scenarios: { enabled: true, selectedIds: ["s1"] }, // subset of s1,s2
    preferredFutures: { enabled: false, selectedIds: [] },
    strategicOptions: { enabled: false, selectedIds: [] },
  };
  const payload = selectionFromPickerState(state, available);
  assert.deepEqual(payload.futureModels.scenarios, { enabled: true, ids: ["s1"] });
});

test("picker → payload round-trips to the same normalized selection", () => {
  const selection = {
    systemMap: false,
    systemAnalysis: true,
    futureModels: {
      enabled: true,
      scenarios: { enabled: true, ids: ["s1"] },
      preferredFutures: { enabled: false },
      strategicOptions: { enabled: false },
    },
  };
  const state = pickerStateFromSelection(selection, available);
  const back = selectionFromPickerState(state, available);
  assert.deepEqual(back, normalizeSelection(selection));
});

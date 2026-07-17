// Shared, pure model for the Publish section selection. Single source of truth
// for the selection shape — imported by both the pipeline (server-lib/
// publish-project.js) and the section-picker UI. No React, no I/O, so it's fully
// unit-testable.
//
// Canonical selection (persisted to sections_included, round-trips GET→picker→
// republish). Overview + Appendix are never optional. For each Future Models
// sub-type, `ids: null` means "all of that type"; an array means exactly those.

const ALL_SELECTION = {
  version: 1,
  overview: true,
  systemMap: true,
  systemAnalysis: true,
  futureModels: {
    enabled: true,
    scenarios: { enabled: true, ids: null },
    preferredFutures: { enabled: true, ids: null },
    strategicOptions: { enabled: true, ids: null },
  },
  appendix: true,
};

function normalizeSubType(x) {
  const s = x || {};
  return { enabled: !!s.enabled, ids: Array.isArray(s.ids) ? [...s.ids] : null };
}

/**
 * Normalize a caller-supplied selection into the canonical stored shape.
 * `null`/`undefined` → include everything (the one-click whole-project path).
 * Idempotent, so the stored value round-trips unchanged.
 */
export function normalizeSelection(selection) {
  if (selection == null) return structuredClone(ALL_SELECTION);
  const fm = selection.futureModels || {};
  return {
    version: 1,
    overview: true,
    systemMap: !!selection.systemMap,
    systemAnalysis: !!selection.systemAnalysis,
    futureModels: {
      enabled: !!fm.enabled,
      scenarios: normalizeSubType(fm.scenarios),
      preferredFutures: normalizeSubType(fm.preferredFutures),
      strategicOptions: normalizeSubType(fm.strategicOptions),
    },
    appendix: true,
  };
}

// ─── Picker (UI) helpers ────────────────────────────────────────────────────────

// The three Future Models sub-types, in reading order. `key` matches the
// selection shape and the app-state array names.
export const FM_SUBTYPES = [
  { key: "scenarios", label: "Scenarios" },
  { key: "preferredFutures", label: "Preferred Futures" },
  { key: "strategicOptions", label: "Strategic Options" },
];

/** Sub-types the project actually has items for — the picker hides the rest. */
export function visibleSubtypes(available) {
  const a = available || {};
  return FM_SUBTYPES.filter((m) => (a[m.key] || []).length > 0);
}

/**
 * Build the picker's initial checkbox state from an existing selection (or null
 * for a never-published project → everything). `available` is
 * { scenarios, preferredFutures, strategicOptions } of {id,...} items already
 * loaded in the app. Respects exactly which specific IDs were previously chosen.
 */
export function pickerStateFromSelection(selection, available) {
  const norm = normalizeSelection(selection);
  const a = available || {};
  const sub = (s, items) => {
    const allIds = (items || []).map((i) => i.id);
    const selectedIds = s.ids == null ? [...allIds] : allIds.filter((id) => s.ids.includes(id));
    return { enabled: s.enabled, selectedIds };
  };
  return {
    systemMap: norm.systemMap,
    systemAnalysis: norm.systemAnalysis,
    futureModels: norm.futureModels.enabled,
    scenarios: sub(norm.futureModels.scenarios, a.scenarios),
    preferredFutures: sub(norm.futureModels.preferredFutures, a.preferredFutures),
    strategicOptions: sub(norm.futureModels.strategicOptions, a.strategicOptions),
  };
}

/**
 * Build the canonical selection payload from picker state. A sub-type with every
 * available item checked collapses to `ids: null` (= all, future-proof); a strict
 * subset keeps the explicit id list. Matches normalizeSelection's shape exactly.
 */
export function selectionFromPickerState(state, available) {
  const a = available || {};
  const sub = (picker, items) => {
    if (!picker || !picker.enabled) return { enabled: false, ids: null };
    const allIds = (items || []).map((i) => i.id);
    const chosen = allIds.filter((id) => picker.selectedIds.includes(id));
    return { enabled: true, ids: chosen.length === allIds.length ? null : chosen };
  };
  return {
    version: 1,
    overview: true,
    systemMap: !!state.systemMap,
    systemAnalysis: !!state.systemAnalysis,
    futureModels: {
      enabled: !!state.futureModels,
      scenarios: sub(state.scenarios, a.scenarios),
      preferredFutures: sub(state.preferredFutures, a.preferredFutures),
      strategicOptions: sub(state.strategicOptions, a.strategicOptions),
    },
    appendix: true,
  };
}

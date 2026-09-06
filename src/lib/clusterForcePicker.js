// Pure logic for ClusterForcePicker (Scenario builder's Driving/Suppressed
// forces fields). No React, no DOM — the component wires this to state/effects.
//
// Cross-role model: a cluster may be assigned to both `driving` and
// `suppressed` on the same scenario. Each field only ever writes its own
// jsonb array (scenarios.driving_forces / scenarios.suppressed_forces); the
// "other field's" selection is passed in for awareness only, never mutated
// from here.

export const ROLE_LABELS = { driving: "Driving", suppressed: "Suppressed" };

/** @param {"driving"|"suppressed"} role */
export function otherRoleOf(role) {
  return role === "driving" ? "suppressed" : "driving";
}

// ─── Selection list helpers (idempotent) ────────────────────────────────────

/** Append id if not already present. Returns a new array either way. */
export function addClusterId(selected, id) {
  const list = Array.isArray(selected) ? selected : [];
  return list.includes(id) ? list : [...list, id];
}

/** Remove id if present. Returns a new array either way. */
export function removeClusterId(selected, id) {
  const list = Array.isArray(selected) ? selected : [];
  return list.filter((x) => x !== id);
}

// ─── Cross-role awareness ────────────────────────────────────────────────────

/** Is `clusterId` already assigned to the OTHER role's selection? */
export function needsCrossRoleConfirm(clusterId, otherSelected) {
  const list = Array.isArray(otherSelected) ? otherSelected : [];
  return list.includes(clusterId);
}

/**
 * The tag to render on an option row or chip for a cluster that is also
 * assigned to the other role — or null if it isn't.
 */
export function getOtherRoleTag(clusterId, otherSelected, otherRoleLabel) {
  return needsCrossRoleConfirm(clusterId, otherSelected) ? otherRoleLabel : null;
}

/** Clicking/selecting a cluster either commits immediately or must be confirmed first. */
export function decideSelectAction(clusterId, otherSelected) {
  return needsCrossRoleConfirm(clusterId, otherSelected) ? "confirm" : "commit";
}

export function buildConfirmationMessage(otherRoleLabel, thisRoleLabel) {
  return `Already added as ${otherRoleLabel}. Add as ${thisRoleLabel} too?`;
}

// ─── Filtering / search ──────────────────────────────────────────────────────

/**
 * Options available to add in this field: clusters not yet selected here,
 * matching the search query (name substring, case-insensitive) and every
 * active single-select facet filter (exact match). Preserves master-list
 * (`clusters` prop) order — matches today's ChipMultiSelect behavior.
 *
 * A facet filter set to a named value (e.g. horizon: "H1") excludes clusters
 * with a null value for that field, since null never equals a named value —
 * this is intentional, not a bug to special-case.
 *
 * @param {Array<object>} clusters
 * @param {{ selected?: string[], query?: string, filters?: { subtype?: string|null, horizon?: string|null, likelihood?: string|null } }} opts
 */
export function filterClusterOptions(clusters, opts = {}) {
  const list = Array.isArray(clusters) ? clusters : [];
  const selected = new Set(Array.isArray(opts.selected) ? opts.selected : []);
  const query = (opts.query || "").trim().toLowerCase();
  const filters = opts.filters || {};

  return list.filter((cl) => {
    if (!cl || selected.has(cl.id)) return false;
    if (query && !(cl.name || "").toLowerCase().includes(query)) return false;
    if (filters.subtype && cl.subtype !== filters.subtype) return false;
    if (filters.horizon && cl.horizon !== filters.horizon) return false;
    if (filters.likelihood && cl.likelihood !== filters.likelihood) return false;
    return true;
  });
}

// ─── Empty states ────────────────────────────────────────────────────────────

/**
 * Which empty-state copy applies, or null if there are options to show.
 * - "no-clusters": the project has zero clusters at all.
 * - "all-assigned": every cluster in the project is already selected in this field.
 * - "no-matches": search/filters exclude everything that's left.
 */
export function getEmptyStateReason({ totalClusters, selectedCount, optionsCount }) {
  if (totalClusters === 0) return "no-clusters";
  if (selectedCount >= totalClusters) return "all-assigned";
  if (optionsCount === 0) return "no-matches";
  return null;
}

// ─── Keyboard navigation ─────────────────────────────────────────────────────

/**
 * Next active option id when moving `direction` (1 = down, -1 = up) through
 * `optionIds`, wrapping around. Returns null if there are no options.
 */
export function getNextActiveId(optionIds, currentActiveId, direction) {
  if (!Array.isArray(optionIds) || optionIds.length === 0) return null;
  const idx = optionIds.indexOf(currentActiveId);
  if (idx === -1) return direction > 0 ? optionIds[0] : optionIds[optionIds.length - 1];
  const next = (idx + direction + optionIds.length) % optionIds.length;
  return optionIds[next];
}

// ─── Panel state reducer ─────────────────────────────────────────────────────
// Drives the floating panel's open/closed state, search text, facet filters,
// keyboard-active option, and any in-progress cross-role confirmation.

export const INITIAL_PICKER_STATE = {
  isOpen: false,
  query: "",
  filters: { subtype: null, horizon: null, likelihood: null },
  activeId: null,
  pendingConfirmId: null,
};

export function pickerPanelReducer(state, action) {
  switch (action.type) {
    case "OPEN":
      return { ...state, isOpen: true };
    case "CLOSE":
      // Reopening starts fresh — no stale search/filter/confirmation state.
      return { ...INITIAL_PICKER_STATE };
    case "SET_QUERY":
      return { ...state, query: action.query, activeId: null, pendingConfirmId: null };
    case "SET_FILTER":
      return {
        ...state,
        filters: { ...state.filters, [action.facet]: action.value },
        activeId: null,
        pendingConfirmId: null,
      };
    case "CLEAR_FILTER":
      return {
        ...state,
        filters: { ...state.filters, [action.facet]: null },
        activeId: null,
        pendingConfirmId: null,
      };
    case "SET_ACTIVE":
      // Moving keyboard focus off the row that has an open cross-role
      // confirmation implicitly cancels it — only one row's confirmation is
      // ever visible at a time, so it can't be left open on a stale row.
      return {
        ...state,
        activeId: action.id,
        pendingConfirmId: state.pendingConfirmId === action.id ? state.pendingConfirmId : null,
      };
    case "REQUEST_CONFIRM":
      return { ...state, pendingConfirmId: action.id };
    case "CANCEL_CONFIRM":
      return { ...state, pendingConfirmId: null };
    default:
      return state;
  }
}

/**
 * ClusterForcePicker — searchable token/combobox picker for a scenario's
 * Driving forces / Suppressed forces fields. Replaces the old ChipMultiSelect
 * (full checklist + separate chip row showing the same selection twice).
 *
 * A cluster can be assigned to BOTH roles on the same scenario — this field
 * only ever writes its own selection array; `otherSelected` is passed in for
 * cross-role awareness only, never mutated here. See src/lib/clusterForcePicker.js
 * for the pure filtering/selection/confirmation logic this wires up.
 *
 * Floating-panel positioning (flip-to-open-upward + portal + high z-index)
 * follows ClusterAssignMenu.jsx's pattern. Unlike that component's button
 * anchor, this field's anchor is a live search input the user keeps typing
 * into, so a full-viewport click-catcher overlay would block re-clicking the
 * input itself — outside-click detection here uses a document `mousedown`
 * listener scoped to the field + panel refs instead.
 */
import { useEffect, useId, useReducer, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { c, fl, fh, btnG } from "../../styles/tokens.js";
import { FilterDropdown } from "./FilterDropdown.jsx";
import { SubtypeTag, HorizTag, LikelihoodTag } from "./Tag.jsx";
import {
  ROLE_LABELS,
  otherRoleOf,
  addClusterId,
  removeClusterId,
  getOtherRoleTag,
  decideSelectAction,
  buildConfirmationMessage,
  filterClusterOptions,
  getEmptyStateReason,
  getNextActiveId,
  INITIAL_PICKER_STATE,
  pickerPanelReducer,
} from "../../lib/clusterForcePicker.js";

const PANEL_MAX_HEIGHT = 320;
const PANEL_WIDTH = 360;

const ROLE_ACCENT = {
  driving: { dot: c.green700, border: c.greenBorder },
  suppressed: { dot: c.cyan700, border: c.cyanBorder },
};

const TYPE_OPTIONS = ["Trend", "Driver", "Tension"].map((v) => ({ value: v, label: v }));
const HORIZON_OPTIONS = ["H1", "H2", "H3"].map((v) => ({ value: v, label: v }));
const LIKELIHOOD_OPTIONS = ["Probable", "Plausible", "Possible"].map((v) => ({ value: v, label: v }));

// ─── Small display helpers ───────────────────────────────────────────────────

function NoValuePill({ label }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 7px", borderRadius: 10,
      background: "transparent", color: c.hint,
      border: `1px dashed ${c.border}`, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function ClusterFieldPills({ cl }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {cl.subtype ? <SubtypeTag sub={cl.subtype} /> : <NoValuePill label="No type" />}
      {cl.horizon ? <HorizTag h={cl.horizon} /> : <NoValuePill label="No horizon" />}
      {cl.likelihood ? <LikelihoodTag l={cl.likelihood} /> : <NoValuePill label="No likelihood" />}
    </span>
  );
}

function OtherRoleTag({ label }) {
  if (!label) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 500, padding: "1px 6px", borderRadius: 8,
      background: c.surfaceAlt, color: c.hint, border: `1px solid ${c.border}`,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

/** A single filter-facet pill, matching ClustersPanel's Type/Horizon/Likelihood
 *  filters exactly (FilterDropdown, single-select). Owns its own open/closed
 *  state — independent of the picker's search/selection reducer. */
function FilterFacet({ label, value, options, onChange, onClear }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <FilterDropdown
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      onClear={onClear}
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
      menuWidth={130}
    />
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * @param {{
 *   role: "driving" | "suppressed",
 *   label: string,
 *   hint?: string,
 *   clusters: Array<object>,      // project clusters, master-list order
 *   selected: string[],           // this field's cluster ids
 *   otherSelected: string[],      // the OTHER field's cluster ids (awareness only)
 *   onChange: (next: string[]) => void,
 *   onGoToClusters?: () => void,  // optional CTA when the project has zero clusters
 * }} props
 */
export function ClusterForcePicker({
  role, label, hint, clusters, selected, otherSelected, onChange, onGoToClusters,
}) {
  const uid = useId();
  const listboxId = `${uid}-listbox`;
  const optionDomId = (id) => `${uid}-option-${id}`;

  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const [state, dispatch] = useReducer(pickerPanelReducer, INITIAL_PICKER_STATE);
  // Measured at the moment the panel opens (inside an event handler, not
  // during render — refs can't be read at render time) and held in state,
  // mirroring ClusterAssignMenu's caller-supplied anchorRect.
  const [anchorRect, setAnchorRect] = useState(null);
  const openPanel = () => {
    setAnchorRect(containerRef.current?.getBoundingClientRect() ?? null);
    dispatch({ type: "OPEN" });
  };

  const thisRoleLabel = ROLE_LABELS[role];
  const otherRoleLabel = ROLE_LABELS[otherRoleOf(role)];
  const accent = ROLE_ACCENT[role];

  const options = filterClusterOptions(clusters, {
    selected, query: state.query, filters: state.filters,
  });
  const optionIds = options.map((cl) => cl.id);
  const emptyReason = getEmptyStateReason({
    totalClusters: (clusters || []).length,
    selectedCount: selected.length,
    optionsCount: options.length,
  });

  // Outside-click detection: a document listener rather than a full-viewport
  // overlay, since the anchor is a live text input the user re-clicks/types
  // into (an overlay would sit on top of it and swallow that interaction).
  useEffect(() => {
    if (!state.isOpen) return undefined;
    function handlePointerDown(e) {
      const insideField = containerRef.current?.contains(e.target);
      const insidePanel = panelRef.current?.contains(e.target);
      if (!insideField && !insidePanel) dispatch({ type: "CLOSE" });
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [state.isOpen]);

  const commit = (id) => {
    onChange(addClusterId(selected, id));
    dispatch({ type: "SET_QUERY", query: "" }); // resets query/active/pendingConfirm, stays open
  };

  const activateOption = (id) => {
    if (state.pendingConfirmId === id) { commit(id); return; }
    if (decideSelectAction(id, otherSelected) === "commit") {
      commit(id);
    } else {
      dispatch({ type: "SET_ACTIVE", id });
      dispatch({ type: "REQUEST_CONFIRM", id });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!state.isOpen) { openPanel(); return; }
      dispatch({ type: "SET_ACTIVE", id: getNextActiveId(optionIds, state.activeId, 1) });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!state.isOpen) { openPanel(); return; }
      dispatch({ type: "SET_ACTIVE", id: getNextActiveId(optionIds, state.activeId, -1) });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (state.activeId) activateOption(state.activeId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (state.pendingConfirmId) dispatch({ type: "CANCEL_CONFIRM" });
      else if (state.isOpen) { dispatch({ type: "CLOSE" }); inputRef.current?.blur(); }
    }
  };

  const openUp = anchorRect ? window.innerHeight - anchorRect.bottom < PANEL_MAX_HEIGHT + 48 : false;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={fl}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent.dot, flexShrink: 0 }} />
        {label}
      </div>
      {hint && <div style={fh}>{hint}</div>}

      <div
        ref={containerRef}
        onClick={() => inputRef.current?.focus()}
        style={{
          display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center",
          minHeight: 40, padding: "6px 8px", cursor: "text",
          border: `1px solid ${state.isOpen ? accent.border : c.borderStrong}`,
          borderRadius: 8, background: c.white,
        }}
      >
        {selected.map((id) => {
          const cl = clusters.find((x) => x.id === id);
          const otherTag = getOtherRoleTag(id, otherSelected, otherRoleLabel);
          return (
            <span key={id} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, background: c.surfaceAlt, color: c.ink,
              border: `1px solid ${c.border}`, borderRadius: 5, padding: "3px 8px",
            }}>
              {cl?.name || id}
              <OtherRoleTag label={otherTag} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(removeClusterId(selected, id)); }}
                aria-label={`Remove ${cl?.name || id} from ${thisRoleLabel.toLowerCase()} forces`}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: c.hint, fontSize: 13, lineHeight: 1, padding: 0,
                }}
              >
                ×
              </button>
            </span>
          );
        })}

        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={state.isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={state.activeId ? optionDomId(state.activeId) : undefined}
          value={state.query}
          onFocus={openPanel}
          onChange={(e) => dispatch({ type: "SET_QUERY", query: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? "Search clusters…" : "Add another…"}
          style={{
            flex: 1, minWidth: 90, border: "none", outline: "none",
            background: "transparent", fontSize: 12, fontFamily: "inherit",
            color: c.ink, padding: "3px 2px",
          }}
        />
      </div>

      {state.isOpen && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: anchorRect?.left,
            width: Math.max(anchorRect?.width || 0, PANEL_WIDTH),
            ...(openUp
              ? { bottom: window.innerHeight - (anchorRect?.top ?? 0) + 4 }
              : { top: (anchorRect?.bottom ?? 0) + 4 }),
            background: c.white,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
            zIndex: 9999,
            overflow: "hidden",
            fontFamily: "inherit",
          }}
        >
          {/* Filter bar — Type / Horizon / Likelihood, single-select per facet,
              same interaction pattern as the Clusters page's own filters. */}
          <div style={{
            display: "flex", gap: 6, padding: "8px 10px",
            borderBottom: `1px solid ${c.border}`, flexWrap: "wrap",
          }}>
            <FilterFacet
              label="Type" value={state.filters.subtype} options={TYPE_OPTIONS}
              onChange={(v) => dispatch({ type: "SET_FILTER", facet: "subtype", value: v })}
              onClear={() => dispatch({ type: "CLEAR_FILTER", facet: "subtype" })}
            />
            <FilterFacet
              label="Horizon" value={state.filters.horizon} options={HORIZON_OPTIONS}
              onChange={(v) => dispatch({ type: "SET_FILTER", facet: "horizon", value: v })}
              onClear={() => dispatch({ type: "CLEAR_FILTER", facet: "horizon" })}
            />
            <FilterFacet
              label="Likelihood" value={state.filters.likelihood} options={LIKELIHOOD_OPTIONS}
              onChange={(v) => dispatch({ type: "SET_FILTER", facet: "likelihood", value: v })}
              onClear={() => dispatch({ type: "CLEAR_FILTER", facet: "likelihood" })}
            />
          </div>

          {/* Cross-role confirmation announcement for screen readers */}
          <div role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
            {state.pendingConfirmId ? buildConfirmationMessage(otherRoleLabel, thisRoleLabel) : ""}
          </div>

          {/* Options */}
          <div id={listboxId} role="listbox" aria-label={`${thisRoleLabel} forces — available clusters`} style={{ maxHeight: PANEL_MAX_HEIGHT, overflowY: "auto" }}>
            {emptyReason && (
              <div style={{ padding: "14px 14px", fontSize: 11, color: c.hint, lineHeight: 1.5 }}>
                {emptyReason === "no-clusters" && (
                  <>
                    No clusters in this project yet.
                    {onGoToClusters && (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={onGoToClusters}
                          style={{ ...btnG, padding: 0, fontSize: 11, color: c.brand, display: "inline" }}
                        >
                          Create clusters →
                        </button>
                      </>
                    )}
                  </>
                )}
                {emptyReason === "all-assigned" && `All clusters in this project are already added as ${thisRoleLabel.toLowerCase()} forces.`}
                {emptyReason === "no-matches" && "No clusters match your search and filters."}
              </div>
            )}

            {options.map((cl) => {
              const isActive = state.activeId === cl.id;
              const otherTag = getOtherRoleTag(cl.id, otherSelected, otherRoleLabel);
              const isConfirming = state.pendingConfirmId === cl.id;

              if (isConfirming) {
                return (
                  <div
                    key={cl.id}
                    id={optionDomId(cl.id)}
                    role="group"
                    aria-label={`Confirm adding ${cl.name} as ${thisRoleLabel.toLowerCase()}`}
                    style={{ padding: "10px 12px", borderBottom: `1px solid ${c.border}`, background: c.fieldBg }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 4 }}>{cl.name}</div>
                    <div style={{ fontSize: 11, color: c.muted, marginBottom: 8 }}>
                      {buildConfirmationMessage(otherRoleLabel, thisRoleLabel)}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => commit(cl.id)}
                        style={{
                          padding: "5px 12px", borderRadius: 6, background: c.brand,
                          color: c.white, border: "none", fontSize: 11, fontWeight: 500,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Add anyway
                      </button>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "CANCEL_CONFIRM" })}
                        style={{
                          padding: "5px 12px", borderRadius: 6, background: "transparent",
                          color: c.muted, border: `1px solid ${c.border}`, fontSize: 11,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cl.id}
                  id={optionDomId(cl.id)}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => dispatch({ type: "SET_ACTIVE", id: cl.id })}
                  onClick={() => activateOption(cl.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 8, padding: "8px 12px", cursor: "pointer",
                    background: isActive ? c.surfaceAlt : "transparent",
                    borderBottom: `1px solid ${c.border}`,
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cl.name}
                    </span>
                    <ClusterFieldPills cl={cl} />
                  </span>
                  <OtherRoleTag label={otherTag} />
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

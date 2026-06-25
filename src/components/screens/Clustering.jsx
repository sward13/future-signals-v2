/**
 * Clustering screen — single scrollable view for grouping project inputs into clusters.
 * Three stacked sections: Clusters grid (top), Unassigned inputs table (middle),
 * AI suggestions table (bottom). No tabs.
 * @param {{ appState: object }} props
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { CirclePlus } from "lucide-react";
import { c, inp, ta, btnP, btnSm, btnSec, btnG, fl, badg } from "../../styles/tokens.js";
import { supabase } from "../../lib/supabase.js";
import { HorizTag, SubtypeTag, Tag } from "../shared/Tag.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { ProjectPicker } from "../shared/ProjectPicker.jsx";
import { ClusterDrawer } from "../clusters/ClusterDrawer.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { FilterDropdown } from "./ProjectDetail.jsx";
import { STEEPLED } from "../../data/seeds.js";

const INPUT_TYPE_OPTS = ["Signal", "Issue", "Projection", "Plan", "Obstacle"];

// ─── Likelihood tag ────────────────────────────────────────────────────────────

function LikelihoodTag({ l }) {
  const map = {
    Probable:  [c.green700,  c.green50,  c.greenBorder],
    Plausible: [c.blue700,   c.blue50,   c.blueBorder],
    Possible:  [c.amber700,  c.amber50,  c.amberBorder],
  };
  const [col, bg, brd] = map[l] || [c.hint, "transparent", c.border];
  return <Tag label={l} color={col} bg={bg} border={brd} />;
}

// ─── STEEPLED pills ────────────────────────────────────────────────────────────

const STEEPLED_ABB = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };

function SteepleList({ tags = [] }) {
  if (!tags.length) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  const vis2     = tags.slice(0, 2);
  const overflow = tags.length - 2;
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {vis2.map((t) => (
        <span key={t} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: c.surfaceAlt, color: c.muted }}>
          {STEEPLED_ABB[t] || t}
        </span>
      ))}
      {overflow > 0 && <span style={{ fontSize: 9, color: c.hint }}>+{overflow}</span>}
    </div>
  );
}

// ─── Strength / confidence display ────────────────────────────────────────────

const STRENGTH_COLORS = {
  weak:     [c.amber700, c.amber50, c.amberBorder],
  moderate: [c.blue700,  c.blue50,  c.blueBorder],
  high:     [c.green700, c.green50, c.greenBorder],
};

const CONFIDENCE_COLORS = {
  low:    [c.amber700, c.amber50, c.amberBorder],
  medium: [c.blue700,  c.blue50,  c.blueBorder],
  high:   [c.green700, c.green50, c.greenBorder],
};

function StrengthCell({ strength, confidence }) {
  if (!strength && !confidence) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {strength && (() => {
        const [col, bg, brd] = STRENGTH_COLORS[strength] || [c.hint, c.surfaceAlt, c.border];
        return <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 6, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap", display: "inline-block" }}>{strength.charAt(0).toUpperCase() + strength.slice(1)}</span>;
      })()}
      {confidence && (() => {
        const [col, bg, brd] = CONFIDENCE_COLORS[confidence] || [c.hint, c.surfaceAlt, c.border];
        return <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 5, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap", display: "inline-block" }}>{confidence.charAt(0).toUpperCase() + confidence.slice(1)} conf.</span>;
      })()}
    </div>
  );
}


// ─── Cluster assign popover ────────────────────────────────────────────────────

function AssignPicker({ clusters, onAssign, onNewCluster, onClose, anchorRect }) {
  if (!anchorRect) return null;
  const DROPDOWN_MAX_HEIGHT = 240;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT + 48;

  const style = {
    position: "fixed",
    right: window.innerWidth - anchorRect.right,
    ...(openUp
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
    background: c.white, border: `1px solid ${c.border}`,
    borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
    minWidth: 240, zIndex: 9999, overflow: "hidden",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
      <div style={style}>
        {clusters.length === 0 ? (
          <div style={{ padding: "12px 14px", fontSize: 12, color: c.hint }}>No clusters yet</div>
        ) : (
          <div style={{ maxHeight: DROPDOWN_MAX_HEIGHT, overflowY: "auto" }}>
            {clusters.map((cl) => (
              <button
                key={cl.id}
                onClick={() => onAssign(cl)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "10px 14px",
                  background: "transparent", border: "none",
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  borderBottom: `1px solid ${c.border}`,
                }}
              >
                <SubtypeTag sub={cl.subtype} />
                <span style={{ fontSize: 12, color: c.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cl.name}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onNewCluster}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", padding: "10px 14px",
            background: "transparent", border: "none",
            textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, color: c.muted,
          }}
        >
          <span style={{ fontSize: 14 }}>+</span> Build a cluster
        </button>
      </div>
    </>,
    document.body
  );
}

// ─── Inline checkbox ──────────────────────────────────────────────────────────

function RowCheckbox({ checked, indeterminate, visible }) {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: 3, flexShrink: 0,
      border: `1.5px solid ${checked || indeterminate ? c.ink : visible ? c.borderMid : "rgba(0,0,0,0.12)"}`,
      background: checked || indeterminate ? c.ink : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "border-color 0.15s, background 0.15s",
      pointerEvents: "none",
    }}>
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminate && !checked && (
        <div style={{ width: 7, height: 1.5, borderRadius: 1, background: c.white }} />
      )}
    </div>
  );
}

// ─── Cluster card (grid) ───────────────────────────────────────────────────────

function ClusterCard({ cluster, inputs, onClick }) {
  const clusterInputs = inputs.filter((inp) => cluster.input_ids?.includes(inp.id));
  return (
    <div
      onClick={onClick}
      style={{
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 11, overflow: "hidden", cursor: "pointer",
        transition: "border-color 0.12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.borderMid; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; }}
    >
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>{cluster.name}</span>
            <SubtypeTag sub={cluster.subtype} />
            <HorizTag h={cluster.horizon} />
            {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
          </div>
          {cluster.description && (
            <div style={{
              fontSize: 11, color: c.muted, lineHeight: 1.5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {cluster.description}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: c.hint }}>{clusterInputs.length} inputs</span>
          <span style={{ fontSize: 11, color: c.hint }}>›</span>
        </div>
      </div>
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, action, icon }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ display: "flex", alignItems: "center", color: c.muted }}>{icon}</span>}
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>{title}</div>
        {count != null && (
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 8,
            background: "rgba(0,0,0,0.06)", color: c.muted,
          }}>
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── Table header row ──────────────────────────────────────────────────────────

function TableHead({ cols }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: cols.map((c) => c.width).join(" "),
      padding: "6px 12px",
      borderBottom: `1px solid ${c.border}`,
      background: c.surfaceAlt,
      borderRadius: "8px 8px 0 0",
    }}>
      {cols.map((col, i) => (
        <div key={i} style={{
          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint,
          textAlign: col.align || "left",
        }}>
          {col.label}
        </div>
      ))}
    </div>
  );
}

// ─── Input table row ──────────────────────────────────────────────────────────

const SUBTYPE_ICONS = { signal: "◎", issue: "▲", projection: "◆", plan: "◉", obstacle: "▲", source: "◻" };

function InputTableRow({ input, clusters, assignedCluster, onAssign, onNewCluster, onOpenDetail, selected, onToggleSelect, anySelected, isLast }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [hovered, setHovered] = useState(false);
  const assignBtnRef = useRef(null);

  const cols = "28px 1fr 100px 60px 160px 120px";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        alignItems: "center",
        padding: "9px 12px",
        background: selected ? "rgba(0,0,0,0.02)" : c.white,
        borderBottom: isLast ? "none" : `1px solid ${c.border}`,
        transition: "background 0.1s",
        gap: 0,
      }}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggleSelect(input.id); }}
        style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
      >
        <RowCheckbox checked={selected} visible={anySelected || hovered} />
      </div>

      {/* Title */}
      <div
        onClick={onOpenDetail}
        style={{
          fontSize: 12, fontWeight: 500, color: c.ink,
          cursor: "pointer", paddingRight: 8,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <span style={{ fontSize: 10, color: c.hint, flexShrink: 0 }}>{SUBTYPE_ICONS[input.subtype] || "◎"}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{input.name}</span>
      </div>

      {/* Strength / Confidence */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <StrengthCell strength={input.signal_strength} confidence={input.source_confidence} />
      </div>

      {/* Horizon */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {input.horizon ? <HorizTag h={input.horizon} /> : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
      </div>

      {/* STEEPLED */}
      <div style={{ paddingRight: 8 }}>
        <SteepleList tags={input.steepled} />
      </div>

      {/* Assign action */}
      {!anySelected && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            ref={assignBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              if (!pickerOpen) setAnchorRect(assignBtnRef.current.getBoundingClientRect());
              setPickerOpen((s) => !s);
            }}
            style={{
              fontSize: 10, padding: "4px 10px", borderRadius: 6,
              background: assignedCluster ? "transparent" : c.brand,
              color: assignedCluster ? c.muted : c.white,
              border: `1px solid ${assignedCluster ? c.border : c.brand}`,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            {assignedCluster ? "Reassign" : "Assign →"}
          </button>
          {pickerOpen && (
            <AssignPicker
              clusters={clusters}
              onAssign={(cl) => { onAssign(input.id, cl); setPickerOpen(false); }}
              onNewCluster={() => { setPickerOpen(false); onNewCluster(); }}
              onClose={() => setPickerOpen(false)}
              anchorRect={anchorRect}
            />
          )}
        </div>
      )}
      {anySelected && <div />}
    </div>
  );
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, inputs, onAccept, onDismiss, isFadingOut }) {
  const [editing,       setEditing]       = useState(false);
  const [editName,      setEditName]      = useState(suggestion.name);
  const [editDesc,      setEditDesc]      = useState(suggestion.description || "");
  const [inputIds,      setInputIds]      = useState(suggestion.input_ids || []);
  const [rationaleOpen, setRationaleOpen] = useState(false);

  const subtype   = suggestion.subtype
    ? suggestion.subtype.charAt(0).toUpperCase() + suggestion.subtype.slice(1)
    : "Trend";
  const sugInputs = inputIds
    .map((id) => inputs.find((i) => i.id === id))
    .filter(Boolean);
  const noInputsLeft = sugInputs.length === 0;

  const handleCancel = () => {
    setEditing(false);
    setEditName(suggestion.name);
    setEditDesc(suggestion.description || "");
  };

  const handleRemoveInput = (id) => {
    setInputIds((prev) => prev.filter((x) => x !== id));
  };

  return (
    <div style={{
      background: c.white,
      border: `1px solid ${c.border}`,
      borderRadius: 11,
      overflow: "hidden",
      opacity: isFadingOut ? 0 : 1,
      transition: "opacity 0.25s ease",
    }}>
      <div style={{ padding: "15px 18px" }}>

        {/* Name + badge row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: editing ? 10 : 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ ...inp, fontSize: 13, fontWeight: 500, padding: "5px 9px", borderRadius: 6 }}
              />
            ) : (
              <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, lineHeight: 1.4 }}>
                {suggestion.name}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
            <SubtypeTag sub={subtype} />
            {suggestion.is_weak_signal && (
              <span style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 8,
                background: c.amber50, color: c.amber700, border: `1px solid ${c.amberBorder}`,
                whiteSpace: "nowrap",
              }}>
                Weak signal
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {editing ? (
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={3}
            style={{ ...ta, fontSize: 12, marginBottom: 10 }}
          />
        ) : suggestion.description ? (
          <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.65, marginBottom: 10 }}>
            {suggestion.description}
          </div>
        ) : null}

        {/* Rationale toggle */}
        {suggestion.rationale && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setRationaleOpen((s) => !s)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11, color: c.muted, padding: 0, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: 9 }}>{rationaleOpen ? "▾" : "▸"}</span>
              Why this cluster?
            </button>
            {rationaleOpen && (
              <div style={{
                marginTop: 7, padding: "9px 12px",
                background: c.surfaceAlt, border: `1px solid ${c.border}`,
                borderRadius: 6, fontSize: 12, color: c.muted,
                lineHeight: 1.6, fontStyle: "italic",
              }}>
                {suggestion.rationale}
              </div>
            )}
          </div>
        )}

        {/* Input list */}
        {sugInputs.length > 0 && (
          <div style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 7, marginBottom: 12, overflow: "hidden" }}>
            {sugInputs.map((i, idx) => (
              <div key={i.id} style={{
                padding: "8px 11px",
                borderTop: idx > 0 ? `1px solid ${c.border}` : "none",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: c.hint, fontSize: 10, flexShrink: 0 }}>•</span>
                <span style={{
                  flex: 1, fontSize: 12, color: c.ink,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {i.name}
                </span>
                <button onClick={() => handleRemoveInput(i.id)} style={{ ...btnG, fontSize: 11 }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {editing ? (
            <>
              <button
                onClick={() => onAccept(suggestion, editName, editDesc, inputIds)}
                disabled={noInputsLeft}
                style={{ ...btnSm, fontSize: 11, ...(noInputsLeft ? { opacity: 0.5, cursor: "default" } : {}) }}
              >
                Create cluster
              </button>
              <button onClick={handleCancel} style={{ ...btnSec, fontSize: 11, padding: "6px 14px" }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onAccept(suggestion, suggestion.name, suggestion.description || "", inputIds)}
                disabled={noInputsLeft}
                style={{ ...btnSm, fontSize: 11, ...(noInputsLeft ? { opacity: 0.5, cursor: "default" } : {}) }}
              >
                Create cluster
              </button>
              <button onClick={() => setEditing(true)} style={{ ...btnSec, fontSize: 11, padding: "6px 14px" }}>
                Edit
              </button>
              <button onClick={() => onDismiss(suggestion.id)} style={{ ...btnG, fontSize: 11 }}>
                Dismiss
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Overlap ratio helper ─────────────────────────────────────────────────────

/** Fraction of IDs shared, normalised by the larger set. */
function overlapRatio(idsA, idsB) {
  if (!idsA?.length || !idsB?.length) return 0;
  const setB = new Set(idsB);
  return idsA.filter((id) => setB.has(id)).length / Math.max(idsA.length, idsB.length);
}

// ─── Table container ──────────────────────────────────────────────────────────

function TableContainer({ children }) {
  return (
    <div style={{
      border: `1px solid ${c.border}`,
      borderRadius: 9,
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

// ─── Assignment suggestion row ────────────────────────────────────────────────

function AssignmentSugRow({ sug, inputs, fadingOutIds, onAcceptOne, onDismissOne, idx }) {
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const inputId = (sug.input_ids || [])[0];
  const matchedInput = inputs.find((i) => i.id === inputId);
  const confidenceStyle = sug.confidence ? CONFIDENCE_STYLES[sug.confidence] : null;
  return (
    <div style={{
      borderTop: idx > 0 ? `1px solid ${c.border}` : "none",
      opacity: fadingOutIds.has(sug.id) ? 0 : 1,
      transition: "opacity 0.25s ease",
    }}>
      {/* Row 1: title, confidence badge, actions */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 130px 140px", alignItems: "center", gap: 8,
        padding: "8px 11px",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12, color: c.ink,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {matchedInput?.name || "Untitled input"}
          </div>
        </div>
        <span style={{ textAlign: "center" }}>
          {confidenceStyle && (
            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, fontWeight: 500, ...confidenceStyle }}>
              {sug.confidence === "high" ? "High" : "Moderate"}
            </span>
          )}
        </span>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => onAcceptOne(sug)} style={{ ...btnSm, fontSize: 11, padding: "4px 12px" }}>
            Accept
          </button>
          <button onClick={() => onDismissOne(sug.id)} style={{ ...btnG, fontSize: 11 }}>
            Dismiss
          </button>
        </div>
      </div>

      {/* Row 2: rationale lane — only when rationale exists */}
      {sug.rationale && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "0 11px 7px",
        }}>
          <button
            onClick={() => setRationaleOpen((s) => !s)}
            title="Why this match?"
            style={{
              flexShrink: 0,
              width: 14, height: 14, borderRadius: "50%",
              border: `1px solid ${c.border}`,
              background: "transparent",
              color: c.faint,
              fontSize: 8, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, padding: 0,
            }}
          >?</button>
          {rationaleOpen && (
            <div style={{
              fontSize: 11, color: c.faint, fontStyle: "italic",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1,
            }}>
              {sug.rationale}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Assignment group card — "Add to existing clusters" ──────────────────────

const CONFIDENCE_STYLES = {
  high:     { background: c.green50, color: c.green700, border: `1px solid ${c.greenBorder}` },
  moderate: { background: c.amber50, color: c.amber700, border: `1px solid ${c.amberBorder}` },
};

function AssignmentGroupCard({ group, inputs, fadingOutIds, onAcceptOne, onDismissOne, onAcceptAll }) {
  const { targetClusterId, clusterName, sugs } = group;

  return (
    <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 11, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>
            Add to <span style={{ color: c.brand }}>{clusterName}</span>
          </div>
          {sugs.length > 1 && (
            <button onClick={() => onAcceptAll(targetClusterId)} style={{ ...btnG, fontSize: 11 }}>
              Accept all
            </button>
          )}
        </div>

        <div style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 7, overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 130px 140px", alignItems: "center", gap: 8,
            padding: "6px 11px", borderBottom: `1px solid ${c.border}`,
            fontSize: 10, fontWeight: 500, color: c.faint, textTransform: "uppercase", letterSpacing: "0.07em",
          }}>
            <span>Title</span>
            <span style={{ textAlign: "center" }}>Match confidence</span>
            <span style={{ textAlign: "center" }}>Actions</span>
          </div>
          {sugs.map((sug, idx) => (
            <AssignmentSugRow
              key={sug.id}
              sug={sug}
              inputs={inputs}
              fadingOutIds={fadingOutIds}
              onAcceptOne={onAcceptOne}
              onDismissOne={onDismissOne}
              idx={idx}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm delete modal ────────────────────────────────────────────────────

function ConfirmDeleteModal({ count, onConfirm, onCancel }) {
  return createPortal(
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 400 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: c.white, borderRadius: 12, padding: "24px 28px",
        boxShadow: "0 16px 48px rgba(0,0,0,0.18)", zIndex: 401, minWidth: 320,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          Delete {count} input{count !== 1 ? "s" : ""}?
        </div>
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 20, lineHeight: 1.5 }}>
          This cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...btnSec, fontSize: 12, padding: "7px 16px" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", border: "none",
            background: "#DC2626", color: "#fff",
          }}>
            Delete
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Clustering({ appState }) {
  const {
    activeProjectId, setActiveProjectId, projects, inputs, clusters,
    addCluster, addInput,
    assignInputToCluster, deleteInput,
    showToast, setActiveScreen, openProjectModal,
    openInputDetail, openClusterDetail, scenarios,
    workspaceId,
  } = appState;

  const [newClusterDrawerOpen,  setNewClusterDrawerOpen]  = useState(false);
  const [inputDrawerOpen,       setInputDrawerOpen]       = useState(false);
  const [selectedInputIds,      setSelectedInputIds]      = useState([]);
  const [assignPickerOpen,      setAssignPickerOpen]      = useState(false);
  const [preselectedForCluster, setPreselectedForCluster] = useState([]);
  const [inputSearch,           setInputSearch]           = useState("");
  const [filterType,            setFilterType]            = useState(null);
  const [filterHorizon,         setFilterHorizon]         = useState(null);
  const [filterSteepled,        setFilterSteepled]        = useState(null);
  const [openFilterDropdown,    setOpenFilterDropdown]    = useState(null);

  // Cluster section filters
  const [clusterSearch,              setClusterSearch]              = useState("");
  const [clusterFilterType,          setClusterFilterType]          = useState(null);
  const [clusterFilterHorizon,       setClusterFilterHorizon]       = useState(null);
  const [clusterFilterLikelihood,    setClusterFilterLikelihood]    = useState(null);
  const [openClusterFilterDropdown,  setOpenClusterFilterDropdown]  = useState(null);

  // Sensitivity setting for cluster suggestion generation
  const [tightness, setTightness] = useState("balanced");

  // Cluster suggestions — assignments (Section 1)
  const [assignmentSugs,     setAssignmentSugs]     = useState([]);
  const [assignFadingOutIds, setAssignFadingOutIds] = useState(new Set());

  // Cluster suggestions — new clusters (Section 2)
  const [newClusterSugs,       setNewClusterSugs]       = useState([]);
  const [newClusterFadingIds,  setNewClusterFadingIds]  = useState(new Set());
  const [dismissedNewClusters, setDismissedNewClusters] = useState([]);

  const [confirmDeleteIds, setConfirmDeleteIds] = useState(null);

  // Combined suggestion run
  const [runningSuggestions, setRunningSuggestions] = useState(false);
  const [suggestionsError,   setSuggestionsError]   = useState(null);
  const [loadingDbSugs,      setLoadingDbSugs]      = useState(false);

  const project         = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null;
  const projectInputs   = project ? inputs.filter((i)  => i.project_id  === project.id) : [];
  const projectClusters = project ? clusters.filter((cl) => cl.project_id === project.id) : [];

  // Backfill embeddings for any inputs that pre-date the embedding feature.
  // Runs once per project open; fire-and-forget so it never blocks the UI.
  const backfilledProjectRef = useRef(null);
  useEffect(() => {
    if (!project || backfilledProjectRef.current === project.id) return;
    backfilledProjectRef.current = project.id;
    const missing = projectInputs.filter((i) => !i.embedding);
    missing.forEach((i) => {
      supabase.functions.invoke("embed-input", { body: { input_id: i.id } }).catch(() => {});
    });
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unassignedInputs = useMemo(() =>
    projectInputs.filter((i) => !projectClusters.some((cl) => cl.input_ids?.includes(i.id))),
    [projectInputs, projectClusters]
  );

  const filteredUnassigned = useMemo(() => {
    const q = inputSearch.trim().toLowerCase();
    return unassignedInputs
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q))
      .filter((i) => !filterType     || i.subtype === filterType)
      .filter((i) => !filterHorizon  || i.horizon === filterHorizon)
      .filter((i) => !filterSteepled || (i.steepled || []).includes(filterSteepled));
  }, [unassignedInputs, inputSearch, filterType, filterHorizon, filterSteepled]);

  const anyFilterActive = !!(inputSearch.trim() || filterType || filterHorizon || filterSteepled);

  const filteredClusters = useMemo(() => {
    const q = clusterSearch.trim().toLowerCase();
    return projectClusters
      .filter((cl) => !q || cl.name.toLowerCase().includes(q) || (cl.description || "").toLowerCase().includes(q))
      .filter((cl) => !clusterFilterType       || cl.subtype    === clusterFilterType)
      .filter((cl) => !clusterFilterHorizon    || cl.horizon    === clusterFilterHorizon)
      .filter((cl) => !clusterFilterLikelihood || cl.likelihood === clusterFilterLikelihood);
  }, [projectClusters, clusterSearch, clusterFilterType, clusterFilterHorizon, clusterFilterLikelihood]);

  const anyClusterFilterActive = !!(clusterSearch.trim() || clusterFilterType || clusterFilterHorizon || clusterFilterLikelihood);

  const clearClusterFilters = () => {
    setClusterSearch(""); setClusterFilterType(null); setClusterFilterHorizon(null); setClusterFilterLikelihood(null);
  };

  const visibleNewClusterSugs = useMemo(() =>
    newClusterSugs.filter((sug) => {
      if (newClusterFadingIds.has(sug.id)) return true;
      return !dismissedNewClusters.some(
        (dis) => overlapRatio(sug.input_ids, dis.input_ids) > 0.8
      );
    }),
    [newClusterSugs, dismissedNewClusters, newClusterFadingIds]
  );

  // Group pending assignment suggestions by their target cluster for Section 1.
  const assignmentGroups = useMemo(() => {
    const groups = new Map();
    for (const sug of assignmentSugs) {
      const key = sug.target_cluster_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sug);
    }
    return [...groups.entries()].map(([targetClusterId, sugs]) => ({
      targetClusterId,
      clusterName: projectClusters.find((cl) => cl.id === targetClusterId)?.name || sugs[0]?.name || "cluster",
      sugs,
    }));
  }, [assignmentSugs, projectClusters]);

  const clearAllFilters = () => {
    setInputSearch(""); setFilterType(null); setFilterHorizon(null); setFilterSteepled(null);
  };

  const loadSuggestions = useCallback(async (projectId, wsId) => {
    setLoadingDbSugs(true);
    try {
      const { data, error } = await supabase
        .from("cluster_suggestions")
        .select("*")
        .eq("project_id", projectId)
        .eq("workspace_id", wsId)
        .eq("status", "pending")
        .order("generated_at", { ascending: false });
      if (error) throw error;
      const all = data || [];
      setAssignmentSugs(all.filter((s) => s.type === "assignment"));
      setNewClusterSugs(all.filter((s) => s.type !== "assignment"));
    } catch {
      // silent — panels show errors when the user actively runs them
    } finally {
      setLoadingDbSugs(false);
    }
  }, []);

  useEffect(() => {
    if (!project || !workspaceId) {
      setAssignmentSugs([]);
      setNewClusterSugs([]);
      return;
    }
    loadSuggestions(project.id, workspaceId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const getInputCluster = (inputId) =>
    projectClusters.find((cl) => cl.input_ids?.includes(inputId)) || null;

  const handleAssignInput = (inputId, cluster) => {
    assignInputToCluster(inputId, cluster.id);
    showToast(`Input assigned to "${cluster.name}"`);
  };

  const handleBulkAssign = (cluster) => {
    selectedInputIds.forEach((id) => assignInputToCluster(id, cluster.id));
    const n = selectedInputIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} assigned to "${cluster.name}"`);
    setSelectedInputIds([]);
    setAssignPickerOpen(false);
  };

  const handleNewClusterFromSelection = () => {
    setPreselectedForCluster([...selectedInputIds]);
    setSelectedInputIds([]);
    setAssignPickerOpen(false);
    setNewClusterDrawerOpen(true);
  };

  const toggleSelectInput = (id) => {
    setSelectedInputIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ── Suggestion handlers ──────────────────────────────────────────────────────

  const handleSuggestClustering = async () => {
    if (!project || runningSuggestions) return;
    setRunningSuggestions(true);
    setSuggestionsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("compute-cluster-suggestions", {
        body: { project_id: project.id, mode: "combined", clustering_sensitivity: tightness },
      });
      if (error) throw new Error(error.message);
      setDismissedNewClusters([]);
      await loadSuggestions(project.id, workspaceId);
    } catch (err) {
      setSuggestionsError(err.message || "Failed to generate suggestions.");
    } finally {
      setRunningSuggestions(false);
    }
  };

  const handleAcceptAssignment = (sug) => {
    (sug.input_ids || []).forEach((inputId) => {
      assignInputToCluster(inputId, sug.target_cluster_id);
    });
    supabase
      .from("cluster_suggestions")
      .update({ status: "accepted", acted_on_at: new Date().toISOString() })
      .eq("id", sug.id)
      .then();
    setAssignmentSugs((prev) => prev.filter((s) => s.id !== sug.id));
    const cl = projectClusters.find((c) => c.id === sug.target_cluster_id);
    showToast(`Input assigned to "${cl?.name || "cluster"}"`);
  };

  const handleDismissAssignment = (id) => {
    setAssignFadingOutIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setAssignmentSugs((prev) => prev.filter((s) => s.id !== id));
      setAssignFadingOutIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 280);
    supabase
      .from("cluster_suggestions")
      .update({ status: "dismissed", acted_on_at: new Date().toISOString() })
      .eq("id", id)
      .then();
  };

  const handleAcceptAllAssignmentsForCluster = (targetClusterId) => {
    const pending = assignmentSugs.filter((s) => s.target_cluster_id === targetClusterId);
    pending.forEach((sug) => {
      (sug.input_ids || []).forEach((inputId) => assignInputToCluster(inputId, targetClusterId));
    });
    supabase
      .from("cluster_suggestions")
      .update({ status: "accepted", acted_on_at: new Date().toISOString() })
      .in("id", pending.map((s) => s.id))
      .then();
    setAssignmentSugs((prev) => prev.filter((s) => s.target_cluster_id !== targetClusterId));
    const cl = projectClusters.find((c) => c.id === targetClusterId);
    showToast(`${pending.length} input${pending.length !== 1 ? "s" : ""} assigned to "${cl?.name || "cluster"}"`);
  };

  const handleAcceptNewCluster = (sug, editedName, editedDesc, editedInputIds) => {
    const name     = editedName?.trim() || sug.name;
    const desc     = editedDesc ?? sug.description ?? "";
    const inputIds = editedInputIds ?? sug.input_ids ?? [];
    const subtype  = sug.subtype
      ? sug.subtype.charAt(0).toUpperCase() + sug.subtype.slice(1)
      : "Trend";
    setNewClusterSugs((prev) => prev.filter((s) => s.id !== sug.id));
    addCluster({ name, subtype, horizon: "H1", likelihood: "Plausible", description: desc, project_id: project.id, input_ids: inputIds });
    supabase
      .from("cluster_suggestions")
      .update({ status: "accepted", acted_on_at: new Date().toISOString() })
      .eq("id", sug.id)
      .then();
    const n = inputIds.length;
    showToast(`Cluster "${name}" created with ${n} input${n !== 1 ? "s" : ""}`);
  };

  const handleDismissNewCluster = (id) => {
    const sug = newClusterSugs.find((s) => s.id === id);
    if (sug) setDismissedNewClusters((prev) => [...prev, { id: sug.id, input_ids: sug.input_ids || [] }]);
    setNewClusterFadingIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setNewClusterSugs((prev) => prev.filter((s) => s.id !== id));
      setNewClusterFadingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 280);
    supabase
      .from("cluster_suggestions")
      .update({ status: "dismissed", acted_on_at: new Date().toISOString() })
      .eq("id", id)
      .then();
  };

  const handleCreateCluster = (fields) => {
    addCluster({ ...fields, project_id: project.id });
    setNewClusterDrawerOpen(false);
    setPreselectedForCluster([]);
    const n = (fields.input_ids || []).length;
    showToast(n > 0 ? `Cluster created with ${n} input${n !== 1 ? "s" : ""}` : "Cluster created — no inputs linked yet");
  };

  const handleAddInput = (fields) => {
    addInput({ ...fields, project_id: project.id });
    showToast("Input added to project");
    setInputDrawerOpen(false);
  };

  const allUnassignedSelected = filteredUnassigned.length > 0 && filteredUnassigned.every((i) => selectedInputIds.includes(i.id));
  const someUnassignedSelected = filteredUnassigned.some((i) => selectedInputIds.includes(i.id));

  const toggleSelectAllUnassigned = () => {
    if (allUnassignedSelected) {
      setSelectedInputIds((prev) => prev.filter((id) => !filteredUnassigned.some((i) => i.id === id)));
    } else {
      setSelectedInputIds((prev) => [...new Set([...prev, ...filteredUnassigned.map((i) => i.id)])]);
    }
  };

  const handleBulkDeleteUnassigned = () => {
    confirmDeleteIds.forEach((id) => deleteInput(id));
    const n = confirmDeleteIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} deleted`);
    setConfirmDeleteIds(null);
    setSelectedInputIds([]);
  };

  const anySelected = selectedInputIds.length > 0;

  if (!project) return null;

  // ── Canvas ─────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ padding: "24px 32px", background: c.bg, minHeight: "100%", overflowY: "auto" }}>

        {/* ── Page header ──────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ marginBottom: 3 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint }}>
                {project.name}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Clustering</div>
          </div>
          <button onClick={() => setNewClusterDrawerOpen(true)} style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}>
            <CirclePlus size={14} />Build a cluster
          </button>
        </div>

        <div style={{ fontSize: 11, color: c.muted, marginBottom: 32 }}>
          {projectInputs.length} inputs · {projectClusters.length} clusters
        </div>

        {/* ── Section 1: Clusters ───────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <SectionHeader
            title="Clusters"
          />

          {projectClusters.length === 0 ? (
            <EmptyState
              icon="◈"
              title="No clusters yet"
              body={
                projectInputs.length < 3
                  ? `Add at least 3 inputs before clustering. You have ${projectInputs.length} so far.`
                  : "Build your first cluster manually or accept an AI suggestion below."
              }
              ctaLabel="Build a cluster"
              onCta={() => setNewClusterDrawerOpen(true)}
            />
          ) : (
            <>
              {/* Search + filter bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <input
                  value={clusterSearch}
                  onChange={(e) => setClusterSearch(e.target.value)}
                  placeholder="Search clusters…"
                  style={{
                    ...inp, width: 220, padding: "5px 10px", fontSize: 12,
                    border: `1px solid ${c.border}`, borderRadius: 6,
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <FilterDropdown
                    label="Type"
                    value={clusterFilterType}
                    options={["Trend", "Driver", "Tension"].map((v) => ({ value: v, label: v }))}
                    onChange={setClusterFilterType}
                    onClear={() => setClusterFilterType(null)}
                    isOpen={openClusterFilterDropdown === "type"}
                    onToggle={() => setOpenClusterFilterDropdown(openClusterFilterDropdown === "type" ? null : "type")}
                  />
                  <FilterDropdown
                    label="Horizon"
                    value={clusterFilterHorizon}
                    options={["H1", "H2", "H3"].map((v) => ({ value: v, label: v }))}
                    onChange={setClusterFilterHorizon}
                    onClear={() => setClusterFilterHorizon(null)}
                    isOpen={openClusterFilterDropdown === "horizon"}
                    onToggle={() => setOpenClusterFilterDropdown(openClusterFilterDropdown === "horizon" ? null : "horizon")}
                  />
                  <FilterDropdown
                    label="Likelihood"
                    value={clusterFilterLikelihood}
                    options={["Possible", "Plausible", "Probable"].map((v) => ({ value: v, label: v }))}
                    onChange={setClusterFilterLikelihood}
                    onClear={() => setClusterFilterLikelihood(null)}
                    isOpen={openClusterFilterDropdown === "likelihood"}
                    onToggle={() => setOpenClusterFilterDropdown(openClusterFilterDropdown === "likelihood" ? null : "likelihood")}
                  />
                </div>
                {anyClusterFilterActive && (
                  <button
                    onClick={clearClusterFilters}
                    style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {filteredClusters.length === 0 ? (
                <div style={{
                  padding: "20px 24px", textAlign: "center",
                  background: c.white, border: `1px solid ${c.border}`,
                  borderRadius: 9,
                }}>
                  <div style={{ fontSize: 13, color: c.muted, marginBottom: 6 }}>No clusters match your filters.</div>
                  <button
                    onClick={clearClusterFilters}
                    style={{ fontSize: 12, color: c.brand, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {filteredClusters.map((cl) => (
                    <ClusterCard
                      key={cl.id}
                      cluster={cl}
                      inputs={projectInputs}
                      onClick={() => openClusterDetail(cl.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Section 2: Unassigned inputs ─────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <SectionHeader
            title="Unassigned inputs"
            count={unassignedInputs.length || null}
            action={
              <button onClick={() => setInputDrawerOpen(true)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                <CirclePlus size={13} />Add an input
              </button>
            }
          />

          {/* Bulk action bar */}
          {anySelected && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 14px", marginBottom: 10,
              background: c.white, border: `1px solid ${c.borderMid}`,
              borderRadius: 9, boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, flex: 1 }}>
                {selectedInputIds.length} input{selectedInputIds.length !== 1 ? "s" : ""} selected
              </span>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setAssignPickerOpen((s) => !s)}
                  style={{ ...btnSm, fontSize: 11 }}
                >
                  Assign to cluster →
                </button>
                {assignPickerOpen && (
                  <AssignPicker
                    clusters={projectClusters}
                    onAssign={handleBulkAssign}
                    onNewCluster={handleNewClusterFromSelection}
                    onClose={() => setAssignPickerOpen(false)}
                  />
                )}
              </div>
              <button
                onClick={() => setConfirmDeleteIds([...selectedInputIds])}
                style={{
                  padding: "7px 14px", borderRadius: 7, fontSize: 11, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                  background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA",
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedInputIds([])}
                style={{ ...btnG, fontSize: 11, color: c.muted }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Search + filter bar */}
          {unassignedInputs.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input
                value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                placeholder="Search inputs…"
                style={{
                  ...inp, width: 240, padding: "5px 10px", fontSize: 12,
                  border: `1px solid ${c.border}`, borderRadius: 6,
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                <FilterDropdown
                  label="Type"
                  value={filterType}
                  options={INPUT_TYPE_OPTS.map((v) => ({ value: v, label: v }))}
                  onChange={setFilterType}
                  onClear={() => setFilterType(null)}
                  isOpen={openFilterDropdown === "type"}
                  onToggle={() => setOpenFilterDropdown(openFilterDropdown === "type" ? null : "type")}
                />
                <FilterDropdown
                  label="Horizon"
                  value={filterHorizon}
                  options={["H1", "H2", "H3"].map((v) => ({ value: v, label: v }))}
                  onChange={setFilterHorizon}
                  onClear={() => setFilterHorizon(null)}
                  isOpen={openFilterDropdown === "horizon"}
                  onToggle={() => setOpenFilterDropdown(openFilterDropdown === "horizon" ? null : "horizon")}
                />
                <FilterDropdown
                  label="STEEPLED"
                  value={filterSteepled}
                  options={STEEPLED.map((v) => ({ value: v, label: v }))}
                  onChange={setFilterSteepled}
                  onClear={() => setFilterSteepled(null)}
                  isOpen={openFilterDropdown === "steepled"}
                  onToggle={() => setOpenFilterDropdown(openFilterDropdown === "steepled" ? null : "steepled")}
                />
              </div>
              {anyFilterActive && (
                <button
                  onClick={clearAllFilters}
                  style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {unassignedInputs.length === 0 ? (
            projectInputs.length === 0 ? (
              <EmptyState
                icon="◎"
                title="No inputs in this project"
                body="Create a new input directly, or head to the Inbox to pull in existing signals."
                ctaLabel="Add an input"
                onCta={() => setInputDrawerOpen(true)}
              />
            ) : (
              <div style={{
                padding: "20px 24px", textAlign: "center",
                background: c.white, border: `1px solid ${c.border}`,
                borderRadius: 9,
              }}>
                <div style={{ fontSize: 13, color: c.muted, marginBottom: 4 }}>All inputs have been assigned to clusters.</div>
                <div style={{ fontSize: 11, color: c.hint }}>Well done — {projectInputs.length} input{projectInputs.length !== 1 ? "s" : ""} clustered.</div>
              </div>
            )
          ) : filteredUnassigned.length === 0 ? (
            <div style={{
              padding: "20px 24px", textAlign: "center",
              background: c.white, border: `1px solid ${c.border}`,
              borderRadius: 9,
            }}>
              <div style={{ fontSize: 13, color: c.muted, marginBottom: 6 }}>No inputs match the current filters.</div>
              <button
                onClick={clearAllFilters}
                style={{ fontSize: 12, color: c.ink, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
              >
                Clear all
              </button>
            </div>
          ) : (
            <TableContainer>
              {/* Header with select-all */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 120px 60px 160px 120px",
                padding: "6px 12px",
                borderBottom: `1px solid ${c.border}`,
                background: c.surfaceAlt,
                borderRadius: "8px 8px 0 0",
                alignItems: "center",
              }}>
                <div
                  onClick={toggleSelectAllUnassigned}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <RowCheckbox
                    checked={allUnassignedSelected}
                    indeterminate={!allUnassignedSelected && someUnassignedSelected}
                    visible={true}
                  />
                </div>
                {["Title", "Strength", "Horizon", "STEEPLED", ""].map((label, i) => (
                  <div key={i} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint }}>
                    {label}
                  </div>
                ))}
              </div>
              {filteredUnassigned.map((inp, idx) => (
                <InputTableRow
                  key={inp.id}
                  input={inp}
                  clusters={projectClusters}
                  assignedCluster={getInputCluster(inp.id)}
                  onAssign={handleAssignInput}
                  onNewCluster={() => setNewClusterDrawerOpen(true)}
                  onOpenDetail={() => openInputDetail(inp.id)}
                  selected={selectedInputIds.includes(inp.id)}
                  onToggleSelect={toggleSelectInput}
                  anySelected={anySelected}
                  isLast={idx === filteredUnassigned.length - 1}
                />
              ))}
            </TableContainer>
          )}
        </div>

        {/* ── Cluster suggestions ───────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>Cluster suggestions</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Tight / Balanced / Exploratory tabs */}
              <div style={{
                display: "inline-flex",
                border: `1px solid ${c.borderMid}`,
                borderRadius: 7, overflow: "hidden", background: c.white,
              }}>
                {[
                  { key: "tight", label: "Tight" },
                  { key: "balanced", label: "Balanced" },
                  { key: "exploratory", label: "Exploratory" },
                ].map(({ key, label }, idx) => (
                  <button
                    key={key}
                    onClick={() => setTightness(key)}
                    style={{
                      padding: "4px 10px", fontSize: 11, fontFamily: "inherit",
                      cursor: "pointer", border: "none",
                      borderLeft: idx > 0 ? `1px solid ${c.borderMid}` : "none",
                      background: tightness === key ? c.ink : "transparent",
                      color: tightness === key ? c.white : c.muted,
                      fontWeight: tightness === key ? 500 : 400,
                      transition: "background 0.12s, color 0.12s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSuggestClustering}
                disabled={runningSuggestions}
                style={{ ...btnSec, fontSize: 11, padding: "4px 12px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}
              >
                {runningSuggestions ? (
                  <>
                    <span style={{
                      display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                      border: `1.5px solid ${c.border}`, borderTopColor: c.muted,
                      animation: "clusterSpinner 0.7s linear infinite",
                    }} />
                    Suggesting…
                  </>
                ) : "Suggest clustering"}
              </button>
            </div>
          </div>

          {/* Body */}
          {suggestionsError ? (
            <div style={{
              padding: "13px 16px", background: c.red50,
              border: `1px solid ${c.redBorder}`, borderRadius: 9,
              fontSize: 12, color: c.red800,
            }}>
              {suggestionsError}
            </div>
          ) : runningSuggestions ? (
            <div style={{
              padding: "36px 24px", background: c.surfaceAlt,
              border: `1px solid ${c.border}`, borderRadius: 9,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                border: `2px solid ${c.border}`, borderTopColor: c.ink,
                animation: "clusterSpinner 0.7s linear infinite",
              }} />
              <div style={{ fontSize: 12, color: c.muted }}>Finding suggestions…</div>
            </div>
          ) : assignmentGroups.length === 0 && visibleNewClusterSugs.length === 0 ? (
            <div style={{
              padding: "32px 24px", background: c.surfaceAlt,
              border: `1px solid ${c.border}`, borderRadius: 9, textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: c.muted }}>
                No suggestions — all inputs are assigned, or there aren't enough unassigned inputs to form new patterns.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {assignmentGroups.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.muted, marginBottom: 8 }}>
                    Add to existing clusters
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {assignmentGroups.map((group) => (
                      <AssignmentGroupCard
                        key={group.targetClusterId}
                        group={group}
                        inputs={projectInputs}
                        fadingOutIds={assignFadingOutIds}
                        onAcceptOne={handleAcceptAssignment}
                        onDismissOne={handleDismissAssignment}
                        onAcceptAll={handleAcceptAllAssignmentsForCluster}
                      />
                    ))}
                  </div>
                </div>
              )}

              {visibleNewClusterSugs.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.muted, marginBottom: 8 }}>
                    New cluster suggestions
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {visibleNewClusterSugs.map((sug) => (
                      <SuggestionCard
                        key={sug.id}
                        suggestion={sug}
                        inputs={projectInputs}
                        onAccept={handleAcceptNewCluster}
                        onDismiss={handleDismissNewCluster}
                        isFadingOut={newClusterFadingIds.has(sug.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <style>{`@keyframes clusterSpinner { to { transform: rotate(360deg); } }`}</style>
        </div>

      </div>

      {confirmDeleteIds && (
        <ConfirmDeleteModal
          count={confirmDeleteIds.length}
          onConfirm={handleBulkDeleteUnassigned}
          onCancel={() => setConfirmDeleteIds(null)}
        />
      )}

      <ClusterDrawer
        open={newClusterDrawerOpen}
        onClose={() => { setNewClusterDrawerOpen(false); setPreselectedForCluster([]); }}
        onSave={handleCreateCluster}
        projectId={project.id}
        projectInputs={projectInputs}
        preselectedInputIds={preselectedForCluster}
      />

      <InputDrawer
        open={inputDrawerOpen}
        onClose={() => setInputDrawerOpen(false)}
        onSave={handleAddInput}
        projects={projects}
        defaultProjectId={project.id}
      />

    </>
  );
}

/**
 * Clustering screen — single scrollable view for grouping project inputs into clusters.
 * Three stacked sections: Clusters grid (top), Unassigned inputs table (middle),
 * AI suggestions table (bottom). No tabs.
 * @param {{ appState: object }} props
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { CirclePlus, Sparkles } from "lucide-react";
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

function SteepleList({ tags = [] }) {
  if (!tags.length) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {tags.map((t) => (
        <span key={t} style={{
          fontSize: 9, padding: "1px 5px", borderRadius: 8,
          background: c.surfaceAlt, color: c.muted,
          border: `1px solid ${c.border}`,
        }}>
          {t}
        </span>
      ))}
    </div>
  );
}

// ─── Signal quality pill ───────────────────────────────────────────────────────

const QUALITY_COLORS = {
  Emerging:    [c.amber700, c.amber50, c.amberBorder],
  Established: [c.blue700,  c.blue50,  c.blueBorder],
  Confirmed:   [c.green700, c.green50, c.greenBorder],
};

function QualityPill({ value }) {
  if (!value) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  const [col, bg, brd] = QUALITY_COLORS[value] || [c.hint, c.surfaceAlt, c.border];
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap" }}>
      {value}
    </span>
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

function RowCheckbox({ checked, visible }) {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: 3, flexShrink: 0,
      border: `1.5px solid ${checked ? c.ink : visible ? c.borderMid : "rgba(0,0,0,0.12)"}`,
      background: checked ? c.ink : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "border-color 0.15s, background 0.15s",
      pointerEvents: "none",
    }}>
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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

      {/* Signal Quality */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <QualityPill value={input.signal_quality} />
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
  const [editing,      setEditing]      = useState(false);
  const [editName,     setEditName]     = useState(suggestion.name);
  const [editDesc,     setEditDesc]     = useState(suggestion.description || "");
  const [editInputIds, setEditInputIds] = useState(suggestion.input_ids || []);

  const subtype    = suggestion.subtype
    ? suggestion.subtype.charAt(0).toUpperCase() + suggestion.subtype.slice(1)
    : "Trend";
  const activeIds  = editing ? editInputIds : (suggestion.input_ids || []);
  const sugInputs  = inputs.filter((i) => activeIds.includes(i.id));
  const shown      = sugInputs.slice(0, 5);
  const extraCount = sugInputs.length - 5;

  const handleCancel = () => {
    setEditing(false);
    setEditName(suggestion.name);
    setEditDesc(suggestion.description || "");
    setEditInputIds(suggestion.input_ids || []);
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

        {/* Input chips */}
        {activeIds.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {editing ? (
              editInputIds.map((id) => {
                const found = inputs.find((i) => i.id === id);
                if (!found) return null;
                return (
                  <span key={id} style={{
                    fontSize: 10, padding: "2px 6px 2px 8px", borderRadius: 10,
                    background: c.surfaceAlt, color: c.muted,
                    border: `1px solid ${c.border}`,
                    display: "inline-flex", alignItems: "center", gap: 3,
                  }}>
                    <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {found.name}
                    </span>
                    <button
                      onClick={() => setEditInputIds((prev) => prev.filter((x) => x !== id))}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: c.hint, fontSize: 12, padding: 0, lineHeight: 1,
                        fontFamily: "inherit", flexShrink: 0,
                      }}
                    >×</button>
                  </span>
                );
              })
            ) : (
              <>
                {shown.map((i) => (
                  <span key={i.id} style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 10,
                    background: c.surfaceAlt, color: c.muted,
                    border: `1px solid ${c.border}`,
                    maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {i.name}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 10,
                    background: "transparent", color: c.hint,
                    border: `1px solid ${c.border}`, whiteSpace: "nowrap",
                  }}>
                    +{extraCount} more
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {editing ? (
            <>
              <button
                onClick={() => onAccept(suggestion, editName, editDesc, editInputIds)}
                style={{ ...btnSm, fontSize: 11 }}
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
                onClick={() => onAccept(suggestion, suggestion.name, suggestion.description || "", suggestion.input_ids || [])}
                style={{ ...btnSm, fontSize: 11 }}
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

// ─── Suggestion inspector panel ───────────────────────────────────────────────

function SuggestionInspector({ suggestion, inputs, onAccept, onDismiss, onClose }) {
  const sugInputs = inputs.filter((inp) => (suggestion.input_ids || []).includes(inp.id));

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 300 }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: c.white, borderLeft: `1px solid ${c.border}`,
        zIndex: 301, display: "flex", flexDirection: "column",
        animation: "drawerSlideIn 0.28s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: `1px solid ${c.border}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 4 }}>
              AI suggestion
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, color: c.ink, lineHeight: 1.35 }}>
              {suggestion.name}
            </div>
          </div>
          <button onClick={onClose} style={{ ...btnG, fontSize: 16, padding: "2px 6px", color: c.muted, flexShrink: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {suggestion.description && (
            <div style={{ marginBottom: 24 }}>
              <div style={fl}>Description</div>
              <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.65 }}>{suggestion.description}</div>
            </div>
          )}

          <div>
            <div style={fl}>
              Linked inputs
              <span style={{ ...badg, marginLeft: 2 }}>{sugInputs.length}</span>
            </div>
            {sugInputs.length === 0 ? (
              <div style={{ fontSize: 12, color: c.hint }}>No matching inputs found.</div>
            ) : (
              <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
                {sugInputs.map((inp, idx) => (
                  <div key={inp.id} style={{
                    padding: "9px 12px",
                    borderTop: idx > 0 ? `1px solid ${c.border}` : "none",
                    background: c.white,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{inp.name}</div>
                    {inp.description && (
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 2, lineHeight: 1.45 }}>
                        {inp.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px 20px", borderTop: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={() => { onDismiss(suggestion.id); onClose(); }}
            style={btnSec}
          >
            Dismiss
          </button>
          <button
            onClick={() => { onAccept(suggestion, suggestion.name); onClose(); }}
            style={btnP}
          >
            Accept →
          </button>
        </div>
      </div>
    </>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Clustering({ appState }) {
  const {
    activeProjectId, setActiveProjectId, projects, inputs, clusters,
    addCluster, addInput,
    assignInputToCluster,
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

  // Tightness setting for AI clustering
  const [tightness, setTightness] = useState("balanced");

  // AI suggestions state
  const [dbSuggestions,       setDbSuggestions]       = useState([]);
  const [loadingSuggestions,  setLoadingSuggestions]  = useState(false);
  const [generatingSugs,      setGeneratingSugs]      = useState(false);
  const [suggestionsError,    setSuggestionsError]    = useState(null);
  const [regenCooldownUntil,  setRegenCooldownUntil]  = useState(null);
  const [inputCountAtRegen,   setInputCountAtRegen]   = useState(null);
  const [lastRegenReason,     setLastRegenReason]     = useState(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);
  const [fadingOutIds,         setFadingOutIds]         = useState(new Set());

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

  const visibleSugs = useMemo(() =>
    dbSuggestions.filter((sug) => {
      if (fadingOutIds.has(sug.id)) return true; // keep in DOM during fade
      return !dismissedSuggestions.some(
        (dis) => overlapRatio(sug.input_ids, dis.input_ids) > 0.8
      );
    }),
    [dbSuggestions, dismissedSuggestions, fadingOutIds]
  );

  const mainSugs = useMemo(() => visibleSugs.filter((s) => !s.is_weak_signal), [visibleSugs]);
  const weakSugs = useMemo(() => visibleSugs.filter((s) =>  s.is_weak_signal), [visibleSugs]);

  const clearAllFilters = () => {
    setInputSearch(""); setFilterType(null); setFilterHorizon(null); setFilterSteepled(null);
  };

  const loadSuggestions = useCallback(async (projectId, wsId) => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    try {
      const { data, error } = await supabase
        .from("cluster_suggestions")
        .select("*")
        .eq("project_id", projectId)
        .eq("workspace_id", wsId)
        .eq("status", "pending")
        .order("generated_at", { ascending: false });
      if (error) throw error;
      setDbSuggestions(data || []);
    } catch (err) {
      setSuggestionsError(err.message || "Failed to load suggestions.");
      setDbSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (!project || !workspaceId) { setDbSuggestions([]); return; }
    loadSuggestions(project.id, workspaceId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const regenOnCooldown = regenCooldownUntil != null && Date.now() < regenCooldownUntil;
  const newInputsSinceRegen = inputCountAtRegen != null && projectInputs.length > inputCountAtRegen;

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

  const handleAcceptSuggestion = (sug, editedName, editedDesc, editedInputIds) => {
    const name     = editedName?.trim() || sug.name;
    const desc     = editedDesc ?? sug.description ?? "";
    const inputIds = editedInputIds ?? sug.input_ids ?? [];
    const subtype  = sug.subtype
      ? sug.subtype.charAt(0).toUpperCase() + sug.subtype.slice(1)
      : "Trend";
    setDbSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
    addCluster({
      name,
      subtype,
      horizon: "H1",
      likelihood: "Plausible",
      description: desc,
      project_id: project.id,
      input_ids: inputIds,
    });
    // Mark accepted in DB — fire and forget
    supabase
      .from("cluster_suggestions")
      .update({ status: "accepted", acted_on_at: new Date().toISOString() })
      .eq("id", sug.id)
      .then();
    const n = inputIds.length;
    showToast(`Cluster "${name}" created with ${n} input${n !== 1 ? "s" : ""}`);
  };

  const handleDismissSuggestion = (id) => {
    const sug = dbSuggestions.find((s) => s.id === id);
    if (sug) {
      setDismissedSuggestions((prev) => [...prev, { id: sug.id, input_ids: sug.input_ids || [] }]);
    }
    setFadingOutIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setDbSuggestions((prev) => prev.filter((s) => s.id !== id));
      setFadingOutIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 280);
    supabase
      .from("cluster_suggestions")
      .update({ status: "dismissed", acted_on_at: new Date().toISOString() })
      .eq("id", id)
      .then();
  };

  const handleRegen = async () => {
    if (!project || regenOnCooldown || generatingSugs) return;
    setGeneratingSugs(true);
    setSuggestionsError(null);
    try {
      const TIGHTNESS_MAP = {
        tight:       { threshold: 0.82, min_cluster_size: 3 },
        balanced:    { threshold: 0.72, min_cluster_size: 2 },
        exploratory: { threshold: 0.62, min_cluster_size: 2 },
      };
      const { threshold, min_cluster_size } = TIGHTNESS_MAP[tightness] || TIGHTNESS_MAP.balanced;
      const { data, error } = await supabase.functions.invoke("generate-cluster-suggestions", {
        body: { project_id: project.id, workspace_id: workspaceId, threshold, min_cluster_size },
      });
      if (error) {
        let message = error.message;
        try {
          const text = await error.context?.text?.();
          console.error("generate-cluster-suggestions error body:", text);
          const body = text ? JSON.parse(text) : null;
          if (body?.error) message = body.error;
          else if (text) message = text;
        } catch (e) {
          console.error("generate-cluster-suggestions error:", error);
        }
        throw new Error(message);
      }
      // Use the rows returned by the Edge Function directly — avoids a second
      // round-trip and any RLS timing issues on the immediate re-fetch.
      if (Array.isArray(data?.suggestions)) {
        setDbSuggestions(data.suggestions.filter((s) => s.status === "pending"));
      } else {
        await loadSuggestions(project.id, workspaceId);
      }
      setLastRegenReason(data?.reason ?? null);
      setRegenCooldownUntil(Date.now() + 60_000);
      setInputCountAtRegen(projectInputs.length);
    } catch (err) {
      setSuggestionsError(err.message || "Failed to generate suggestions.");
    } finally {
      setGeneratingSugs(false);
    }
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

  const anySelected = selectedInputIds.length > 0;

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
            count={projectClusters.length || null}
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {projectClusters.map((cl) => (
                <ClusterCard
                  key={cl.id}
                  cluster={cl}
                  inputs={projectInputs}
                  onClick={() => openClusterDetail(cl.id)}
                />
              ))}
            </div>
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
              <TableHead cols={[
                { label: "", width: "28px" },
                { label: "Title", width: "1fr" },
                { label: "Quality", width: "100px" },
                { label: "Horizon", width: "60px" },
                { label: "STEEPLED", width: "160px" },
                { label: "", width: "120px" },
              ]} />
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

        {/* ── Section 3: AI suggestions ─────────────────────────── */}
        <div style={{ marginBottom: 32 }}>

          {/* Tightness control */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: c.muted, whiteSpace: "nowrap" }}>Clustering</span>
            <div style={{
              display: "inline-flex",
              border: `1px solid ${c.borderMid}`,
              borderRadius: 7,
              overflow: "hidden",
              background: c.white,
            }}>
              {[
                { key: "tight",       label: "Tight" },
                { key: "balanced",    label: "Balanced" },
                { key: "exploratory", label: "Exploratory" },
              ].map(({ key, label }, idx) => (
                <button
                  key={key}
                  onClick={() => setTightness(key)}
                  style={{
                    padding: "5px 12px",
                    fontSize: 11,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    border: "none",
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
          </div>
          <SectionHeader
            title="AI suggestions"
            icon={<Sparkles size={16} />}
            count={visibleSugs.length || null}
            action={
              projectInputs.length >= 3 && visibleSugs.length > 0 && (
                <button
                  onClick={handleRegen}
                  disabled={regenOnCooldown || generatingSugs || loadingSuggestions}
                  style={{
                    fontSize: 11, padding: "4px 12px", borderRadius: 6,
                    background: "transparent", color: regenOnCooldown ? c.hint : c.muted,
                    border: `1px solid ${regenOnCooldown ? c.border : c.borderMid}`,
                    cursor: regenOnCooldown || generatingSugs ? "default" : "pointer",
                    fontFamily: "inherit",
                    opacity: regenOnCooldown ? 0.5 : 1,
                  }}
                >
                  Regenerate
                </button>
              )
            }
          />

          {/* New-inputs nudge */}
          {newInputsSinceRegen && visibleSugs.length > 0 && (
            <div style={{
              fontSize: 11, color: c.blue700,
              background: c.blue50, border: `1px solid ${c.blueBorder}`,
              borderRadius: 7, padding: "8px 14px", marginBottom: 10,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>
                You&apos;ve added {projectInputs.length - inputCountAtRegen} input{projectInputs.length - inputCountAtRegen !== 1 ? "s" : ""} since your last suggestions were generated.
              </span>
              <button
                onClick={handleRegen}
                disabled={regenOnCooldown || generatingSugs}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: c.blue700, fontWeight: 500, padding: 0 }}
              >
                Regenerate?
              </button>
            </div>
          )}

          {projectInputs.length < 3 ? (
            <div style={{
              padding: "16px 18px", background: c.white,
              border: `1px solid ${c.border}`, borderRadius: 9,
              fontSize: 12, color: c.hint,
            }}>
              Add at least 3 inputs with descriptions to generate cluster suggestions.
            </div>
          ) : loadingSuggestions || generatingSugs ? (
            <div style={{
              padding: "32px 18px", background: c.white,
              border: `1px solid ${c.border}`, borderRadius: 9,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                border: `2px solid ${c.border}`, borderTopColor: c.ink,
                animation: "clusterSpinner 0.7s linear infinite",
              }} />
              <div style={{ fontSize: 12, color: c.muted }}>
                {generatingSugs ? "Analysing your inputs…" : "Loading suggestions…"}
              </div>
              <style>{`@keyframes clusterSpinner { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : suggestionsError ? (
            <div style={{
              padding: "14px 18px", background: c.red50,
              border: `1px solid ${c.redBorder}`, borderRadius: 9,
              fontSize: 12, color: c.red800,
            }}>
              {suggestionsError}
            </div>
          ) : visibleSugs.length === 0 ? (
            lastRegenReason === "no_clusters" ? (
              <div style={{
                padding: "16px 18px", background: c.white,
                border: `1px solid ${c.border}`, borderRadius: 9,
                fontSize: 12, color: c.hint,
              }}>
                Your inputs are too varied to suggest clear clusters yet. Try adding more inputs on a focused topic.
              </div>
            ) : (
              <div style={{
                padding: "28px 24px", background: c.white,
                border: `1px solid ${c.border}`, borderRadius: 9,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 13, color: c.muted, marginBottom: 6 }}>No AI suggestions yet.</div>
                <div style={{ fontSize: 11, color: c.hint, marginBottom: 18 }}>
                  Run the AI to group your inputs by semantic similarity.
                </div>
                <button
                  onClick={handleRegen}
                  disabled={regenOnCooldown}
                  style={{ ...btnP, opacity: regenOnCooldown ? 0.5 : 1 }}
                >
                  Generate suggestions
                </button>
              </div>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mainSugs.map((sug) => (
                <SuggestionCard
                  key={sug.id}
                  suggestion={sug}
                  inputs={projectInputs}
                  onAccept={handleAcceptSuggestion}
                  onDismiss={handleDismissSuggestion}
                  isFadingOut={fadingOutIds.has(sug.id)}
                />
              ))}
              {weakSugs.map((sug) => (
                <SuggestionCard
                  key={sug.id}
                  suggestion={sug}
                  inputs={projectInputs}
                  onAccept={handleAcceptSuggestion}
                  onDismiss={handleDismissSuggestion}
                  isFadingOut={fadingOutIds.has(sug.id)}
                />
              ))}
            </div>
          )}
        </div>

      </div>

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

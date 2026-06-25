/**
 * Inbox screen — shows unassigned inputs (project_id === null).
 * Two tables: My Inputs (manual) and AI Suggested (scanner).
 * Three view densities (List / Compact / Card), full-text search,
 * inline filter panel (STEEPLED / Quality / Horizon), and multi-select
 * bulk actions (add to project, dismiss).
 * @param {{ appState: object }} props
 */
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { c, inp, btnP, btnSm, btnSec, btnG } from "../../styles/tokens.js";
import { CirclePlus, Sparkles, List, LayoutGrid } from "lucide-react";
import { ViewToggle } from "../ViewToggle.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { HorizTag } from "../shared/Tag.jsx";
import { AddToProjectButton } from "../shared/AddToProjectButton.jsx";
import { FilterDropdown } from "./ProjectDetail.jsx";
import { STEEPLED } from "../../data/seeds.js";

const STEEPLED_ABB  = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const INPUT_TYPE_OPTS = ["Signal", "Issue", "Projection", "Plan", "Obstacle"];

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

const AI_PREVIEW_COUNT = 10;

// Column widths for list/table layout
const COL = { type: 76, quality: 120, horizon: 52, steepled: 100, date: 55, cta: 220 };

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

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

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
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {indeterminate && !checked && (
        <div style={{ width: 7, height: 1.5, borderRadius: 1, background: c.white }} />
      )}
    </div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

// ─── Project picker popover ───────────────────────────────────────────────────

function ProjectPickerPopover({ projects, onSelect, onClose, onCreateProject }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
      <div style={{
        position: "absolute", top: "100%", left: 0, marginTop: 4,
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
        minWidth: 240, zIndex: 51, overflow: "hidden",
      }}>
        {projects.length === 0 ? (
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: c.hint, marginBottom: 8 }}>No projects yet.</div>
            <button onClick={() => { onClose(); onCreateProject(); }} style={{ fontSize: 11, color: c.blue700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              + Create project
            </button>
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {projects.map((p) => (
              <button key={p.id} onClick={() => onSelect(p)} style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 14px",
                background: "transparent", border: "none",
                textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                borderBottom: `1px solid ${c.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: c.hint }}>{p.domain}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${c.border}` }}>
          <button onClick={onClose} style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Table section header ─────────────────────────────────────────────────────

function SectionHeader({ title, count, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      {icon && <span style={{ display: "flex", alignItems: "center", color: c.muted }}>{icon}</span>}
      <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>{title}</div>
      {count > 0 && (
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 10,
          background: "rgba(0,0,0,0.06)", color: c.muted, fontWeight: 500,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ─── List table header ────────────────────────────────────────────────────────

function ListHeader({ checked, indeterminate, onToggleAll }) {
  const cell = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, flexShrink: 0 };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 14px", height: 30,
      borderBottom: "0.5px solid rgba(0,0,0,0.09)",
    }}>
      <div onClick={(e) => { e.stopPropagation(); onToggleAll(); }} style={{ cursor: "pointer", flexShrink: 0 }}>
        <RowCheckbox checked={checked} indeterminate={indeterminate} visible={true} />
      </div>
      <div style={{ flex: 1, minWidth: 0, ...cell }}>Title</div>
      <div style={{ width: COL.type,     ...cell }}>Type</div>
      <div style={{ width: COL.quality,  ...cell }}>Strength</div>
      <div style={{ width: COL.horizon,  ...cell }}>Horizon</div>
      <div style={{ width: COL.steepled, ...cell }}>STEEPLED</div>
      <div style={{ width: COL.date,     ...cell }}>Date</div>
      <div style={{ width: COL.cta, flexShrink: 0 }} />
    </div>
  );
}

// ─── List row (flat single-row) ────────────────────────────────────────────────

function ListRow({ input, isScannerSuggested, suggestedProjects, recommendedProjectId, projects, onAddToProject, onDismissSuggested, onOpen, selected, onToggle, anySelected }) {
  const [hovered, setHovered] = useState(false);
  const steepled = input.steepled || [];
  const vis2     = steepled.slice(0, 2);
  const overflow = steepled.length - 2;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 14px", minHeight: 38,
        background: selected ? c.surfaceAlt : hovered ? "rgba(0,0,0,0.02)" : c.white,
        borderBottom: `1px solid ${c.border}`,
        cursor: "pointer",
        transition: "background 0.08s",
      }}
    >
      <div onClick={(e) => { e.stopPropagation(); onToggle(input.id); }} style={{ cursor: "pointer", flexShrink: 0 }}>
        <RowCheckbox checked={selected} visible={anySelected || hovered} />
      </div>

      {/* Title + suggested projects hint */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {input.name}
        </div>
        {isScannerSuggested && suggestedProjects.length > 0 && (
          <div style={{ fontSize: 11, color: c.hint, marginTop: 2 }}>
            {suggestedProjects.slice(0, 2).map((p) => p.name).join(", ")}
          </div>
        )}
      </div>

      {/* Type */}
      <div style={{ width: COL.type, flexShrink: 0, fontSize: 11, color: c.muted }}>
        {input.subtype
          ? input.subtype.charAt(0).toUpperCase() + input.subtype.slice(1)
          : <span style={{ color: c.hint }}>—</span>}
      </div>

      {/* Strength / Confidence */}
      <div style={{ width: COL.quality, flexShrink: 0 }}>
        <StrengthCell strength={input.signal_strength} confidence={input.source_confidence} />
      </div>

      {/* Horizon */}
      <div style={{ width: COL.horizon, flexShrink: 0, fontSize: 11, color: input.horizon ? c.muted : c.hint }}>
        {input.horizon || "—"}
      </div>

      {/* STEEPLED */}
      <div style={{ width: COL.steepled, flexShrink: 0, display: "flex", gap: 3, alignItems: "center" }}>
        {vis2.map((t) => (
          <span key={t} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: c.surfaceAlt, color: c.muted }}>
            {STEEPLED_ABB[t] || t}
          </span>
        ))}
        {overflow > 0 && <span style={{ fontSize: 9, color: c.hint }}>+{overflow}</span>}
      </div>

      {/* Date */}
      <div style={{ width: COL.date, flexShrink: 0, fontSize: 10, color: c.hint }}>
        {formatDate(input.created_at)}
      </div>

      {/* CTA */}
      <div style={{ width: COL.cta, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <AddToProjectButton
            projects={projects}
            recommendedProjectId={isScannerSuggested ? recommendedProjectId : undefined}
            onAdd={onAddToProject}
            buttonStyle={{ ...btnSm, fontSize: 10, padding: "3px 8px" }}
          />
          {isScannerSuggested && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismissSuggested(); }}
              style={{ fontSize: 10, padding: "3px 6px", background: "none", border: "none", color: c.hint, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Full card (Card view) ────────────────────────────────────────────────────

function FullCard({ input, isScannerSuggested, suggestedProjects, recommendedProjectId, projects, savedProjectId, onAddToProject, onDismissSuggested, onDismiss, onOpen, selected, onToggle, anySelected }) {
  const [hovered, setHovered] = useState(false);
  const project = savedProjectId ? projects.find((p) => p.id === savedProjectId) : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: c.white,
        border: `1px solid ${selected ? c.borderMid : c.border}`,
        borderRadius: 10, padding: "14px 16px",
        transition: "border-color 0.15s",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}
    >
      <div onClick={(e) => { e.stopPropagation(); onToggle(input.id); }} style={{ paddingTop: 2, flexShrink: 0, cursor: "pointer" }}>
        <RowCheckbox checked={selected} visible={anySelected || hovered} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          {!isScannerSuggested && input.subtype && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f0f0ee", color: c.faint }}>
              {input.subtype}
            </span>
          )}
          <span style={{ marginLeft: "auto" }}><StrengthCell strength={input.signal_strength} confidence={input.source_confidence} /></span>
        </div>

        <div
          onClick={(e) => { e.stopPropagation(); onToggle(input.id); }}
          style={{ fontSize: 13, fontWeight: 500, color: c.ink, lineHeight: 1.35, marginBottom: isScannerSuggested && suggestedProjects.length > 0 ? 2 : 5, cursor: "pointer" }}
        >
          {input.name}
        </div>

        {isScannerSuggested && suggestedProjects.length > 0 && (
          <div style={{ fontSize: 11, color: c.hint, marginBottom: 8 }}>
            {suggestedProjects.slice(0, 2).map((p) => p.name).join(", ")}
          </div>
        )}

        {(input.description || input.desc) && (
          <div
            onClick={anySelected ? undefined : onOpen}
            style={{ fontSize: 11, color: c.muted, lineHeight: 1.6, marginBottom: 10, cursor: anySelected ? "default" : "pointer" }}
          >
            {input.description || input.desc}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(input.steepled || []).map((cat) => (
            <span key={cat} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f0f0ee", color: c.muted }}>
              {cat}
            </span>
          ))}
          <HorizTag h={input.horizon} />
          <span style={{ fontSize: 10, color: c.hint }}>{formatDate(input.created_at)}</span>

          {!anySelected && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {savedProjectId ? (
                <span style={{ fontSize: 11, color: c.green700, background: c.green50, border: `1px solid ${c.greenBorder}`, borderRadius: 6, padding: "3px 9px" }}>
                  ✓ Saved to {project?.name || "project"}
                </span>
              ) : (
                <>
                  <AddToProjectButton
                    projects={projects}
                    recommendedProjectId={isScannerSuggested ? recommendedProjectId : undefined}
                    onAdd={onAddToProject}
                    buttonStyle={{ padding: "4px 12px", borderRadius: 7, background: c.brand, color: c.white, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                  />
                  {isScannerSuggested && (
                    <button onClick={(e) => { e.stopPropagation(); onDismissSuggested(); }} style={{ ...btnG, fontSize: 11, padding: "4px 8px", color: c.hint }}>
                      Dismiss
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Per-section search + filter bar ──────────────────────────────────────────

function SearchFilterBar({
  search, onSearchChange,
  filterType, onFilterTypeChange,
  filterHorizon, onFilterHorizonChange,
  filterSteepled, onFilterSteepledChange,
  filterProject, onFilterProjectChange, projectOptions,
  openDropdown, onToggleDropdown,
  onClearAll,
}) {
  const anyFilterActive = !!(search.trim() || filterType || filterHorizon || filterSteepled || filterProject);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
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
          onChange={onFilterTypeChange}
          onClear={() => onFilterTypeChange(null)}
          isOpen={openDropdown === "type"}
          onToggle={() => onToggleDropdown("type")}
        />
        <FilterDropdown
          label="Horizon"
          value={filterHorizon}
          options={["H1", "H2", "H3"].map((v) => ({ value: v, label: v }))}
          onChange={onFilterHorizonChange}
          onClear={() => onFilterHorizonChange(null)}
          isOpen={openDropdown === "horizon"}
          onToggle={() => onToggleDropdown("horizon")}
        />
        <FilterDropdown
          label="STEEPLED"
          value={filterSteepled}
          options={STEEPLED.map((v) => ({ value: v, label: v }))}
          onChange={onFilterSteepledChange}
          onClear={() => onFilterSteepledChange(null)}
          isOpen={openDropdown === "steepled"}
          onToggle={() => onToggleDropdown("steepled")}
        />
        {projectOptions && (
          <FilterDropdown
            label="Project"
            value={filterProject}
            options={projectOptions}
            onChange={onFilterProjectChange}
            onClear={() => onFilterProjectChange("")}
            isOpen={openDropdown === "project"}
            onToggle={() => onToggleDropdown("project")}
            menuWidth={200}
          />
        )}
      </div>
      {anyFilterActive && (
        <button
          onClick={onClearAll}
          style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
        >
          Clear all
        </button>
      )}
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

export default function Inbox({ appState }) {
  const {
    inputs, projects,
    addInput, dismissInput, dismissSuggestedInput, deleteInput,
    saveInputToProject, saveInputsToProject,
    showToast, openInputDetail, openProjectModal,
    inboxProjectFilter, setInboxProjectFilter,
  } = appState;

  const [drawerOpen,        setDrawerOpen]        = useState(false);
  const [viewMode,          setViewMode]          = useState("list");

  // My Inputs — search + filters
  const [manualSearch,            setManualSearch]            = useState("");
  const [manualFilterType,        setManualFilterType]        = useState(null);
  const [manualFilterHorizon,     setManualFilterHorizon]     = useState(null);
  const [manualFilterSteepled,    setManualFilterSteepled]    = useState(null);
  const [manualOpenFilterDropdown,setManualOpenFilterDropdown]= useState(null);

  // AI Suggested — search + filters
  const [aiSearch,            setAiSearch]            = useState("");
  const [aiFilterType,        setAiFilterType]        = useState(null);
  const [aiFilterHorizon,     setAiFilterHorizon]     = useState(null);
  const [aiFilterSteepled,    setAiFilterSteepled]    = useState(null);
  // Pre-select only when arriving via deep-link (inboxProjectFilter is a project ID).
  // Otherwise start with "All projects" — no automatic default.
  const [aiFilterProject,     setAiFilterProject]     = useState(
    typeof inboxProjectFilter === "string" && inboxProjectFilter ? inboxProjectFilter : ""
  );
  const [aiOpenFilterDropdown,setAiOpenFilterDropdown]= useState(null);

  const [savedToProject,    setSavedToProject]    = useState({});
  const [selectedManualIds, setSelectedManualIds] = useState([]);
  const [selectedAiIds,     setSelectedAiIds]     = useState([]);
  const [manualPickerOpen,       setManualPickerOpen]       = useState(false);
  const [aiPickerOpen,           setAiPickerOpen]           = useState(false);
  const [aiExpanded,             setAiExpanded]             = useState(false);
  const [confirmDeleteManualIds, setConfirmDeleteManualIds] = useState(null);

  // All inbox inputs (base list — used for total count + selection reference)
  const allInboxInputs = useMemo(() =>
    [...inputs.filter((i) =>
      i.project_id === null &&
      !(i.is_seeded && i.metadata?.source === "scanner" && i.metadata?.dismissed)
    )].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [inputs]
  );

  // Split into manual vs AI suggested
  const manualInputs = useMemo(
    () => allInboxInputs.filter((i) => !(i.is_seeded && i.metadata?.source === "scanner")),
    [allInboxInputs]
  );
  // True if any manually-created inputs exist anywhere in the workspace (assigned or not)
  const hasAnyManualInputs = useMemo(
    () => inputs.some((i) => !(i.is_seeded && i.metadata?.source === "scanner")),
    [inputs]
  );
  const aiInputs = useMemo(
    () => allInboxInputs.filter((i) => i.is_seeded && i.metadata?.source === "scanner"),
    [allInboxInputs]
  );

  // Project filter dropdown options for AI Suggested — "All projects" plus
  // one entry per project (name + domain subtitle).
  const aiProjectFilterOptions = useMemo(() => [
    { value: "", label: "All projects" },
    ...projects.map((p) => ({ value: p.id, label: p.name, sublabel: p.domain })),
  ], [projects]);

  // Apply search + filters independently per section
  const filteredManual = useMemo(() =>
    manualInputs
      .filter((i) => !manualSearch || (i.name || "").toLowerCase().includes(manualSearch.toLowerCase()) || (i.description || "").toLowerCase().includes(manualSearch.toLowerCase()))
      .filter((i) => !manualFilterType     || i.subtype === manualFilterType)
      .filter((i) => !manualFilterHorizon  || i.horizon === manualFilterHorizon)
      .filter((i) => !manualFilterSteepled || (i.steepled || []).includes(manualFilterSteepled)),
    [manualInputs, manualSearch, manualFilterType, manualFilterHorizon, manualFilterSteepled]
  );
  const filteredAI = useMemo(() =>
    aiInputs
      .filter((i) => !aiSearch || (i.name || "").toLowerCase().includes(aiSearch.toLowerCase()) || (i.description || "").toLowerCase().includes(aiSearch.toLowerCase()))
      .filter((i) => !aiFilterType     || i.subtype === aiFilterType)
      .filter((i) => !aiFilterHorizon  || i.horizon === aiFilterHorizon)
      .filter((i) => !aiFilterSteepled || (i.steepled || []).includes(aiFilterSteepled))
      .filter((i) => !aiFilterProject  || (i.metadata?.suggested_projects || []).some((p) => p.id === aiFilterProject)),
    [aiInputs, aiSearch, aiFilterType, aiFilterHorizon, aiFilterSteepled, aiFilterProject]
  );

  // AI items to display (collapsed = first 10)
  const visibleAI = aiExpanded ? filteredAI : filteredAI.slice(0, AI_PREVIEW_COUNT);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = (fields) => {
    addInput(fields);
    showToast("Input saved to Inbox");
    setDrawerOpen(false);
  };

  const handleDismiss = (id) => {
    dismissInput(id);
    showToast("Input dismissed");
  };

  const handleDismissSuggested = (inp) => {
    dismissSuggestedInput(inp);
    showToast("Signal dismissed");
  };

  const toggleSelectManual = (id) => {
    setSelectedManualIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAi = (id) => {
    setSelectedAiIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  // Select-all for the My Inputs header checkbox — applies to all rows
  // currently visible under the active search/filters.
  const allManualSelected  = filteredManual.length > 0 && filteredManual.every((i) => selectedManualIds.includes(i.id));
  const someManualSelected = filteredManual.some((i) => selectedManualIds.includes(i.id));

  const toggleSelectAllManual = () => {
    if (allManualSelected) {
      setSelectedManualIds((prev) => prev.filter((id) => !filteredManual.some((i) => i.id === id)));
    } else {
      setSelectedManualIds((prev) => [...new Set([...prev, ...filteredManual.map((i) => i.id)])]);
    }
  };

  // Select-all for the AI Suggested header checkbox — applies to the rows
  // currently rendered (respecting the collapsed preview + active filters).
  const allAiSelected  = visibleAI.length > 0 && visibleAI.every((i) => selectedAiIds.includes(i.id));
  const someAiSelected = visibleAI.some((i) => selectedAiIds.includes(i.id));

  const toggleSelectAllAi = () => {
    if (allAiSelected) {
      setSelectedAiIds((prev) => prev.filter((id) => !visibleAI.some((i) => i.id === id)));
    } else {
      setSelectedAiIds((prev) => [...new Set([...prev, ...visibleAI.map((i) => i.id)])]);
    }
  };

  const clearManualSelection = () => { setSelectedManualIds([]); setManualPickerOpen(false); };
  const clearAiSelection     = () => { setSelectedAiIds([]);     setAiPickerOpen(false); };

  const handleBulkDeleteManual = () => {
    confirmDeleteManualIds.forEach((id) => deleteInput(id));
    const n = confirmDeleteManualIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} deleted`);
    setConfirmDeleteManualIds(null);
    clearManualSelection();
  };

  const handleBulkAddToProjectManual = (project) => {
    saveInputsToProject(selectedManualIds, project.id);
    const n = selectedManualIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} added to "${project.name}"`);
    clearManualSelection();
  };

  const handleBulkAddToProjectAi = (project) => {
    saveInputsToProject(selectedAiIds, project.id);
    const n = selectedAiIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} added to "${project.name}"`);
    clearAiSelection();
  };

  const handleBulkAcceptAi = () => {
    const selectedInputs = aiInputs.filter((i) => selectedAiIds.includes(i.id));
    selectedInputs.forEach((inp) => {
      const topProject = inp.metadata?.suggested_projects?.[0];
      if (!topProject) return;
      saveInputToProject(inp.id, topProject.id);
      setSavedToProject((prev) => ({ ...prev, [inp.id]: topProject.id }));
    });
    const n = selectedInputs.length;
    showToast(`${n} signal${n !== 1 ? "s" : ""} accepted`);
    clearAiSelection();
  };

  const handleBulkDismissAi = () => {
    const selectedInputs = aiInputs.filter((i) => selectedAiIds.includes(i.id));
    selectedInputs.forEach((inp) => dismissSuggestedInput(inp));
    const n = selectedInputs.length;
    showToast(`${n} signal${n !== 1 ? "s" : ""} dismissed`);
    clearAiSelection();
  };

  const clearManualFilters = () => {
    setManualSearch("");
    setManualFilterType(null);
    setManualFilterHorizon(null);
    setManualFilterSteepled(null);
  };

  const clearAiFilters = () => {
    setAiSearch("");
    setAiFilterType(null);
    setAiFilterHorizon(null);
    setAiFilterSteepled(null);
    setAiFilterProject("");
    setInboxProjectFilter(null);
  };

  const handleAddToProject = (inp, projectId) => {
    const project = projects.find((p) => p.id === projectId);
    saveInputToProject(inp.id, projectId);
    setSavedToProject((prev) => ({ ...prev, [inp.id]: projectId }));
    showToast(`Added to "${project?.name || "project"}"`);
  };

  // Item props builder — selection context passed per-table
  const itemProps = (inp, selectedIds, onToggle, anyTableSelected) => {
    // Cross-reference against currently-active projects — `projects` only
    // contains live (non-deleted) rows, so this drops references to
    // projects the user has since deleted.
    const suggestedProjects = (inp.metadata?.suggested_projects || []).filter((sp) =>
      projects.some((proj) => proj.id === sp.id)
    );
    const recommendedProjectId = suggestedProjects.length > 0
      ? suggestedProjects.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0].id
      : undefined;

    return {
      input: inp,
      isSeeded: !!inp.is_seeded,
      isScannerSuggested: !!(inp.is_seeded && inp.metadata?.source === "scanner"),
      suggestedProjects,
      recommendedProjectId,
      projects,
      savedProjectId: savedToProject[inp.id],
      onAddToProject: (projectId) => handleAddToProject(inp, projectId),
      onDismissSuggested: () => handleDismissSuggested(inp),
      onDismiss: handleDismiss,
      onOpen: () => openInputDetail(inp.id),
      selected: selectedIds.includes(inp.id),
      onToggle,
      anySelected: anyTableSelected,
    };
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderList = (items, getProps, headerProps) => (
    <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
      <ListHeader {...headerProps} />
      {items.map((inp) => <ListRow key={inp.id} {...getProps(inp)} />)}
    </div>
  );

  const renderCards = (items, getProps) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((inp) => <FullCard key={inp.id} {...getProps(inp)} />)}
    </div>
  );

  const renderItems = (items, getProps, headerProps) => {
    if (viewMode === "list") return renderList(items, getProps, headerProps);
    return renderCards(items, getProps);
  };

  const manualGetProps = (inp) => itemProps(inp, selectedManualIds, toggleSelectManual, selectedManualIds.length > 0);
  const aiGetProps     = (inp) => itemProps(inp, selectedAiIds,     toggleSelectAi,     selectedAiIds.length > 0);

  // Empty state content for the My Inputs section — rendered inside the table body
  const manualEmptyContent = manualInputs.length === 0 && hasAnyManualInputs ? (
    <div style={{ textAlign: "center", padding: "24px 0 36px", color: c.muted, fontSize: 13 }}>
      All your inputs have been assigned to a project.
    </div>
  ) : manualInputs.length === 0 ? (
    <EmptyState
      icon="◎"
      title="Your inbox is empty."
      body="Add your first input manually, or capture signals from the web with the Chrome extension."
      ctaLabel="Add an input"
      onCta={() => setDrawerOpen(true)}
    />
  ) : (
    <div style={{ textAlign: "center", padding: "24px 0 36px", color: c.hint, fontSize: 13 }}>
      No inputs match your {manualSearch ? "search" : "filters"}.{" "}
      <button onClick={clearManualFilters} style={{ color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
        Clear all
      </button>
    </div>
  );

  return (
    <>
      <div style={{ padding: "24px 32px", background: c.bg, minHeight: "100%" }}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
              Workspace
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Inbox</div>
              {allInboxInputs.length > 0 && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(0,0,0,0.06)", color: c.muted, fontWeight: 500 }}>
                  {allInboxInputs.length}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setDrawerOpen(true)} style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}><CirclePlus size={14} />Add an input</button>
          </div>
        </div>

        {/* ── My Inputs table ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>My Inputs</div>
            {filteredManual.length > 0 && (
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "rgba(0,0,0,0.06)", color: c.muted, fontWeight: 500 }}>
                {filteredManual.length}
              </span>
            )}
          </div>
          <ViewToggle
            view={viewMode}
            onChange={setViewMode}
            options={[
              { value: "list", icon: <List size={14} />, title: "List view" },
              { value: "card", icon: <LayoutGrid size={14} />, title: "Card view" },
            ]}
          />
        </div>

        <SearchFilterBar
          search={manualSearch}
          onSearchChange={setManualSearch}
          filterType={manualFilterType}
          onFilterTypeChange={setManualFilterType}
          filterHorizon={manualFilterHorizon}
          onFilterHorizonChange={setManualFilterHorizon}
          filterSteepled={manualFilterSteepled}
          onFilterSteepledChange={setManualFilterSteepled}
          openDropdown={manualOpenFilterDropdown}
          onToggleDropdown={(key) => setManualOpenFilterDropdown((d) => d === key ? null : key)}
          onClearAll={clearManualFilters}
        />

        {/* My Inputs inline action bar */}
        {selectedManualIds.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: "rgb(249, 249, 247)",
            border: `1px solid ${c.border}`, borderRadius: 8, marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, flex: 1 }}>
              {selectedManualIds.length} selected
            </span>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setManualPickerOpen((s) => !s)}
                style={{
                  padding: "7px 14px", borderRadius: 7, fontSize: 11,
                  background: "transparent", color: "rgb(102, 102, 102)",
                  border: "1px solid rgb(200, 200, 200)",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Add to project →
              </button>
              {manualPickerOpen && (
                <ProjectPickerPopover
                  projects={projects}
                  onSelect={handleBulkAddToProjectManual}
                  onClose={() => setManualPickerOpen(false)}
                  onCreateProject={() => { clearManualSelection(); openProjectModal(); }}
                />
              )}
            </div>
            <button
              onClick={() => setConfirmDeleteManualIds([...selectedManualIds])}
              style={{
                padding: "7px 14px", borderRadius: 7, fontSize: 11, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
                background: "rgb(254, 226, 226)", color: "rgb(185, 28, 28)", border: "none",
              }}
            >
              Delete
            </button>
            <button onClick={clearManualSelection} style={{ fontSize: 11, color: "rgb(102, 102, 102)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              ✕ Clear
            </button>
          </div>
        )}

        <div style={{ marginBottom: 36 }}>
          {viewMode === "list" ? (
            <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
              <ListHeader
                checked={allManualSelected}
                indeterminate={!allManualSelected && someManualSelected}
                onToggleAll={toggleSelectAllManual}
              />
              {filteredManual.length > 0
                ? filteredManual.map((inp) => <ListRow key={inp.id} {...manualGetProps(inp)} />)
                : manualEmptyContent}
            </div>
          ) : filteredManual.length > 0 ? (
            renderCards(filteredManual, manualGetProps)
          ) : (
            manualEmptyContent
          )}
        </div>

        {/* ── AI Suggested table ───────────────────────────────── */}
        {aiInputs.length > 0 && (
          <>
            <SectionHeader title="AI Suggested" count={aiInputs.length} icon={<Sparkles size={16} />} />

            <SearchFilterBar
              search={aiSearch}
              onSearchChange={setAiSearch}
              filterType={aiFilterType}
              onFilterTypeChange={setAiFilterType}
              filterHorizon={aiFilterHorizon}
              onFilterHorizonChange={setAiFilterHorizon}
              filterSteepled={aiFilterSteepled}
              onFilterSteepledChange={setAiFilterSteepled}
              filterProject={aiFilterProject}
              onFilterProjectChange={(v) => { setAiFilterProject(v); setInboxProjectFilter(v || null); }}
              projectOptions={aiProjectFilterOptions}
              openDropdown={aiOpenFilterDropdown}
              onToggleDropdown={(key) => setAiOpenFilterDropdown((d) => d === key ? null : key)}
              onClearAll={clearAiFilters}
            />

            <div style={{ fontSize: 11, color: c.hint, marginBottom: 8 }}>
              Showing {filteredAI.length} of {aiInputs.length}
            </div>

            {/* AI Suggested inline action bar */}
            {selectedAiIds.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", background: "rgb(249, 249, 247)",
                border: `1px solid ${c.border}`, borderRadius: 8, marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, flex: 1 }}>
                  {selectedAiIds.length} selected
                </span>
                <button onClick={handleBulkAcceptAi} style={{ ...btnSm, fontSize: 11 }}>
                  Accept →
                </button>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setAiPickerOpen((s) => !s)}
                    style={{
                      padding: "7px 14px", borderRadius: 7, fontSize: 11,
                      background: "transparent", color: "rgb(102, 102, 102)",
                      border: "1px solid rgb(200, 200, 200)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Add to project →
                  </button>
                  {aiPickerOpen && (
                    <ProjectPickerPopover
                      projects={projects}
                      onSelect={handleBulkAddToProjectAi}
                      onClose={() => setAiPickerOpen(false)}
                      onCreateProject={() => { clearAiSelection(); openProjectModal(); }}
                    />
                  )}
                </div>
                <button
                  onClick={handleBulkDismissAi}
                  style={{
                    padding: "7px 14px", borderRadius: 7, fontSize: 11,
                    background: "transparent", color: "rgb(102, 102, 102)",
                    border: "1px solid rgb(200, 200, 200)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Dismiss
                </button>
                <button onClick={clearAiSelection} style={{ fontSize: 11, color: "rgb(102, 102, 102)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  ✕ Clear
                </button>
              </div>
            )}

            {filteredAI.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: c.hint, fontSize: 13 }}>
                No AI suggestions match your {aiSearch ? "search" : "filters"}.{" "}
                <button
                  onClick={clearAiFilters}
                  style={{ color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
                >
                  Clear all
                </button>
              </div>
            ) : (
              <>
                {renderItems(visibleAI, aiGetProps, {
                  checked: allAiSelected,
                  indeterminate: !allAiSelected && someAiSelected,
                  onToggleAll: toggleSelectAllAi,
                })}
                {!aiExpanded && filteredAI.length > AI_PREVIEW_COUNT && (
                  <button
                    onClick={() => setAiExpanded(true)}
                    style={{
                      display: "block", width: "100%", marginTop: 8,
                      padding: "9px 0", borderRadius: 8, fontSize: 12,
                      background: "transparent", border: `1px solid ${c.border}`,
                      color: c.muted, cursor: "pointer", fontFamily: "inherit",
                      textAlign: "center",
                    }}
                  >
                    Show all {filteredAI.length} →
                  </button>
                )}
              </>
            )}
          </>
        )}

      </div>

      <InputDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        projects={projects}
      />

      {confirmDeleteManualIds && (
        <ConfirmDeleteModal
          count={confirmDeleteManualIds.length}
          onConfirm={handleBulkDeleteManual}
          onCancel={() => setConfirmDeleteManualIds(null)}
        />
      )}
    </>
  );
}

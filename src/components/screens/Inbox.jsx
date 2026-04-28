/**
 * Inbox screen — shows unassigned inputs (project_id === null).
 * Two tables: My Inputs (manual) and AI Suggested (scanner).
 * Three view densities (List / Compact / Card), full-text search,
 * inline filter panel (STEEPLED / Quality / Horizon), and multi-select
 * bulk actions (add to project, dismiss).
 * @param {{ appState: object }} props
 */
import { useState, useMemo } from "react";
import { c, inp, btnP, btnSm, btnSec, btnG } from "../../styles/tokens.js";
import { CirclePlus, Sparkles, List, LayoutGrid } from "lucide-react";
import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { HorizTag } from "../shared/Tag.jsx";
import { ProjectPickerModal } from "../shared/ProjectPickerModal.jsx";
import { FilterDropdown } from "./ProjectDetail.jsx";
import { STEEPLED } from "../../data/seeds.js";

const STEEPLED_ABB  = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const INPUT_TYPE_OPTS = ["Signal", "Issue", "Projection", "Plan", "Obstacle"];

const QUALITY_COLORS = {
  Emerging:    [c.amber700, c.amber50, c.amberBorder],
  Established: [c.blue700,  c.blue50,  c.blueBorder],
  Confirmed:   [c.green700, c.green50, c.greenBorder],
};

const AI_PREVIEW_COUNT = 10;

// Column widths for list/table layout
const COL = { type: 76, quality: 94, horizon: 52, steepled: 100, date: 55, cta: 220 };

function QualityPill({ value }) {
  if (!value) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  const [col, bg, brd] = QUALITY_COLORS[value] || [c.hint, c.surfaceAlt, c.border];
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

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
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
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

// ─── Single-input project picker modal ───────────────────────────────────────

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

function ListHeader() {
  const cell = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, flexShrink: 0 };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 14px", height: 30,
      borderBottom: "0.5px solid rgba(0,0,0,0.09)",
    }}>
      <div style={{ width: 15, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, ...cell }}>Title</div>
      <div style={{ width: COL.type,     ...cell }}>Type</div>
      <div style={{ width: COL.quality,  ...cell }}>Quality</div>
      <div style={{ width: COL.horizon,  ...cell }}>Horizon</div>
      <div style={{ width: COL.steepled, ...cell }}>STEEPLED</div>
      <div style={{ width: COL.date,     ...cell }}>Date</div>
      <div style={{ width: COL.cta, flexShrink: 0 }} />
    </div>
  );
}

// ─── List row (flat single-row) ────────────────────────────────────────────────

function ListRow({ input, isScannerSuggested, suggestedProjects, onSaveToProject, onAccept, onDismissSuggested, onOpen, selected, onToggle, anySelected }) {
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

      {/* Quality */}
      <div style={{ width: COL.quality, flexShrink: 0 }}>
        <QualityPill value={input.signal_quality} />
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
        {isScannerSuggested && suggestedProjects.length > 0 ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              style={{ ...btnSm, fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }}
            >
              Accept →
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }}
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 7, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              Add to project →
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDismissSuggested(); }}
              style={{ fontSize: 10, padding: "3px 6px", background: "none", border: "none", color: c.hint, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              Dismiss
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }}
            style={{ ...btnSm, fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }}
          >
            Add to project →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Full card (Card view) ────────────────────────────────────────────────────

function FullCard({ input, isScannerSuggested, suggestedProjects, projects, savedProjectId, onSaveToProject, onAccept, onDismissSuggested, onDismiss, onOpen, selected, onToggle, anySelected }) {
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
          <span style={{ marginLeft: "auto" }}><QualityPill value={input.signal_quality} /></span>
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
              ) : isScannerSuggested && suggestedProjects.length > 0 ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onAccept(); }} style={{ padding: "4px 12px", borderRadius: 7, background: c.ink, color: c.white, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    Accept →
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }} style={{ padding: "4px 12px", borderRadius: 7, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    Add to project →
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDismissSuggested(); }} style={{ ...btnG, fontSize: 11, padding: "4px 8px", color: c.hint }}>
                    Dismiss
                  </button>
                </>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }} style={{ padding: "4px 12px", borderRadius: 7, background: c.brand, color: c.white, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  Add to project →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared filter function ────────────────────────────────────────────────────

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
  const [search,            setSearch]            = useState("");
  const [filterType,        setFilterType]        = useState(null);
  const [filterHorizon,     setFilterHorizon]     = useState(null);
  const [filterSteepled,    setFilterSteepled]    = useState(null);
  const [openFilterDropdown,setOpenFilterDropdown]= useState(null);
  const [savedToProject,    setSavedToProject]    = useState({});
  const [savingInputId,     setSavingInputId]     = useState(null);
  const [selectedManualIds, setSelectedManualIds] = useState([]);
  const [selectedAiIds,     setSelectedAiIds]     = useState([]);
  const [manualPickerOpen,  setManualPickerOpen]  = useState(false);
  const [aiPickerOpen,      setAiPickerOpen]      = useState(false);
  const [aiExpanded,        setAiExpanded]        = useState(false);

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
  const aiInputs = useMemo(() => {
    const all = allInboxInputs.filter((i) => i.is_seeded && i.metadata?.source === "scanner");
    if (!inboxProjectFilter) return all;
    return all.filter((i) => i.metadata?.suggested_projects?.some((p) => p.id === inboxProjectFilter));
  }, [allInboxInputs, inboxProjectFilter]);

  const anyFilterActive = !!(search.trim() || filterType || filterHorizon || filterSteepled);
  const hasActiveSearch = anyFilterActive;

  // Apply search + filters independently
  const filteredManual = useMemo(() =>
    manualInputs
      .filter((i) => !search || (i.name || "").toLowerCase().includes(search.toLowerCase()) || (i.description || "").toLowerCase().includes(search.toLowerCase()))
      .filter((i) => !filterType     || i.subtype === filterType)
      .filter((i) => !filterHorizon  || i.horizon === filterHorizon)
      .filter((i) => !filterSteepled || (i.steepled || []).includes(filterSteepled)),
    [manualInputs, search, filterType, filterHorizon, filterSteepled]
  );
  const filteredAI = useMemo(() =>
    aiInputs
      .filter((i) => !search || (i.name || "").toLowerCase().includes(search.toLowerCase()) || (i.description || "").toLowerCase().includes(search.toLowerCase()))
      .filter((i) => !filterType     || i.subtype === filterType)
      .filter((i) => !filterHorizon  || i.horizon === filterHorizon)
      .filter((i) => !filterSteepled || (i.steepled || []).includes(filterSteepled)),
    [aiInputs, search, filterType, filterHorizon, filterSteepled]
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

  const clearManualSelection = () => { setSelectedManualIds([]); setManualPickerOpen(false); };
  const clearAiSelection     = () => { setSelectedAiIds([]);     setAiPickerOpen(false); };

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

  const clearFilters = () => { setFilterType(null); setFilterHorizon(null); setFilterSteepled(null); };

  const handleAccept = (inp) => {
    const topProject = inp.metadata?.suggested_projects?.[0];
    if (!topProject) return;
    saveInputToProject(inp.id, topProject.id);
    setSavedToProject((prev) => ({ ...prev, [inp.id]: topProject.id }));
    showToast(`Added to "${topProject.name}"`);
  };

  // Item props builder — selection context passed per-table
  const itemProps = (inp, selectedIds, onToggle, anyTableSelected) => ({
    input: inp,
    isSeeded: !!inp.is_seeded,
    isScannerSuggested: !!(inp.is_seeded && inp.metadata?.source === "scanner"),
    suggestedProjects: inp.metadata?.suggested_projects || [],
    projects,
    savedProjectId: savedToProject[inp.id],
    onSaveToProject: (id) => setSavingInputId(id),
    onAccept: () => handleAccept(inp),
    onDismissSuggested: () => handleDismissSuggested(inp),
    onDismiss: handleDismiss,
    onOpen: () => openInputDetail(inp.id),
    selected: selectedIds.includes(inp.id),
    onToggle,
    anySelected: anyTableSelected,
  });

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderList = (items, getProps) => (
    <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
      <ListHeader />
      {items.map((inp) => <ListRow key={inp.id} {...getProps(inp)} />)}
    </div>
  );

  const renderCards = (items, getProps) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((inp) => <FullCard key={inp.id} {...getProps(inp)} />)}
    </div>
  );

  const renderItems = (items, getProps) => {
    if (viewMode === "list") return renderList(items, getProps);
    return renderCards(items, getProps);
  };

  const manualGetProps = (inp) => itemProps(inp, selectedManualIds, toggleSelectManual, selectedManualIds.length > 0);
  const aiGetProps     = (inp) => itemProps(inp, selectedAiIds,     toggleSelectAi,     selectedAiIds.length > 0);

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
            {/* View toggle */}
            <div style={{ display: "flex", border: `1px solid ${c.border}`, borderRadius: 7, overflow: "hidden" }}>
              {[{ mode: "list", Icon: List }, { mode: "card", Icon: LayoutGrid }].map(({ mode, Icon }, i) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: "5px 9px", display: "flex", alignItems: "center",
                      background: active ? c.brand : c.white,
                      color: active ? c.white : c.muted,
                      border: "none",
                      borderLeft: i > 0 ? `1px solid ${c.border}` : "none",
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
            <button onClick={() => setDrawerOpen(true)} style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}><CirclePlus size={14} />Add an input</button>
          </div>
        </div>

        {/* ── Search + Filter bar ──────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              onClick={() => { setSearch(""); clearFilters(); }}
              style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* ── My Inputs table ──────────────────────────────────── */}
        <SectionHeader title="My Inputs" count={filteredManual.length} />

        {/* My Inputs inline action bar */}
        {selectedManualIds.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: c.surfaceAlt,
            border: `1px solid ${c.border}`, borderRadius: 8, marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, flex: 1 }}>
              {selectedManualIds.length} selected
            </span>
            <div style={{ position: "relative" }}>
              <button onClick={() => setManualPickerOpen((s) => !s)} style={{ ...btnSm, fontSize: 11 }}>
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
            <button onClick={clearManualSelection} style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Clear selection
            </button>
          </div>
        )}

        {manualInputs.length === 0 ? (
          <div style={{ marginBottom: 36 }}>
            <EmptyState
              icon="◎"
              title="No inputs yet"
              body="Add your first input manually, or use the Chrome extension to capture signals from the web."
              ctaLabel="Add an input"
              onCta={() => setDrawerOpen(true)}
            />
          </div>
        ) : filteredManual.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0 36px", color: c.hint, fontSize: 13 }}>
            No inputs match your {search ? "search" : "filters"}.{" "}
            <button
              onClick={() => { setSearch(""); clearFilters(); }}
              style={{ color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
            >
              Clear {hasActiveSearch ? "all" : ""}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 36 }}>
            {renderItems(filteredManual, manualGetProps)}
          </div>
        )}

        {/* ── AI Suggested table ───────────────────────────────── */}
        {inboxProjectFilter && (() => {
          const proj = projects.find((p) => p.id === inboxProjectFilter);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11, padding: "4px 10px", borderRadius: 20,
                background: c.blue50, color: c.blue700,
                border: `1px solid ${c.blueBorder}`,
              }}>
                Showing suggestions for: <strong>{proj?.name || "project"}</strong>
                <button
                  onClick={() => setInboxProjectFilter(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: c.blue700, fontSize: 13, lineHeight: 1, padding: "0 0 0 2px", fontFamily: "inherit" }}
                  title="Clear filter"
                >
                  ✕
                </button>
              </span>
            </div>
          );
        })()}
        {(inboxProjectFilter ? true : aiInputs.length > 0) && (
          <>
            <SectionHeader title="AI Suggested" count={filteredAI.length} icon={<Sparkles size={16} />} />

            {/* AI Suggested inline action bar */}
            {selectedAiIds.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", background: c.surfaceAlt,
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
                    style={{ padding: "7px 16px", borderRadius: 7, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
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
                <button onClick={handleBulkDismissAi} style={{ ...btnG, fontSize: 11, color: c.muted }}>
                  Dismiss
                </button>
                <button onClick={clearAiSelection} style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  Clear selection
                </button>
              </div>
            )}

            {filteredAI.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: c.hint, fontSize: 13 }}>
                No AI suggestions match your {search ? "search" : "filters"}.{" "}
                <button
                  onClick={() => { setSearch(""); clearFilters(); }}
                  style={{ color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
                >
                  Clear {hasActiveSearch ? "all" : ""}
                </button>
              </div>
            ) : (
              <>
                {renderItems(visibleAI, aiGetProps)}
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

      {savingInputId && (
        <ProjectPickerModal
          projects={projects}
          onClose={() => setSavingInputId(null)}
          onCreateProject={openProjectModal}
          onSelect={(project) => {
            saveInputToProject(savingInputId, project.id);
            setSavedToProject((prev) => ({ ...prev, [savingInputId]: project.id }));
            showToast(`Input added to "${project.name}"`);
            setSavingInputId(null);
          }}
        />
      )}
    </>
  );
}

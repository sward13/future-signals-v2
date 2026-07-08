import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CirclePlus, Settings2, FolderInput } from "lucide-react";
import { useScannerStatus } from "../../hooks/useScannerStatus.js";
import { c, inp, btnP, btnSec, fontHeading } from "../../styles/tokens.js";
import { STEEPLED } from "../../data/seeds.js";
import { HorizTag, SubtypeTag } from "../shared/Tag.jsx";
import { FilterDropdown } from "../shared/FilterDropdown.jsx";

import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { AddFromInboxModal } from "../inputs/AddFromInboxModal.jsx";

import { EditProjectDrawer } from "../projects/EditProjectDrawer.jsx";
import { ScanningPreferencesDrawer } from "../projects/ScanningPreferencesDrawer.jsx";
import { CsvImportModal } from "../inputs/CsvImportModal.jsx";

const STEEPLED_ABB = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const COL = { check: 28, type: 80, strength: 60, confidence: 60, steepled: 100, horizon: 55, menu: 28 };

const STRENGTH_COLORS = {
  weak:     [c.amber700, c.amber50, c.amberBorder],
  moderate: [c.blue700,  c.blue50,  c.blueBorder],
  strong:   [c.green700, c.green50, c.greenBorder],
};

const CONFIDENCE_COLORS = {
  low:    [c.amber700, c.amber50, c.amberBorder],
  medium: [c.blue700,  c.blue50,  c.blueBorder],
  high:   [c.green700, c.green50, c.greenBorder],
};

const INPUT_TYPE_OPTS = ["signal","issue","projection","plan","obstacle","source"];
const COL_AI = { check: 28, type: 70, classif: 88, steepled: 90, date: 50 };

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Filter tab ────────────────────────────────────────────────────────────────

function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "6px 2px", fontSize: 12,
        cursor: "pointer", fontFamily: "inherit",
        background: "transparent",
        color: active ? c.ink : c.muted,
        border: "none",
        borderBottom: active ? `2px solid #3B82F6` : "2px solid transparent",
        fontWeight: active ? 500 : 400,
        transition: "color 0.1s, border-color 0.1s",
        marginRight: 14,
        marginBottom: -1,
      }}
    >
      {label}
      <span style={{
        fontSize: 10, padding: "0 4px", borderRadius: 6,
        background: active ? "#EFF6FF" : "rgba(0,0,0,0.06)",
        color: active ? c.blue700 : c.muted,
      }}>
        {count}
      </span>
    </button>
  );
}

// ─── Input type badge ──────────────────────────────────────────────────────────

function InputTypeBadge({ subtype }) {
  if (!subtype) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  const label = subtype.charAt(0).toUpperCase() + subtype.slice(1);
  return (
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4,
      background: c.surfaceAlt, color: c.muted, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─── AI Suggested row ─────────────────────────────────────────────────────────

const CLASSIF_STYLE = {
  emerging:    { bg: "#FEF3C7", text: "#92400E", label: "Emerging" },
  reinforcing: { bg: "#DBEAFE", text: "#1E40AF", label: "Reinforcing" },
};

function AiRow({ inp, selected, onCheck, activeProjectId, onAccept, onDismiss }) {
  const [hov, setHov] = useState(false);
  const projectEntry = (inp.metadata?.suggested_projects || []).find(p => p.id === activeProjectId);
  const classif = projectEntry?.classification;
  const cs = CLASSIF_STYLE[classif] || { bg: c.surfaceAlt, text: c.muted, label: classif || "—" };
  const allProjects = (inp.metadata?.suggested_projects || []).map(p => p.name).filter(Boolean);
  const steepledAbbr = (inp.steepled || []).slice(0, 3).map(t => STEEPLED_ABB[t] || t);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 14px",
        borderBottom: `1px solid ${c.border}`,
        background: selected ? "#EFF6FF" : hov ? c.surfaceAlt : c.white,
        transition: "background 0.1s",
        minHeight: 38,
      }}
    >
      <div style={{ width: COL_AI.check, flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onCheck(inp.id, e)}
          onClick={e => e.stopPropagation()}
          style={{ cursor: "pointer", accentColor: c.ink }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {inp.name || inp.metadata?.title || "Untitled signal"}
        </div>
        {allProjects.length > 1 && (
          <div style={{ fontSize: 10, color: c.hint, marginTop: 1 }}>
            Suggested for {allProjects.join(", ")}
          </div>
        )}
      </div>
      <div style={{ width: COL_AI.type, flexShrink: 0 }}>
        <InputTypeBadge subtype={inp.subtype} />
      </div>
      <div style={{ width: COL_AI.classif, flexShrink: 0 }}>
        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: cs.bg, color: cs.text, whiteSpace: "nowrap" }}>
          {cs.label}
        </span>
      </div>
      <div style={{ width: COL_AI.steepled, flexShrink: 0, fontSize: 10, color: c.muted }}>
        {steepledAbbr.length > 0 ? steepledAbbr.join(", ") : "—"}
      </div>
      <div style={{ width: COL_AI.date, flexShrink: 0, fontSize: 10, color: c.hint }}>
        {formatDate(inp.created_at)}
      </div>
      {/* Per-row actions — visible on hover */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        opacity: hov ? 1 : 0,
        transition: "opacity 0.12s",
        flexShrink: 0,
        width: 120,
        justifyContent: "flex-end",
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onAccept(inp); }}
          style={{
            padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
            background: c.brand, color: c.white, border: "none",
          }}
        >
          Accept
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(inp); }}
          style={{
            padding: "3px 9px", borderRadius: 5, fontSize: 11,
            cursor: "pointer", fontFamily: "inherit",
            background: "transparent", color: c.muted,
            border: `1px solid ${c.border}`,
          }}
        >
          Dismiss
        </button>
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
        fontFamily: "inherit",
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

export default function ProjectDetail({ appState }) {
  const {
    activeProjectId, projects, inputs, clusters,
    addInput, saveInputToProject, saveInputsToProject, showToast, setActiveScreen, setActiveProjectId,
    openInputDetail,
    updateProject, deleteProject,
    duplicateInputToCluster, deleteInput,
    dismissSuggestedInput,
    workspaceScanningEnabled, setInboxProjectFilter,
    projectSources, updateProjectSource,
    openScanningPrefs, setOpenScanningPrefs,
    workspaceId, addSource, addProjectSource,
  } = appState;

  const [drawerOpen,        setDrawerOpen]        = useState(false);
  const [inboxModalOpen,    setInboxModalOpen]    = useState(false);
  const [scanPrefOpen,      setScanPrefOpen]      = useState(false);

  const [editDrawerOpen,    setEditDrawerOpen]    = useState(false);
  const [editScrollTo,      setEditScrollTo]      = useState(null);
  const [csvImportOpen,     setCsvImportOpen]     = useState(false);
  const [inputTab,          setInputTab]          = useState("all");
  // Multi-select
  const [selectedIds,       setSelectedIds]       = useState(new Set());
  const [confirmDeleteIds,  setConfirmDeleteIds]  = useState(null);
  const [lastCheckedId,     setLastCheckedId]     = useState(null);
  // Search + filters
  const [searchQuery,       setSearchQuery]       = useState("");
  const [filterType,        setFilterType]        = useState(null);
  const [filterHorizon,     setFilterHorizon]     = useState(null);
  const [filterSteepled,    setFilterSteepled]    = useState(null);
  const [openFilterDropdown,setOpenFilterDropdown]= useState(null);
  // Row context menu + cluster picker for "Duplicate to cluster"
  const [rowMenu,    setRowMenu]    = useState(null); // null | { inputId, rect }
  const [dupePicker, setDupePicker] = useState(null); // null | { inputId, rect }
  // AI Suggested tab state
  const [aiSearchQuery,        setAiSearchQuery]        = useState("");
  const [aiFilterType,         setAiFilterType]         = useState(null);
  const [aiFilterSteepled,     setAiFilterSteepled]     = useState(null);
  const [aiOpenFilterDropdown, setAiOpenFilterDropdown] = useState(null);
  const [aiSelectedIds,        setAiSelectedIds]        = useState(new Set());
  const [aiLastCheckedId,      setAiLastCheckedId]      = useState(null);

  const project = projects.find((p) => p.id === activeProjectId) ?? null;
  const { status: scanStatus, foundCount, dismiss: dismissScan } = useScannerStatus(project, inputs);

  // Open ScanningPreferencesDrawer when navigated here via Overview "Manage sources"
  useEffect(() => {
    if (openScanningPrefs) {
      setScanPrefOpen(true);
      setOpenScanningPrefs(false);
    }
  }, [openScanningPrefs]);

  if (!project) {
    return (
      <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, marginBottom: 8, fontFamily: fontHeading }}>No project selected</div>
        <button onClick={() => setActiveScreen("dashboard")} style={{ ...btnSec, marginTop: 8 }}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const projectClusters = clusters.filter((cl) => cl.project_id === project.id);
  // Include inputs directly assigned to the project AND inputs referenced in
  // any of the project's clusters (cluster assignment does not update project_id).
  const clusterInputIdSet = new Set(projectClusters.flatMap((cl) => cl.input_ids || []));
  const projectInputs = inputs.filter(
    (i) => i.project_id === project.id || clusterInputIdSet.has(i.id)
  );
  const inboxInputs = inputs.filter((i) => i.project_id === null && !clusterInputIdSet.has(i.id));

  const getInputCluster = (inputId) => projectClusters.find((cl) => cl.input_ids?.includes(inputId)) || null;

  const unassigned = projectInputs.filter((i) => !getInputCluster(i.id));
  const inCluster  = projectInputs.filter((i) =>  getInputCluster(i.id));

  const tabInputs =
    inputTab === "unassigned"  ? unassigned :
    inputTab === "incluster"   ? inCluster :
    inputTab === "aisuggested" ? [] :
    [...unassigned, ...inCluster]; // All: unassigned first

  // Apply search + filter chips on top of the tab slice
  const visibleInputs = tabInputs
    .filter((i) => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((i) => !filterType     || i.subtype === filterType)
    .filter((i) => !filterHorizon  || i.horizon === filterHorizon)
    .filter((i) => !filterSteepled || (i.steepled || []).includes(filterSteepled));

  const anyFilterActive = !!(searchQuery || filterType || filterHorizon || filterSteepled);

  // Helpers for multi-select
  const allVisibleSelected = visibleInputs.length > 0 && visibleInputs.every((i) => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleInputs.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleInputs.forEach((i) => next.add(i.id));
        return next;
      });
    }
    setLastCheckedId(null);
  };

  const handleCheckboxClick = (id, e) => {
    if (e.shiftKey && lastCheckedId && lastCheckedId !== id) {
      const idxA = visibleInputs.findIndex((i) => i.id === lastCheckedId);
      const idxB = visibleInputs.findIndex((i) => i.id === id);
      if (idxA !== -1 && idxB !== -1) {
        const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        const rangeIds = visibleInputs.slice(lo, hi + 1).map((i) => i.id);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rid) => next.add(rid));
          return next;
        });
      }
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
    setLastCheckedId(id);
  };

  // ── AI Suggested derived values ──────────────────────────────────────────────
  const aiSuggestedInputs = inputs
    .filter((i) =>
      i.project_id === null &&
      i.is_seeded &&
      i.metadata?.source === "scanner" &&
      !i.metadata?.dismissed &&
      (i.metadata?.suggested_projects || []).some((p) => p.id === activeProjectId)
    )
    .sort((a, b) => {
      const sA = (a.metadata?.suggested_projects || []).find(p => p.id === activeProjectId)?.score ?? 0;
      const sB = (b.metadata?.suggested_projects || []).find(p => p.id === activeProjectId)?.score ?? 0;
      return sB - sA;
    });

  const filteredAiInputs = aiSuggestedInputs
    .filter((i) => !aiSearchQuery    || (i.name || "").toLowerCase().includes(aiSearchQuery.toLowerCase()))
    .filter((i) => !aiFilterType     || i.subtype === aiFilterType)
    .filter((i) => !aiFilterSteepled || (i.steepled || []).includes(aiFilterSteepled));

  const getAiClass = (i) =>
    (i.metadata?.suggested_projects || []).find(p => p.id === activeProjectId)?.classification;

  const emergingInputs    = filteredAiInputs.filter(i => getAiClass(i) === "emerging");
  const reinforcingInputs = filteredAiInputs.filter(i => getAiClass(i) === "reinforcing");

  const anyAiFilterActive = !!(aiSearchQuery || aiFilterType || aiFilterSteepled);
  const allAiSelected = filteredAiInputs.length > 0 && filteredAiInputs.every(i => aiSelectedIds.has(i.id));
  const someAiSelected = aiSelectedIds.size > 0;

  const toggleSelectAllAi = () => {
    if (allAiSelected) {
      setAiSelectedIds(prev => { const n = new Set(prev); filteredAiInputs.forEach(i => n.delete(i.id)); return n; });
    } else {
      setAiSelectedIds(prev => { const n = new Set(prev); filteredAiInputs.forEach(i => n.add(i.id)); return n; });
    }
    setAiLastCheckedId(null);
  };

  const handleAiCheckboxClick = (id, e) => {
    if (e.shiftKey && aiLastCheckedId && aiLastCheckedId !== id) {
      const idxA = filteredAiInputs.findIndex(i => i.id === aiLastCheckedId);
      const idxB = filteredAiInputs.findIndex(i => i.id === id);
      if (idxA !== -1 && idxB !== -1) {
        const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        setAiSelectedIds(prev => { const n = new Set(prev); filteredAiInputs.slice(lo, hi + 1).forEach(i => n.add(i.id)); return n; });
      }
    } else {
      setAiSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }
    setAiLastCheckedId(id);
  };

  const clearAiFilters = () => { setAiSearchQuery(""); setAiFilterType(null); setAiFilterSteepled(null); };

  const handleAiAcceptOne = (inp) => {
    saveInputToProject(inp.id, activeProjectId);
    showToast(`Signal added to project`);
    setAiSelectedIds(prev => { const n = new Set(prev); n.delete(inp.id); return n; });
  };

  const handleAiDismissOne = (inp) => {
    dismissSuggestedInput(inp);
    setAiSelectedIds(prev => { const n = new Set(prev); n.delete(inp.id); return n; });
  };

  const handleAiBatchAccept = () => {
    const ids = [...aiSelectedIds];
    saveInputsToProject(ids, activeProjectId);
    showToast(`${ids.length} signal${ids.length !== 1 ? "s" : ""} added to project`);
    setAiSelectedIds(new Set());
    setAiLastCheckedId(null);
  };

  const handleAiBatchDismiss = () => {
    const todismiss = aiSuggestedInputs.filter(i => aiSelectedIds.has(i.id));
    todismiss.forEach(i => dismissSuggestedInput(i));
    showToast(`${todismiss.length} signal${todismiss.length !== 1 ? "s" : ""} dismissed`);
    setAiSelectedIds(new Set());
    setAiLastCheckedId(null);
  };

  const handleBulkDelete = () => {
    confirmDeleteIds.forEach((id) => deleteInput(id));
    const n = confirmDeleteIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} deleted`);
    setConfirmDeleteIds(null);
    setSelectedIds(new Set());
    setLastCheckedId(null);
  };

  const handleAddInput = (fields) => {
    addInput({ ...fields, project_id: project.id });
    showToast("Input added to project");
    setDrawerOpen(false);
  };

  const handleAddFromInbox = (ids) => {
    saveInputsToProject(ids, project.id);
    setInboxModalOpen(false);
    showToast(`${ids.length} input${ids.length !== 1 ? "s" : ""} added to "${project.name}"`);
  };

  const openEditDrawer = (scrollTo = null) => {
    setEditScrollTo(scrollTo);
    setEditDrawerOpen(true);
  };

  const handleUpdateProject = (fields) => {
    updateProject(project.id, fields);
    showToast("Project updated");
    setEditDrawerOpen(false);
  };

  const handleDeleteProject = () => {
    deleteProject(project.id);
    showToast("Project deleted");
    setActiveProjectId(null);
    setActiveScreen("dashboard");
  };

  const handleDuplicateToCluster = async (inputId, destCluster) => {
    setDupePicker(null);
    const result = await duplicateInputToCluster(inputId, destCluster.id);
    if (result) showToast(`Copied to "${destCluster.name}"`);
  };

  const cell = { fontSize: 11, letterSpacing: "0.02em", color: c.hint, flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: c.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Scanner status banner ─────────────────────────────── */}
      {scanStatus === 'scanning' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 22px',
          background: c.amber50,
          borderBottom: `1px solid ${c.amberBorder}`,
          fontSize: 12,
          color: c.amber700,
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            border: `2px solid ${c.amber700}`,
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }} />
          <span>Finding signals for this project…</span>
          <button
            onClick={dismissScan}
            style={{ marginLeft: 'auto', fontSize: 11, color: c.amber700,
                     background: 'none', border: 'none', cursor: 'pointer',
                     fontFamily: 'inherit' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {scanStatus === 'found' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 22px',
          background: c.green50,
          borderBottom: `1px solid ${c.greenBorder}`,
          fontSize: 12,
          color: c.green700,
        }}>
          <span>✓</span>
          <span>{foundCount} new signal{foundCount !== 1 ? 's' : ''} found for this project</span>
          <button
            onClick={() => { setInboxProjectFilter(activeProjectId); setActiveScreen('inbox'); dismissScan(); }}
            style={{ marginLeft: 4, fontSize: 12, color: c.green700,
                     background: 'none', border: 'none', cursor: 'pointer',
                     fontFamily: 'inherit', textDecoration: 'underline' }}
          >
            View in Inbox →
          </button>
          <button
            onClick={dismissScan}
            style={{ marginLeft: 'auto', fontSize: 11, color: c.green700,
                     background: 'none', border: 'none', cursor: 'pointer',
                     fontFamily: 'inherit' }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* ── Header section ───────────────────────────────────── */}
        <div style={{ padding: "24px 32px 0", flexShrink: 0, borderBottom: `1px solid ${c.borderMid}` }}>

        {/* ── Header: title row ────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 12, gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 3 }}>
              {project.name}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, fontFamily: fontHeading }}>Scan</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setScanPrefOpen(true)} style={{ ...btnSec, fontSize: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}>
              <Settings2 size={14} />Scanning preferences
            </button>
            <button onClick={() => setInboxModalOpen(true)} style={{ ...btnSec, fontSize: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}>
              <FolderInput size={14} />Add from Inbox
            </button>
            <button onClick={() => setDrawerOpen(true)} style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}><CirclePlus size={14} />Add an input</button>
          </div>
        </div>

        </div>{/* end header section */}

        {/* ── Inputs table ─────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 32, padding: "0 32px 32px" }}>
          {/* Row 1: tabs left, import link right */}
          <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 10, gap: 12, borderBottom: `1px solid ${c.border}` }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <FilterTab label="All"          count={projectInputs.length}       active={inputTab === "all"}         onClick={() => { setInputTab("all");         setSelectedIds(new Set()); setLastCheckedId(null); setAiSelectedIds(new Set()); setAiLastCheckedId(null); }} />
              <FilterTab label="Unassigned"   count={unassigned.length}           active={inputTab === "unassigned"}  onClick={() => { setInputTab("unassigned");  setSelectedIds(new Set()); setLastCheckedId(null); setAiSelectedIds(new Set()); setAiLastCheckedId(null); }} />
              <FilterTab label="Clustered"    count={inCluster.length}            active={inputTab === "incluster"}   onClick={() => { setInputTab("incluster");   setSelectedIds(new Set()); setLastCheckedId(null); setAiSelectedIds(new Set()); setAiLastCheckedId(null); }} />
              <FilterTab label="AI Suggested" count={aiSuggestedInputs.length}    active={inputTab === "aisuggested"} onClick={() => { setInputTab("aisuggested"); setSelectedIds(new Set()); setLastCheckedId(null); }} />
            </div>
            <button
              onClick={() => setCsvImportOpen(true)}
              style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "0 0 8px", textDecoration: "underline", textDecorationColor: c.border }}
            >
              Import via CSV
            </button>
          </div>

          {inputTab === "aisuggested" ? (
            /* ── AI Suggested tab ──────────────────────────────── */
            aiSuggestedInputs.length === 0 ? (
              <div style={{
                background: c.white, border: `1px dashed ${c.border}`,
                borderRadius: 12, padding: "36px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 26, opacity: 0.12, marginBottom: 10 }}>✦</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: c.muted, marginBottom: 5 }}>No signals suggested yet</div>
                <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.6 }}>
                  The scanner surfaces signals matching your project's key question. Check back after the next scan.
                </div>
              </div>
            ) : (
              <>
                {/* Search + filters — Type + STEEPLED only; Horizon omitted (not set on scanner candidates) */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input
                    value={aiSearchQuery}
                    onChange={(e) => setAiSearchQuery(e.target.value)}
                    placeholder="Search signals…"
                    style={{
                      ...inp, width: 220, padding: "5px 10px", fontSize: 12,
                      border: `1px solid ${c.border}`, borderRadius: 6,
                    }}
                  />
                  <FilterDropdown
                    label="Type"
                    value={aiFilterType}
                    options={INPUT_TYPE_OPTS.map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))}
                    onChange={setAiFilterType}
                    onClear={() => setAiFilterType(null)}
                    isOpen={aiOpenFilterDropdown === "type"}
                    onToggle={() => setAiOpenFilterDropdown(aiOpenFilterDropdown === "type" ? null : "type")}
                  />
                  <FilterDropdown
                    label="STEEPLED"
                    value={aiFilterSteepled}
                    options={STEEPLED.map(v => ({ value: v, label: v }))}
                    onChange={setAiFilterSteepled}
                    onClear={() => setAiFilterSteepled(null)}
                    isOpen={aiOpenFilterDropdown === "steepled"}
                    onToggle={() => setAiOpenFilterDropdown(aiOpenFilterDropdown === "steepled" ? null : "steepled")}
                  />
                  {anyAiFilterActive && (
                    <button
                      onClick={clearAiFilters}
                      style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {filteredAiInputs.length === 0 ? (
                  <div style={{ padding: "20px 14px", fontSize: 12, color: c.hint, textAlign: "center" }}>
                    No signals match the current filters.{" "}
                    <button onClick={clearAiFilters} style={{ fontSize: 12, color: c.ink, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
                    {/* Table header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 30, borderBottom: "0.5px solid rgba(0,0,0,0.09)" }}>
                      <div style={{ width: COL_AI.check, flexShrink: 0, display: "flex", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={allAiSelected}
                          onChange={toggleSelectAllAi}
                          ref={el => { if (el) el.indeterminate = someAiSelected && !allAiSelected; }}
                          style={{ cursor: "pointer", accentColor: c.ink }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, ...cell }}>Signal</div>
                      <div style={{ width: COL_AI.type,   ...cell }}>Type</div>
                      <div style={{ width: COL_AI.classif,...cell }}>Signal type</div>
                      <div style={{ width: COL_AI.steepled,...cell }}>STEEPLED</div>
                      <div style={{ width: COL_AI.date,   ...cell }}>Date</div>
                    </div>

                    {/* Emerging section */}
                    {emergingInputs.length > 0 && (() => {
                      const SectionHdr = ({ first }) => (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "6px 14px 5px",
                          background: c.surfaceAlt,
                          borderTop: first ? "none" : `1px solid ${c.border}`,
                          borderBottom: `1px solid ${c.border}`,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: c.ink }}>Emerging</span>
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: c.amber50, color: c.amber700, fontWeight: 500 }}>Novel signals</span>
                          <span style={{ fontSize: 10, color: c.hint, marginLeft: 2 }}>{emergingInputs.length}</span>
                        </div>
                      );
                      return (
                        <>
                          <SectionHdr first={true} />
                          {emergingInputs.map(i => <AiRow key={i.id} inp={i} selected={aiSelectedIds.has(i.id)} onCheck={handleAiCheckboxClick} activeProjectId={activeProjectId} onAccept={handleAiAcceptOne} onDismiss={handleAiDismissOne} />)}
                        </>
                      );
                    })()}

                    {/* Reinforcing section */}
                    {reinforcingInputs.length > 0 && (
                      <>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "6px 14px 5px",
                          background: c.surfaceAlt,
                          borderTop: `1px solid ${c.border}`,
                          borderBottom: `1px solid ${c.border}`,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: c.ink }}>Reinforcing</span>
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: c.blue50, color: c.blue700, fontWeight: 500 }}>Confirms existing clusters</span>
                          <span style={{ fontSize: 10, color: c.hint, marginLeft: 2 }}>{reinforcingInputs.length}</span>
                        </div>
                        {reinforcingInputs.map(i => <AiRow key={i.id} inp={i} selected={aiSelectedIds.has(i.id)} onCheck={handleAiCheckboxClick} activeProjectId={activeProjectId} onAccept={handleAiAcceptOne} onDismiss={handleAiDismissOne} />)}
                      </>
                    )}

                    {/* Fallback: candidates with unknown classification (edge case) */}
                    {emergingInputs.length === 0 && reinforcingInputs.length === 0 && (
                      filteredAiInputs.map(i => <AiRow key={i.id} inp={i} selected={aiSelectedIds.has(i.id)} onCheck={handleAiCheckboxClick} activeProjectId={activeProjectId} onAccept={handleAiAcceptOne} onDismiss={handleAiDismissOne} />)
                    )}
                  </div>
                )}

                {/* AI selection action bar */}
                {someAiSelected && (
                  <div style={{
                    position: "sticky", bottom: 0,
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 14px",
                    background: "rgb(249, 249, 247)",
                    borderTop: `1px solid ${c.border}`,
                    animation: "slideUp 0.16s ease",
                  }}>
                    <span style={{ fontSize: 12, color: c.muted, flex: 1 }}>{aiSelectedIds.size} selected</span>
                    <button
                      onClick={handleAiBatchAccept}
                      style={{
                        padding: "5px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 500,
                        cursor: "pointer", fontFamily: "inherit",
                        background: c.brand, color: c.white, border: "none",
                      }}
                    >
                      Accept {aiSelectedIds.size}
                    </button>
                    <button
                      onClick={handleAiBatchDismiss}
                      style={{
                        padding: "5px 12px", borderRadius: 6, fontSize: 11.5,
                        cursor: "pointer", fontFamily: "inherit",
                        background: "transparent", color: c.muted,
                        border: `1px solid ${c.borderStrong}`,
                      }}
                    >
                      Dismiss {aiSelectedIds.size}
                    </button>
                    <button
                      onClick={() => { setAiSelectedIds(new Set()); setAiLastCheckedId(null); }}
                      style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginLeft: 4 }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </>
            )
          ) : projectInputs.length === 0 ? (
            <div style={{
              background: c.white, border: `1px dashed ${c.border}`,
              borderRadius: 12, padding: "36px 24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 26, opacity: 0.12, marginBottom: 10 }}>◎</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: c.muted, marginBottom: 5 }}>No inputs yet</div>
              <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.6, marginBottom: 18 }}>
                No inputs yet — add one to get started.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => setDrawerOpen(true)} style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}><CirclePlus size={14} />Add an input</button>
                <button onClick={() => setInboxModalOpen(true)} style={{ ...btnSec, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><FolderInput size={14} />Add from Inbox</button>
              </div>
            </div>
          ) : (
            <>
              {/* Row 2: search + filter chips */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                    options={INPUT_TYPE_OPTS.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))}
                    onChange={setFilterType}
                    onClear={() => setFilterType(null)}
                    isOpen={openFilterDropdown === "type"}
                    onToggle={() => setOpenFilterDropdown(openFilterDropdown === "type" ? null : "type")}
                  />
                  <FilterDropdown
                    label="Horizon"
                    value={filterHorizon}
                    options={["H1","H2","H3"].map((v) => ({ value: v, label: v }))}
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
                    onClick={() => { setSearchQuery(""); setFilterType(null); setFilterHorizon(null); setFilterSteepled(null); }}
                    style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 30, borderBottom: "0.5px solid rgba(0,0,0,0.09)" }}>
                  <div style={{ width: COL.check, flexShrink: 0, display: "flex", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allVisibleSelected; }}
                      style={{ cursor: "pointer", accentColor: c.ink }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, ...cell }}>Title</div>
                  <div style={{ width: COL.type,       ...cell }}>Type</div>
                  <div style={{ width: COL.strength,   ...cell }}>Strength</div>
                  <div style={{ width: COL.confidence, ...cell }}>Confidence</div>
                  <div style={{ width: COL.steepled,   ...cell }}>STEEPLED</div>
                  <div style={{ width: COL.horizon,    ...cell }}>Horizon</div>
                  <div style={{ width: COL.menu, flexShrink: 0 }} />
                </div>

                {/* Data rows */}
                {visibleInputs.length === 0 ? (
                  <div style={{ padding: "20px 14px", fontSize: 12, color: c.hint, textAlign: "center" }}>
                    No inputs match the current filters.{" "}
                    {anyFilterActive && (
                      <button
                        onClick={() => { setSearchQuery(""); setFilterType(null); setFilterHorizon(null); setFilterSteepled(null); }}
                        style={{ fontSize: 12, color: c.ink, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : visibleInputs.map((inp) => {
                  const steepled = inp.steepled || [];
                  const vis2     = steepled.slice(0, 2);
                  const overflow = steepled.length - 2;
                  const isSelected = selectedIds.has(inp.id);
                  return (
                    <div
                      key={inp.id}
                      onClick={() => openInputDetail(inp.id)}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? c.brandBg : c.white; }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "0 14px", height: 38,
                        borderBottom: `1px solid ${c.border}`,
                        cursor: "pointer",
                        transition: "background 0.08s",
                        background: isSelected ? c.brandBg : c.white,
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{ width: COL.check, flexShrink: 0, display: "flex", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          onClick={(e) => { e.stopPropagation(); handleCheckboxClick(inp.id, e); }}
                          style={{ cursor: "pointer", accentColor: c.ink }}
                        />
                      </div>
                      {/* Title */}
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                        {inp.name}
                      </div>
                      {/* Type */}
                      <div style={{ width: COL.type, flexShrink: 0 }}>
                        <InputTypeBadge subtype={inp.subtype} />
                      </div>
                      {/* Signal Strength */}
                      <div style={{ width: COL.strength, flexShrink: 0 }}>
                        {inp.signal_strength ? (() => {
                          const [col, bg, brd] = STRENGTH_COLORS[inp.signal_strength] || [c.hint, c.surfaceAlt, c.border];
                          return <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 6, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap", display: "inline-block" }}>{inp.signal_strength.charAt(0).toUpperCase() + inp.signal_strength.slice(1)}</span>;
                        })() : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
                      </div>
                      {/* Source Confidence */}
                      <div style={{ width: COL.confidence, flexShrink: 0 }}>
                        {inp.source_confidence ? (() => {
                          const [col, bg, brd] = CONFIDENCE_COLORS[inp.source_confidence] || [c.hint, c.surfaceAlt, c.border];
                          return <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 5, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap", display: "inline-block" }}>{inp.source_confidence.charAt(0).toUpperCase() + inp.source_confidence.slice(1)}</span>;
                        })() : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
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
                      {/* Horizon */}
                      <div style={{ width: COL.horizon, flexShrink: 0 }}>
                        {inp.horizon ? <HorizTag h={inp.horizon} /> : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
                      </div>
                      {/* Three-dot context menu trigger */}
                      <div style={{ width: COL.menu, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRowMenu((prev) => prev?.inputId === inp.id ? null : { inputId: inp.id, rect });
                            setDupePicker(null);
                          }}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 14, color: c.muted, padding: "2px 4px",
                            borderRadius: 4, fontFamily: "inherit", lineHeight: 1,
                          }}
                          title="More actions"
                        >
                          ⋯
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Multi-select action bar — sticky at bottom */}
              {someSelected && (
                <div style={{
                  position: "sticky", bottom: 0,
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 14px",
                  background: "rgb(249, 249, 247)",
                  borderTop: `1px solid ${c.border}`,
                  animation: "slideUp 0.16s ease",
                }}>
                  <span style={{ fontSize: 12, color: c.muted, flex: 1 }}>
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={() => setConfirmDeleteIds([...selectedIds])}
                    style={{
                      padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 500,
                      cursor: "pointer", fontFamily: "inherit", border: "none",
                      background: "rgb(254, 226, 226)", color: "rgb(185, 28, 28)",
                    }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => { setSelectedIds(new Set()); setLastCheckedId(null); }}
                    style={{ fontSize: 11, color: "rgb(102, 102, 102)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    ✕ Clear
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <InputDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleAddInput}
        projects={projects}
        defaultProjectId={project.id}
      />

      <AddFromInboxModal
        open={inboxModalOpen}
        onClose={() => setInboxModalOpen(false)}
        onConfirm={handleAddFromInbox}
        inboxInputs={inboxInputs}
        projectName={project.name}
        onCreateNew={() => { setInboxModalOpen(false); setDrawerOpen(true); }}
      />

      {editDrawerOpen && (
        <EditProjectDrawer
          project={project}
          onClose={() => setEditDrawerOpen(false)}
          onSave={handleUpdateProject}
          onDelete={handleDeleteProject}
          scrollTo={editScrollTo}
          workspaceScanningEnabled={workspaceScanningEnabled}
        />
      )}

      <ScanningPreferencesDrawer
        open={scanPrefOpen}
        onClose={() => setScanPrefOpen(false)}
        project={project}
        projectSources={projectSources}
        workspaceScanningEnabled={workspaceScanningEnabled}
        updateProject={updateProject}
        updateProjectSource={updateProjectSource}
        addSource={addSource}
        addProjectSource={addProjectSource}
        workspaceId={workspaceId}
        showToast={showToast}
      />

      <CsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        projectId={project.id}
        addInput={addInput}
        showToast={showToast}
      />

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {confirmDeleteIds && (
        <ConfirmDeleteModal
          count={confirmDeleteIds.length}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmDeleteIds(null)}
        />
      )}

      {/* ── Row context menu portal ──────────────────────────── */}
      {rowMenu && createPortal(
        <>
          <div
            onClick={() => setRowMenu(null)}
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
          />
          <div style={{
            position: "fixed",
            top: rowMenu.rect.bottom + 4,
            right: window.innerWidth - rowMenu.rect.right,
            background: c.white,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            minWidth: 180,
            zIndex: 201,
            overflow: "hidden",
          }}>
            <button
              onClick={() => {
                const { inputId, rect } = rowMenu;
                setRowMenu(null);
                setDupePicker({ inputId, rect });
              }}
              style={{
                display: "block", width: "100%", padding: "9px 14px",
                background: "transparent", border: "none",
                textAlign: "left", cursor: "pointer",
                fontSize: 12, color: c.ink, fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = c.surfaceAlt; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Duplicate to cluster
            </button>
          </div>
        </>,
        document.body
      )}

      {/* ── Cluster picker portal for duplicate ─────────────── */}
      {dupePicker && (() => {
        const sourceInput = inputs.find((i) => i.id === dupePicker.inputId);
        const assignedClusterIds = new Set(
          projectClusters.filter((cl) => cl.input_ids?.includes(dupePicker.inputId)).map((cl) => cl.id)
        );
        const eligibleClusters = projectClusters.filter((cl) => !assignedClusterIds.has(cl.id));
        return createPortal(
          <>
            <div
              onClick={() => setDupePicker(null)}
              style={{ position: "fixed", inset: 0, zIndex: 200 }}
            />
            <div style={{
              position: "fixed",
              top: dupePicker.rect.bottom + 4,
              right: window.innerWidth - dupePicker.rect.right,
              background: c.white,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
              minWidth: 220,
              zIndex: 201,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "8px 14px 4px",
                fontSize: 11, letterSpacing: "0.02em",
                color: c.muted, fontWeight: 500,
              }}>
                Copy to cluster
              </div>
              {eligibleClusters.length === 0 ? (
                <div style={{ padding: "8px 14px 12px", fontSize: 12, color: c.muted, fontStyle: "italic" }}>
                  {projectClusters.length === 0
                    ? "No clusters yet — build one first."
                    : "Input is already in all clusters."}
                </div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {eligibleClusters.map((cl) => (
                    <button
                      key={cl.id}
                      onClick={() => sourceInput && handleDuplicateToCluster(sourceInput.id, cl)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "9px 14px",
                        background: "transparent", border: "none",
                        borderBottom: `1px solid ${c.border}`,
                        textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = c.surfaceAlt; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <SubtypeTag sub={cl.subtype} />
                      <span style={{ fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cl.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ padding: "6px 14px", borderTop: `1px solid ${c.border}` }}>
                <button
                  onClick={() => setDupePicker(null)}
                  style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>,
          document.body
        );
      })()}
    </div>
  );
}

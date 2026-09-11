import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { CirclePlus } from "lucide-react";
import { HorizTag } from "../shared/Tag.jsx";
import { FilterDropdown } from "../shared/FilterDropdown.jsx";
import { ClusterAssignMenu } from "../shared/ClusterAssignMenu.jsx";
import { ClustersPanel } from "../clusters/ClustersPanel.jsx";
import { ClusterRail } from "../clusters/ClusterRail.jsx";
import { UnsavedChangesDialog } from "../shared/UnsavedChangesDialog.jsx";
import { DragGhost } from "../clusters/DragGhost.jsx";
import { STEEPLED } from "../../data/seeds.js";

const STEEPLED_ABB = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const COL = { check: 28, type: 70, strength: 55, confidence: 55, steepled: 80, horizon: 50, cluster: 90, menu: 24 };
const INPUT_TYPE_OPTS = ["signal","issue","projection","plan","obstacle","source"];

// Signal Strength / Source Confidence badge colors — the shared rust/tan/sage
// three-tier ramp (low→rust, mid→tan, high→sage). Mirrors Tag.jsx's TIER_COLORS.
const STRENGTH_CLASSES = {
  weak:     "text-rust-700 bg-rust-50 border-rust-border",
  moderate: "text-tan-700  bg-tan-50  border-tan-border",
  strong:   "text-sage-700 bg-sage-50 border-sage-border",
};
const CONFIDENCE_CLASSES = {
  low:    "text-rust-700 bg-rust-50 border-rust-border",
  medium: "text-tan-700  bg-tan-50  border-tan-border",
  high:   "text-sage-700 bg-sage-50 border-sage-border",
};

// Shared button primitives, as Tailwind equivalents of tokens.js btnSm / btnSec.
const btnSmCls  = "py-1.75 px-4 rounded-btn bg-brand text-white border-none text-xs font-medium cursor-pointer font-[inherit]";
const btnSecCls = "py-2.25 px-4.5 rounded-container bg-transparent text-muted border border-border-strong text-ui cursor-pointer font-[inherit]";
// Column-header cell base (was the `cell` inline-style object).
const cellCls = "text-[11px] tracking-[0.02em] text-hint shrink-0";

// ─── Filter tab ────────────────────────────────────────────────────────────────

function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.25 py-1.25 px-0.5 text-xs cursor-pointer font-[inherit] bg-transparent border-b-2 mr-3 -mb-px transition-[color,border-color] duration-100",
        active ? "text-ink border-brand font-medium" : "text-muted border-transparent font-normal",
      )}
    >
      {label}
      {/* was tokens.js `tabCount`: 10px / padding 0 4px / radius 6 (no radius token) */}
      <span className={clsx(
        "text-[10px] px-1 py-0 rounded-[6px]",
        active ? "bg-brand-bg text-blue-700" : "bg-black/[0.06] text-muted",
      )}>
        {count}
      </span>
    </button>
  );
}

// ─── Input type badge ──────────────────────────────────────────────────────────

function InputTypeBadge({ subtype }) {
  if (!subtype) return null;
  const label = subtype.charAt(0).toUpperCase() + subtype.slice(1);
  return (
    <span className="text-[10px] py-0.5 px-1.5 rounded-chip bg-surface-alt text-muted whitespace-nowrap shrink-0">
      {label}
    </span>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ClusterScreen({ appState }) {
  const {
    activeProjectId, projects, inputs, clusters,
    showToast, setActiveScreen,
    addCluster, updateCluster,
    assignInputToCluster, removeInputFromCluster,
    duplicateInputToCluster, deleteCluster,
    setBulkBarActive,
  } = appState;

  // Drag-and-drop state
  const [dragIds,    setDragIds]    = useState(null);       // null | string[]
  const [dragPos,    setDragPos]    = useState({ x: 0, y: 0 });
  const [dragIsCopy, setDragIsCopy] = useState(false);

  // Input drawer resize state
  const [drawerHeight, setDrawerHeight] = useState(() => {
    const saved = localStorage.getItem("clusterDrawerHeight");
    return saved ? Number(saved) : 240;
  });
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef(null); // { startY, startHeight }

  useEffect(() => {
    if (!resizing) return;
    const onMouseMove = (e) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startY - e.clientY; // drag up = taller
      const next = Math.max(120, Math.min(window.innerHeight * 0.6, resizeRef.current.startHeight + delta));
      setDrawerHeight(next);
    };
    const onMouseUp = () => setResizing(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizing]);

  useEffect(() => {
    localStorage.setItem("clusterDrawerHeight", String(Math.round(drawerHeight)));
  }, [drawerHeight]);

  const blankImgRef = useRef(null);
  if (!blankImgRef.current) {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    blankImgRef.current = img;
  }

  // Non-drag single-row assign picker
  const [assignPickerFor,        setAssignPickerFor]        = useState(null);
  const [assignPickerAnchorRect, setAssignPickerAnchorRect] = useState(null);

  // Tab + search + filter state
  const [inputTab,           setInputTab]           = useState("all");
  const [searchQuery,        setSearchQuery]        = useState("");
  const [filterType,         setFilterType]         = useState(null);
  const [filterHorizon,      setFilterHorizon]      = useState(null);
  const [filterSteepled,     setFilterSteepled]     = useState(null);
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);

  // Multi-select + batch assign state
  const [selectedIds,          setSelectedIds]          = useState(new Set());
  const [lastCheckedId,        setLastCheckedId]        = useState(null);
  const [batchPickerOpen,      setBatchPickerOpen]      = useState(false);
  const [batchAssignAnchorRect,setBatchAssignAnchorRect]= useState(null);

  // Signal the global Toast to lift above the multi-select bar below while it's showing
  useEffect(() => {
    setBulkBarActive(selectedIds.size > 0);
    return () => setBulkBarActive(false);
  }, [selectedIds, setBulkBarActive]);

  // Cluster mode lifted to this level so the header Suggested CTA can switch it
  const [clusterMode,  setClusterMode]  = useState("manual");
  // Drop zone state for the InputRail drop target
  const [dropOnZone,   setDropOnZone]   = useState(false);
  // ClusterRail target: null (closed) | { kind:"view", id } (existing cluster)
  // | { kind:"create", inputIds, seq } (new-cluster draft — persisted only on
  // Save). seq forces the rail to reset for each fresh create session.
  const [railTarget, setRailTarget] = useState(null);
  // Unsaved-changes guard (phase 5): pendingNav holds the intended next target
  // while we confirm; railDirtyRef mirrors the rail's dirty state (set via
  // onDirtyChange) so navigation triggers can read it synchronously; railRef
  // reaches the rail's imperative commit() for the "Save" choice.
  const [pendingNav, setPendingNav] = useState(null); // null | { next }
  const createSeqRef = useRef(0);
  const railDirtyRef = useRef(false);
  const railRef = useRef(null);
  const handleDirtyChange = useCallback((d) => { railDirtyRef.current = d; }, []);
  const buildCreateTarget = (inputIds = []) => ({ kind: "create", inputIds, seq: ++createSeqRef.current });
  // Route every navigate-away through the guard: if the draft is dirty, stash
  // the intent and confirm; otherwise navigate immediately.
  const requestNav = (next) => {
    if (railDirtyRef.current) setPendingNav({ next });
    else setRailTarget(next);
  };
  const openCreateRail = (inputIds = []) => requestNav(buildCreateTarget(inputIds));
  // Stable identity: passed to ClustersPanel as onSelectCluster (an effect dep there).
  const selectViewCluster = useCallback((id) => {
    const next = id ? { kind: "view", id } : null;
    if (railDirtyRef.current) setPendingNav({ next });
    else setRailTarget(next);
  }, []);

  const project = projects.find((p) => p.id === activeProjectId) ?? null;

  // Track cursor position and Alt key state while a drag is in progress
  useEffect(() => {
    if (!dragIds) return;
    const onOver = (e) => {
      setDragPos({ x: e.clientX, y: e.clientY });
      setDragIsCopy(e.altKey);
    };
    document.addEventListener("dragover", onOver);
    return () => document.removeEventListener("dragover", onOver);
  }, [dragIds]);

  if (!project) {
    return (
      <div className="py-7 px-8 bg-bg min-h-full">
        <div className="text-[22px] font-medium text-ink mb-2 font-heading">No project selected</div>
        <button onClick={() => setActiveScreen("dashboard")} className={clsx(btnSecCls, "mt-2")}>
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

  const getInputCluster  = (inputId) => projectClusters.find((cl) => cl.input_ids?.includes(inputId)) || null;
  const getInputClusters = (inputId) => projectClusters.filter((cl) => cl.input_ids?.includes(inputId));

  const handleAssignToCluster = (inputId, cluster) => {
    assignInputToCluster(inputId, cluster.id);
    showToast(`Input assigned to "${cluster.name}"`);
    setAssignPickerFor(null);
  };

  // Persist a rail create draft (no navigation). Returns the new cluster so the
  // caller can decide where to go next (the create button → view it; the guard's
  // "Save" → continue to the pending target).
  const createClusterDraft = (fields, inputIds) => {
    const created = addCluster({ ...fields, project_id: project.id, input_ids: inputIds });
    showToast(inputIds.length > 0
      ? `"${fields.name}" created with ${inputIds.length} input${inputIds.length !== 1 ? "s" : ""}`
      : `"${fields.name}" created`);
    return created;
  };

  // ── Tab / filter derived values ──────────────────────────────────────────────
  const unassigned = projectInputs.filter((i) => !getInputCluster(i.id));
  const inCluster  = projectInputs.filter((i) =>  getInputCluster(i.id));

  const tabInputs =
    inputTab === "unassigned" ? unassigned :
    inputTab === "incluster"  ? inCluster :
    [...unassigned, ...inCluster];

  const visibleInputs = tabInputs
    .filter((i) => !searchQuery    || i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((i) => !filterType     || i.subtype === filterType)
    .filter((i) => !filterHorizon  || i.horizon === filterHorizon)
    .filter((i) => !filterSteepled || (i.steepled || []).includes(filterSteepled));

  const anyFilterActive = !!(searchQuery || filterType || filterHorizon || filterSteepled);
  const allVisibleSelected = visibleInputs.length > 0 && visibleInputs.every((i) => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0;

  // ── Multi-select handlers ────────────────────────────────────────────────────
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); visibleInputs.forEach((i) => next.delete(i.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); visibleInputs.forEach((i) => next.add(i.id)); return next; });
    }
    setLastCheckedId(null);
  };

  const handleCheckboxClick = (id, e) => {
    if (e.shiftKey && lastCheckedId && lastCheckedId !== id) {
      const idxA = visibleInputs.findIndex((i) => i.id === lastCheckedId);
      const idxB = visibleInputs.findIndex((i) => i.id === id);
      if (idxA !== -1 && idxB !== -1) {
        const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        setSelectedIds((prev) => {
          const next = new Set(prev);
          visibleInputs.slice(lo, hi + 1).forEach((i) => next.add(i.id));
          return next;
        });
      }
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    }
    setLastCheckedId(id);
  };

  const handleBatchAssign = (cluster) => {
    selectedIds.forEach((id) => assignInputToCluster(id, cluster.id));
    showToast(`${selectedIds.size} input${selectedIds.size !== 1 ? "s" : ""} assigned to "${cluster.name}"`);
    setSelectedIds(new Set());
    setLastCheckedId(null);
    setBatchPickerOpen(false);
  };

  const clearTabFilters = () => { setInputTab("all"); setSelectedIds(new Set()); setLastCheckedId(null); };

  const handleDrop = (clusterId, isAlt) => {
    const droppedIds = [...(dragIds || [])];
    if (!droppedIds.length) return;
    const cluster = projectClusters.find((cl) => cl.id === clusterId);
    setDragIds(null);
    if (!isAlt) {
      droppedIds.forEach((id) => {
        const prev = getInputCluster(id);
        if (prev && prev.id !== clusterId) removeInputFromCluster(id, prev.id);
        assignInputToCluster(id, clusterId);
      });
      const n = droppedIds.length;
      showToast(n === 1 ? `Input moved to "${cluster?.name}"` : `${n} inputs moved to "${cluster?.name}"`);
    } else {
      droppedIds.forEach((id) => duplicateInputToCluster(id, clusterId));
      const n = droppedIds.length;
      showToast(n === 1 ? `Input copied to "${cluster?.name}"` : `${n} inputs copied to "${cluster?.name}"`);
    }
  };

  const handleDropToNewCluster = () => {
    const ids = [...(dragIds || [])];
    setDragIds(null);
    openCreateRail(ids);
  };

  const dragLabel = dragIds
    ? dragIds.length === 1
      ? (projectInputs.find((i) => i.id === dragIds[0])?.name || "1 input")
      : `${dragIds.length} inputs`
    : "";

  const railCluster = railTarget?.kind === "view"
    ? (projectClusters.find((cl) => cl.id === railTarget.id) || null)
    : null;
  const railCreate = railTarget?.kind === "create" ? railTarget : null;
  const railOpen = !!(railCluster || railCreate);

  return (
    <div className={clsx(
      "flex flex-col h-screen overflow-hidden bg-bg transition-[padding] duration-[220ms]",
      // Rail is a fixed 400px right panel; pad content left so it stays usable
      // on wide viewports. Under 860px the rail overlays instead (no padding).
      railOpen && "min-[861px]:pr-[400px]",
    )}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="pt-6 px-8 pb-4 shrink-0 border-b border-border-mid">
        <div className="text-[11px] tracking-[0.02em] text-hint mb-0.75">
          {project.name}
        </div>
        <div className="flex items-center">
          <div className="text-[22px] font-medium text-ink font-heading">Cluster</div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => openCreateRail()}
              className={clsx(btnSmCls, "inline-flex items-center gap-1.25")}
            >
              <CirclePlus size={13} className="shrink-0" /> New cluster
            </button>
          </div>
        </div>
      </div>

      {/* ── Stacked workspace ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* ── ClustersPanel (top, fills available height) ──────── */}
        <ClustersPanel
          projectId={project.id}
          clusters={projectClusters}
          inputs={inputs}
          onNewCluster={() => openCreateRail()}
          removeInputFromCluster={removeInputFromCluster}
          deleteCluster={deleteCluster}
          showToast={showToast}
          dragIds={dragIds}
          dragIsCopy={dragIsCopy}
          onDrop={handleDrop}
          onDropToNewCluster={handleDropToNewCluster}
          assignInputToCluster={assignInputToCluster}
          addCluster={addCluster}
          updateCluster={updateCluster}
          mode={clusterMode}
          setMode={setClusterMode}
          selectedClusterId={railTarget?.kind === "view" ? railTarget.id : null}
          onSelectCluster={selectViewCluster}
          style={{ flex: 1, minHeight: 0, width: "100%", minWidth: 0, borderLeft: "none" }}
        />

        {/* ── Resize handle ──────────────────────────────────────── */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            resizeRef.current = { startY: e.clientY, startHeight: drawerHeight };
            setResizing(true);
          }}
          className="h-[7px] shrink-0 cursor-row-resize bg-bg border-t border-border-mid border-b border-border flex items-center justify-center select-none"
        >
          <div className="flex gap-0.75">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-0.75 h-0.75 rounded-full bg-faint" />
            ))}
          </div>
        </div>

        {/* ── Input rail (bottom, resizable height) ──────────────── */}
        <div
          className="shrink-0 flex flex-col overflow-hidden bg-bg"
          style={{ height: drawerHeight }}
        >

          {/* Fixed: "Inputs" label row */}
          <div className="py-1.25 px-8 shrink-0 flex items-center border-b border-border">
            <span className="text-[11px] font-semibold text-muted">Inputs</span>
          </div>

          {/* Fixed: Drop zone (manual mode only) */}
          {clusterMode === "manual" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDropOnZone(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOnZone(false); }}
              onDrop={(e) => { e.preventDefault(); setDropOnZone(false); handleDropToNewCluster(); }}
              className={clsx(
                "my-1.5 mx-8 py-1.25 px-3 rounded-btn border border-dashed flex items-center justify-center shrink-0 transition-[border-color,background-color] duration-[120ms]",
                dropOnZone ? "border-brand bg-brand-bg" : "border-border bg-white",
              )}
            >
              <span className={clsx("text-[11px]", dropOnZone ? "text-brand" : "text-faint")}>
                ⊕ Drop inputs here to create a new cluster
              </span>
            </div>
          )}

          {/* Fixed: Tabs row */}
          <div className="flex items-end px-8 border-b border-border shrink-0">
            <FilterTab label="All"        count={projectInputs.length} active={inputTab === "all"}        onClick={() => { setInputTab("all");        setSelectedIds(new Set()); setLastCheckedId(null); }} />
            <FilterTab label="Unassigned" count={unassigned.length}    active={inputTab === "unassigned"} onClick={() => { setInputTab("unassigned"); setSelectedIds(new Set()); setLastCheckedId(null); }} />
            <FilterTab label="Clustered"  count={inCluster.length}     active={inputTab === "incluster"}  onClick={() => { setInputTab("incluster");  setSelectedIds(new Set()); setLastCheckedId(null); }} />
          </div>

          {projectInputs.length === 0 ? (
            <div className="flex-1 overflow-y-auto pt-3 px-8 pb-2">
              <div className="bg-white border border-dashed border-border rounded-[12px] py-5 px-6 text-center">
                <div className="text-ui font-medium text-muted mb-1">No inputs yet</div>
                <div className="text-xs text-hint leading-[1.5]">
                  Add inputs on the Scan screen, then drag them to clusters here.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Fixed: Search + filter row */}
              <div className="flex items-center gap-2 pt-1.25 px-8 pb-1.5 shrink-0">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inputs…"
                  className="w-[200px] py-1 px-2.25 text-xs border border-border rounded-[6px] bg-white text-ink font-[inherit] outline-none"
                />
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
                {anyFilterActive && (
                  <button
                    onClick={() => { setSearchQuery(""); setFilterType(null); setFilterHorizon(null); setFilterSteepled(null); }}
                    className="text-[11px] text-muted bg-transparent border-none cursor-pointer font-[inherit] whitespace-nowrap"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Fixed: Column header strip */}
              <div className="px-8 shrink-0">
                <div className="flex items-center gap-2.5 px-3.5 h-[30px] bg-white border border-border border-b-[0.5px] rounded-t-[10px]">
                  <div className="shrink-0 flex items-center" style={{ width: COL.check }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allVisibleSelected; }}
                      className="cursor-pointer accent-ink"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className={clsx("grow basis-0 min-w-0", cellCls)}>Input</div>
                  <div className={cellCls} style={{ width: COL.type }}>Type</div>
                  <div className={cellCls} style={{ width: COL.strength }}>Strength</div>
                  <div className={cellCls} style={{ width: COL.confidence }}>Confidence</div>
                  <div className={cellCls} style={{ width: COL.steepled }}>STEEPLED</div>
                  <div className={cellCls} style={{ width: COL.horizon }}>Horizon</div>
                  <div className={cellCls} style={{ width: COL.cluster }}>Cluster</div>
                  <div className="shrink-0" style={{ width: COL.menu }} />
                </div>
              </div>

              {/* Scrollable: row list */}
              <div className="flex-1 overflow-y-auto px-8 pb-2">

                {visibleInputs.length === 0 ? (
                  <div className="bg-white border border-border border-t-0 rounded-b-[10px] py-4 px-3.5 text-xs text-hint text-center">
                    No inputs match the current filters.
                  </div>
                ) : (
                  <div className="bg-white border border-border border-t-0 rounded-b-[10px] overflow-hidden">
                    {visibleInputs.map((inp) => {
                      const assignedClusters = getInputClusters(inp.id);
                      const isDragging = dragIds?.includes(inp.id);
                      const isSelected = selectedIds.has(inp.id);
                      const steepled = inp.steepled || [];
                      const vis2 = steepled.slice(0, 2);
                      const overflow = steepled.length - 2;
                      return (
                        <div
                          key={inp.id}
                          draggable
                          onClick={(e) => handleCheckboxClick(inp.id, e)}
                          onDragStart={(e) => {
                            if (e.target.closest('button') || e.target.type === 'checkbox') return;
                            setDragIds(selectedIds.has(inp.id) ? [...selectedIds] : [inp.id]);
                            setDragIsCopy(false);
                            if (blankImgRef.current) e.dataTransfer.setDragImage(blankImgRef.current, 0, 0);
                            e.dataTransfer.effectAllowed = "copyMove";
                          }}
                          onDragEnd={() => { setDragIds(null); setDragIsCopy(false); }}
                          onMouseEnter={(e) => { if (!isDragging && !isSelected) e.currentTarget.style.background = "var(--color-surface-hover)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "var(--color-brand-bg)" : "var(--color-white)"; }}
                          className="flex items-center gap-2.5 px-3.5 h-[38px] border-b border-border cursor-grab"
                          style={{
                            background: isSelected ? "var(--color-brand-bg)" : "var(--color-white)",
                            opacity: isDragging ? 0.35 : 1,
                            transition: "opacity 0.1s, background 0.08s",
                          }}
                        >
                          {/* Checkbox */}
                          <div className="shrink-0 flex items-center" style={{ width: COL.check }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={(e) => { e.stopPropagation(); handleCheckboxClick(inp.id, e); }}
                              className="cursor-pointer accent-ink"
                            />
                          </div>
                          {/* Title */}
                          <div className="flex-1 min-w-0 text-ui font-medium text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                            {inp.name}
                          </div>
                          {/* Type */}
                          <div className="shrink-0" style={{ width: COL.type }}>
                            <InputTypeBadge subtype={inp.subtype} />
                          </div>
                          {/* Signal Strength */}
                          <div className="shrink-0" style={{ width: COL.strength }}>
                            {inp.signal_strength ? (
                              <span className={clsx(
                                "text-[10px] py-0.5 px-1.75 rounded-pill border whitespace-nowrap inline-block",
                                STRENGTH_CLASSES[inp.signal_strength] || "text-hint bg-surface-alt border-border",
                              )}>
                                {inp.signal_strength.charAt(0).toUpperCase() + inp.signal_strength.slice(1)}
                              </span>
                            ) : <span className="text-[10px] text-hint">—</span>}
                          </div>
                          {/* Source Confidence */}
                          <div className="shrink-0" style={{ width: COL.confidence }}>
                            {inp.source_confidence ? (
                              <span className={clsx(
                                "text-[10px] py-0.5 px-1.75 rounded-pill border whitespace-nowrap inline-block",
                                CONFIDENCE_CLASSES[inp.source_confidence] || "text-hint bg-surface-alt border-border",
                              )}>
                                {inp.source_confidence.charAt(0).toUpperCase() + inp.source_confidence.slice(1)}
                              </span>
                            ) : <span className="text-[10px] text-hint">—</span>}
                          </div>
                          {/* STEEPLED */}
                          <div className="shrink-0 flex items-center gap-0.75" style={{ width: COL.steepled }}>
                            {vis2.map((t) => (
                              <span key={t} className="text-[10px] py-0.5 px-1.75 rounded-pill bg-surface-alt text-muted border border-border">
                                {STEEPLED_ABB[t] || t}
                              </span>
                            ))}
                            {overflow > 0 && <span className="text-[9px] text-hint">+{overflow}</span>}
                          </div>
                          {/* Horizon */}
                          <div className="shrink-0" style={{ width: COL.horizon }}>
                            {inp.horizon ? <HorizTag h={inp.horizon} /> : <span className="text-[10px] text-hint">—</span>}
                          </div>
                          {/* Cluster assignment / Assign button */}
                          <div className="shrink-0 flex items-center relative" style={{ width: COL.cluster }}>
                            {assignedClusters.length === 0 ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (assignPickerFor !== inp.id) setAssignPickerAnchorRect(e.currentTarget.getBoundingClientRect());
                                    setAssignPickerFor(assignPickerFor === inp.id ? null : inp.id);
                                  }}
                                  className="py-[3px] px-2 rounded-btn bg-brand text-white border-none text-[10px] font-medium cursor-pointer font-[inherit] whitespace-nowrap"
                                >
                                  Assign →
                                </button>
                                {assignPickerFor === inp.id && (
                                  <ClusterAssignMenu
                                    clusters={projectClusters}
                                    onAssign={(cl) => handleAssignToCluster(inp.id, cl)}
                                    onNewCluster={() => { setAssignPickerFor(null); openCreateRail([inp.id]); }}
                                    onClose={() => setAssignPickerFor(null)}
                                    anchorRect={assignPickerAnchorRect}
                                  />
                                )}
                              </>
                            ) : assignedClusters.length === 1 ? (
                              <span className="text-[11px] text-muted overflow-hidden text-ellipsis whitespace-nowrap">
                                {assignedClusters[0].name}
                              </span>
                            ) : (
                              <span className="text-[10.5px] py-0.5 px-1.5 rounded-chip bg-bg text-muted whitespace-nowrap">
                                {assignedClusters.length} clusters
                              </span>
                            )}
                          </div>
                          {/* Drag grip indicator */}
                          <div className="shrink-0 flex items-center justify-center" style={{ width: COL.menu }}>
                            <span className="text-xs text-faint leading-none">⠿</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Multi-select action bar */}
                {someSelected && (
                  <div className="sticky bottom-0 flex items-center gap-2 py-1.75 px-3.5 bg-bg border-t border-border">
                    <span className="text-xs text-muted flex-1">
                      {selectedIds.size} selected
                    </span>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!batchPickerOpen) setBatchAssignAnchorRect(e.currentTarget.getBoundingClientRect());
                          setBatchPickerOpen(!batchPickerOpen);
                        }}
                        className="py-1 px-3 rounded-btn bg-brand text-white border-none text-[11px] font-medium cursor-pointer font-[inherit] whitespace-nowrap"
                      >
                        Assign {selectedIds.size} →
                      </button>
                      {batchPickerOpen && (
                        <ClusterAssignMenu
                          clusters={projectClusters}
                          onAssign={handleBatchAssign}
                          onNewCluster={() => { setBatchPickerOpen(false); openCreateRail([...selectedIds]); setSelectedIds(new Set()); setLastCheckedId(null); }}
                          onClose={() => setBatchPickerOpen(false)}
                          anchorRect={batchAssignAnchorRect}
                        />
                      )}
                    </div>
                    <button
                      onClick={() => { setSelectedIds(new Set()); setLastCheckedId(null); }}
                      className="text-[11px] text-muted bg-transparent border-none cursor-pointer font-[inherit]"
                    >
                      ✕ Clear
                    </button>
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Cluster detail / create rail (non-modal) ───────────── */}
      <ClusterRail
        ref={railRef}
        open={railOpen}
        cluster={railCluster}
        createInputIds={railCreate ? railCreate.inputIds : null}
        createSeq={railCreate ? railCreate.seq : 0}
        inputs={inputs}
        onClose={() => requestNav(null)}
        onRemoveInput={removeInputFromCluster}
        onDelete={(id) => { deleteCluster(id); setRailTarget(null); }}
        updateCluster={updateCluster}
        createClusterDraft={createClusterDraft}
        onViewCluster={(id) => setRailTarget({ kind: "view", id })}
        onDirtyChange={handleDirtyChange}
        guardActive={!!pendingNav}
      />

      {/* ── Unsaved-changes guard (phase 5) ────────────────────── */}
      {pendingNav && (
        <UnsavedChangesDialog
          onKeepEditing={() => setPendingNav(null)}
          onDiscard={() => { setRailTarget(pendingNav.next); setPendingNav(null); }}
          onSave={() => {
            const ok = railRef.current?.commit();
            if (ok === false) { setPendingNav(null); return; } // couldn't save (e.g. no name) — keep the draft open
            setRailTarget(pendingNav.next);
            setPendingNav(null);
          }}
        />
      )}

      <DragGhost
        active={!!dragIds}
        label={dragLabel}
        x={dragPos.x}
        y={dragPos.y}
        isCopy={dragIsCopy}
      />
    </div>
  );
}

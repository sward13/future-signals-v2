import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CirclePlus } from "lucide-react";
import { c, btnSec, btnSm } from "../../styles/tokens.js";
import { HorizTag } from "../shared/Tag.jsx";
import { FilterDropdown } from "../shared/FilterDropdown.jsx";
import { ClusterAssignMenu } from "../shared/ClusterAssignMenu.jsx";
import { ClustersPanel } from "../clusters/ClustersPanel.jsx";
import { DragGhost } from "../clusters/DragGhost.jsx";
import { STEEPLED } from "../../data/seeds.js";

// Returns the next available "Untitled" / "Untitled N" name for a project's cluster list.
// Sequence: "Untitled", "Untitled 2", "Untitled 3", … (gaps are reused, not skipped).
function nextUntitledName(clusters) {
  const used = new Set();
  for (const cl of clusters) {
    if (cl.name === "Untitled") used.add(0);
    const m = cl.name?.match(/^Untitled (\d+)$/);
    if (m) used.add(Number(m[1]));
  }
  if (!used.has(0)) return "Untitled";
  let n = 2;
  while (used.has(n)) n++;
  return `Untitled ${n}`;
}

const STEEPLED_ABB = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const COL = { check: 28, type: 70, strength: 55, confidence: 55, steepled: 80, horizon: 50, cluster: 90, menu: 24 };
const INPUT_TYPE_OPTS = ["signal","issue","projection","plan","obstacle","source"];

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

// ─── Filter tab ────────────────────────────────────────────────────────────────

function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 2px", fontSize: 12,
        cursor: "pointer", fontFamily: "inherit",
        background: "transparent",
        color: active ? c.ink : c.muted,
        border: "none",
        borderBottom: active ? `2px solid ${c.brand}` : "2px solid transparent",
        fontWeight: active ? 500 : 400,
        transition: "color 0.1s, border-color 0.1s",
        marginRight: 12,
        marginBottom: -1,
      }}
    >
      {label}
      <span style={{
        fontSize: 10, padding: "0 4px", borderRadius: 6,
        background: active ? c.brandBg : "rgba(0,0,0,0.06)",
        color: active ? c.brand : c.muted,
      }}>
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
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4,
      background: c.surfaceAlt, color: c.muted, whiteSpace: "nowrap", flexShrink: 0,
    }}>
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

  // Cluster mode lifted to this level so the header Suggested CTA can switch it
  const [clusterMode,  setClusterMode]  = useState("manual");
  // Drop zone state for the InputRail drop target
  const [dropOnZone,   setDropOnZone]   = useState(false);

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
      <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, marginBottom: 8 }}>No project selected</div>
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

  const getInputCluster  = (inputId) => projectClusters.find((cl) => cl.input_ids?.includes(inputId)) || null;
  const getInputClusters = (inputId) => projectClusters.filter((cl) => cl.input_ids?.includes(inputId));

  const createUntitledCluster = (inputIds = []) => {
    const name = nextUntitledName(projectClusters);
    addCluster({ name, project_id: project.id, input_ids: inputIds });
    showToast(inputIds.length > 0
      ? `"${name}" created with ${inputIds.length} input${inputIds.length !== 1 ? "s" : ""}`
      : `"${name}" created`);
  };

  const handleAssignToCluster = (inputId, cluster) => {
    assignInputToCluster(inputId, cluster.id);
    showToast(`Input assigned to "${cluster.name}"`);
    setAssignPickerFor(null);
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
    createUntitledCluster(ids);
  };

  const dragLabel = dragIds
    ? dragIds.length === 1
      ? (projectInputs.find((i) => i.id === dragIds[0])?.name || "1 input")
      : `${dragIds.length} inputs`
    : "";

  const cell = { fontSize: 10, letterSpacing: "0.07em", color: c.hint, flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: c.bg }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ padding: "24px 32px 16px", flexShrink: 0, borderBottom: `1px solid ${c.borderMid}` }}>
        <div style={{ fontSize: 10, letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
          {project.name}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Cluster</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <button
              onClick={() => setClusterMode("suggested")}
              style={{
                ...btnSec,
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, padding: "7px 14px",
              }}
            >
              ✦ Suggested
              {unassigned.length > 0 && (
                <span style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 8,
                  background: c.brand, color: c.white, fontWeight: 500,
                }}>
                  {unassigned.length}
                </span>
              )}
            </button>
            <button
              onClick={() => createUntitledCluster()}
              style={{
                ...btnSm,
                display: "inline-flex", alignItems: "center", gap: 5,
                border: `1px solid ${c.brandBorder}`,
                background: c.brandBg,
                color: c.brand,
              }}
            >
              <CirclePlus size={13} style={{ flexShrink: 0 }} /> New cluster
            </button>
          </div>
        </div>
      </div>

      {/* ── Stacked workspace ────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* ── ClustersPanel (top, fills available height) ──────── */}
        <ClustersPanel
          projectId={project.id}
          clusters={projectClusters}
          inputs={inputs}
          onNewCluster={() => createUntitledCluster()}
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
          style={{ flex: 1, minHeight: 0, width: "100%", minWidth: 0, borderLeft: "none" }}
        />

        {/* ── Resize handle ──────────────────────────────────────── */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            resizeRef.current = { startY: e.clientY, startHeight: drawerHeight };
            setResizing(true);
          }}
          style={{
            height: 7,
            flexShrink: 0,
            cursor: "row-resize",
            background: c.bg,
            borderTop: `1px solid ${c.borderMid}`,
            borderBottom: `1px solid ${c.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: c.faint }} />
            ))}
          </div>
        </div>

        {/* ── Input rail (bottom, resizable height) ──────────────── */}
        <div style={{
          height: drawerHeight, flexShrink: 0,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          background: c.bg,
        }}>

          {/* Fixed: "Inputs" label row */}
          <div style={{
            padding: "5px 32px",
            flexShrink: 0,
            display: "flex", alignItems: "center",
            borderBottom: `1px solid ${c.border}`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.muted }}>Inputs</span>
          </div>

          {/* Fixed: Drop zone (manual mode only) */}
          {clusterMode === "manual" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDropOnZone(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOnZone(false); }}
              onDrop={(e) => { e.preventDefault(); setDropOnZone(false); handleDropToNewCluster(); }}
              style={{
                margin: "6px 32px",
                padding: "5px 12px",
                borderRadius: 7,
                border: `1px dashed ${dropOnZone ? c.brand : c.border}`,
                background: dropOnZone ? c.brandBg : c.white,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              <span style={{ fontSize: 11, color: dropOnZone ? c.brand : c.faint }}>
                ⊕ Drop inputs here to create a new cluster
              </span>
            </div>
          )}

          {/* Fixed: Tabs row */}
          <div style={{
            display: "flex", alignItems: "flex-end",
            padding: "0 32px",
            borderBottom: `1px solid ${c.border}`,
            flexShrink: 0,
          }}>
            <FilterTab label="All"        count={projectInputs.length} active={inputTab === "all"}        onClick={() => { setInputTab("all");        setSelectedIds(new Set()); setLastCheckedId(null); }} />
            <FilterTab label="Unassigned" count={unassigned.length}    active={inputTab === "unassigned"} onClick={() => { setInputTab("unassigned"); setSelectedIds(new Set()); setLastCheckedId(null); }} />
            <FilterTab label="Clustered"  count={inCluster.length}     active={inputTab === "incluster"}  onClick={() => { setInputTab("incluster");  setSelectedIds(new Set()); setLastCheckedId(null); }} />
          </div>

          {projectInputs.length === 0 ? (
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 32px 8px" }}>
              <div style={{
                background: c.white, border: `1px dashed ${c.border}`,
                borderRadius: 12, padding: "20px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: c.muted, marginBottom: 4 }}>No inputs yet</div>
                <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.5 }}>
                  Add inputs on the Scan screen, then drag them to clusters here.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Fixed: Search + filter row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 32px 6px", flexShrink: 0 }}>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inputs…"
                  style={{
                    width: 200, padding: "4px 9px", fontSize: 12,
                    border: `1px solid ${c.border}`, borderRadius: 6,
                    background: c.white, color: c.ink, fontFamily: "inherit", outline: "none",
                  }}
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
                    style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Fixed: Column header strip */}
              <div style={{ padding: "0 32px", flexShrink: 0 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0 14px", height: 30,
                  background: c.white,
                  border: `1px solid ${c.border}`,
                  borderBottom: "0.5px solid rgba(0,0,0,0.09)",
                  borderRadius: "10px 10px 0 0",
                }}>
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
                  <div style={{ flex: 1, minWidth: 0, ...cell }}>Input</div>
                  <div style={{ width: COL.type,       ...cell }}>Type</div>
                  <div style={{ width: COL.strength,   ...cell }}>Strength</div>
                  <div style={{ width: COL.confidence, ...cell }}>Confidence</div>
                  <div style={{ width: COL.steepled,   ...cell }}>STEEPLED</div>
                  <div style={{ width: COL.horizon,    ...cell }}>Horizon</div>
                  <div style={{ width: COL.cluster,    ...cell }}>Cluster</div>
                  <div style={{ width: COL.menu, flexShrink: 0 }} />
                </div>
              </div>

              {/* Scrollable: row list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 32px 8px" }}>

                {visibleInputs.length === 0 ? (
                  <div style={{
                    background: c.white,
                    border: `1px solid ${c.border}`,
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    padding: "16px 14px", fontSize: 12, color: c.hint, textAlign: "center",
                  }}>
                    No inputs match the current filters.
                  </div>
                ) : (
                  <div style={{
                    background: c.white,
                    border: `1px solid ${c.border}`,
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    overflow: "hidden",
                  }}>
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
                          onMouseEnter={(e) => { if (!isDragging && !isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? c.brandBg : c.white; }}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "0 14px", height: 38,
                            borderBottom: `1px solid ${c.border}`,
                            cursor: "grab",
                            background: isSelected ? c.brandBg : c.white,
                            opacity: isDragging ? 0.35 : 1,
                            transition: "opacity 0.1s, background 0.08s",
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
                              return <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 5, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap", display: "inline-block" }}>{inp.signal_strength.charAt(0).toUpperCase() + inp.signal_strength.slice(1)}</span>;
                            })() : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
                          </div>
                          {/* Source Confidence */}
                          <div style={{ width: COL.confidence, flexShrink: 0 }}>
                            {inp.source_confidence ? (() => {
                              const [col, bg, brd] = CONFIDENCE_COLORS[inp.source_confidence] || [c.hint, c.surfaceAlt, c.border];
                              return <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 4, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap", display: "inline-block" }}>{inp.source_confidence.charAt(0).toUpperCase() + inp.source_confidence.slice(1)}</span>;
                            })() : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
                          </div>
                          {/* STEEPLED */}
                          <div style={{ width: COL.steepled, flexShrink: 0, display: "flex", gap: 3, alignItems: "center" }}>
                            {vis2.map((t) => (
                              <span key={t} style={{ fontSize: 9, padding: "1px 4px", borderRadius: 4, background: c.surfaceAlt, color: c.muted }}>
                                {STEEPLED_ABB[t] || t}
                              </span>
                            ))}
                            {overflow > 0 && <span style={{ fontSize: 9, color: c.hint }}>+{overflow}</span>}
                          </div>
                          {/* Horizon */}
                          <div style={{ width: COL.horizon, flexShrink: 0 }}>
                            {inp.horizon ? <HorizTag h={inp.horizon} /> : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
                          </div>
                          {/* Cluster assignment / Assign button */}
                          <div style={{ width: COL.cluster, flexShrink: 0, display: "flex", alignItems: "center", position: "relative" }}>
                            {assignedClusters.length === 0 ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (assignPickerFor !== inp.id) setAssignPickerAnchorRect(e.currentTarget.getBoundingClientRect());
                                    setAssignPickerFor(assignPickerFor === inp.id ? null : inp.id);
                                  }}
                                  style={{ ...btnSm, fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }}
                                >
                                  Assign →
                                </button>
                                {assignPickerFor === inp.id && (
                                  <ClusterAssignMenu
                                    clusters={projectClusters}
                                    onAssign={(cl) => handleAssignToCluster(inp.id, cl)}
                                    onNewCluster={() => { setAssignPickerFor(null); createUntitledCluster([inp.id]); }}
                                    onClose={() => setAssignPickerFor(null)}
                                    anchorRect={assignPickerAnchorRect}
                                  />
                                )}
                              </>
                            ) : assignedClusters.length === 1 ? (
                              <span style={{ fontSize: 11, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {assignedClusters[0].name}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 4, background: c.bg, color: c.muted, whiteSpace: "nowrap" }}>
                                {assignedClusters.length} clusters
                              </span>
                            )}
                          </div>
                          {/* Drag grip indicator */}
                          <div style={{ width: COL.menu, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 12, color: c.faint, lineHeight: 1 }}>⠿</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Multi-select action bar */}
                {someSelected && (
                  <div style={{
                    position: "sticky", bottom: 0,
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 14px",
                    background: c.bg,
                    borderTop: `1px solid ${c.border}`,
                  }}>
                    <span style={{ fontSize: 12, color: c.muted, flex: 1 }}>
                      {selectedIds.size} selected
                    </span>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!batchPickerOpen) setBatchAssignAnchorRect(e.currentTarget.getBoundingClientRect());
                          setBatchPickerOpen(!batchPickerOpen);
                        }}
                        style={{ ...btnSm, fontSize: 11, padding: "4px 12px", whiteSpace: "nowrap" }}
                      >
                        Assign {selectedIds.size} →
                      </button>
                      {batchPickerOpen && (
                        <ClusterAssignMenu
                          clusters={projectClusters}
                          onAssign={handleBatchAssign}
                          onNewCluster={() => { setBatchPickerOpen(false); createUntitledCluster([...selectedIds]); setSelectedIds(new Set()); setLastCheckedId(null); }}
                          onClose={() => setBatchPickerOpen(false)}
                          anchorRect={batchAssignAnchorRect}
                        />
                      )}
                    </div>
                    <button
                      onClick={() => { setSelectedIds(new Set()); setLastCheckedId(null); }}
                      style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
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

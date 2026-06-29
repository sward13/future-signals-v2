/**
 * ProjectDetail screen — project metadata, two-column layout:
 * left = inputs table with filter tabs, right = clusters/systems summary.
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CirclePlus } from "lucide-react";
import { useScannerStatus } from "../../hooks/useScannerStatus.js";
import { c, inp, btnP, btnSm, btnSec, btnG, fl } from "../../styles/tokens.js";
import { STEEPLED } from "../../data/seeds.js";
import { HorizTag, SubtypeTag } from "../shared/Tag.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { ClusterAssignMenu } from "../shared/ClusterAssignMenu.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { AddFromInboxModal } from "../inputs/AddFromInboxModal.jsx";
import { ClusterDrawer } from "../clusters/ClusterDrawer.jsx";
import { ScenarioDrawer } from "../scenarios/ScenarioDrawer.jsx";
import { EditProjectDrawer } from "../projects/EditProjectDrawer.jsx";
import { CsvImportModal } from "../inputs/CsvImportModal.jsx";
import { ClustersPanel } from "../clusters/ClustersPanel.jsx";
import { DragGhost } from "../clusters/DragGhost.jsx";

const STEEPLED_ABB = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const COL = { check: 28, type: 80, quality: 120, steepled: 100, horizon: 55, action: 90, menu: 28 };

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

const INPUT_TYPE_OPTS = ["signal","issue","projection","plan","obstacle","source"];

// ─── Read-only horizon bar ─────────────────────────────────────────────────────

function HorizonBar({ project }) {
  const start = parseInt(project.h1_start, 10) || 2025;
  const end = parseInt(project.h3_end, 10) || 2040;
  const h1End = parseInt(project.h1_end, 10) || start + 3;
  const h2End = parseInt(project.h2_end, 10) || h1End + 5;
  const span = end - start || 15;

  const h1Pct = ((h1End - start) / span) * 100;
  const h2Pct = ((h2End - start) / span) * 100;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ position: "relative", height: 46, borderRadius: 8, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: `${h1Pct}%`, height: "100%",
          background: c.green50, borderRight: `2px solid ${c.white}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.green700, lineHeight: 1 }}>H1</span>
          <span style={{ fontSize: 10, color: c.green700, lineHeight: 1 }}>{project.h1_start}–{project.h1_end}</span>
        </div>
        <div style={{
          position: "absolute", left: `${h1Pct}%`, top: 0,
          width: `${h2Pct - h1Pct}%`, height: "100%",
          background: c.blue50, borderRight: `2px solid ${c.white}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.blue700, lineHeight: 1 }}>H2</span>
          <span style={{ fontSize: 10, color: c.blue700, lineHeight: 1 }}>{project.h2_start}–{project.h2_end}</span>
        </div>
        <div style={{
          position: "absolute", left: `${h2Pct}%`, top: 0, right: 0, height: "100%",
          background: c.amber50,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.amber700, lineHeight: 1 }}>H3</span>
          <span style={{ fontSize: 10, color: c.amber700, lineHeight: 1 }}>{project.h3_start}–{project.h3_end}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Cluster assign popover ────────────────────────────────────────────────────

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
        color: active ? "#3B82F6" : c.muted,
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

// ─── Filter dropdown chip ──────────────────────────────────────────────────────

export function FilterDropdown({ label, value, options, onChange, onClear, isOpen, onToggle, menuWidth = 150 }) {
  const active = !!value;
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 9px", borderRadius: 5, fontSize: 11,
          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          background: active ? c.ink : "transparent",
          color: active ? c.white : c.muted,
          border: `1px solid ${active ? c.ink : c.border}`,
        }}
      >
        {active ? options.find(o => o.value === value)?.label ?? value : label}
        {active ? (
          <span
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}
          >✕</span>
        ) : (
          <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
        )}
      </button>
      {isOpen && (
        <>
          <div onClick={() => onToggle()} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
          <div style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4,
            background: c.white, border: `1px solid ${c.border}`,
            borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            zIndex: 51, minWidth: menuWidth, maxHeight: 280, overflowX: "hidden", overflowY: "auto",
          }}>
            {options.map((opt) => (
              <button
                key={opt.value || "__all__"}
                onClick={() => { onChange(opt.value); onToggle(); }}
                style={{
                  display: "block", width: "100%", padding: "8px 12px",
                  background: value === opt.value ? c.surfaceAlt : "transparent",
                  border: "none", borderBottom: `1px solid ${c.border}`,
                  textAlign: "left", cursor: "pointer",
                  fontSize: 12, color: c.ink, fontFamily: "inherit",
                }}
              >
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</div>
                {opt.sublabel && (
                  <div style={{ fontSize: 10, color: c.hint, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.sublabel}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
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

// ─── Right-column summary card ─────────────────────────────────────────────────

function SummaryCard({ icon, title, count, countLabel, emptyBody, ctaLabel, onCta, addButton, children, showCount = true }) {
  return (
    <div style={{
      background: c.white,
      border: `0.5px solid ${c.border}`,
      borderRadius: 8,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "11px 16px",
        borderBottom: count > 0 ? `0.5px solid ${c.border}` : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
          {icon && <span style={{ fontSize: 12, color: c.hint }}>{icon}</span>}
          <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{title}</span>
          {showCount && (
            <span style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 8,
              background: count > 0 ? c.ink : "rgba(0,0,0,0.06)",
              color: count > 0 ? c.white : c.hint,
              fontWeight: 500,
            }}>
              {count} {countLabel}
            </span>
          )}
        </div>
        {addButton}
      </div>
      {count > 0 ? (
        <div style={{ padding: "10px 14px" }}>
          {children}
        </div>
      ) : (
        <div style={{ padding: "16px 16px" }}>
          <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, marginBottom: ctaLabel ? 10 : 0 }}>{emptyBody}</div>
          {ctaLabel && (
            <button onClick={onCta} style={{
              fontSize: 11, color: c.ink, background: "transparent", border: `1px solid ${c.borderMid}`,
              borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit",
            }}>
              {ctaLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

/**
 * @param {{ appState: object }} props
 */
export default function ProjectDetail({ appState }) {
  const {
    activeProjectId, projects, inputs, clusters, scenarios, canvasNodes,
    addInput, saveInputsToProject, showToast, setActiveScreen, setActiveProjectId,
    openInputDetail, openClusterDetail, openScenarioDetail,
    addCluster, addScenario, updateProject, assignInputToCluster, deleteProject,
    duplicateInputToCluster, deleteInput,
    removeInputFromCluster, deleteCluster,
    workspaceScanningEnabled, setInboxProjectFilter,
  } = appState;

  const [drawerOpen,        setDrawerOpen]        = useState(false);
  const [inboxModalOpen,    setInboxModalOpen]    = useState(false);
  const [clusterDrawerOpen, setClusterDrawerOpen] = useState(false);
  const [scenarioDrawerOpen,setScenarioDrawerOpen]= useState(false);
  const [editDrawerOpen,    setEditDrawerOpen]    = useState(false);
  const [editScrollTo,      setEditScrollTo]      = useState(null);
  const [csvImportOpen,     setCsvImportOpen]     = useState(false);
  const [inputTab,          setInputTab]          = useState("all");
  const [assignPickerFor,        setAssignPickerFor]        = useState(null);
  const [assignPickerAnchorRect, setAssignPickerAnchorRect] = useState(null);
  // Multi-select
  const [selectedIds,            setSelectedIds]            = useState(new Set());
  const [batchPickerOpen,        setBatchPickerOpen]        = useState(false);
  const [batchAssignAnchorRect,  setBatchAssignAnchorRect]  = useState(null);
  const [confirmDeleteIds,       setConfirmDeleteIds]       = useState(null);
  const batchAnchorRef = useRef(null);
  // Drag-and-drop
  const [dragIds,          setDragIds]          = useState(null);       // null | string[]
  const [dragPos,          setDragPos]          = useState({ x: 0, y: 0 });
  const [dragIsCopy,       setDragIsCopy]       = useState(false);
  const [exitingIds,       setExitingIds]       = useState(new Set());
  const [clusterPreInputIds, setClusterPreInputIds] = useState([]);
  const blankImgRef = useRef(null);
  if (!blankImgRef.current) {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    blankImgRef.current = img;
  }
  // Search + filters
  const [searchQuery,       setSearchQuery]       = useState("");
  const [filterType,        setFilterType]        = useState(null);
  const [filterHorizon,     setFilterHorizon]     = useState(null);
  const [filterSteepled,    setFilterSteepled]    = useState(null);
  const [openFilterDropdown,setOpenFilterDropdown]= useState(null);
  // Row context menu + cluster picker for "Duplicate to cluster"
  const [rowMenu,    setRowMenu]    = useState(null); // null | { inputId, rect }
  const [dupePicker, setDupePicker] = useState(null); // null | { inputId, rect }

  const project = projects.find((p) => p.id === activeProjectId) ?? null;
  const { status: scanStatus, foundCount, dismiss: dismissScan } = useScannerStatus(project, inputs);

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

  const projectClusters  = clusters.filter((cl) => cl.project_id === project.id);
  const projectScenarios = scenarios.filter((s)  => s.project_id === project.id);
  const projectHasSystemMap = canvasNodes.some((n) => n.projectId === project.id);
  // Include inputs directly assigned to the project AND inputs referenced in
  // any of the project's clusters (cluster assignment does not update project_id).
  const clusterInputIdSet = new Set(projectClusters.flatMap((cl) => cl.input_ids || []));
  const projectInputs = inputs.filter(
    (i) => i.project_id === project.id || clusterInputIdSet.has(i.id)
  );
  const inboxInputs = inputs.filter((i) => i.project_id === null && !clusterInputIdSet.has(i.id));

  // Determine assigned cluster(s) for an input
  const getInputCluster  = (inputId) => projectClusters.find((cl) => cl.input_ids?.includes(inputId)) || null;
  const getInputClusters = (inputId) => projectClusters.filter((cl) => cl.input_ids?.includes(inputId));

  const unassigned = projectInputs.filter((i) => !getInputCluster(i.id));
  const inCluster  = projectInputs.filter((i) =>  getInputCluster(i.id));

  const tabInputs =
    inputTab === "unassigned" ? unassigned :
    inputTab === "incluster"  ? inCluster :
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

  const toggleSelect = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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
  };

  const handleBulkDelete = () => {
    confirmDeleteIds.forEach((id) => deleteInput(id));
    const n = confirmDeleteIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} deleted`);
    setConfirmDeleteIds(null);
    setSelectedIds(new Set());
  };

  const handleBatchAssign = (cluster) => {
    selectedIds.forEach((id) => assignInputToCluster(id, cluster.id));
    showToast(`${selectedIds.size} input${selectedIds.size !== 1 ? "s" : ""} assigned to "${cluster.name}"`);
    setSelectedIds(new Set());
    setBatchPickerOpen(false);
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

  const handleCreateCluster = (fields) => {
    addCluster({ ...fields, project_id: project.id });
    const n = (fields.input_ids || []).length;
    showToast(n > 0 ? `Cluster created with ${n} input${n !== 1 ? "s" : ""}` : "Cluster created — no inputs linked yet");
    setClusterDrawerOpen(false);
    setClusterPreInputIds([]);
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

  const handleCreateScenario = (fields) => {
    const newScenario = addScenario({ ...fields, project_id: project.id });
    setScenarioDrawerOpen(false);
    if (newScenario) openScenarioDetail(newScenario.id);
    setActiveScreen("scenarios");
    showToast("System created — start mapping relationships");
  };

  const handleAssignToCluster = (inputId, cluster) => {
    assignInputToCluster(inputId, cluster.id);
    showToast(`Input assigned to "${cluster.name}"`);
    setAssignPickerFor(null);
  };

  const handleDrop = (clusterId, isAlt) => {
    const droppedIds = [...(dragIds || [])];
    if (!droppedIds.length) return;
    const cluster = projectClusters.find((cl) => cl.id === clusterId);
    setDragIds(null);
    if (!isAlt) {
      if (inputTab === "unassigned") {
        // Animate rows out before removing from list
        setExitingIds(new Set(droppedIds));
        const prevMap = {};
        droppedIds.forEach((id) => { const prev = getInputCluster(id); if (prev) prevMap[id] = prev.id; });
        setTimeout(() => {
          setExitingIds(new Set());
          droppedIds.forEach((id) => {
            if (prevMap[id] && prevMap[id] !== clusterId) removeInputFromCluster(id, prevMap[id]);
            assignInputToCluster(id, clusterId);
          });
        }, 185);
      } else {
        droppedIds.forEach((id) => {
          const prev = getInputCluster(id);
          if (prev && prev.id !== clusterId) removeInputFromCluster(id, prev.id);
          assignInputToCluster(id, clusterId);
        });
      }
      const n = droppedIds.length;
      showToast(n === 1 ? `Input moved to "${cluster?.name}"` : `${n} inputs moved to "${cluster?.name}"`);
    } else {
      droppedIds.forEach((id) => duplicateInputToCluster(id, clusterId));
      const n = droppedIds.length;
      showToast(n === 1 ? `Input copied to "${cluster?.name}"` : `${n} inputs copied to "${cluster?.name}"`);
    }
  };

  const handleDropToNewCluster = () => {
    setClusterPreInputIds([...(dragIds || [])]);
    setClusterDrawerOpen(true);
    setDragIds(null);
  };

  const handleDuplicateToCluster = async (inputId, destCluster) => {
    setDupePicker(null);
    const result = await duplicateInputToCluster(inputId, destCluster.id);
    if (result) showToast(`Copied to "${destCluster.name}"`);
  };

  const cell = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, flexShrink: 0 };
  const dragLabel = dragIds
    ? dragIds.length === 1
      ? (projectInputs.find((i) => i.id === dragIds[0])?.name || "1 input")
      : `${dragIds.length} inputs`
    : "";

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
        <div style={{ padding: "24px 32px 0", flexShrink: 0, borderBottom: `1px solid ${c.border}` }}>

        {/* ── Header: title row ────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 12, gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
              {project.name}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Inputs</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setInboxModalOpen(true)} style={{ ...btnSec, fontSize: 12, padding: "8px 16px" }}>
              Add from Inbox
            </button>
            <button onClick={() => setDrawerOpen(true)} style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}><CirclePlus size={14} />Add an input</button>
          </div>
        </div>

        {/* ── Header: key question ─────────────────────────────── */}
        {project.question && (
          <div style={{
            padding: "9px 14px",
            background: "#F0F7FF",
            border: "1px solid #BFDBFE",
            borderRadius: 8,
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: c.brand, marginBottom: 3 }}>
              Key question
            </div>
            <div style={{ fontSize: 13, fontStyle: "italic", color: c.ink, lineHeight: 1.5 }}>
              {project.question}
            </div>
          </div>
        )}

        {/* ── Header: project metadata strip ───────────────────── */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          {[
            { label: "Domain",       value: project.domain },
            { label: "Focus",        value: project.unit || project.focus },
            { label: "Geography",    value: project.geo },
            { label: "Stakeholders", value: project.stakeholders },
          ].map(({ label, value }, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && (
                <div style={{ width: 1, height: 14, background: c.borderMid, margin: "0 10px", flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, fontWeight: 500, marginRight: 5 }}>
                {label}
              </span>
              {value
                ? <span style={{ fontSize: 12, color: c.ink }}>{value}</span>
                : <span style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>Not set</span>
              }
            </div>
          ))}
        </div>

        {/* ── Header: time horizons bar ─────────────────────────── */}
        {project.h1_start && <HorizonBar project={project} />}

        </div>{/* end header section */}

        {/* ── Workspace: inputs panel + clusters panel ─────── */}
        <div style={{ display: "flex", alignItems: "stretch", flex: 1, minHeight: 0, overflow: "hidden", padding: "0 0 0 32px" }}>

          {/* ── LEFT: Inputs table ───────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingBottom: 32 }}>
            {/* Row 1: tabs left, add actions right */}
            <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 10, gap: 12, borderBottom: `1px solid ${c.border}` }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <FilterTab label="All"         count={projectInputs.length} active={inputTab === "all"}        onClick={() => { setInputTab("all");        setSelectedIds(new Set()); }} />
                <FilterTab label="Unassigned"  count={unassigned.length}    active={inputTab === "unassigned"} onClick={() => { setInputTab("unassigned"); setSelectedIds(new Set()); }} />
                <FilterTab label="Clustered"   count={inCluster.length}     active={inputTab === "incluster"}  onClick={() => { setInputTab("incluster");  setSelectedIds(new Set()); }} />
              </div>
              <button
                onClick={() => setCsvImportOpen(true)}
                style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "0 0 8px", textDecoration: "underline", textDecorationColor: c.border }}
              >
                Import via CSV
              </button>
            </div>

            {projectInputs.length === 0 ? (
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
                  <button onClick={() => setInboxModalOpen(true)} style={{ ...btnSec, fontSize: 13 }}>Add from Inbox</button>
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

                {/* Row 3: batch action bar (animates in when rows selected) */}
                {someSelected && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 12px", marginBottom: 8,
                    background: "rgb(249, 249, 247)", border: `1px solid ${c.border}`, borderRadius: 8,
                    animation: "fadeSlideIn 0.15s ease",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, flex: 1 }}>
                      {selectedIds.size} selected
                    </span>
                    <div style={{ position: "relative" }} ref={batchAnchorRef}>
                      <button
                        onClick={(e) => {
                          if (!batchPickerOpen) setBatchAssignAnchorRect(e.currentTarget.getBoundingClientRect());
                          setBatchPickerOpen((p) => !p);
                        }}
                        style={{ ...btnSm, fontSize: 11, padding: "4px 10px" }}
                      >
                        Assign →
                      </button>
                      {batchPickerOpen && (
                        <ClusterAssignMenu
                          clusters={projectClusters}
                          onAssign={handleBatchAssign}
                          onNewCluster={() => { setBatchPickerOpen(false); setClusterDrawerOpen(true); }}
                          onClose={() => setBatchPickerOpen(false)}
                          anchorRect={batchAssignAnchorRect}
                        />
                      )}
                    </div>
                    <button
                      onClick={() => setConfirmDeleteIds([...selectedIds])}
                      style={{
                        padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 500,
                        cursor: "pointer", fontFamily: "inherit", border: "none",
                        background: "#FEE2E2", color: "#991B1B",
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      style={{ fontSize: 11, color: "rgb(102, 102, 102)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      ✕ Clear
                    </button>
                  </div>
                )}

                <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 30, borderBottom: "0.5px solid rgba(0,0,0,0.09)" }}>
                    {/* Select-all checkbox */}
                    <div style={{ width: COL.check, flexShrink: 0, display: "flex", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer", accentColor: c.ink }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, ...cell }}>Title</div>
                    <div style={{ width: COL.type,    ...cell }}>Type</div>
                    <div style={{ width: COL.quality, ...cell }}>Strength</div>
                    <div style={{ width: COL.steepled,...cell }}>STEEPLED</div>
                    <div style={{ width: COL.horizon,    ...cell }}>Horizon</div>
                    <div style={{ width: COL.action, flexShrink: 0, ...cell }}>Cluster</div>
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
                    const assignedCluster  = getInputCluster(inp.id);
                    const assignedClusters = getInputClusters(inp.id);
                    const isSelected = selectedIds.has(inp.id);
                    return (
                      <div
                        key={inp.id}
                        draggable
                        onDragStart={(e) => {
                          if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) return;
                          const ids = selectedIds.has(inp.id) && selectedIds.size > 1
                            ? [...selectedIds]
                            : [inp.id];
                          setDragIds(ids);
                          setDragIsCopy(false);
                          if (blankImgRef.current) e.dataTransfer.setDragImage(blankImgRef.current, 0, 0);
                          e.dataTransfer.effectAllowed = "copyMove";
                        }}
                        onDragEnd={() => {
                          setDragIds(null);
                          setDragIsCopy(false);
                          setExitingIds(new Set());
                        }}
                        onClick={() => openInputDetail(inp.id)}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "rgba(0,0,0,0.03)" : c.white; }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "0 14px", height: 38,
                          borderBottom: `1px solid ${c.border}`,
                          cursor: "pointer",
                          transition: exitingIds.has(inp.id)
                            ? "opacity 0.18s ease, transform 0.18s ease"
                            : "background 0.08s",
                          background: isSelected ? "rgba(0,0,0,0.03)" : c.white,
                          opacity: exitingIds.has(inp.id) ? 0 : dragIds?.includes(inp.id) ? 0.35 : 1,
                          transform: exitingIds.has(inp.id) ? "translateX(12px)" : "none",
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{ width: COL.check, flexShrink: 0, display: "flex", alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(inp.id)}
                            onClick={(e) => e.stopPropagation()}
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
                        {/* Signal Strength / Source Confidence */}
                        <div style={{ width: COL.quality, flexShrink: 0 }}>
                          <StrengthCell strength={inp.signal_strength} confidence={inp.source_confidence} />
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
                        {/* Cluster */}
                        <div style={{ width: COL.action, flexShrink: 0, display: "flex", alignItems: "center", position: "relative" }}>
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
                                  onNewCluster={() => { setAssignPickerFor(null); setClusterDrawerOpen(true); }}
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
                            <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.muted, whiteSpace: "nowrap" }}>
                              {assignedClusters.length} clusters
                            </span>
                          )}
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
              </>
            )}
          </div>

          <ClustersPanel
            clusters={projectClusters}
            inputs={inputs}
            onNewCluster={() => setClusterDrawerOpen(true)}
            removeInputFromCluster={removeInputFromCluster}
            deleteCluster={deleteCluster}
            showToast={showToast}
            dragIds={dragIds}
            dragIsCopy={dragIsCopy}
            onDrop={handleDrop}
            onDropToNewCluster={handleDropToNewCluster}
          />
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

      <ClusterDrawer
        open={clusterDrawerOpen}
        onClose={() => { setClusterDrawerOpen(false); setClusterPreInputIds([]); }}
        onSave={handleCreateCluster}
        projectId={project.id}
        projectInputs={projectInputs}
        preselectedInputIds={clusterPreInputIds}
        onAddInput={(fields) => { addInput({ ...fields, project_id: project.id }); showToast("Input added"); }}
        projects={projects}
      />

      {scenarioDrawerOpen && (
        <ScenarioDrawer
          onClose={() => setScenarioDrawerOpen(false)}
          onSave={handleCreateScenario}
        />
      )}

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
                fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em",
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

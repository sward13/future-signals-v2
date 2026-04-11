/**
 * ProjectDetail screen — project metadata, two-column layout:
 * left = inputs table with filter tabs, right = clusters/systems summary.
 */
import { useState, useRef } from "react";
import { useScannerStatus } from "../../hooks/useScannerStatus.js";
import { c, inp, btnP, btnSm, btnSec, btnG, fl } from "../../styles/tokens.js";
import { STEEPLED } from "../../data/seeds.js";
import { HorizTag, SubtypeTag } from "../shared/Tag.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { AddFromInboxModal } from "../inputs/AddFromInboxModal.jsx";
import { ClusterDrawer } from "../clusters/ClusterDrawer.jsx";
import { ScenarioDrawer } from "../scenarios/ScenarioDrawer.jsx";
import { EditProjectDrawer } from "../projects/EditProjectDrawer.jsx";

const STEEPLED_ABB = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const COL = { check: 28, type: 80, quality: 100, steepled: 100, horizon: 55, action: 160 };

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
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: "relative", height: 32, borderRadius: 8, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: `${h1Pct}%`, height: "100%",
          background: c.green50, borderRight: `2px solid ${c.white}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.green700 }}>H1</span>
        </div>
        <div style={{
          position: "absolute", left: `${h1Pct}%`, top: 0,
          width: `${h2Pct - h1Pct}%`, height: "100%",
          background: c.blue50, borderRight: `2px solid ${c.white}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.blue700 }}>H2</span>
        </div>
        <div style={{
          position: "absolute", left: `${h2Pct}%`, top: 0, right: 0, height: "100%",
          background: c.amber50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.amber700 }}>H3</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
        <div style={{ fontSize: 11, color: c.green700 }}>{project.h1_start}–{project.h1_end}</div>
        <div style={{ fontSize: 11, color: c.blue700, textAlign: "center" }}>{project.h2_start}–{project.h2_end}</div>
        <div style={{ fontSize: 11, color: c.amber700, textAlign: "right" }}>{project.h3_start}–{project.h3_end}</div>
      </div>
    </div>
  );
}

// ─── Cluster assign popover ────────────────────────────────────────────────────

function ClusterAssignPopover({ clusters, onAssign, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
      <div style={{
        position: "absolute", top: "100%", right: 0, marginTop: 4,
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
        minWidth: 220, zIndex: 51, overflow: "hidden",
      }}>
        {clusters.length === 0 ? (
          <div style={{ padding: "12px 14px", fontSize: 12, color: c.hint }}>
            No clusters yet — build one first.
          </div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {clusters.map((cl) => (
              <button key={cl.id} onClick={() => onAssign(cl)} style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "9px 14px",
                background: "transparent", border: "none", borderBottom: `1px solid ${c.border}`,
                textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              }}>
                <SubtypeTag sub={cl.subtype} />
                <span style={{ fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cl.name}
                </span>
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: "6px 14px", borderTop: `1px solid ${c.border}` }}>
          <button onClick={onClose} style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Filter tab ────────────────────────────────────────────────────────────────

function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 20, fontSize: 11,
        cursor: "pointer", fontFamily: "inherit",
        background: active ? c.ink : "transparent",
        color: active ? c.white : c.muted,
        border: `1px solid ${active ? c.ink : c.border}`,
        fontWeight: active ? 500 : 400,
        transition: "all 0.1s",
      }}
    >
      {label}
      <span style={{
        fontSize: 10, padding: "0 4px", borderRadius: 6,
        background: active ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)",
        color: active ? c.white : c.muted,
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
      background: "#f0f0ee", color: c.muted, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─── Filter dropdown chip ──────────────────────────────────────────────────────

function FilterDropdown({ label, value, options, onChange, onClear, isOpen, onToggle }) {
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
            zIndex: 51, minWidth: 150, overflow: "hidden",
          }}>
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); onToggle(); }}
                style={{
                  display: "block", width: "100%", padding: "8px 12px",
                  background: value === opt.value ? c.surfaceAlt : "transparent",
                  border: "none", borderBottom: `1px solid ${c.border}`,
                  textAlign: "left", cursor: "pointer",
                  fontSize: 12, color: c.ink, fontFamily: "inherit",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Right-column summary card ─────────────────────────────────────────────────

function SummaryCard({ icon, title, count, countLabel, emptyBody, ctaLabel, onCta, addButton, children }) {
  return (
    <div style={{
      background: c.white,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "11px 16px",
        borderBottom: count > 0 ? `1px solid ${c.border}` : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: c.hint }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{title}</span>
          <span style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 8,
            background: count > 0 ? c.ink : "rgba(0,0,0,0.06)",
            color: count > 0 ? c.white : c.hint,
            fontWeight: 500,
          }}>
            {count} {countLabel}
          </span>
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
    activeProjectId, projects, inputs, clusters, scenarios,
    addInput, saveInputsToProject, showToast, setActiveScreen, setActiveProjectId,
    openInputDetail, openClusterDetail, openScenarioDetail,
    addCluster, addScenario, updateProject, assignInputToCluster, deleteProject,
    workspaceScanningEnabled,
  } = appState;

  const [drawerOpen,        setDrawerOpen]        = useState(false);
  const [inboxModalOpen,    setInboxModalOpen]    = useState(false);
  const [clusterDrawerOpen, setClusterDrawerOpen] = useState(false);
  const [scenarioDrawerOpen,setScenarioDrawerOpen]= useState(false);
  const [editDrawerOpen,    setEditDrawerOpen]    = useState(false);
  const [editScrollTo,      setEditScrollTo]      = useState(null);
  const [inputTab,          setInputTab]          = useState("all");
  const [assignPickerFor,   setAssignPickerFor]   = useState(null);
  // Multi-select
  const [selectedIds,       setSelectedIds]       = useState(new Set());
  const [batchPickerOpen,   setBatchPickerOpen]   = useState(false);
  const batchAnchorRef = useRef(null);
  // Search + filters
  const [searchQuery,       setSearchQuery]       = useState("");
  const [filterType,        setFilterType]        = useState(null);
  const [filterHorizon,     setFilterHorizon]     = useState(null);
  const [filterSteepled,    setFilterSteepled]    = useState(null);
  const [openFilterDropdown,setOpenFilterDropdown]= useState(null);

  const { status: scanStatus, foundCount, dismiss: dismissScan } = useScannerStatus(activeProjectId, inputs);

  const project = projects.find((p) => p.id === activeProjectId);

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

  const cell = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, flexShrink: 0 };

  return (
    <>
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
            onClick={() => { setActiveScreen('inbox'); dismissScan(); }}
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

      <div style={{ padding: "24px 32px", background: c.bg, minHeight: "100%", overflowY: "auto" }}>

        {/* ── Breadcrumb ──────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <button
            onClick={() => setActiveScreen("dashboard")}
            style={{ ...btnG, padding: "3px 0", fontSize: 11, color: c.hint }}
          >
            Projects
          </button>
          <span style={{ fontSize: 11, color: c.hint }}>›</span>
          <span style={{ fontSize: 11, color: c.muted }}>{project.name}</span>
        </div>

        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 16, gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>{project.name}</div>
              <button
                onClick={() => openEditDrawer()}
                style={{
                  fontSize: 11, padding: "3px 9px", borderRadius: 6,
                  background: "transparent", color: c.muted, border: `1px solid ${c.border}`,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Edit project
              </button>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}` }}>
                {project.domain}
              </span>
            </div>
            {project.question && (
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.6, fontStyle: "italic", marginTop: 4, maxWidth: 560 }}>
                "{project.question}"
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setInboxModalOpen(true)} style={{ ...btnSec, fontSize: 12, padding: "8px 16px" }}>
              Add from Inbox
            </button>
            <button onClick={() => setDrawerOpen(true)} style={btnP}>Add an input</button>
          </div>
        </div>

        {/* ── Horizon bar ─────────────────────────────────────── */}
        {project.h1_start && (
          <div style={{ padding: "14px 18px", background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: c.muted, marginBottom: 10 }}>Time horizons</div>
            <HorizonBar project={project} />
          </div>
        )}

        {/* ── Two-column body ──────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* ── LEFT: Inputs table ───────────────────────────── */}
          {/* TODO: responsive pass — sidebar min-width is causing overflow at <1200px */}
          <div style={{ minWidth: 0 }}>
            {/* Row 1: tabs left, add actions right */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FilterTab label="All"         count={projectInputs.length} active={inputTab === "all"}        onClick={() => { setInputTab("all");        setSelectedIds(new Set()); }} />
                <FilterTab label="Unassigned"  count={unassigned.length}    active={inputTab === "unassigned"} onClick={() => { setInputTab("unassigned"); setSelectedIds(new Set()); }} />
                <FilterTab label="In cluster"  count={inCluster.length}     active={inputTab === "incluster"}  onClick={() => { setInputTab("incluster");  setSelectedIds(new Set()); }} />
              </div>
              {projectInputs.length > 0 && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setInboxModalOpen(true)} style={{ ...btnG, fontSize: 11 }}>Add from Inbox</button>
                  <button onClick={() => setDrawerOpen(true)} style={{ ...btnG, fontSize: 11 }}>+ Add</button>
                </div>
              )}
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
                  <button onClick={() => setDrawerOpen(true)} style={btnP}>Add an input</button>
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
                    background: c.ink, borderRadius: 8,
                    animation: "fadeSlideIn 0.15s ease",
                  }}>
                    <span style={{ fontSize: 12, color: c.white, flex: 1 }}>
                      {selectedIds.size} selected
                    </span>
                    <div style={{ position: "relative" }} ref={batchAnchorRef}>
                      <button
                        onClick={() => setBatchPickerOpen((p) => !p)}
                        style={{ ...btnSm, fontSize: 11, padding: "4px 10px", background: c.white, color: c.ink }}
                      >
                        Assign to cluster →
                      </button>
                      {batchPickerOpen && (
                        <ClusterAssignPopover
                          clusters={projectClusters}
                          onAssign={handleBatchAssign}
                          onClose={() => setBatchPickerOpen(false)}
                        />
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
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
                    <div style={{ width: COL.quality, ...cell }}>Quality</div>
                    <div style={{ width: COL.steepled,...cell }}>STEEPLED</div>
                    <div style={{ width: COL.horizon,    ...cell }}>Horizon</div>
                    <div style={{ width: COL.action, flexShrink: 0, ...cell }}>Cluster</div>
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
                        onClick={() => openInputDetail(inp.id)}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "rgba(0,0,0,0.03)" : c.white; }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "0 14px", height: 38,
                          borderBottom: `1px solid ${c.border}`,
                          cursor: "pointer", transition: "background 0.08s",
                          background: isSelected ? "rgba(0,0,0,0.03)" : c.white,
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
                        {/* Signal Quality */}
                        <div style={{ width: COL.quality, flexShrink: 0 }}>
                          <QualityPill value={inp.signal_quality} />
                        </div>
                        {/* STEEPLED */}
                        <div style={{ width: COL.steepled, flexShrink: 0, display: "flex", gap: 3, alignItems: "center" }}>
                          {vis2.map((t) => (
                            <span key={t} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#f0f0ee", color: c.muted }}>
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
                        <div style={{ width: COL.action, flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center", position: "relative" }}>
                          {assignedClusters.length === 0 ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setAssignPickerFor(assignPickerFor === inp.id ? null : inp.id); }}
                                style={{ ...btnSm, fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }}
                              >
                                Assign to cluster →
                              </button>
                              {assignPickerFor === inp.id && (
                                <ClusterAssignPopover
                                  clusters={projectClusters}
                                  onAssign={(cl) => handleAssignToCluster(inp.id, cl)}
                                  onClose={() => setAssignPickerFor(null)}
                                />
                              )}
                            </>
                          ) : assignedClusters.length === 1 ? (
                            <span style={{ fontSize: 11, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {assignedClusters[0].name}
                            </span>
                          ) : (
                            assignedClusters.map((cl) => (
                              <span key={cl.id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#f0f0ee", color: c.muted, whiteSpace: "nowrap" }}>
                                {cl.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT: Clusters & Systems summary ───────────── */}
          <div>
            <SummaryCard
              icon="◈"
              title="Clusters"
              count={projectClusters.length}
              countLabel="built"
              emptyBody={
                projectInputs.length < 3
                  ? `Add at least 3 inputs before clustering. You have ${projectInputs.length} so far.`
                  : "Group your inputs into themes and drivers."
              }
              ctaLabel={projectInputs.length >= 3 ? "Go to Clusters →" : undefined}
              onCta={() => setActiveScreen("clustering")}
              addButton={
                <button
                  onClick={() => setClusterDrawerOpen(true)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                >
                  Build a cluster
                </button>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {projectClusters.map((cl) => (
                  <div
                    key={cl.id}
                    onClick={() => openClusterDetail(cl.id)}
                    style={{
                      padding: "9px 12px", background: c.surfaceAlt,
                      border: `1px solid ${c.border}`, borderRadius: 8, cursor: "pointer",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = c.borderMid}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = c.border}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <SubtypeTag sub={cl.subtype} />
                      <HorizTag h={cl.horizon} />
                      <span style={{ fontSize: 10, color: c.hint, marginLeft: "auto" }}>{cl.input_ids?.length || 0} inputs</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{cl.name}</div>
                  </div>
                ))}
              </div>
            </SummaryCard>

            <SummaryCard
              icon="◆"
              title="System Map"
              count={projectScenarios.length}
              countLabel="built"
              emptyBody="The System Map is built from clusters. Complete your clustering step first."
              ctaLabel={projectClusters.length > 0 ? "Go to System Map →" : undefined}
              onCta={() => setActiveScreen("scenarios")}
              addButton={
                <button
                  onClick={() => setScenarioDrawerOpen(true)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                >
                  Map a system
                </button>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {projectScenarios.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { openScenarioDetail(s.id); setActiveScreen("scenarios"); }}
                    style={{
                      padding: "9px 12px", background: c.surfaceAlt,
                      border: `1px solid ${c.border}`, borderRadius: 8, cursor: "pointer",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = c.borderMid}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = c.border}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{s.name}</div>
                    {s.description && (
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 3 }}>{s.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </SummaryCard>

            {/* Metadata strip */}
            <div
              onClick={() => openEditDrawer()}
              style={{ padding: "12px 14px", background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = c.borderMid}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = c.border}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint }}>Project details</div>
                <span style={{ fontSize: 10, color: c.hint }}>Edit ›</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {project.geo ? (
                  <div onClick={(e) => { e.stopPropagation(); openEditDrawer("geo"); }}>
                    <div style={{ fontSize: 10, color: c.hint, marginBottom: 1 }}>Geography</div>
                    <div style={{ fontSize: 12, color: c.ink }}>{project.geo}</div>
                  </div>
                ) : (
                  <div onClick={(e) => { e.stopPropagation(); openEditDrawer("geo"); }} style={{ fontSize: 11, color: c.hint, fontStyle: "italic" }}>
                    + Add geography
                  </div>
                )}
                {project.unit ? (
                  <div onClick={(e) => { e.stopPropagation(); openEditDrawer("unit"); }}>
                    <div style={{ fontSize: 10, color: c.hint, marginBottom: 1 }}>Focus</div>
                    <div style={{ fontSize: 12, color: c.ink }}>{project.unit}</div>
                  </div>
                ) : (
                  <div onClick={(e) => { e.stopPropagation(); openEditDrawer("unit"); }} style={{ fontSize: 11, color: c.hint, fontStyle: "italic" }}>
                    + Add focus
                  </div>
                )}
                {project.stakeholders ? (
                  <div onClick={(e) => { e.stopPropagation(); openEditDrawer("stakeholders"); }}>
                    <div style={{ fontSize: 10, color: c.hint, marginBottom: 1 }}>Stakeholders</div>
                    <div style={{ fontSize: 12, color: c.ink }}>{project.stakeholders}</div>
                  </div>
                ) : (
                  <div onClick={(e) => { e.stopPropagation(); openEditDrawer("stakeholders"); }} style={{ fontSize: 11, color: c.hint, fontStyle: "italic" }}>
                    + Add stakeholders
                  </div>
                )}
              </div>
            </div>
          </div>
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
        onClose={() => setClusterDrawerOpen(false)}
        onSave={handleCreateCluster}
        projectId={project.id}
        projectInputs={projectInputs}
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

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

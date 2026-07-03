import { useState, useRef, useEffect } from "react";
import { c, btnSec, btnSm } from "../../styles/tokens.js";
import { ClusterAssignMenu } from "../shared/ClusterAssignMenu.jsx";
import { ClustersPanel } from "../clusters/ClustersPanel.jsx";
import { DragGhost } from "../clusters/DragGhost.jsx";

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

  const blankImgRef = useRef(null);
  if (!blankImgRef.current) {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    blankImgRef.current = img;
  }

  // Non-drag assign picker
  const [assignPickerFor,        setAssignPickerFor]        = useState(null);
  const [assignPickerAnchorRect, setAssignPickerAnchorRect] = useState(null);

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
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Cluster</div>
      </div>

      {/* ── Two-column workspace ──────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, minHeight: 0, overflow: "hidden", padding: "0 0 0 32px" }}>

        {/* ── Input rail ────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingBottom: 32 }}>
          {projectInputs.length === 0 ? (
            <div style={{
              background: c.white, border: `1px dashed ${c.border}`,
              borderRadius: 12, padding: "36px 24px", marginTop: 20, textAlign: "center",
            }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: c.muted, marginBottom: 5 }}>No inputs yet</div>
              <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.6 }}>
                Add inputs on the Scan screen, then drag them to clusters here.
              </div>
            </div>
          ) : (
            <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", marginTop: 16 }}>
              {/* Rail header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 30, borderBottom: "0.5px solid rgba(0,0,0,0.09)" }}>
                <div style={{ flex: 1, minWidth: 0, ...cell }}>Input</div>
                <div style={{ width: 80,  ...cell }}>Type</div>
                <div style={{ width: 90,  ...cell }}>Cluster</div>
              </div>

              {/* Rail rows */}
              {projectInputs.map((inp) => {
                const assignedClusters = getInputClusters(inp.id);
                const isDragging = dragIds?.includes(inp.id);
                return (
                  <div
                    key={inp.id}
                    draggable
                    onDragStart={(e) => {
                      if (e.target.closest('button')) return;
                      setDragIds([inp.id]);
                      setDragIsCopy(false);
                      if (blankImgRef.current) e.dataTransfer.setDragImage(blankImgRef.current, 0, 0);
                      e.dataTransfer.effectAllowed = "copyMove";
                    }}
                    onDragEnd={() => {
                      setDragIds(null);
                      setDragIsCopy(false);
                    }}
                    onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = c.white; }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "0 14px", height: 38,
                      borderBottom: `1px solid ${c.border}`,
                      cursor: "grab",
                      background: c.white,
                      opacity: isDragging ? 0.35 : 1,
                      transition: "opacity 0.1s",
                    }}
                  >
                    {/* Name */}
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {inp.name}
                    </div>
                    {/* Type */}
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <InputTypeBadge subtype={inp.subtype} />
                    </div>
                    {/* Cluster assignment / Assign button */}
                    <div style={{ width: 90, flexShrink: 0, display: "flex", alignItems: "center", position: "relative" }}>
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
                        <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.muted, whiteSpace: "nowrap" }}>
                          {assignedClusters.length} clusters
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── ClustersPanel ──────────────────────────────────────── */}
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
        />
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

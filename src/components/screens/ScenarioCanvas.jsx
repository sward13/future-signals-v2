/**
 * ScenarioCanvas — Systems screen. Three-panel layout: cluster/scenario library
 * left, interactive canvas or table view centre, inspector right.
 * Features: connection mode, relationship types, zoom, panel collapse, table view.
 * @param {{ appState: object }} props
 */
import { useState, useRef, useEffect } from "react";
import { c, btnP, btnSm, btnSec, btnG, inp, ta, fl, fh } from "../../styles/tokens.js";
import { SubtypeTag, HorizTag, ArchTag } from "../shared/Tag.jsx";

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_W          = 176;
const CLUSTER_NODE_H  = 58;
const SCENARIO_NODE_H = 70;

const COL_HEADERS = [
  { h: "H1", label: "H1 · Near-term",   col: c.green700, bg: c.green50,  border: c.greenBorder },
  { h: "H2", label: "H2 · Medium-term", col: c.blue700,  bg: c.blue50,   border: c.blueBorder  },
  { h: "H3", label: "H3 · Long-term",   col: c.amber700, bg: c.amber50,  border: c.amberBorder },
];

const ARCHETYPES = [
  { key: "Continuation",   desc: "Trends extend; the future broadly resembles the present." },
  { key: "Collapse",       desc: "A critical system breaks down; discontinuity is sharp." },
  { key: "Constraint",     desc: "Growth hits hard limits; forced adaptation without collapse." },
  { key: "Transformation", desc: "Fundamental structural shift opens new possibilities." },
];

const HORIZON_COLORS = {
  H1: { col: c.green700, bg: c.green50,  border: c.greenBorder },
  H2: { col: c.blue700,  bg: c.blue50,   border: c.blueBorder  },
  H3: { col: c.amber700, bg: c.amber50,  border: c.amberBorder },
};

const REL_TYPES = ["Drives", "Enables", "Accelerates", "Constrains", "Feedback Loop"];

const REL_COLORS = {
  Drives:           { col: c.green700, bg: c.green50,  border: c.greenBorder, stroke: c.green700 },
  Enables:          { col: c.green700, bg: c.green50,  border: c.greenBorder, stroke: c.green700 },
  Accelerates:      { col: c.green700, bg: c.green50,  border: c.greenBorder, stroke: c.green700 },
  Constrains:       { col: c.red800,   bg: c.red50,    border: c.redBorder,   stroke: c.red800   },
  "Feedback Loop":  { col: c.amber700, bg: c.amber50,  border: c.amberBorder, stroke: c.amber700 },
};

// ── Main component ─────────────────────────────────────────────────────────

export default function ScenarioCanvas({ appState }) {
  const {
    activeProjectId, clusters, scenarios, inputs, projects, connections,
    nodePositions, updateNodePosition, addScenario, updateScenario,
    addConnection, updateConnection, removeConnection,
    openClusterDetail, setActiveScreen, showToast,
  } = appState;

  const project       = projects.find((p) => p.id === activeProjectId) || null;
  const projClusters  = clusters.filter((cl) => cl.project_id === activeProjectId);
  const projScenarios = scenarios.filter((s)  => s.project_id  === activeProjectId);
  const projConns     = connections.filter((c) => {
    const sc = scenarios.find((s) => s.id === c.scenarioId);
    return sc?.project_id === activeProjectId;
  });

  // ── Component state ──────────────────────────────────────────────────────
  const [selectedId,       setSelectedId]       = useState(null);   // "cl-<id>" | "sc-<id>" | "conn-<id>"
  const [connectingFromId, setConnectingFromId] = useState(null);   // cluster entity id
  const [view,             setView]             = useState("canvas"); // "canvas" | "table"
  const [zoom,             setZoom]             = useState(1);
  const [leftCollapsed,    setLeftCollapsed]    = useState(false);
  const [rightCollapsed,   setRightCollapsed]   = useState(false);
  const [pendingEnd,       setPendingEnd]       = useState({ x: 0, y: 0 });
  const [canvasWidth,      setCanvasWidth]      = useState(640);
  const [drawerOpen,       setDrawerOpen]       = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const canvasRef        = useRef(null);
  const dragStateRef     = useRef(null);
  const didDragRef       = useRef(false);
  const nodesRef         = useRef([]);
  const updPosRef        = useRef(updateNodePosition);
  const zoomRef          = useRef(zoom);
  const connectingRef    = useRef(connectingFromId);
  const selectedRef      = useRef(selectedId);

  updPosRef.current   = updateNodePosition;
  zoomRef.current     = zoom;
  connectingRef.current = connectingFromId;
  selectedRef.current   = selectedId;

  // ── Column x-positions ───────────────────────────────────────────────────
  const colW = canvasWidth / 3;
  const colX = {
    H1: Math.max(0, Math.round(colW * 0 + (colW - NODE_W) / 2)),
    H2: Math.max(0, Math.round(colW * 1 + (colW - NODE_W) / 2)),
    H3: Math.max(0, Math.round(colW * 2 + (colW - NODE_W) / 2)),
  };

  // ── Node computation ──────────────────────────────────────────────────────
  const colIdxCl = { H1: 0, H2: 0, H3: 0 };
  const colIdxSc = { H1: 0, H2: 0, H3: 0 };

  const clusterNodes = projClusters.map((cl) => {
    const h = cl.horizon || "H1";
    const idx = colIdxCl[h] ?? 0;
    colIdxCl[h] = idx + 1;
    const nodeId = `cl-${cl.id}`;
    const pos = nodePositions[nodeId] ?? { x: colX[h] ?? 0, y: 56 + idx * 84 };
    return { id: nodeId, type: "cluster", entity: cl, pos };
  });

  const scenarioNodes = projScenarios.map((sc) => {
    const h = sc.horizon || "H2";
    const idx = colIdxSc[h] ?? 0;
    colIdxSc[h] = idx + 1;
    const clsInCol = colIdxCl[h] || 0;
    const nodeId = `sc-${sc.id}`;
    const pos = nodePositions[nodeId] ?? { x: colX[h] ?? 0, y: 56 + (clsInCol + idx) * 84 + 24 };
    return { id: nodeId, type: "scenario", entity: sc, pos };
  });

  const allNodes = [...clusterNodes, ...scenarioNodes];
  nodesRef.current = allNodes;

  const selectedNode = selectedId ? allNodes.find((n) => n.id === selectedId) : null;
  const selectedConn = selectedId?.startsWith("conn-")
    ? projConns.find((c) => c.id === selectedId.slice(5))
    : null;

  const sourceClNode = connectingFromId
    ? clusterNodes.find((n) => n.entity.id === connectingFromId)
    : null;

  // ── Effects ───────────────────────────────────────────────────────────────

  // Measure canvas width
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(([e]) => setCanvasWidth(e.contentRect.width));
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  // Drag: window mousemove + mouseup
  useEffect(() => {
    const onMove = (e) => {
      if (!dragStateRef.current) return;
      const dx = (e.clientX - dragStateRef.current.startX) / zoomRef.current;
      const dy = (e.clientY - dragStateRef.current.startY) / zoomRef.current;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
      if (didDragRef.current) {
        updPosRef.current(dragStateRef.current.nodeId, {
          x: Math.max(0, dragStateRef.current.origX + dx),
          y: Math.max(36, dragStateRef.current.origY + dy),
        });
      }
    };
    const onUp = () => { dragStateRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  // Escape key to cancel connection mode or deselect
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (connectingRef.current) setConnectingFromId(null);
      else if (selectedRef.current) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl+scroll / pinch-to-zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.004;
      setZoom((prev) => Math.max(0.4, Math.min(2.0, prev + delta)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleCanvasClick = () => {
    if (connectingFromId) { setConnectingFromId(null); return; }
    setSelectedId(null);
  };

  const handleMouseMove = (e) => {
    if (!connectingFromId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setPendingEnd({
      x: (e.clientX - rect.left) / zoomRef.current,
      y: (e.clientY - rect.top)  / zoomRef.current,
    });
  };

  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    didDragRef.current = false;
    dragStateRef.current = { nodeId, startX: e.clientX, startY: e.clientY, origX: node.pos.x, origY: node.pos.y };
  };

  const handleNodeClick = (e, nodeId) => {
    e.stopPropagation();
    if (didDragRef.current) return;
    setSelectedId((prev) => (prev === nodeId ? null : nodeId));
  };

  const handleConnectClick = (e, clusterId) => {
    e.stopPropagation();
    setConnectingFromId((prev) => (prev === clusterId ? null : clusterId));
    setSelectedId(null);
  };

  const handleScenarioConnectTarget = (e, scenarioId) => {
    e.stopPropagation();
    if (!connectingFromId) return;
    const result = addConnection({ clusterId: connectingFromId, scenarioId, relationshipType: "Drives" });
    if (!result) showToast("Connection already exists", "error");
    setConnectingFromId(null);
  };

  const handleAddScenario = (fields) => {
    const sc = addScenario({ ...fields, project_id: activeProjectId });
    // Create connection records for linked clusters
    for (const clusterId of (fields.cluster_ids || [])) {
      addConnection({ clusterId, scenarioId: sc.id, relationshipType: "Drives" });
    }
    setDrawerOpen(false);
    showToast(`"${sc.name}" created`);
    setSelectedId(`sc-${sc.id}`);
  };

  const isEmpty = projClusters.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: c.bg }}>

      {/* ── Left panel ────────────────────────────────────────────────── */}
      <LeftPanel
        collapsed={leftCollapsed}
        onToggle={() => setLeftCollapsed((v) => !v)}
        clusters={projClusters}
        scenarios={projScenarios}
        selectedId={selectedId}
        onSelectNode={setSelectedId}
        onAddScenario={() => setDrawerOpen(true)}
        noClusters={isEmpty}
        onGoClustering={() => setActiveScreen("clustering")}
      />

      {/* ── Centre column ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Toolbar */}
        <div style={{
          padding: "10px 18px",
          borderBottom: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", gap: 10,
          flexShrink: 0, background: c.white,
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: c.ink }}>Systems</span>
            {project && <span style={{ fontSize: 11, color: c.muted }}>{project.name}</span>}
          </div>
          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: 7, border: `1px solid ${c.borderMid}`, overflow: "hidden" }}>
            {["canvas", "table"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "5px 13px", border: "none", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 11, fontWeight: view === v ? 500 : 400,
                  background: view === v ? c.ink : "transparent",
                  color: view === v ? c.white : c.muted,
                }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            disabled={isEmpty}
            style={{ ...btnSm, opacity: isEmpty ? 0.4 : 1, cursor: isEmpty ? "default" : "pointer" }}
          >
            + Add scenario
          </button>
        </div>

        {/* Canvas or Table */}
        {view === "canvas" ? (
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            style={{
              flex: 1, position: "relative", overflow: "hidden",
              background: c.canvas,
              backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.13) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              userSelect: "none",
              cursor: connectingFromId ? "crosshair" : "default",
            }}
          >
            {isEmpty ? (
              <EmptyCanvas onGoClustering={() => setActiveScreen("clustering")} />
            ) : (
              <>
                {/* Scaled canvas content */}
                <div style={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%",
                  transform: `scale(${zoom})`,
                  transformOrigin: "0 0",
                }}>
                  {/* Column separators */}
                  {[1, 2].map((i) => (
                    <div key={i} style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: `${(100 / 3) * i}%`, width: 1,
                      background: c.border, pointerEvents: "none",
                    }} />
                  ))}

                  {/* Column headers */}
                  {COL_HEADERS.map(({ h, label, col, bg, border }, i) => (
                    <div key={h} style={{
                      position: "absolute", top: 10,
                      left: `${(100 / 3) * i}%`, width: `${100 / 3}%`,
                      display: "flex", justifyContent: "center",
                      pointerEvents: "none",
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 500, padding: "2px 9px",
                        borderRadius: 10, background: bg, color: col, border: `1px solid ${border}`,
                      }}>{label}</span>
                    </div>
                  ))}

                  {/* SVG: connection lines + pending line */}
                  <svg style={{
                    position: "absolute", top: 0, left: 0,
                    width: "100%", height: "100%",
                    overflow: "visible", pointerEvents: "none",
                  }}>
                    {projConns.map((conn) => {
                      const clN = clusterNodes.find((n) => n.entity.id === conn.clusterId);
                      const scN = scenarioNodes.find((n) => n.entity.id === conn.scenarioId);
                      if (!clN || !scN) return null;
                      const isSel = selectedId === `conn-${conn.id}`;
                      const rc = REL_COLORS[conn.relationshipType] || REL_COLORS.Drives;
                      return (
                        <line
                          key={conn.id}
                          x1={clN.pos.x + NODE_W / 2} y1={clN.pos.y + CLUSTER_NODE_H / 2}
                          x2={scN.pos.x + NODE_W / 2} y2={scN.pos.y + SCENARIO_NODE_H / 2}
                          stroke={rc.stroke}
                          strokeWidth={isSel ? 2.5 : 1.5}
                          strokeOpacity={isSel ? 1 : 0.55}
                        />
                      );
                    })}
                    {/* Pending connection line */}
                    {connectingFromId && sourceClNode && (
                      <line
                        x1={sourceClNode.pos.x + NODE_W / 2}
                        y1={sourceClNode.pos.y + CLUSTER_NODE_H / 2}
                        x2={pendingEnd.x} y2={pendingEnd.y}
                        stroke={c.green700} strokeWidth={1.5} strokeDasharray="6,4"
                      />
                    )}
                  </svg>

                  {/* Connection midpoint labels */}
                  {projConns.map((conn) => {
                    const clN = clusterNodes.find((n) => n.entity.id === conn.clusterId);
                    const scN = scenarioNodes.find((n) => n.entity.id === conn.scenarioId);
                    if (!clN || !scN) return null;
                    const mx = (clN.pos.x + NODE_W / 2 + scN.pos.x + NODE_W / 2) / 2;
                    const my = (clN.pos.y + CLUSTER_NODE_H / 2 + scN.pos.y + SCENARIO_NODE_H / 2) / 2;
                    const isSel = selectedId === `conn-${conn.id}`;
                    const rc = REL_COLORS[conn.relationshipType] || REL_COLORS.Drives;
                    return (
                      <div
                        key={conn.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(isSel ? null : `conn-${conn.id}`); }}
                        style={{
                          position: "absolute", left: mx, top: my,
                          transform: "translate(-50%, -50%)",
                          display: "flex", alignItems: "center", gap: 4,
                          cursor: "pointer", zIndex: 5,
                        }}
                      >
                        <span style={{
                          fontSize: 9, fontWeight: 500, padding: "2px 7px",
                          borderRadius: 8, background: rc.bg, color: rc.col,
                          border: `1px solid ${rc.border}`,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          whiteSpace: "nowrap",
                          outline: isSel ? `2px solid ${rc.col}` : "none",
                          outlineOffset: 1,
                        }}>
                          {conn.relationshipType}
                        </span>
                        {isSel && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeConnection(conn.id); setSelectedId(null); }}
                            style={{
                              width: 16, height: 16, borderRadius: "50%",
                              background: c.red800, color: c.white,
                              border: "none", cursor: "pointer",
                              fontSize: 10, fontFamily: "inherit",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Cluster nodes */}
                  {clusterNodes.map((n) => (
                    <ClusterNode
                      key={n.id}
                      cluster={n.entity}
                      pos={n.pos}
                      selected={selectedId === n.id}
                      isConnectingSource={connectingFromId === n.entity.id}
                      isConnecting={connectingFromId !== null}
                      onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                      onClick={(e) => handleNodeClick(e, n.id)}
                      onConnect={(e) => handleConnectClick(e, n.entity.id)}
                    />
                  ))}

                  {/* Scenario nodes */}
                  {scenarioNodes.map((n) => (
                    <ScenarioNode
                      key={n.id}
                      scenario={n.entity}
                      pos={n.pos}
                      selected={selectedId === n.id}
                      isConnecting={connectingFromId !== null}
                      onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                      onClick={(e) => handleNodeClick(e, n.id)}
                      onConnectTarget={(e) => handleScenarioConnectTarget(e, n.entity.id)}
                    />
                  ))}
                </div>

                {/* Zoom controls — outside scaled content, fixed in canvas corner */}
                <div style={{
                  position: "absolute", bottom: 16, right: 16, zIndex: 10,
                  display: "flex", alignItems: "center", gap: 2,
                  background: c.white, borderRadius: 8,
                  border: `1px solid ${c.borderMid}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}>
                  <ZoomBtn onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} label="−" />
                  <span
                    onDoubleClick={() => setZoom(1)}
                    title="Double-click to reset"
                    style={{
                      fontSize: 11, fontWeight: 500, color: c.muted,
                      padding: "5px 8px", minWidth: 44, textAlign: "center",
                      cursor: "default", userSelect: "none",
                      borderLeft: `1px solid ${c.border}`, borderRight: `1px solid ${c.border}`,
                    }}
                  >
                    {Math.round(zoom * 100)}%
                  </span>
                  <ZoomBtn onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(2)))} label="+" />
                </div>

                {/* Connection mode banner */}
                {connectingFromId && (
                  <div style={{
                    position: "absolute", top: 12, left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 10,
                    padding: "6px 14px", borderRadius: 20,
                    background: c.green700, color: c.white,
                    fontSize: 11, fontWeight: 500,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    Click a scenario node to connect — Esc to cancel
                    <button
                      onClick={(e) => { e.stopPropagation(); setConnectingFromId(null); }}
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 14, padding: 0 }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <TableArea
            clusters={projClusters}
            scenarios={projScenarios}
            connections={projConns}
            inputs={inputs}
            onEditCluster={openClusterDetail}
            onEditScenario={(sc) => { setView("canvas"); setSelectedId(`sc-${sc.id}`); }}
            onUpdateCluster={(id, fields) => { appState.updateCluster(id, fields); showToast("Cluster updated"); }}
          />
        )}
      </div>

      {/* ── Right inspector ───────────────────────────────────────────── */}
      <InspectorPanel
        collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed((v) => !v)}
        selectedNode={selectedNode}
        selectedConn={selectedConn}
        clusters={projClusters}
        scenarios={projScenarios}
        inputs={inputs}
        onEditCluster={(id) => openClusterDetail(id)}
        onEditScenario={() => showToast("Scenario editing coming soon")}
        onOpenNarrative={() => setActiveScreen("narrative")}
        onUpdateRelType={(id, type) => updateConnection(id, { relationshipType: type })}
        onDeleteConn={(id) => { removeConnection(id); setSelectedId(null); }}
      />

      {/* ── Add Scenario Drawer ───────────────────────────────────────── */}
      {drawerOpen && (
        <AddScenarioDrawer
          projectClusters={projClusters}
          onClose={() => setDrawerOpen(false)}
          onSave={handleAddScenario}
        />
      )}
    </div>
  );
}

// ── Zoom button ───────────────────────────────────────────────────────────────

function ZoomBtn({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 28, border: "none", background: "transparent",
        color: c.muted, fontSize: 15, cursor: "pointer",
        fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {label}
    </button>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────

function LeftPanel({ collapsed, onToggle, clusters, scenarios, selectedId, onSelectNode, onAddScenario, noClusters, onGoClustering }) {
  if (collapsed) {
    return (
      <div style={{
        width: 40, flexShrink: 0, borderRight: `1px solid ${c.border}`,
        background: c.surfaceAlt, display: "flex", flexDirection: "column",
        alignItems: "center", paddingTop: 10,
      }}>
        <button onClick={onToggle} title="Expand panel" style={{
          ...btnG, padding: "5px 6px", fontSize: 13, color: c.muted,
        }}>›</button>
      </div>
    );
  }

  return (
    <div style={{
      width: 220, flexShrink: 0, borderRight: `1px solid ${c.border}`,
      background: c.surfaceAlt, display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Clusters header */}
      <div style={{ padding: "12px 14px 8px", borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, fontWeight: 500 }}>
            Clusters
          </div>
          <button onClick={onToggle} title="Collapse panel" style={{ ...btnG, padding: "2px 4px", fontSize: 13, color: c.hint }}>‹</button>
        </div>
        {noClusters ? (
          <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.5 }}>
            No clusters yet.{" "}
            <button onClick={onGoClustering} style={{ ...btnG, padding: 0, fontSize: 11, color: c.muted, textDecoration: "underline" }}>
              Go to Clustering →
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {clusters.map((cl) => {
              const nodeId = `cl-${cl.id}`;
              const isSel = selectedId === nodeId;
              return (
                <button key={cl.id} onClick={() => onSelectNode(isSel ? null : nodeId)} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 8px", borderRadius: 5, width: "100%", textAlign: "left",
                  border: `1px solid ${isSel ? c.borderMid : "transparent"}`,
                  background: isSel ? c.white : "transparent",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: c.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cl.name}
                  </span>
                  <SubtypeTag sub={cl.subtype} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Scenarios section */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px 6px", flexShrink: 0 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, fontWeight: 500 }}>
            Scenarios
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
          {scenarios.length === 0 ? (
            <div style={{ fontSize: 11, color: c.hint }}>No scenarios yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {scenarios.map((sc) => {
                const nodeId = `sc-${sc.id}`;
                const isSel = selectedId === nodeId;
                return (
                  <button key={sc.id} onClick={() => onSelectNode(isSel ? null : nodeId)} style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                    padding: "7px 9px", borderRadius: 6, width: "100%", textAlign: "left",
                    background: isSel ? c.ink : "rgba(0,0,0,0.06)",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: isSel ? c.white : c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                      {sc.name}
                    </span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <ArchTag arch={sc.archetype} />
                      <HorizTag h={sc.horizon} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${c.border}`, flexShrink: 0 }}>
        <button onClick={onAddScenario} disabled={noClusters} style={{
          width: "100%", padding: "7px 10px", borderRadius: 6,
          border: `1px dashed ${c.borderMid}`, background: "transparent",
          color: noClusters ? c.hint : c.muted,
          fontSize: 11, fontFamily: "inherit",
          cursor: noClusters ? "default" : "pointer", textAlign: "left",
        }}>
          + Generate scenario
        </button>
      </div>
    </div>
  );
}

// ── Canvas nodes ──────────────────────────────────────────────────────────────

function ClusterNode({ cluster, pos, selected, isConnectingSource, isConnecting, onMouseDown, onClick, onConnect }) {
  const [hovered, setHovered] = useState(false);
  const showConnect = (hovered || selected) && !isConnecting;

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute", left: pos.x, top: pos.y,
        width: NODE_W, minHeight: CLUSTER_NODE_H,
        background: isConnectingSource ? c.green50 : c.white,
        borderRadius: 9,
        border: `1.5px solid ${isConnectingSource ? c.green700 : selected ? c.ink : hovered ? c.borderMid : c.border}`,
        boxShadow: selected ? "0 3px 14px rgba(0,0,0,0.12)" : hovered ? "0 2px 8px rgba(0,0,0,0.07)" : "0 1px 4px rgba(0,0,0,0.05)",
        padding: "9px 10px 8px",
        display: "flex", flexDirection: "column", gap: 5,
        cursor: "grab",
        transition: "border-color 0.1s, box-shadow 0.1s",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {cluster.name}
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <SubtypeTag sub={cluster.subtype} />
        <HorizTag h={cluster.horizon} />
      </div>
      {showConnect && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onConnect}
          style={{
            marginTop: 2, padding: "3px 8px", borderRadius: 5,
            border: `1px solid ${c.greenBorder}`,
            background: c.green50, color: c.green700,
            fontSize: 9, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit", alignSelf: "flex-start",
          }}
        >
          Connect →
        </button>
      )}
    </div>
  );
}

function ScenarioNode({ scenario, pos, selected, isConnecting, onMouseDown, onClick, onConnectTarget }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isConnecting) { onConnectTarget(e); return; }
    onClick(e);
  };

  return (
    <div
      onMouseDown={isConnecting ? undefined : onMouseDown}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute", left: pos.x, top: pos.y,
        width: NODE_W, minHeight: SCENARIO_NODE_H,
        background: selected ? c.ink : "rgba(17,17,17,0.88)",
        borderRadius: 9,
        border: `1.5px solid ${isConnecting ? c.green700 : selected ? "rgba(255,255,255,0.2)" : hovered ? "rgba(255,255,255,0.15)" : "transparent"}`,
        boxShadow: selected ? "0 3px 14px rgba(0,0,0,0.22)" : isConnecting && hovered ? "0 0 0 3px rgba(59,109,17,0.3)" : hovered ? "0 2px 10px rgba(0,0,0,0.16)" : "0 1px 5px rgba(0,0,0,0.12)",
        padding: "10px 10px",
        display: "flex", flexDirection: "column", gap: 5,
        cursor: isConnecting ? "crosshair" : "grab",
        transition: "background 0.1s, box-shadow 0.1s",
        outline: isConnecting && hovered ? `2px solid ${c.green700}` : "none",
        outlineOffset: 2,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: c.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {scenario.name}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <ArchTag arch={scenario.archetype} />
        <HorizTag h={scenario.horizon} />
      </div>
    </div>
  );
}

// ── Table view ────────────────────────────────────────────────────────────────

function TableArea({ clusters, scenarios, connections, inputs, onEditCluster, onEditScenario, onUpdateCluster }) {
  const [editingDescId, setEditingDescId] = useState(null);
  const [descDraft, setDescDraft] = useState("");

  const startEdit = (cl) => {
    setEditingDescId(cl.id);
    setDescDraft(cl.description || "");
  };

  const commitEdit = (id) => {
    onUpdateCluster(id, { description: descDraft });
    setEditingDescId(null);
  };

  const TH = ({ children, width }) => (
    <div style={{
      width, flexShrink: 0, fontSize: 10, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.07em",
      color: c.hint, padding: "8px 10px",
    }}>
      {children}
    </div>
  );

  const TD = ({ children, width, style: s }) => (
    <div style={{ width, flexShrink: 0, padding: "8px 10px", fontSize: 12, color: c.ink, ...s }}>
      {children}
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

      {/* Clusters table */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 12 }}>
          Clusters <span style={{ fontSize: 11, color: c.hint, fontWeight: 400 }}>({clusters.length})</span>
        </div>
        {clusters.length === 0 ? (
          <div style={{ fontSize: 12, color: c.hint }}>No clusters for this project.</div>
        ) : (
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", background: c.white }}>
            {/* Header */}
            <div style={{ display: "flex", borderBottom: `1px solid ${c.border}`, background: c.surfaceAlt }}>
              <TH width={200}>Name</TH>
              <TH width={90}>Subtype</TH>
              <TH width={70}>Horizon</TH>
              <TH width={100}>Likelihood</TH>
              <TH width={60}>Inputs</TH>
              <TH width="100%">Description</TH>
            </div>
            {clusters.map((cl, i) => {
              const inputCount = inputs.filter((inp) => (cl.input_ids || []).includes(inp.id)).length;
              return (
                <div
                  key={cl.id}
                  style={{
                    display: "flex", alignItems: "flex-start",
                    borderBottom: i < clusters.length - 1 ? `1px solid ${c.border}` : "none",
                    cursor: "pointer",
                  }}
                  onClick={() => onEditCluster(cl.id)}
                >
                  <TD width={200}><span style={{ fontWeight: 500 }}>{cl.name}</span></TD>
                  <TD width={90}><SubtypeTag sub={cl.subtype} /></TD>
                  <TD width={70}><HorizTag h={cl.horizon} /></TD>
                  <TD width={100} style={{ color: c.muted }}>{cl.likelihood || "—"}</TD>
                  <TD width={60} style={{ color: c.muted }}>{inputCount}</TD>
                  <TD width="100%" style={{ color: c.muted }}>
                    {editingDescId === cl.id ? (
                      <textarea
                        autoFocus
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        onBlur={() => commitEdit(cl.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          ...ta, minHeight: 56, fontSize: 11,
                          padding: "6px 8px", borderRadius: 5,
                        }}
                      />
                    ) : (
                      <span
                        onClick={(e) => { e.stopPropagation(); startEdit(cl); }}
                        style={{
                          display: "block", minHeight: 20,
                          borderRadius: 4, padding: "2px 4px",
                          border: `1px solid transparent`,
                          cursor: "text",
                          color: cl.description ? c.muted : c.hint,
                          fontStyle: cl.description ? "normal" : "italic",
                        }}
                        title="Click to edit"
                      >
                        {cl.description || "Click to add description…"}
                      </span>
                    )}
                  </TD>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scenarios table */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 12 }}>
          Scenarios <span style={{ fontSize: 11, color: c.hint, fontWeight: 400 }}>({scenarios.length})</span>
        </div>
        {scenarios.length === 0 ? (
          <div style={{ fontSize: 12, color: c.hint }}>No scenarios for this project yet.</div>
        ) : (
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", background: c.white }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${c.border}`, background: c.surfaceAlt }}>
              <TH width={200}>Name</TH>
              <TH width={130}>Archetype</TH>
              <TH width={70}>Horizon</TH>
              <TH width={220}>Linked clusters</TH>
              <TH width="100%">Narrative</TH>
            </div>
            {scenarios.map((sc, i) => {
              const linkedNames = connections
                .filter((cn) => cn.scenarioId === sc.id)
                .map((cn) => {
                  const cl = clusters.find((cl) => cl.id === cn.clusterId);
                  return cl?.name || cn.clusterId;
                })
                .join(", ");
              return (
                <div
                  key={sc.id}
                  onClick={() => onEditScenario(sc)}
                  style={{
                    display: "flex", alignItems: "flex-start", cursor: "pointer",
                    borderBottom: i < scenarios.length - 1 ? `1px solid ${c.border}` : "none",
                  }}
                >
                  <TD width={200}><span style={{ fontWeight: 500 }}>{sc.name}</span></TD>
                  <TD width={130}><ArchTag arch={sc.archetype} /></TD>
                  <TD width={70}><HorizTag h={sc.horizon} /></TD>
                  <TD width={220} style={{ color: c.muted, fontSize: 11 }}>{linkedNames || "—"}</TD>
                  <TD width="100%" style={{ color: c.hint, fontSize: 11 }}>
                    {sc.narrative
                      ? sc.narrative.slice(0, 120) + (sc.narrative.length > 120 ? "…" : "")
                      : <span style={{ fontStyle: "italic" }}>No narrative yet</span>
                    }
                  </TD>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inspector panel ───────────────────────────────────────────────────────────

function InspectorPanel({ collapsed, onToggle, selectedNode, selectedConn, clusters, scenarios, inputs, onEditCluster, onEditScenario, onOpenNarrative, onUpdateRelType, onDeleteConn }) {
  if (collapsed) {
    return (
      <div style={{
        width: 40, flexShrink: 0, borderLeft: `1px solid ${c.border}`,
        background: c.white, display: "flex", flexDirection: "column",
        alignItems: "center", paddingTop: 10,
      }}>
        <button onClick={onToggle} title="Expand panel" style={{ ...btnG, padding: "5px 6px", fontSize: 13, color: c.muted }}>‹</button>
      </div>
    );
  }

  return (
    <div style={{
      width: 260, flexShrink: 0, borderLeft: `1px solid ${c.border}`,
      background: c.white, display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${c.border}`, flexShrink: 0, display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, fontSize: 11, fontWeight: 500, color: c.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Inspector
        </div>
        <button onClick={onToggle} title="Collapse panel" style={{ ...btnG, padding: "2px 4px", fontSize: 13, color: c.hint }}>›</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {selectedConn ? (
          <ConnectionInspector
            conn={selectedConn}
            clusters={clusters}
            scenarios={scenarios}
            onUpdateRelType={onUpdateRelType}
            onDelete={onDeleteConn}
          />
        ) : !selectedNode ? (
          <EmptyInspector />
        ) : selectedNode.type === "cluster" ? (
          <ClusterInspector
            cluster={selectedNode.entity}
            inputs={inputs}
            onEdit={() => onEditCluster(selectedNode.entity.id)}
          />
        ) : (
          <ScenarioInspector
            scenario={selectedNode.entity}
            clusters={clusters}
            onEdit={onEditScenario}
            onOpenNarrative={onOpenNarrative}
          />
        )}
      </div>
    </div>
  );
}

function EmptyInspector() {
  return (
    <div style={{ textAlign: "center", paddingTop: 36 }}>
      <div style={{ fontSize: 26, opacity: 0.1, marginBottom: 10 }}>◆</div>
      <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.65 }}>
        Select a node or connection to inspect it.
      </div>
    </div>
  );
}

function ClusterInspector({ cluster, inputs, onEdit }) {
  const inputCount = inputs.filter((i) => (cluster.input_ids || []).includes(i.id)).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <SubtypeTag sub={cluster.subtype} />
        <HorizTag h={cluster.horizon} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, marginBottom: 8, lineHeight: 1.35 }}>{cluster.name}</div>
      {cluster.likelihood && (
        <div style={{ fontSize: 11, color: c.muted, marginBottom: 8 }}>
          Likelihood: <strong>{cluster.likelihood}</strong>
        </div>
      )}
      {cluster.description && (
        <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.65, marginBottom: 12 }}>{cluster.description}</div>
      )}
      <div style={{
        fontSize: 11, color: c.hint, padding: "5px 9px",
        background: c.surfaceAlt, borderRadius: 6, marginBottom: 14,
        border: `1px solid ${c.border}`,
      }}>
        {inputCount} input{inputCount !== 1 ? "s" : ""} linked
      </div>
      <button onClick={onEdit} style={{ ...btnSec, fontSize: 11, padding: "7px 12px" }}>
        Edit cluster →
      </button>
    </div>
  );
}

function ScenarioInspector({ scenario, clusters, onEdit, onOpenNarrative }) {
  const linkedClusters = clusters.filter((cl) => (scenario.cluster_ids || []).includes(cl.id));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ArchTag arch={scenario.archetype} />
        <HorizTag h={scenario.horizon} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, marginBottom: 8, lineHeight: 1.35 }}>{scenario.name}</div>
      {scenario.narrative && (
        <div style={{
          fontSize: 11, color: c.muted, lineHeight: 1.65, marginBottom: 12,
          display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {scenario.narrative}
        </div>
      )}
      {linkedClusters.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>
            Linked clusters
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {linkedClusters.map((cl) => (
              <div key={cl.id} style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: c.muted,
                padding: "4px 8px", borderRadius: 5,
                background: c.surfaceAlt, border: `1px solid ${c.border}`,
              }}>
                <SubtypeTag sub={cl.subtype} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cl.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <button onClick={onOpenNarrative} style={{ ...btnP, fontSize: 11, padding: "8px 14px" }}>
          Open narrative →
        </button>
        <button onClick={onEdit} style={{ ...btnSec, fontSize: 11, padding: "7px 12px" }}>
          Edit scenario
        </button>
      </div>
    </div>
  );
}

function ConnectionInspector({ conn, clusters, scenarios, onUpdateRelType, onDelete }) {
  const cluster  = clusters.find((cl) => cl.id === conn.clusterId);
  const scenario = scenarios.find((s)  => s.id  === conn.scenarioId);

  return (
    <div>
      <div style={{ ...fl, marginBottom: 12 }}>Connection</div>

      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 3 }}>From cluster</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, marginBottom: 12,
        padding: "5px 8px", borderRadius: 6, background: c.surfaceAlt, border: `1px solid ${c.border}` }}>
        {cluster?.name || "Unknown"}
      </div>

      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 3 }}>To scenario</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, marginBottom: 16,
        padding: "5px 8px", borderRadius: 6, background: "rgba(17,17,17,0.06)", border: `1px solid ${c.border}` }}>
        {scenario?.name || "Unknown"}
      </div>

      <div style={{ ...fl, marginBottom: 8 }}>Relationship type</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
        {REL_TYPES.map((type) => {
          const isSel = conn.relationshipType === type;
          const rc = REL_COLORS[type];
          return (
            <button key={type} onClick={() => onUpdateRelType(conn.id, type)} style={{
              padding: "7px 10px", borderRadius: 7, textAlign: "left",
              border: `1.5px solid ${isSel ? rc.col : c.border}`,
              background: isSel ? rc.bg : "transparent",
              color: isSel ? rc.col : c.muted,
              fontSize: 12, fontWeight: isSel ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {type}
            </button>
          );
        })}
      </div>

      <button onClick={() => onDelete(conn.id)} style={{
        ...btnSec, fontSize: 11, padding: "7px 12px",
        color: c.red800, borderColor: c.redBorder,
      }}>
        Delete connection
      </button>
    </div>
  );
}

// ── Empty canvas state ────────────────────────────────────────────────────────

function EmptyCanvas({ onGoClustering }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
    }}>
      <div style={{ fontSize: 32, opacity: 0.1, marginBottom: 14 }}>◆</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: c.muted, marginBottom: 6 }}>No clusters yet</div>
      <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.65, maxWidth: 280, marginBottom: 20 }}>
        Create clusters in the Clustering screen first, then return here to build scenarios.
      </div>
      <button onClick={onGoClustering} style={btnSm}>Go to Clustering →</button>
    </div>
  );
}

// ── Add Scenario Drawer ───────────────────────────────────────────────────────

function AddScenarioDrawer({ projectClusters, onClose, onSave }) {
  const [name,       setName]       = useState("");
  const [archetype,  setArchetype]  = useState("Continuation");
  const [horizon,    setHorizon]    = useState("H2");
  const [clusterIds, setClusterIds] = useState([]);
  const [narrative,  setNarrative]  = useState("");

  const toggleCluster = (id) =>
    setClusterIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 300 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
        background: c.white, borderLeft: `1px solid ${c.border}`,
        zIndex: 301, display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
        animation: "drawerSlideIn 0.25s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, fontSize: 16, fontWeight: 500, color: c.ink }}>New Scenario</div>
            <button onClick={onClose} style={{ ...btnG, padding: "4px 8px", fontSize: 16 }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={fl}>Name <span style={{ color: c.red800 }}>*</span></label>
            <input
              style={inp} autoFocus
              placeholder="e.g. The Governance Chasm"
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Archetype */}
          <div style={{ marginBottom: 18 }}>
            <label style={fl}>Archetype</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {ARCHETYPES.map(({ key, desc }) => {
                const isSel = archetype === key;
                return (
                  <button key={key} onClick={() => setArchetype(key)} style={{
                    padding: "10px 11px", borderRadius: 8, textAlign: "left",
                    border: `1.5px solid ${isSel ? c.ink : c.border}`,
                    background: isSel ? c.ink : c.white,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isSel ? c.white : c.ink, marginBottom: 3 }}>{key}</div>
                    <div style={{ fontSize: 10, color: isSel ? "rgba(255,255,255,0.6)" : c.hint, lineHeight: 1.4 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horizon */}
          <div style={{ marginBottom: 18 }}>
            <label style={fl}>Horizon</label>
            <div style={{ display: "flex", gap: 7 }}>
              {["H1", "H2", "H3"].map((h) => {
                const hc = HORIZON_COLORS[h];
                const isSel = horizon === h;
                return (
                  <button key={h} onClick={() => setHorizon(h)} style={{
                    padding: "6px 18px", borderRadius: 20,
                    border: `1.5px solid ${isSel ? hc.col : c.border}`,
                    background: isSel ? hc.bg : "transparent",
                    color: isSel ? hc.col : c.muted,
                    fontSize: 12, fontWeight: isSel ? 600 : 400,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{h}</button>
                );
              })}
            </div>
          </div>

          {/* Link clusters */}
          {projectClusters.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={fl}>Link clusters</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {projectClusters.map((cl) => {
                  const checked = clusterIds.includes(cl.id);
                  return (
                    <button key={cl.id} onClick={() => toggleCluster(cl.id)} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "7px 10px", borderRadius: 6,
                      border: `1px solid ${checked ? c.borderMid : c.border}`,
                      background: checked ? "rgba(0,0,0,0.02)" : c.white,
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}>
                      <SmallCheckbox checked={checked} />
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cl.name}
                      </span>
                      <SubtypeTag sub={cl.subtype} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Narrative seed */}
          <div>
            <label style={fl}>
              Narrative seed{" "}
              <span style={{ fontSize: 10, color: c.hint, fontWeight: 400, fontStyle: "italic" }}>(optional)</span>
            </label>
            <textarea
              style={{ ...ta, minHeight: 80 }}
              placeholder="A brief opening framing for this scenario…"
              value={narrative} onChange={(e) => setNarrative(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 22px", borderTop: `1px solid ${c.border}`, display: "flex", gap: 9, flexShrink: 0 }}>
          <button onClick={onClose} style={btnSec}>Cancel</button>
          <button
            onClick={() => { if (name.trim()) onSave({ name: name.trim(), archetype, horizon, cluster_ids: clusterIds, narrative }); }}
            disabled={!name.trim()}
            style={{ ...btnP, flex: 1, opacity: name.trim() ? 1 : 0.35, cursor: name.trim() ? "pointer" : "default" }}
          >
            Create scenario
          </button>
        </div>
      </div>

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

function SmallCheckbox({ checked }) {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: 3, flexShrink: 0,
      border: `1.5px solid ${checked ? c.ink : c.borderMid}`,
      background: checked ? c.ink : c.white,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

/**
 * ScenarioCanvas — Relationship Canvas screen.
 * Left sidebar: cluster library + legend. Centre: draggable, pannable, zoomable canvas
 * with SVG relationship lines. Right: inspector panel. Toggle to table view.
 * @param {{ appState: object }} props
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { c, ta, btnP, btnSm, btnSec, btnG, fl } from "../../styles/tokens.js";
import { ProjectPicker } from "../shared/ProjectPicker.jsx";

const NODE_W = 156;
const NODE_H = 68;

const REL_TYPES = [
  { id: "Drives",        color: "#185FA5", dash: false, desc: "One cluster directly propels another" },
  { id: "Enables",       color: "#3B6D11", dash: false, desc: "Creates conditions for another to occur" },
  { id: "Accelerates",   color: "#0F766E", dash: false, desc: "Speeds up the pace of another cluster" },
  { id: "Inhibits",      color: "#854F0B", dash: false, desc: "Slows down or weakens another cluster" },
  { id: "Blocks",        color: "#791F1F", dash: false, desc: "Actively prevents or stops another cluster" },
  { id: "Feedback Loop", color: "#B45309", dash: true,  desc: "Mutually reinforcing or dampening cycle" },
  { id: "Displaces",     color: "#4B1010", dash: false, desc: "Replaces or supersedes another cluster" },
];

const SUBTYPE_STYLE = {
  Trend:   { col: c.violet700, bg: c.violet50,  border: c.violetBorder },
  Driver:  { col: c.blue700,   bg: c.blue50,    border: c.blueBorder   },
  Tension: { col: c.amber700,  bg: c.amber50,   border: c.amberBorder  },
};

const HORIZON_COLORS = {
  H1: [c.green700, c.green50, c.greenBorder],
  H2: [c.blue700,  c.blue50,  c.blueBorder ],
  H3: [c.amber700, c.amber50, c.amberBorder],
};

const LEFT_BORDER_COLOR = {
  Trend:   c.violetBorder,
  Driver:  c.blueBorder,
  Tension: c.amberBorder,
};

/**
 * Returns the cardinal edge midpoint nearest to the target, plus the unit exit
 * direction perpendicular to that edge (the direction a line leaves the node face).
 */
function cardinalEdgePoint(node, towardX, towardY) {
  const cx = node.x + NODE_W / 2;
  const cy = node.y + NODE_H / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (Math.abs(dx) * NODE_H > Math.abs(dy) * NODE_W) {
    return dx > 0
      ? { x: node.x + NODE_W, y: cy, ex: 1,  ey: 0  }  // right edge → exits right
      : { x: node.x,          y: cy, ex: -1, ey: 0  }; // left edge  → exits left
  }
  return dy > 0
    ? { x: cx, y: node.y + NODE_H, ex: 0, ey: 1  }     // bottom edge → exits down
    : { x: cx, y: node.y,          ex: 0, ey: -1 };    // top edge    → exits up
}

/**
 * Compute line segments terminating at node edges with perpendicular offsets for
 * parallel relationships. Exit directions are returned for cubic bezier control points.
 */
function computeLineSegments(relationships, canvasNodes) {
  const pairGroups = {};
  relationships.forEach((rel) => {
    const key = [rel.fromClusterId, rel.toClusterId].sort().join("||");
    if (!pairGroups[key]) pairGroups[key] = [];
    pairGroups[key].push(rel);
  });

  return relationships.map((rel) => {
    const fromNode = canvasNodes.find((n) => n.clusterId === rel.fromClusterId);
    const toNode   = canvasNodes.find((n) => n.clusterId === rel.toClusterId);
    if (!fromNode || !toNode) return null;

    const fromCx = fromNode.x + NODE_W / 2;
    const fromCy = fromNode.y + NODE_H / 2;
    const toCx   = toNode.x   + NODE_W / 2;
    const toCy   = toNode.y   + NODE_H / 2;

    const ep1 = cardinalEdgePoint(fromNode, toCx, toCy);
    const ep2 = cardinalEdgePoint(toNode, fromCx, fromCy);

    const key   = [rel.fromClusterId, rel.toClusterId].sort().join("||");
    const group = pairGroups[key];
    const idx   = group.indexOf(rel);
    const total = group.length;

    const dx  = ep2.x - ep1.x;
    const dy  = ep2.y - ep1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = -dy / len;
    const ny  =  dx / len;
    const offset = (idx - (total - 1) / 2) * 10;

    return {
      rel,
      x1: ep1.x + nx * offset,
      y1: ep1.y + ny * offset,
      x2: ep2.x + nx * offset,
      y2: ep2.y + ny * offset,
      // exit directions for bezier control points (unaffected by parallel offset)
      ex1: ep1.ex, ey1: ep1.ey,
      ex2: ep2.ex, ey2: ep2.ey,
    };
  }).filter(Boolean);
}

/** Relationship type/evidence/confidence form modal. */
function RelModal({ fromCluster, toCluster, initial, onSave, onClose }) {
  const [relType,    setRelType]    = useState(initial?.type       || "Drives");
  const [evidence,   setEvidence]   = useState(initial?.evidence   || "");
  const [confidence, setConfidence] = useState(initial?.confidence || "Medium");

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 492, background: c.white, borderRadius: 12, zIndex: 501,
        border: `1px solid ${c.border}`, boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
        display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 4 }}>
            Define relationship
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: c.ink }}>
            <span style={{ color: c.muted }}>{fromCluster?.name}</span>
            <span style={{ color: c.hint, margin: "0 10px" }}>→</span>
            <span>{toCluster?.name}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 22px", overflowY: "auto" }}>
          {/* Type cards */}
          <div style={{ marginBottom: 18 }}>
            <div style={fl}>Relationship type</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {REL_TYPES.map(({ id, color, dash, desc }) => {
                const on = relType === id;
                return (
                  <button
                    key={id}
                    onClick={() => setRelType(id)}
                    style={{
                      padding: "9px 12px", borderRadius: 8, textAlign: "left",
                      border: `1.5px solid ${on ? color : c.border}`,
                      background: on ? "rgba(0,0,0,0.015)" : c.white,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                      <div style={{
                        width: 22, height: 2.5, borderRadius: 2, flexShrink: 0,
                        background: dash
                          ? `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`
                          : color,
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: on ? c.ink : c.muted }}>{id}</span>
                    </div>
                    <div style={{ fontSize: 10, color: c.hint, lineHeight: 1.4 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Evidence */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...fl, gap: 5 }}>
              Evidence
              <span style={{ fontSize: 10, fontWeight: 400, color: c.hint }}>optional</span>
            </div>
            <textarea
              style={{ ...ta, minHeight: 68 }}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="What evidence supports this relationship?"
            />
          </div>

          {/* Confidence */}
          <div>
            <div style={fl}>Confidence</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Low", "Medium", "High"].map((lv) => {
                const on = confidence === lv;
                return (
                  <button
                    key={lv}
                    onClick={() => setConfidence(lv)}
                    style={{
                      padding: "6px 20px", borderRadius: 20,
                      border: `1px solid ${on ? c.borderMid : c.border}`,
                      background: on ? c.ink : c.white,
                      color: on ? c.white : c.muted,
                      fontSize: 12, fontWeight: on ? 500 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{lv}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 22px 18px", borderTop: `1px solid ${c.border}`,
          display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0,
        }}>
          <button onClick={onClose} style={btnSec}>Cancel</button>
          <button onClick={() => onSave({ type: relType, evidence, confidence })} style={btnP}>
            Save relationship
          </button>
        </div>
      </div>
    </>
  );
}

/** Draggable cluster node card on the canvas. */
function ClusterNode({ node, cluster, selected, connectMode, isConnectSource, onClick, onRemove, onMouseDown }) {
  const [hovered, setHovered] = useState(false);
  const st = SUBTYPE_STYLE[cluster.subtype] || SUBTYPE_STYLE.Trend;

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: NODE_W,
        userSelect: "none",
        background: c.white,
        border: `1.5px solid ${isConnectSource ? "#185FA5" : selected ? c.ink : hovered ? c.borderMid : c.border}`,
        borderRadius: 10,
        boxShadow: selected
          ? "0 2px 12px rgba(0,0,0,0.13)"
          : hovered ? "0 2px 8px rgba(0,0,0,0.09)" : "0 1px 4px rgba(0,0,0,0.05)",
        cursor: connectMode ? "crosshair" : "grab",
        overflow: "hidden",
        transition: "border-color 0.12s, box-shadow 0.12s",
      }}
    >
      {/* Coloured left border strip */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: st.border }} />

      <div style={{ padding: "8px 24px 9px 14px" }}>
        {/* Type + horizon badges */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 5 }}>
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 500,
            background: st.bg, color: st.col, border: `0.5px solid ${st.border}`,
          }}>
            {cluster.subtype}
          </span>
          {cluster.horizon && HORIZON_COLORS[cluster.horizon] && (() => {
            const [col, bg, brd] = HORIZON_COLORS[cluster.horizon];
            return (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 500,
                background: bg, color: col, border: `0.5px solid ${brd}`,
              }}>
                {cluster.horizon}
              </span>
            );
          })()}
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, lineHeight: 1.35 }}>
          {cluster.name}
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          position: "absolute", top: 5, right: 5,
          width: 17, height: 17, borderRadius: 4,
          background: "transparent", border: "none",
          color: c.hint, fontSize: 14, lineHeight: 1,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "inherit",
        }}
      >×</button>
    </div>
  );
}

/** Left sidebar — cluster library with Add buttons and relationship legend. */
function LeftSidebar({ clusters, canvasNodes, onAdd, collapsed, onToggle }) {
  const nodeClusterIds = new Set(canvasNodes.map((n) => n.clusterId));

  if (collapsed) {
    return (
      <div style={{
        width: 40, borderRight: `1px solid ${c.border}`,
        background: c.white, display: "flex", flexDirection: "column",
        alignItems: "center", paddingTop: 10, flexShrink: 0,
      }}>
        <button
          onClick={onToggle}
          title="Expand panel"
          style={{ ...btnG, padding: "5px 8px", fontSize: 13, color: c.hint }}
        >›</button>
      </div>
    );
  }

  return (
    <div style={{
      width: 222, borderRight: `1px solid ${c.border}`,
      background: c.white, display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: "13px 14px 10px", borderBottom: `1px solid ${c.border}`, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint }}>
          Clusters &nbsp;·&nbsp; {nodeClusterIds.size} on canvas
        </div>
        <button
          onClick={onToggle}
          title="Collapse panel"
          style={{ ...btnG, padding: "3px 6px", fontSize: 13, color: c.hint }}
        >‹</button>
      </div>

      {/* Cluster list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {clusters.length === 0 ? (
          <div style={{ padding: "16px 14px", fontSize: 11, color: c.hint, lineHeight: 1.5 }}>
            No clusters in this project yet. Create some in the Clustering screen first.
          </div>
        ) : (
          clusters.map((cl) => {
            const added = nodeClusterIds.has(cl.id);
            const st    = SUBTYPE_STYLE[cl.subtype]    || SUBTYPE_STYLE.Trend;
            const lb    = LEFT_BORDER_COLOR[cl.subtype] || c.border;

            return (
              <div
                key={cl.id}
                style={{
                  padding: "9px 12px 9px 14px",
                  borderBottom: `1px solid ${c.border}`,
                  borderLeft: `3px solid ${lb}`,
                  display: "flex", alignItems: "flex-start", gap: 8,
                  background: added ? "rgba(0,0,0,0.015)" : c.white,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                    color: st.col, marginBottom: 2, letterSpacing: "0.05em",
                  }}>
                    {cl.subtype}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 500, color: c.ink, lineHeight: 1.35,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {cl.name}
                  </div>
                </div>
                <button
                  onClick={() => !added && onAdd(cl)}
                  style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 5, flexShrink: 0, marginTop: 1,
                    border: `1px solid ${added ? c.border : c.borderMid}`,
                    background: added ? c.surfaceAlt : c.white,
                    color: added ? c.hint : c.muted,
                    cursor: added ? "default" : "pointer",
                    fontFamily: "inherit",
                  }}
                >{added ? "Added" : "+ Add"}</button>
              </div>
            );
          })
        )}
      </div>

      {/* Relationship legend */}
      <div style={{ padding: "12px 14px", borderTop: `1px solid ${c.border}`, flexShrink: 0 }}>
        <div style={{
          fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em",
          color: c.hint, marginBottom: 8,
        }}>Legend</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {REL_TYPES.map(({ id, color, dash }) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 22, height: 2.5, borderRadius: 2, flexShrink: 0,
                background: dash
                  ? `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`
                  : color,
              }} />
              <span style={{ fontSize: 10, color: c.muted }}>{id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Right inspector panel — empty state, cluster detail, relationship detail, or scenario detail. */
function Inspector({ selectedItem, clusters, scenarios, relationships, onEditRel, onDeleteRel, onClose, collapsed, onToggle }) {
  const HORIZON_COLORS = {
    H1: [c.green700, c.green50],
    H2: [c.blue700,  c.blue50],
    H3: [c.amber700, c.amber50],
  };

  if (collapsed) {
    return (
      <div style={{
        width: 40, borderLeft: `1px solid ${c.border}`,
        background: c.white, display: "flex", flexDirection: "column",
        alignItems: "center", paddingTop: 10, flexShrink: 0,
      }}>
        <button
          onClick={onToggle}
          title="Expand panel"
          style={{ ...btnG, padding: "5px 8px", fontSize: 13, color: c.hint }}
        >‹</button>
      </div>
    );
  }

  const panelStyle = {
    width: 254, borderLeft: `1px solid ${c.border}`,
    display: "flex", flexDirection: "column", background: c.white, flexShrink: 0,
  };

  const headerStyle = {
    padding: "14px 16px 11px", borderBottom: `1px solid ${c.border}`,
    display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
  };

  if (!selectedItem) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint }}>Inspector</div>
          <button onClick={onToggle} title="Collapse panel" style={{ ...btnG, padding: "3px 6px", fontSize: 13, color: c.hint }}>›</button>
        </div>
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center",
        }}>
          <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.6 }}>
            Select a cluster or relationship to inspect its details.
          </div>
        </div>
      </div>
    );
  }

  if (selectedItem.type === "node") {
    const cluster = clusters.find((cl) => cl.id === selectedItem.clusterId);
    if (!cluster) return null;
    const st = SUBTYPE_STYLE[cluster.subtype] || SUBTYPE_STYLE.Trend;
    const [hcol, hbg] = HORIZON_COLORS[cluster.horizon] || [c.muted, c.surfaceAlt];

    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint }}>Cluster</div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={onToggle} title="Collapse panel" style={{ ...btnG, padding: "0 5px", color: c.hint, fontSize: 13 }}>›</button>
            <button onClick={onClose} style={{ ...btnG, padding: "0 4px", color: c.hint, fontSize: 15 }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", padding: "2px 8px",
            borderRadius: 5, background: st.bg, border: `1px solid ${st.border}`, marginBottom: 10,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: st.col }}>{cluster.subtype}</span>
          </div>

          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, lineHeight: 1.4, marginBottom: 10 }}>
            {cluster.name}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: hbg, color: hcol, fontWeight: 600 }}>
              {cluster.horizon}
            </span>
            <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: c.surfaceAlt, color: c.muted }}>
              {cluster.likelihood}
            </span>
          </div>

          {cluster.description && (
            <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, marginBottom: 12 }}>
              {cluster.description}
            </div>
          )}

          <div style={{ fontSize: 11, color: c.hint }}>
            {cluster.input_ids?.length || 0} linked input{(cluster.input_ids?.length || 0) !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    );
  }

  if (selectedItem.type === "rel") {
    const rel = relationships.find((r) => r.id === selectedItem.id);
    if (!rel) return null;
    const fromCl  = clusters.find((cl) => cl.id === rel.fromClusterId);
    const toCl    = clusters.find((cl) => cl.id === rel.toClusterId);
    const relType = REL_TYPES.find((r) => r.id === rel.type) || REL_TYPES[0];

    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint }}>Relationship</div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={onToggle} title="Collapse panel" style={{ ...btnG, padding: "0 5px", color: c.hint, fontSize: 13 }}>›</button>
            <button onClick={onClose} style={{ ...btnG, padding: "0 4px", color: c.hint, fontSize: 15 }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: c.hint, marginBottom: 3 }}>From</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{fromCl?.name}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <div style={{
              width: 20, height: 2.5, borderRadius: 2, flexShrink: 0,
              background: relType.dash
                ? `repeating-linear-gradient(to right, ${relType.color} 0, ${relType.color} 4px, transparent 4px, transparent 8px)`
                : relType.color,
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: relType.color }}>{rel.type}</span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: c.hint, marginBottom: 3 }}>To</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{toCl?.name}</div>
          </div>

          <div style={{ marginBottom: rel.evidence ? 12 : 16 }}>
            <div style={{ fontSize: 10, color: c.hint, marginBottom: 3 }}>Confidence</div>
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 10, background: c.surfaceAlt, color: c.muted }}>
              {rel.confidence}
            </span>
          </div>

          {rel.evidence && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: c.hint, marginBottom: 3 }}>Evidence</div>
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55 }}>{rel.evidence}</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => onEditRel(rel.id)}
              style={{ ...btnSec, fontSize: 11, padding: "6px 14px" }}
            >Edit</button>
            <button
              onClick={() => onDeleteRel(rel.id)}
              style={{
                fontSize: 11, padding: "6px 14px", borderRadius: 7,
                background: "transparent", border: `1px solid ${c.redBorder}`,
                color: c.red800, cursor: "pointer", fontFamily: "inherit",
              }}
            >Delete</button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedItem.type === "scenario") {
    const scenario = (scenarios || []).find((s) => s.id === selectedItem.scenarioId);
    if (!scenario) return null;
    const ARCHETYPE_COLORS = {
      Continuation:   { col: c.green700,  bg: c.green50  },
      Collapse:       { col: c.red800,    bg: c.red50    },
      Constraint:     { col: c.amber700,  bg: c.amber50  },
      Transformation: { col: c.violet700, bg: c.violet50 },
    };
    const ac = ARCHETYPE_COLORS[scenario.archetype] || { col: c.muted, bg: c.surfaceAlt };
    const [hcol, hbg] = HORIZON_COLORS[scenario.horizon] || [c.muted, c.surfaceAlt];

    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint }}>System</div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={onToggle} title="Collapse panel" style={{ ...btnG, padding: "0 5px", color: c.hint, fontSize: 13 }}>›</button>
            <button onClick={onClose} style={{ ...btnG, padding: "0 4px", color: c.hint, fontSize: 15 }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", padding: "2px 8px",
            borderRadius: 5, background: ac.bg, marginBottom: 10,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: ac.col }}>
              {scenario.archetype}
            </span>
          </div>

          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, lineHeight: 1.4, marginBottom: 10 }}>
            {scenario.name}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: hbg, color: hcol, fontWeight: 600 }}>
              {scenario.horizon}
            </span>
          </div>

          {scenario.narrative && (
            <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, fontStyle: "italic" }}>
              {scenario.narrative}
            </div>
          )}

          {!scenario.narrative && (
            <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.55 }}>
              No narrative seed yet. Add clusters to the canvas below to start mapping relationships.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

/** Full-width table view showing clusters and relationships. */
function TableView({ clusters, relationships, canvasNodes, allClusters, onEditRel, onDeleteRel }) {
  const thStyle = {
    padding: "8px 14px", fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.06em", color: c.hint,
    background: c.surfaceAlt, borderBottom: `1px solid ${c.border}`,
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
      {/* Clusters table */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 10 }}>
          Clusters <span style={{ fontSize: 11, color: c.hint, fontWeight: 400 }}>({clusters.length})</span>
        </div>
        {clusters.length === 0 ? (
          <div style={{ fontSize: 12, color: c.hint }}>No clusters in this project.</div>
        ) : (
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 60px" }}>
              {["Name", "Subtype", "Horizon", "Likelihood", "Inputs"].map((h) => (
                <div key={h} style={thStyle}>{h}</div>
              ))}
            </div>
            {clusters.map((cl, idx) => {
              const st       = SUBTYPE_STYLE[cl.subtype] || SUBTYPE_STYLE.Trend;
              const onCanvas = canvasNodes.some((n) => n.clusterId === cl.id);
              return (
                <div
                  key={cl.id}
                  style={{
                    display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 60px",
                    borderTop: idx > 0 ? `1px solid ${c.border}` : "none",
                    alignItems: "center",
                  }}
                >
                  <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{cl.name}</span>
                    {onCanvas && (
                      <span style={{
                        fontSize: 9, padding: "1px 5px", background: c.surfaceAlt,
                        border: `1px solid ${c.border}`, borderRadius: 4, color: c.hint,
                      }}>on canvas</span>
                    )}
                  </div>
                  <div style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 4,
                      background: st.bg, color: st.col, display: "inline-block",
                    }}>{cl.subtype}</span>
                  </div>
                  <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted }}>{cl.horizon}</div>
                  <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted }}>{cl.likelihood}</div>
                  <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted }}>{cl.input_ids?.length || 0}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Relationships table */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 10 }}>
          Relationships <span style={{ fontSize: 11, color: c.hint, fontWeight: 400 }}>({relationships.length})</span>
        </div>
        {relationships.length === 0 ? (
          <div style={{ fontSize: 12, color: c.hint }}>
            No relationships mapped yet. Switch to canvas view to add some.
          </div>
        ) : (
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr 2.5fr 1fr 90px" }}>
              {["From", "Type", "To", "Evidence", "Confidence", ""].map((h, i) => (
                <div key={i} style={thStyle}>{h}</div>
              ))}
            </div>
            {relationships.map((rel, idx) => {
              const fromCl = allClusters.find((cl) => cl.id === rel.fromClusterId);
              const toCl   = allClusters.find((cl) => cl.id === rel.toClusterId);
              const rt     = REL_TYPES.find((r) => r.id === rel.type) || REL_TYPES[0];
              return (
                <div
                  key={rel.id}
                  style={{
                    display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr 2.5fr 1fr 90px",
                    borderTop: idx > 0 ? `1px solid ${c.border}` : "none",
                    alignItems: "center",
                  }}
                >
                  <div style={{ padding: "10px 14px", fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fromCl?.name}</div>
                  <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 16, height: 2.5, borderRadius: 2, flexShrink: 0,
                      background: rt.dash
                        ? `repeating-linear-gradient(to right, ${rt.color} 0, ${rt.color} 4px, transparent 4px, transparent 8px)`
                        : rt.color,
                    }} />
                    <span style={{ fontSize: 11, color: rt.color, fontWeight: 500 }}>{rel.type}</span>
                  </div>
                  <div style={{ padding: "10px 14px", fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toCl?.name}</div>
                  <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rel.evidence || "—"}</div>
                  <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted }}>{rel.confidence}</div>
                  <div style={{ padding: "10px 14px", display: "flex", gap: 5 }}>
                    <button
                      onClick={() => onEditRel(rel.id)}
                      style={{ ...btnG, fontSize: 10, padding: "3px 8px", border: `1px solid ${c.border}` }}
                    >Edit</button>
                    <button
                      onClick={() => onDeleteRel(rel.id)}
                      style={{ ...btnG, fontSize: 10, padding: "3px 8px", border: `1px solid ${c.redBorder}`, color: c.red800 }}
                    >Del</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Main Relationship Canvas screen. */
export default function ScenarioCanvas({ appState }) {
  const {
    clusters, inputs, scenarios, projects, activeProjectId, setActiveProjectId, openProjectModal,
    canvasNodes, relationships,
    addCanvasNode, removeCanvasNode, updateCanvasNodePos,
    addRelationship, updateRelationship, removeRelationship,
    showToast, scenarioDetailId, closeScenarioDetail,
  } = appState;

  const project         = projects.find((p) => p.id === activeProjectId) || null;
  const projectClusters = clusters.filter((cl) => cl.project_id === activeProjectId);
  const projectNodes    = canvasNodes.filter((n) => n.projectId === activeProjectId);
  const projectRels     = relationships.filter((r) => r.projectId === activeProjectId);

  const [viewMode,      setViewMode]      = useState("canvas");
  const [leftOpen,      setLeftOpen]      = useState(true);
  const [rightOpen,     setRightOpen]     = useState(true);
  const [connectMode,   setConnectMode]   = useState(null);   // null | 'source' | 'target'
  const [connectSource, setConnectSource] = useState(null);   // canvasNode id
  const [relModalOpen,  setRelModalOpen]  = useState(false);
  const [pendingRel,    setPendingRel]    = useState(null);   // { fromClusterId, toClusterId }
  const [editingRelId,  setEditingRelId]  = useState(null);
  const [selectedItem,  setSelectedItem]  = useState(null);
  const [pan,  setPan]  = useState({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(1);

  const canvasRef       = useRef(null);
  const isPanningRef    = useRef(false);
  const panStartRef     = useRef(null);
  const dragRef         = useRef(null);
  const dragOccurredRef = useRef(false);
  const mouseDownPosRef = useRef(null);

  const clampZoom = (z) => Math.min(Math.max(z, 0.25), 2.5);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        setConnectMode(null);
        setConnectSource(null);
        setRelModalOpen(false);
        setPendingRel(null);
        setEditingRelId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Pre-select a scenario in the inspector when navigating from ProjectDetail
  useEffect(() => {
    if (scenarioDetailId) {
      setSelectedItem({ type: "scenario", scenarioId: scenarioDetailId });
      setRightOpen(true);
      closeScenarioDetail();
    }
  }, [scenarioDetailId, closeScenarioDetail]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (!e.target.dataset.canvasBg) return;
    if (connectMode) return;
    isPanningRef.current   = true;
    panStartRef.current    = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragOccurredRef.current = false;
    e.preventDefault();
  }, [pan, connectMode]);

  const handleNodeMouseDown = useCallback((e, nodeId, nodeX, nodeY) => {
    if (connectMode) return;
    e.stopPropagation();
    dragRef.current         = { nodeId, startMouseX: e.clientX, startMouseY: e.clientY, startNodeX: nodeX, startNodeY: nodeY };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragOccurredRef.current = false;
  }, [connectMode]);

  const handleMouseMove = useCallback((e) => {
    if (mouseDownPosRef.current) {
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 4) dragOccurredRef.current = true;
    }
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      setPan({ x: panStartRef.current.px + dx, y: panStartRef.current.py + dy });
    }
    if (dragRef.current) {
      const { nodeId, startMouseX, startMouseY, startNodeX, startNodeY } = dragRef.current;
      const dx = (e.clientX - startMouseX) / zoom;
      const dy = (e.clientY - startMouseY) / zoom;
      updateCanvasNodePos(nodeId, { x: Math.max(0, startNodeX + dx), y: Math.max(0, startNodeY + dy) });
    }
  }, [zoom, updateCanvasNodePos]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    panStartRef.current  = null;
    dragRef.current      = null;
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0008;
    setZoom((z) => clampZoom(z + delta));
  }, []);

  const handleNodeClick = useCallback((e, node) => {
    e.stopPropagation();
    if (dragOccurredRef.current) return;
    if (connectMode === "source") {
      setConnectSource(node.id);
      setConnectMode("target");
      return;
    }
    if (connectMode === "target") {
      if (node.id === connectSource) return;
      const srcNode = projectNodes.find((n) => n.id === connectSource);
      if (!srcNode) return;
      setPendingRel({ fromClusterId: srcNode.clusterId, toClusterId: node.clusterId });
      setRelModalOpen(true);
      setConnectMode(null);
      setConnectSource(null);
      return;
    }
    setSelectedItem({ type: "node", nodeId: node.id, clusterId: node.clusterId });
  }, [connectMode, connectSource, projectNodes]);

  const handleCanvasClick = useCallback(() => {
    if (dragOccurredRef.current) return;
    if (connectMode === "source") { setConnectMode(null); return; }
    setSelectedItem(null);
  }, [connectMode]);

  const handleAddToCanvas = useCallback((cluster) => {
    if (projectNodes.find((n) => n.clusterId === cluster.id)) return;
    const placed = projectNodes.length;
    addCanvasNode({
      projectId: activeProjectId,
      clusterId: cluster.id,
      x: 120 + (placed % 4) * 210,
      y: 100 + Math.floor(placed / 4) * 160,
    });
  }, [projectNodes, addCanvasNode, activeProjectId]);

  const handleRemoveFromCanvas = useCallback((nodeId) => {
    const node = projectNodes.find((n) => n.id === nodeId);
    removeCanvasNode(nodeId);
    if (node) {
      projectRels
        .filter((r) => r.fromClusterId === node.clusterId || r.toClusterId === node.clusterId)
        .forEach((r) => removeRelationship(r.id));
    }
    if (selectedItem?.nodeId === nodeId) setSelectedItem(null);
  }, [projectNodes, projectRels, removeCanvasNode, removeRelationship, selectedItem]);

  const handleSaveRel = useCallback((fields) => {
    if (editingRelId) {
      updateRelationship(editingRelId, fields);
      showToast("Relationship updated");
    } else if (pendingRel) {
      addRelationship({ ...pendingRel, projectId: activeProjectId, ...fields });
      showToast("Relationship added");
    }
    setRelModalOpen(false);
    setPendingRel(null);
    setEditingRelId(null);
  }, [editingRelId, pendingRel, activeProjectId, updateRelationship, addRelationship, showToast]);

  const handleEditRel = useCallback((relId) => {
    setEditingRelId(relId);
    setRelModalOpen(true);
  }, []);

  const handleDeleteRel = useCallback((relId) => {
    removeRelationship(relId);
    showToast("Relationship removed");
    setSelectedItem(null);
  }, [removeRelationship, showToast]);

  const closeModal = useCallback(() => {
    setRelModalOpen(false);
    setPendingRel(null);
    setEditingRelId(null);
  }, []);

  const lineSegments = computeLineSegments(projectRels, projectNodes);

  const editingRel  = editingRelId ? relationships.find((r) => r.id === editingRelId) : null;
  const fromCluster = pendingRel
    ? clusters.find((cl) => cl.id === pendingRel.fromClusterId)
    : editingRel ? clusters.find((cl) => cl.id === editingRel.fromClusterId) : null;
  const toCluster   = pendingRel
    ? clusters.find((cl) => cl.id === pendingRel.toClusterId)
    : editingRel ? clusters.find((cl) => cl.id === editingRel.toClusterId) : null;

  // No active project — show picker
  if (!project) {
    return (
      <ProjectPicker
        heading="Select a project to work in"
        description="The System Map maps cluster-to-cluster dynamics for a specific project."
        projects={projects}
        inputs={inputs}
        clusters={clusters}
        scenarios={scenarios}
        onSelect={(id) => setActiveProjectId(id)}
        onNewProject={openProjectModal}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: c.bg }}>
      {/* Top bar */}
      <div style={{
        padding: "14px 22px 12px", background: c.white,
        borderBottom: `1px solid ${c.border}`, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.09em", color: c.hint }}>
            {project.name}
          </div>
          <button
            onClick={() => setActiveProjectId(null)}
            style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 4,
              border: `1px solid ${c.border}`, background: "transparent",
              color: c.hint, cursor: "pointer", fontFamily: "inherit",
              letterSpacing: 0, textTransform: "none",
            }}
          >switch ↕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 500, color: c.ink }}>System Map</div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>
              {projectNodes.length} cluster{projectNodes.length !== 1 ? "s" : ""} on canvas
              &nbsp;·&nbsp;
              {projectRels.length} relationship{projectRels.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ display: "flex", border: `1px solid ${c.border}`, borderRadius: 7, overflow: "hidden" }}>
            {["canvas", "table"].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "6px 16px",
                  background: viewMode === mode ? c.ink : c.white,
                  color: viewMode === mode ? c.white : c.muted,
                  border: "none", fontSize: 11,
                  fontWeight: viewMode === mode ? 500 : 400,
                  cursor: "pointer", fontFamily: "inherit",
                  textTransform: "capitalize",
                }}
              >{mode}</button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === "table" ? (
        <TableView
          clusters={projectClusters}
          relationships={projectRels}
          canvasNodes={projectNodes}
          allClusters={clusters}
          onEditRel={handleEditRel}
          onDeleteRel={handleDeleteRel}
        />
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <LeftSidebar
            clusters={projectClusters}
            canvasNodes={projectNodes}
            onAdd={handleAddToCanvas}
            collapsed={!leftOpen}
            onToggle={() => setLeftOpen((o) => !o)}
          />

          {/* Canvas area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
            {/* Connection mode banner */}
            {connectMode && (
              <div style={{
                position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
                zIndex: 10, padding: "8px 18px", background: c.ink, color: c.white,
                borderRadius: 20, fontSize: 12, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 12,
                boxShadow: "0 2px 14px rgba(0,0,0,0.18)", whiteSpace: "nowrap",
              }}>
                {connectMode === "source"
                  ? "Click a cluster to start the relationship"
                  : "Now click the target cluster"}
                <button
                  onClick={() => { setConnectMode(null); setConnectSource(null); }}
                  style={{
                    background: "rgba(255,255,255,0.15)", border: "none",
                    color: c.white, fontSize: 11, padding: "2px 10px",
                    borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
                  }}
                >Cancel</button>
              </div>
            )}

            {/* Add relationship button */}
            {!connectMode && projectNodes.length >= 2 && (
              <div style={{ position: "absolute", top: 14, right: 14, zIndex: 10 }}>
                <button onClick={() => setConnectMode("source")} style={{ ...btnSm, fontSize: 11 }}>
                  + Add relationship
                </button>
              </div>
            )}

            {/* Canvas */}
            <div
              ref={canvasRef}
              data-canvas-bg="1"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCanvasClick}
              onWheel={handleWheel}
              style={{
                flex: 1, overflow: "hidden", position: "relative",
                cursor: connectMode ? "crosshair" : "default",
                backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.11) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                backgroundPosition: `${((pan.x % 24) + 24) % 24}px ${((pan.y % 24) + 24) % 24}px`,
              }}
            >
              {/* World — pan + zoom applied here */}
              <div
                data-canvas-bg="1"
                style={{
                  position: "absolute", top: 0, left: 0,
                  transformOrigin: "0 0",
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                {/* SVG relationship lines */}
                <svg
                  style={{
                    position: "absolute", top: 0, left: 0,
                    width: 4000, height: 4000, overflow: "visible",
                  }}
                >
                  {lineSegments.map(({ rel, x1, y1, x2, y2, ex1, ey1, ex2, ey2 }) => {
                    const rt         = REL_TYPES.find((r) => r.id === rel.type) || REL_TYPES[0];
                    const isSelected = selectedItem?.type === "rel" && selectedItem.id === rel.id;

                    // Per-relationship marker IDs — inline defs guarantee color always matches current type
                    const endMarkerId   = `arr-end-${rel.id}`;
                    const startMarkerId = `arr-start-${rel.id}`;

                    // Cubic bezier S-curve: control points extend along each node's exit direction.
                    // dist scales with separation so short lines stay gentle, long lines curve enough.
                    const edgeDist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                    const dist = Math.min(edgeDist * 0.45, 120);
                    const cp1x = x1 + ex1 * dist;
                    const cp1y = y1 + ey1 * dist;
                    const cp2x = x2 + ex2 * dist;
                    const cp2y = y2 + ey2 * dist;

                    // Label at t=0.5 on the cubic bezier
                    const mx = 0.125*x1 + 0.375*cp1x + 0.375*cp2x + 0.125*x2;
                    const my = 0.125*y1 + 0.375*cp1y + 0.375*cp2y + 0.125*y2;
                    const labelW = Math.max(40, rt.id.length * 5.8 + 14);
                    const labelH = 15;

                    const pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x2} ${y2}`;

                    return (
                      <g key={rel.id}>
                        {/* Inline markers — each relationship owns its defs so color is always in sync */}
                        <defs>
                          <marker
                            id={endMarkerId}
                            markerWidth="7" markerHeight="7"
                            refX="5" refY="3.5"
                            orient="auto" markerUnits="strokeWidth"
                          >
                            <path d="M0,0.5 L0,6.5 L7,3.5 z" fill={rt.color} />
                          </marker>
                          {rt.dash && (
                            <marker
                              id={startMarkerId}
                              markerWidth="7" markerHeight="7"
                              refX="5" refY="3.5"
                              orient="auto-start-reverse" markerUnits="strokeWidth"
                            >
                              <path d="M0,0.5 L0,6.5 L7,3.5 z" fill={rt.color} />
                            </marker>
                          )}
                        </defs>

                        {/* Visible curved path */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={rt.color}
                          strokeWidth={isSelected ? 2.5 : 1.8}
                          strokeDasharray={rt.dash ? "6,4" : undefined}
                          markerEnd={`url(#${endMarkerId})`}
                          markerStart={rt.dash ? `url(#${startMarkerId})` : undefined}
                          style={{ pointerEvents: "none" }}
                        />

                        {/* Midpoint label — background pill + text */}
                        <g style={{ pointerEvents: "none" }}>
                          <rect
                            x={mx - labelW / 2} y={my - labelH / 2}
                            width={labelW} height={labelH}
                            rx={3}
                            fill={c.white}
                            stroke="rgba(0,0,0,0.09)"
                            strokeWidth={0.5}
                          />
                          <text
                            x={mx} y={my}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{
                              fontSize: 9,
                              fill: rt.color,
                              fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
                              fontWeight: 500,
                            }}
                          >
                            {rt.id}
                          </text>
                        </g>

                        {/* Wide invisible hit area — same curve, rendered last to capture clicks over label */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={18}
                          style={{ cursor: "pointer", pointerEvents: "stroke" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem({ type: "rel", id: rel.id });
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Cluster node cards */}
                {projectNodes.map((node) => {
                  const cluster = clusters.find((cl) => cl.id === node.clusterId);
                  if (!cluster) return null;
                  return (
                    <ClusterNode
                      key={node.id}
                      node={node}
                      cluster={cluster}
                      selected={selectedItem?.type === "node" && selectedItem.nodeId === node.id}
                      connectMode={!!connectMode}
                      isConnectSource={connectSource === node.id}
                      onClick={(e) => handleNodeClick(e, node)}
                      onRemove={() => handleRemoveFromCanvas(node.id)}
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id, node.x, node.y)}
                    />
                  );
                })}

                {/* Empty canvas nudge */}
                {projectNodes.length === 0 && (
                  <div style={{
                    position: "absolute", top: 160, left: 160,
                    fontSize: 12, color: c.hint, pointerEvents: "none", lineHeight: 1.6,
                  }}>
                    Add clusters from the sidebar to begin mapping relationships.
                  </div>
                )}
              </div>

              {/* Bottom hint + zoom controls */}
              <div style={{
                position: "absolute", bottom: 14, left: 0, right: 0,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 16px", pointerEvents: "none",
              }}>
                <div style={{ fontSize: 10, color: c.hint }}>
                  Drag to pan · Scroll to zoom · Use × to remove a cluster
                </div>
                <div style={{
                  display: "flex", alignItems: "center",
                  border: `1px solid ${c.border}`, borderRadius: 7, overflow: "hidden",
                  background: c.white, pointerEvents: "all",
                }}>
                  <button
                    onClick={() => setZoom((z) => clampZoom(z - 0.1))}
                    style={{ ...btnG, padding: "5px 11px", fontSize: 15, lineHeight: 1 }}
                  >−</button>
                  <div style={{
                    padding: "5px 10px", fontSize: 11, color: c.muted,
                    borderLeft: `1px solid ${c.border}`, borderRight: `1px solid ${c.border}`,
                    minWidth: 48, textAlign: "center",
                  }}>
                    {Math.round(zoom * 100)}%
                  </div>
                  <button
                    onClick={() => setZoom((z) => clampZoom(z + 0.1))}
                    style={{ ...btnG, padding: "5px 11px", fontSize: 15, lineHeight: 1 }}
                  >+</button>
                  <button
                    onClick={() => { setZoom(1); setPan({ x: 60, y: 60 }); }}
                    style={{ ...btnG, padding: "5px 10px", fontSize: 10, borderLeft: `1px solid ${c.border}` }}
                  >reset</button>
                </div>
              </div>
            </div>
          </div>

          <Inspector
            selectedItem={selectedItem}
            clusters={clusters}
            scenarios={scenarios}
            relationships={projectRels}
            onEditRel={handleEditRel}
            onDeleteRel={handleDeleteRel}
            onClose={() => setSelectedItem(null)}
            collapsed={!rightOpen}
            onToggle={() => setRightOpen((o) => !o)}
          />
        </div>
      )}

      {/* Relationship modal */}
      {relModalOpen && (
        <RelModal
          fromCluster={fromCluster}
          toCluster={toCluster}
          initial={editingRel
            ? { type: editingRel.type, evidence: editingRel.evidence, confidence: editingRel.confidence }
            : undefined
          }
          onSave={handleSaveRel}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

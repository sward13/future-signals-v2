/**
 * ScenarioCanvas — System Map canvas screen.
 * Left sidebar: cluster library + legend. Centre: React Flow canvas.
 * Right: inspector panel. Toggle to table view.
 * @param {{ appState: object }} props
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, Panel,
  useReactFlow, useNodesState, useEdgesState,
  useUpdateNodeInternals,
  Handle, Position, BaseEdge, EdgeLabelRenderer,
  getBezierPath, MarkerType, ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CirclePlus, LayoutDashboard, Logs, ChevronDown, ChevronRight, Maximize2, Minimize2, Hand, MousePointer2, Network, Type } from "lucide-react";
import { c, ta, btnP, btnSm, btnSec, btnG, fl } from "../../styles/tokens.js";
import { ProjectPicker } from "../shared/ProjectPicker.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

const NODE_W = 156;

const REL_TYPES = [
  { id: "Drives", color: "#185FA5", dash: false, desc: "One cluster directly propels another" },
  { id: "Enables", color: "#3B6D11", dash: false, desc: "Creates conditions for another to occur" },
  { id: "Accelerates", color: "#0F766E", dash: false, desc: "Speeds up the pace of another cluster" },
  { id: "Inhibits", color: "#854F0B", dash: false, desc: "Slows down or weakens another cluster" },
  { id: "Blocks", color: "#791F1F", dash: false, desc: "Actively prevents or stops another cluster" },
  { id: "Feedback Loop", color: "#B45309", dash: true, desc: "Mutually reinforcing or dampening cycle" },
  { id: "Displaces", color: "#4B1010", dash: false, desc: "Replaces or supersedes another cluster" },
];
// O(1) lookup by type id — used anywhere a single type needs to be resolved
const REL_TYPE_MAP = Object.fromEntries(REL_TYPES.map((rt) => [rt.id, rt]));

const SUBTYPE_STYLE = {
  Trend: { col: c.violet700, bg: c.violet50, border: c.violetBorder },
  Driver: { col: c.blue700, bg: c.blue50, border: c.blueBorder },
  Tension: { col: c.amber700, bg: c.amber50, border: c.amberBorder },
};

const HORIZON_COLORS = {
  H1: [c.green700, c.green50, c.greenBorder],
  H2: [c.blue700, c.blue50, c.blueBorder],
  H3: [c.amber700, c.amber50, c.amberBorder],
};

const LEFT_BORDER_COLOR = {
  Trend: c.violetBorder,
  Driver: c.blueBorder,
  Tension: c.amberBorder,
};

// ─── React Flow node types and edge types ─────────────────────────────────────
// Must be defined outside any component to keep stable references.

/** Custom node: renders a cluster card with handles. */
function ClusterNodeComponent({ id, data }) {
  const [hovered, setHovered] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();
  const { cluster, onRemove, connectMode, isConnectSource, selected } = data;
  if (!cluster) return null;
  const st = SUBTYPE_STYLE[cluster.subtype] || SUBTYPE_STYLE.Trend;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, cluster.name, cluster.description, cluster.input_ids?.length]);

  const handleStyle = {
    width: 8, height: 8, borderRadius: "50%",
    border: `1.5px solid ${st.border}`,
    background: c.white,
    opacity: connectMode ? 1 : 0,
    transition: "opacity 0.15s",
  };

  return (
    <>
      <Handle type="source" position={Position.Top} id="t" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="l" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="b" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="r" style={handleStyle} />

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: NODE_W,
          background: c.white,
          border: `1.5px solid ${isConnectSource ? "#185FA5" : selected ? c.ink : hovered ? c.borderMid : c.border}`,
          borderRadius: 10,
          boxShadow: selected
            ? "0 2px 12px rgba(0,0,0,0.13)"
            : hovered ? "0 2px 8px rgba(0,0,0,0.09)" : "0 1px 4px rgba(0,0,0,0.05)",
          overflow: "hidden",
          position: "relative",
          transition: "border-color 0.12s, box-shadow 0.12s",
          cursor: connectMode ? "crosshair" : "grab",
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
    </>
  );
}

/** Custom edge: relationship line with type label and optional bidirectional arrows. */
function RelationshipEdgeComponent({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const color = data?.color || "#185FA5";
  const dash = data?.dash || false;
  const typeLabel = data?.typeLabel || data?.rel?.type || "";
  const isSelected = data?.selected || false;
  const sw = isSelected ? 3.5 : 2;
  const typeKey = typeLabel.replace(/\s/g, "-");

  return (
    <>
      {/* Visible path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        style={{
          stroke: data?.color || "#185FA5",
          strokeWidth: data?.selected ? 3.5 : 2,
          strokeDasharray: data?.dash ? "6,4" : undefined,
          pointerEvents: "none",
        }}
        markerEnd={`url(#arrow-end-${typeKey})`}
        markerStart={data?.dash ? `url(#arrow-start-${typeKey})` : undefined}
      />

      {/* Wide invisible hit area for easy clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ cursor: "pointer" }}
      />

      {/* Midpoint label pill */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: c.white,
            border: "0.5px solid rgba(0,0,0,0.09)",
            borderRadius: 3,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 500,
            color,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
          }}
          className="nodrag nopan"
        >
          {typeLabel}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// ─── Text node constants ──────────────────────────────────────────────────────

const TEXT_NODE_FONTS = [
  { label: "Sans",  value: "Open Sans, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono",  value: "'Menlo', 'Courier New', monospace" },
];
const TEXT_NODE_SIZES = [12, 14, 16, 20, 24, 32, 48];
const TEXT_NODE_COLORS = [
  { hex: "#1A1A1A", label: "Ink" },
  { hex: "#374151", label: "Dark gray" },
  { hex: "#6B7280", label: "Gray" },
  { hex: "#1D4ED8", label: "Blue" },
  { hex: "#0F6E56", label: "Teal" },
  { hex: "#993C1D", label: "Coral" },
  { hex: "#854F0B", label: "Amber" },
];

// ─── TextNodeComponent — freeform canvas annotation ──────────────────────────
// Must be defined outside CanvasArea for a stable nodeTypes reference.

function TextNodeComponent({ id, data, selected }) {
  const { setNodes } = useReactFlow();
  const taRef = useRef(null);
  const [editing, setEditing] = useState(data.autoFocus ?? false);

  function resize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.width = "auto";
    el.style.height = el.scrollHeight + "px";
    el.style.width = Math.max(el.scrollWidth, 80) + "px";
  }

  useEffect(() => {
    if (!editing) return;
    // Double-RAF ensures focus fires after ReactFlow settles its own internal
    // focus handling from the pane-click event that placed this node.
    let r1, r2;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (taRef.current) {
          taRef.current.focus();
          taRef.current.select();
          resize();
        }
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [editing]);

  function commit(value) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, text: value, autoFocus: false, editing: false } }
          : n
      )
    );
    setEditing(false);
    data.onCommit?.(value);
  }

  function startEditing() {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, editing: true } } : n
      )
    );
    setEditing(true);
  }

  const fontStyle = {
    fontFamily: data.fontFamily,
    fontSize: (data.fontSize ?? 16) + "px",
    fontWeight: data.bold ? "700" : "400",
    fontStyle: data.italic ? "italic" : "normal",
    color: data.color,
    lineHeight: "1.45",
  };

  const sharedStyle = {
    ...fontStyle,
    background: "transparent",
    border: "none",
    outline: "none",
    padding: 0,
    margin: 0,
    display: "block",
    minWidth: 80,
    resize: "none",
    overflow: "hidden",
    whiteSpace: "pre",
  };

  return (
    <div
      style={{ position: "relative", cursor: editing ? "text" : "default" }}
      onDoubleClick={() => startEditing()}
    >
      {selected && !editing && (
        <div style={{
          position: "absolute", inset: -6,
          border: `1.5px solid ${c.brand}`,
          borderRadius: 4,
          pointerEvents: "none",
        }} />
      )}
      {editing ? (
        <textarea
          ref={taRef}
          defaultValue={data.text}
          style={{ ...sharedStyle, cursor: "text" }}
          rows={1}
          onInput={resize}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") commit(e.target.value);
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit(e.target.value);
            }
          }}
        />
      ) : (
        <div style={{ ...sharedStyle, whiteSpace: "pre-wrap", minHeight: "1.45em", cursor: "default" }}>
          {data.text || (
            <span style={{ color: "rgba(107,114,128,0.5)", fontStyle: "italic" }}>Text</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FormatBarTextNode — format bar for selected text nodes ───────────────────

function FormatBarTextNode({ node, onUpdate, onDuplicate, onDelete }) {
  if (!node || node.data.editing) return null;
  const d = node.data;
  const sep = { width: 1, height: 16, background: "rgba(255,255,255,0.15)", flexShrink: 0 };
  const selSty = {
    background: "rgba(255,255,255,0.08)", border: "none",
    color: "#d0d0d0", fontSize: 11.5, borderRadius: 4,
    padding: "3px 5px", cursor: "pointer", outline: "none",
    fontFamily: "inherit",
  };
  const fmtBtn = (active) => ({
    background: active ? "rgba(255,255,255,0.18)" : "none",
    border: "none", color: "#d0d0d0",
    fontSize: 13, cursor: "pointer", borderRadius: 4,
    padding: "3px 7px", lineHeight: 1, fontFamily: "inherit",
  });
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "#1c1c1e", borderRadius: 8,
      padding: "6px 10px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
      marginTop: 12,
    }}>
      <select value={d.fontFamily} onChange={(e) => onUpdate({ fontFamily: e.target.value })} style={selSty}>
        {TEXT_NODE_FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <div style={sep} />
      <select value={d.fontSize} onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })} style={selSty}>
        {TEXT_NODE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div style={sep} />
      <button style={{ ...fmtBtn(d.bold), fontWeight: 700 }} onClick={() => onUpdate({ bold: !d.bold })}>B</button>
      <button style={{ ...fmtBtn(d.italic), fontStyle: "italic" }} onClick={() => onUpdate({ italic: !d.italic })}>I</button>
      <div style={sep} />
      {TEXT_NODE_COLORS.map((clr) => (
        <button
          key={clr.hex}
          title={clr.label}
          onClick={() => onUpdate({ color: clr.hex })}
          style={{
            width: 14, height: 14, borderRadius: "50%",
            background: clr.hex, border: "none", padding: 0,
            cursor: "pointer", flexShrink: 0,
            outline: d.color === clr.hex ? "2px solid #fff" : "none",
            outlineOffset: 1,
            transform: d.color === clr.hex ? "scale(1.2)" : "scale(1)",
            transition: "transform 0.1s",
          }}
        />
      ))}
      <div style={sep} />
      <button
        style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 13, cursor: "pointer", borderRadius: 4, padding: "2px 6px", fontFamily: "inherit" }}
        onClick={onDuplicate}
        title="Duplicate"
      >⧉</button>
      <button
        style={{ background: "none", border: "none", color: "#f87171", fontSize: 13, cursor: "pointer", borderRadius: 4, padding: "2px 6px", fontFamily: "inherit" }}
        onClick={onDelete}
        title="Delete"
      >✕</button>
    </div>
  );
}

// Stable type maps — defined once outside any component
const nodeTypes = { cluster: ClusterNodeComponent, textNode: TextNodeComponent };
const edgeTypes = { relationship: RelationshipEdgeComponent };

// ─── Relationship modal ───────────────────────────────────────────────────────

function RelModal({ fromCluster, toCluster, initial, onSave, onClose }) {
  const isKnownType = !initial?.type || !!REL_TYPE_MAP[initial.type];
  const [relType,     setRelType]     = useState(isKnownType ? (initial?.type || "Drives") : "Other");
  const [customLabel, setCustomLabel] = useState(isKnownType ? "" : (initial?.type || ""));
  const [evidence,    setEvidence]    = useState(initial?.evidence   || "");
  const [confidence,  setConfidence]  = useState(initial?.confidence || "Medium");

  const effectiveType = relType === "Other" ? (customLabel.trim() || "Other") : relType;

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
              {/* Other — freeform label */}
              <button
                onClick={() => setRelType("Other")}
                style={{
                  padding: "9px 12px", borderRadius: 8, textAlign: "left",
                  border: `1.5px solid ${relType === "Other" ? c.borderMid : c.border}`,
                  background: relType === "Other" ? "rgba(0,0,0,0.015)" : c.white,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <div style={{ width: 22, height: 2.5, borderRadius: 2, flexShrink: 0, background: c.hint }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: relType === "Other" ? c.ink : c.muted }}>Other</span>
                </div>
                <div style={{ fontSize: 10, color: c.hint, lineHeight: 1.4 }}>A custom relationship type</div>
              </button>
            </div>
            {relType === "Other" && (
              <input
                autoFocus
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Describe the relationship…"
                style={{
                  marginTop: 8, width: "100%", padding: "8px 10px",
                  border: `1px solid ${c.borderMid}`, borderRadius: 6,
                  fontSize: 12, fontFamily: "inherit", color: c.ink,
                  background: c.white, outline: "none", boxSizing: "border-box",
                }}
              />
            )}
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
              onKeyDown={(e) => e.stopPropagation()}
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
          <button onClick={() => onSave({ type: effectiveType, evidence, confidence })} style={btnP}>
            Save relationship
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────

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

  const unaddedClusters = clusters.filter((cl) => !nodeClusterIds.has(cl.id));

  return (
    <div style={{
      width: 222, borderRight: `1px solid ${c.border}`,
      background: c.white, display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: "13px 14px 10px", borderBottom: `1px solid ${c.border}`, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: unaddedClusters.length > 0 ? 8 : 0 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint }}>
            Clusters
          </div>
          <button
            onClick={onToggle}
            title="Collapse panel"
            style={{ ...btnG, padding: "3px 6px", fontSize: 13, color: c.hint }}
          >‹</button>
        </div>
        {unaddedClusters.length > 0 && (
          <button
            onClick={() => unaddedClusters.forEach((cl) => onAdd(cl))}
            style={{
              width: "100%", padding: "5px 8px", borderRadius: 6,
              background: "transparent", border: `1px solid ${c.borderMid}`,
              color: c.muted, fontSize: 11, cursor: "pointer",
              fontFamily: "inherit", textAlign: "center",
            }}
          >
            Add all clusters
          </button>
        )}
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
            const st = SUBTYPE_STYLE[cl.subtype] || SUBTYPE_STYLE.Trend;
            const lb = LEFT_BORDER_COLOR[cl.subtype] || c.border;

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

// ─── Inspector ────────────────────────────────────────────────────────────────

function Inspector({ selectedItem, clusters, scenarios, relationships, onEditRel, onDeleteRel, onClose, collapsed, onToggle }) {
  const HINSP_COLORS = {
    H1: [c.green700, c.green50],
    H2: [c.blue700, c.blue50],
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
    const [hcol, hbg] = HINSP_COLORS[cluster.horizon] || [c.muted, c.surfaceAlt];
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
          <div style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 5, background: st.bg, border: `1px solid ${st.border}`, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: st.col }}>{cluster.subtype}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, lineHeight: 1.4, marginBottom: 10 }}>{cluster.name}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: hbg, color: hcol, fontWeight: 600 }}>{cluster.horizon}</span>
            <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: c.surfaceAlt, color: c.muted }}>{cluster.likelihood}</span>
          </div>
          {cluster.description && (
            <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, marginBottom: 12 }}>{cluster.description}</div>
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
    const fromCl = clusters.find((cl) => cl.id === rel.fromClusterId);
    const toCl = clusters.find((cl) => cl.id === rel.toClusterId);
    const relType = REL_TYPE_MAP[rel.type] || REL_TYPES[0];
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
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 10, background: c.surfaceAlt, color: c.muted }}>{rel.confidence}</span>
          </div>
          {rel.evidence && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: c.hint, marginBottom: 3 }}>Evidence</div>
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55 }}>{rel.evidence}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onEditRel(rel.id)} style={{ ...btnSec, fontSize: 11, padding: "6px 14px" }}>Edit</button>
            <button
              onClick={() => onDeleteRel(rel.id)}
              style={{ fontSize: 11, padding: "6px 14px", borderRadius: 7, background: "transparent", border: `1px solid ${c.redBorder}`, color: c.red800, cursor: "pointer", fontFamily: "inherit" }}
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
      Continuation: { col: c.green700, bg: c.green50 },
      Collapse: { col: c.red800, bg: c.red50 },
      Constraint: { col: c.amber700, bg: c.amber50 },
      Transformation: { col: c.violet700, bg: c.violet50 },
    };
    const ac = ARCHETYPE_COLORS[scenario.archetype] || { col: c.muted, bg: c.surfaceAlt };
    const [hcol, hbg] = HINSP_COLORS[scenario.horizon] || [c.muted, c.surfaceAlt];
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
          <div style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 5, background: ac.bg, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: ac.col }}>{scenario.archetype}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, lineHeight: 1.4, marginBottom: 10 }}>{scenario.name}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: hbg, color: hcol, fontWeight: 600 }}>{scenario.horizon}</span>
          </div>
          {scenario.narrative ? (
            <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, fontStyle: "italic" }}>{scenario.narrative}</div>
          ) : (
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

// ─── Table view ───────────────────────────────────────────────────────────────

const EMPTY_DRAFT = { fromClusterId: "", toClusterId: "", type: "Drives", customType: "", evidence: "", confidence: "Medium" };

function TableView({ clusters, relationships, canvasNodes, allClusters, onEditRel, onDeleteRel, onAddRel }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // Collapsed by default when there are relationships; expanded when empty so
  // the user can see their clusters and orient themselves.
  const [clustersCollapsed, setClustersCollapsed] = useState(relationships.length > 0);

  const thStyle = {
    padding: "8px 14px", fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.06em", color: c.hint,
    background: c.surfaceAlt, borderBottom: `1px solid ${c.border}`,
  };
  const selStyle = {
    width: "100%", padding: "5px 7px", border: `1px solid ${c.borderMid}`,
    borderRadius: 6, background: c.white, color: c.ink, fontSize: 11,
    fontFamily: "inherit", outline: "none", cursor: "pointer",
  };

  const canSave = draft.fromClusterId && draft.toClusterId && draft.fromClusterId !== draft.toClusterId;
  const handleSave = () => {
    const effectiveType = draft.type === "Other" ? (draft.customType.trim() || "Other") : draft.type;
    onAddRel({ ...draft, type: effectiveType });
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  };
  const handleCancel = () => { setDraft(EMPTY_DRAFT); setAdding(false); };
  const canvasClusters = clusters.filter((cl) => canvasNodes.some((n) => n.clusterId === cl.id));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
      {/* Relationships table — shown first */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>
            Relationships <span style={{ fontSize: 11, color: c.hint, fontWeight: 400 }}>({relationships.length})</span>
          </div>
          {!adding && <button onClick={() => setAdding(true)} style={{ ...btnSm, fontSize: 11, padding: "4px 12px", display: "flex", alignItems: "center", gap: 5 }}><CirclePlus size={13} />Add relationship</button>}
        </div>

        {relationships.length === 0 && !adding ? (
          <div style={{ fontSize: 12, color: c.hint }}>No relationships mapped yet. Add one above or draw connections in the canvas view.</div>
        ) : (
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr 2.5fr 1fr 90px" }}>
              {["From", "Type", "To", "Evidence", "Confidence", ""].map((h, i) => <div key={i} style={thStyle}>{h}</div>)}
            </div>
            {adding && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr 2.5fr 1fr 90px", borderTop: `1px solid ${c.border}`, alignItems: "center", background: c.surfaceAlt }}>
                <div style={{ padding: "8px 10px" }}>
                  <select style={selStyle} value={draft.fromClusterId} onChange={(e) => setDraft((d) => ({ ...d, fromClusterId: e.target.value, toClusterId: d.toClusterId === e.target.value ? "" : d.toClusterId }))}>
                    <option value="">From…</option>
                    {canvasClusters.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                  </select>
                </div>
                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <select style={selStyle} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value, customType: "" }))}>
                    {REL_TYPES.map((rt) => <option key={rt.id} value={rt.id}>{rt.id}</option>)}
                    <option value="Other">Other…</option>
                  </select>
                  {draft.type === "Other" && (
                    <input
                      autoFocus
                      type="text"
                      value={draft.customType}
                      onChange={(e) => setDraft((d) => ({ ...d, customType: e.target.value }))}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Custom label…"
                      style={{ ...selStyle, cursor: "text" }}
                    />
                  )}
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <select style={selStyle} value={draft.toClusterId} onChange={(e) => setDraft((d) => ({ ...d, toClusterId: e.target.value }))}>
                    <option value="">To…</option>
                    {canvasClusters.filter((cl) => cl.id !== draft.fromClusterId).map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                  </select>
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <input style={{ ...selStyle, cursor: "text" }} type="text" value={draft.evidence} onChange={(e) => setDraft((d) => ({ ...d, evidence: e.target.value }))} onKeyDown={(e) => e.stopPropagation()} placeholder="Evidence (optional)" />
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <select style={selStyle} value={draft.confidence} onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))}>
                    {["Low", "Medium", "High"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div style={{ padding: "8px 10px", display: "flex", gap: 4 }}>
                  <button onClick={handleSave} disabled={!canSave} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 5, background: canSave ? c.ink : c.surfaceAlt, border: `1px solid ${canSave ? c.ink : c.border}`, color: canSave ? c.white : c.hint, cursor: canSave ? "pointer" : "default", fontFamily: "inherit", fontWeight: 500 }}>Save</button>
                  <button onClick={handleCancel} style={{ ...btnG, fontSize: 10, padding: "4px 8px", border: `1px solid ${c.border}` }}>Cancel</button>
                </div>
              </div>
            )}
            {relationships.map((rel, idx) => {
              const fromCl = allClusters.find((cl) => cl.id === rel.fromClusterId);
              const toCl = allClusters.find((cl) => cl.id === rel.toClusterId);
              const rt = REL_TYPE_MAP[rel.type] || REL_TYPES[0];
              return (
                <div key={rel.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr 2.5fr 1fr 90px", borderTop: `1px solid ${c.border}`, alignItems: "center" }}>
                  <div style={{ padding: "10px 14px", fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fromCl?.name}</div>
                  <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 16, height: 2.5, borderRadius: 2, flexShrink: 0, background: rt.dash ? `repeating-linear-gradient(to right, ${rt.color} 0, ${rt.color} 4px, transparent 4px, transparent 8px)` : rt.color }} />
                    <span style={{ fontSize: 11, color: rt.color, fontWeight: 500 }}>{rel.type}</span>
                  </div>
                  <div style={{ padding: "10px 14px", fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toCl?.name}</div>
                  <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rel.evidence || "—"}</div>
                  <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted }}>{rel.confidence}</div>
                  <div style={{ padding: "10px 14px", display: "flex", gap: 5 }}>
                    <button onClick={() => onEditRel(rel.id)} style={{ ...btnG, fontSize: 10, padding: "3px 8px", border: `1px solid ${c.border}` }}>Edit</button>
                    <button onClick={() => onDeleteRel(rel.id)} style={{ ...btnG, fontSize: 10, padding: "3px 8px", border: `1px solid ${c.redBorder}`, color: c.red800 }}>Del</button>
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* Clusters table — collapsible */}
      <div>
        <button
          onClick={() => setClustersCollapsed((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            padding: 0, marginBottom: clustersCollapsed ? 0 : 10,
            fontSize: 13, fontWeight: 500, color: c.ink, fontFamily: "inherit",
          }}
        >
          {clustersCollapsed
            ? <ChevronRight size={14} style={{ color: c.hint, flexShrink: 0 }} />
            : <ChevronDown  size={14} style={{ color: c.hint, flexShrink: 0 }} />}
          Clusters <span style={{ fontSize: 11, color: c.hint, fontWeight: 400 }}>({clusters.length})</span>
        </button>

        {!clustersCollapsed && (
          clusters.length === 0 ? (
            <div style={{ fontSize: 12, color: c.hint, marginTop: 10 }}>No clusters in this project.</div>
          ) : (
            <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 60px" }}>
                {["Name", "Subtype", "Horizon", "Likelihood", "Inputs"].map((h) => (
                  <div key={h} style={thStyle}>{h}</div>
                ))}
              </div>
              {clusters.map((cl) => {
                const st = SUBTYPE_STYLE[cl.subtype] || SUBTYPE_STYLE.Trend;
                const onCanvas = canvasNodes.some((n) => n.clusterId === cl.id);
                return (
                  <div key={cl.id} style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 60px", borderTop: `1px solid ${c.border}`, alignItems: "center" }}>
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{cl.name}</span>
                      {onCanvas && <span style={{ fontSize: 9, padding: "1px 5px", background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 4, color: c.hint }}>on canvas</span>}
                    </div>
                    <div style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.col, display: "inline-block" }}>{cl.subtype}</span>
                    </div>
                    <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted }}>{cl.horizon}</div>
                    <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted }}>{cl.likelihood}</div>
                    <div style={{ padding: "10px 14px", fontSize: 11, color: c.muted }}>{cl.input_ids?.length || 0}</div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Canvas area (must be inside ReactFlowProvider to use useReactFlow) ───────

function CanvasArea({
  projectNodes, projectRels, clusters,
  projectTextNodes, activeProjectId,
  onAddTextNode, onUpdateTextNode, onRemoveTextNode,
  connectMode, setConnectMode,
  selectedItem, setSelectedItem,
  onConnect, onNodeDragStop,
  onRemoveNode, isPanning,
  panelsHidden, onTogglePanels,
  isFullscreen, onToggleFullscreen,
}) {
  const { zoomIn, zoomOut, setViewport, getViewport, screenToFlowPosition } = useReactFlow();
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState([]);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [activeTool, setActiveTool] = useState("select"); // 'select' | 'hand' | 'text' | 'connect'
  const [selectedTextNodeId, setSelectedTextNodeId] = useState(null);

  // Keep connectMode in sync with activeTool
  useEffect(() => {
    setConnectMode(activeTool === "connect");
  }, [activeTool, setConnectMode]);

  // Stable refs so node data closures don't go stale
  const onRemoveNodeRef = useRef(onRemoveNode);
  useEffect(() => { onRemoveNodeRef.current = onRemoveNode; }, [onRemoveNode]);
  const onUpdateTextNodeRef = useRef(onUpdateTextNode);
  useEffect(() => { onUpdateTextNodeRef.current = onUpdateTextNode; }, [onUpdateTextNode]);

  // Rebuild RF nodes whenever cluster nodes OR text nodes change (add/remove).
  const nodeIdsKey = projectNodes.map((n) => n.id).join(",");
  const textNodeIdsKey = projectTextNodes.map((n) => n.id).join(",");
  useEffect(() => {
    setRFNodes((prev) => {
      const dbIds = new Set(projectTextNodes.map((n) => n.id));
      // Build DB text nodes — if the RF node already exists (same ID) preserve its current
      // state (editing, selection, text-in-progress) so the DB confirmation doesn't reset it.
      const dbTextNodes = projectTextNodes.map((tn) => {
        const existing = prev.find((n) => n.id === tn.id && n.type === "textNode");
        if (existing) return existing;
        return {
          id: tn.id,
          type: "textNode",
          position: { x: tn.x, y: tn.y },
          selected: false,
          data: {
            text: tn.text,
            fontFamily: tn.fontFamily,
            fontSize: tn.fontSize,
            bold: tn.bold,
            italic: tn.italic,
            color: tn.color,
            autoFocus: false,
            editing: false,
            onCommit: (text) => onUpdateTextNodeRef.current(tn.id, { text }),
          },
        };
      });
      // Only keep locally-placed nodes that aren't yet confirmed by Supabase
      const pendingLocal = prev.filter(
        (n) => n.type === "textNode" && n.data?.autoFocus && !dbIds.has(n.id)
      );
      return [
        ...projectNodes.map((pNode) => ({
          id: pNode.id,
          type: "cluster",
          position: { x: pNode.x, y: pNode.y },
          selectable: false,
          data: {
            cluster: clusters.find((cl) => cl.id === pNode.clusterId),
            onRemove: () => onRemoveNodeRef.current(pNode.id),
            connectMode: !!connectMode,
            isConnectSource: false,
            selected: false,
          },
        })),
        ...dbTextNodes,
        ...pendingLocal,
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIdsKey, textNodeIdsKey]);

  // Update data (selection, connectMode) without resetting positions.
  // Skip text nodes — they manage their own selection via rfNode.selected.
  useEffect(() => {
    setRFNodes((nds) => nds.map((rfNode) => {
      if (rfNode.type === "textNode") return rfNode;
      return {
        ...rfNode,
        data: {
          ...rfNode.data,
          connectMode: !!connectMode,
          selected: selectedItem?.type === "node" && selectedItem.nodeId === rfNode.id,
        },
      };
    }));
  }, [selectedItem, connectMode, setRFNodes]);

  // Text node helpers
  const addTextNodeAtPosition = useCallback((position) => {
    // Pre-generate the UUID so the optimistic RF node and the DB row share the same ID.
    // This prevents a duplicate node from appearing while the Supabase insert is in flight.
    const id = crypto.randomUUID();
    const fields = {
      id,
      projectId: activeProjectId,
      x: position.x,
      y: position.y,
      text: "",
      fontFamily: TEXT_NODE_FONTS[0].value,
      fontSize: 16,
      color: TEXT_NODE_COLORS[0].hex,
      bold: false,
      italic: false,
    };
    setRFNodes((nds) => [
      ...nds,
      {
        id,
        type: "textNode",
        position,
        selected: true,
        data: {
          ...fields,
          autoFocus: true,
          editing: true,
          onCommit: (text) => onUpdateTextNodeRef.current(id, { text }),
        },
      },
    ]);
    setSelectedTextNodeId(id);
    onAddTextNode(fields);
  }, [activeProjectId, setRFNodes, onAddTextNode]);

  const updateTextNodeData = useCallback((nodeId, patch) => {
    // Update RF node locally for immediate feedback
    setRFNodes((nds) =>
      nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)
    );
    // Persist format change to Supabase (position updates go via onNodeDragStop)
    const { x, y, autoFocus, editing, ...formattingPatch } = patch;
    if (Object.keys(formattingPatch).length > 0) onUpdateTextNode(nodeId, formattingPatch);
  }, [setRFNodes, onUpdateTextNode]);

  const deleteTextNode = useCallback((nodeId) => {
    setRFNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setSelectedTextNodeId(null);
    onRemoveTextNode(nodeId);
  }, [setRFNodes, onRemoveTextNode]);

  const duplicateTextNode = useCallback((nodeId) => {
    const src = rfNodes.find((n) => n.id === nodeId);
    if (!src) return;
    const id = crypto.randomUUID();
    const fields = {
      id,
      projectId: activeProjectId,
      x: src.position.x + 16,
      y: src.position.y + 16,
      text: src.data.text,
      fontFamily: src.data.fontFamily,
      fontSize: src.data.fontSize,
      color: src.data.color,
      bold: src.data.bold,
      italic: src.data.italic,
    };
    setRFNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      {
        id,
        type: "textNode",
        position: { x: fields.x, y: fields.y },
        selected: true,
        data: { ...fields, autoFocus: false, editing: false },
      },
    ]);
    setSelectedTextNodeId(id);
    onAddTextNode(fields);
  }, [rfNodes, activeProjectId, setRFNodes, onAddTextNode]);

  // Keyboard shortcuts for tool switching and text node deletion
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      const isEditing = tag === "input" || tag === "textarea" || tag === "select" ||
        document.activeElement?.isContentEditable;
      if (isEditing) return;

      if (e.key === "v" || e.key === "V") { setActiveTool("select"); return; }
      if (e.key === "h" || e.key === "H") { setActiveTool("hand"); return; }
      if (e.key === "t" || e.key === "T") { setActiveTool("text"); return; }
      if (e.key === "c" || e.key === "C") { setActiveTool("connect"); return; }
      if (e.key === "Escape") { setActiveTool("select"); return; }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedTextNodeId) {
        deleteTextNode(selectedTextNodeId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTextNodeId, deleteTextNode]);

  // Rebuild edges whenever relationships or selection changes
  useEffect(() => {
    setRFEdges(projectRels.map((rel) => {
      const fromNode = projectNodes.find((n) => n.clusterId === rel.fromClusterId);
      const toNode = projectNodes.find((n) => n.clusterId === rel.toClusterId);
      if (!fromNode || !toNode) return null;
      const rt = REL_TYPE_MAP[rel.type];
      const isSelected = selectedItem?.type === "rel" && selectedItem.id === rel.id;
      return {
        id: `${rel.id}-${rel.type}`,
        source: fromNode.id,
        target: toNode.id,
        sourceHandle: rel.sourceHandle || null,
        targetHandle: rel.targetHandle || null,
        type: "relationship",
        data: {
          rel,
          selected: isSelected,
          color:     rt?.color ?? REL_TYPES[0].color,
          dash:      rt?.dash  ?? REL_TYPES[0].dash,
          typeLabel: rel.type,   // always use the stored value, never a fallback id
        },
        selectable: false,
      };
    }).filter(Boolean));
  }, [projectRels, projectNodes, selectedItem, setRFEdges]);

  const handleNodeClick = useCallback((_, rfNode) => {
    if (rfNode.type === "textNode") {
      setSelectedTextNodeId(rfNode.id);
      setRFNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === rfNode.id })));
      setSelectedItem(null);
      setActiveTool("select");
      return;
    }
    const pNode = projectNodes.find((n) => n.id === rfNode.id);
    if (!pNode) return;
    setSelectedTextNodeId(null);
    setSelectedItem({ type: "node", nodeId: rfNode.id, clusterId: pNode.clusterId });
  }, [projectNodes, setSelectedItem, setRFNodes]);

  const handleEdgeClick = useCallback((_, rfEdge) => {
    setSelectedTextNodeId(null);
    // rfEdge.id is `${rel.id}-${rel.type}` — read the stable rel id from data
    setSelectedItem({ type: "rel", id: rfEdge.data.rel.id });
  }, [setSelectedItem]);

  const handlePaneClick = useCallback((event) => {
    if (activeTool === "text") {
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addTextNodeAtPosition(pos);
      setActiveTool("select");
      return;
    }
    setSelectedTextNodeId(null);
    setRFNodes((nds) => nds.map((n) => n.type === "textNode" ? { ...n, selected: false } : n));
    if (activeTool === "connect") { setActiveTool("select"); return; }
    setSelectedItem(null);
  }, [activeTool, setSelectedItem, setRFNodes, screenToFlowPosition, addTextNodeAtPosition]);

  // Wraps the onConnect prop: adds type guard + resets tool on completion
  const handleConnect = useCallback((connection) => {
    const sourceNode = rfNodes.find((n) => n.id === connection.source);
    const targetNode = rfNodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return;
    if (sourceNode.type !== "cluster" || targetNode.type !== "cluster") return;
    onConnect(connection);
    setActiveTool("select");
  }, [rfNodes, onConnect]);

  const selectedTextNode = selectedTextNodeId
    ? rfNodes.find((n) => n.id === selectedTextNodeId) ?? null
    : null;

  return (
    <div style={{ flex: 1, position: "relative", width: "100%", height: "100%", cursor: activeTool === "text" ? "crosshair" : activeTool === "hand" ? "grab" : undefined }}>
      {/* Global SVG marker definitions — one per relationship type, always in DOM */}
      <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          {REL_TYPES.map((rt) => {
            const k = rt.id.replace(/\s/g, "-");
            return (
              <>
                <marker key={`end-${k}`} id={`arrow-end-${k}`} markerWidth="10" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={rt.color} />
                </marker>
                {rt.dash && (
                  <marker key={`start-${k}`} id={`arrow-start-${k}`} markerWidth="10" markerHeight="6" refX="8" refY="3" orient="auto-start-reverse">
                    <path d="M0,0 L0,6 L8,3 z" fill={rt.color} />
                  </marker>
                )}
              </>
            );
          })}
        </defs>
      </svg>

      {/* Connect mode banner */}
      {connectMode && (
        <div style={{
          position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
          zIndex: 10, padding: "8px 18px", background: c.ink, color: c.white,
          borderRadius: 20, fontSize: 12, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 2px 14px rgba(0,0,0,0.18)", whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>
          Drag from a node handle to connect
          <button
            onMouseDown={(e) => { e.stopPropagation(); setActiveTool("select"); }}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", color: c.white, fontSize: 11, padding: "2px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", pointerEvents: "all" }}
          >Cancel</button>
        </div>
      )}


      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={3}
        zoomOnPinch={true}
        zoomOnScroll={true}
        panOnScroll={false}
        preventScrolling={true}
        panOnDrag={activeTool === "hand" ? true : activeTool === "text" ? false : (isPanning ? true : [1, 2])}
        nodesDraggable={activeTool !== "text"}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={20}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        onViewportChange={(vp) => setCurrentZoom(vp.zoom)}
        style={{ background: c.canvas, touchAction: "none" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(0,0,0,0.11)" gap={24} size={1} />
        {selectedTextNode && (
          <Panel position="top-center">
            <FormatBarTextNode
              node={selectedTextNode}
              onUpdate={(patch) => updateTextNodeData(selectedTextNodeId, patch)}
              onDuplicate={() => duplicateTextNode(selectedTextNodeId)}
              onDelete={() => deleteTextNode(selectedTextNodeId)}
            />
          </Panel>
        )}
      </ReactFlow>

      {/* Empty canvas nudge */}
      {projectNodes.length === 0 && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 12, color: c.hint, textAlign: "center", lineHeight: 1.6 }}>
            Add clusters from the sidebar to begin mapping relationships.
          </div>
        </div>
      )}

      {/* ── Bottom-left: panel controls pill ── */}
      <div style={{
        position: "absolute", bottom: 16, left: 16, zIndex: 10,
        display: "flex", flexDirection: "column",
        background: c.white, border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
          style={{
            padding: 7, border: "none", background: isFullscreen ? c.ink : "none",
            color: isFullscreen ? c.white : c.ink, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }} />
        <button
          onClick={onTogglePanels}
          title={panelsHidden ? "Show panels (Tab)" : "Hide panels (Tab)"}
          style={{
            padding: 7, border: "none", background: panelsHidden ? c.ink : "none",
            color: panelsHidden ? c.white : c.ink, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {panelsHidden ? (
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
              <rect x="1" y="1" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6 5L4 7L6 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 5L12 7L10 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
              <rect x="1" y="1" width="3.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="11.5" y="1" width="3.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6.5 5L8.5 7L6.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.5 5L7.5 7L9.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Bottom-center: tool toolbar ── */}
      {(() => {
        const pillStyle = {
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10,
          display: "flex", flexDirection: "row", alignItems: "center",
          background: c.white, border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          overflow: "hidden",
        };
        const toolBtn = (tool) => ({
          padding: "8px 12px", border: "none", cursor: "pointer",
          borderRadius: 0, display: "flex", alignItems: "center", gap: 5,
          fontSize: 12, fontFamily: "inherit",
          background: activeTool === tool ? c.ink : "none",
          color: activeTool === tool ? c.white : c.ink,
          transition: "background 0.15s, color 0.15s",
        });
        return (
          <div style={pillStyle}>
            <button style={toolBtn("select")} title="Select (V)" onClick={() => setActiveTool("select")}>
              <MousePointer2 size={14} />
            </button>
            <button style={toolBtn("hand")} title="Hand (H)" onClick={() => setActiveTool("hand")}>
              <Hand size={14} />
            </button>
            <button style={toolBtn("text")} title="Text (T)" onClick={() => setActiveTool("text")}>
              <Type size={14} />
            </button>
            <button style={toolBtn("connect")} title="Connect (C)" onClick={() => setActiveTool("connect")}>
              <Network size={14} />
            </button>
          </div>
        );
      })()}

      {/* ── Bottom-right: zoom controls ── */}
      <div style={{
        position: "absolute", bottom: 16, right: 16, zIndex: 10,
        display: "flex", alignItems: "center",
        background: c.white, border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        <button onClick={() => zoomOut()} style={{ padding: "7px 11px", border: "none", background: "none", color: c.ink, fontSize: 15, lineHeight: 1, cursor: "pointer", fontFamily: "inherit" }}>−</button>
        <div style={{ padding: "7px 10px", fontSize: 11, color: c.muted, borderLeft: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.08)", minWidth: 48, textAlign: "center" }}>
          {Math.round(currentZoom * 100)}%
        </div>
        <button onClick={() => zoomIn()} style={{ padding: "7px 11px", border: "none", background: "none", color: c.ink, fontSize: 15, lineHeight: 1, cursor: "pointer", fontFamily: "inherit" }}>+</button>
        <button
          onClick={() => { setViewport({ x: 60, y: 60, zoom: 1 }); setCurrentZoom(1); }}
          style={{ padding: "7px 10px", border: "none", background: "none", color: c.muted, fontSize: 10, borderLeft: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", fontFamily: "inherit" }}
        >reset</button>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ScenarioCanvas({ appState }) {
  const {
    clusters, inputs, scenarios, projects, activeProjectId, setActiveProjectId, openProjectModal,
    canvasNodes, canvasTextNodes, relationships,
    addCanvasNode, removeCanvasNode, updateCanvasNodePos,
    addCanvasTextNode, updateCanvasTextNode, removeCanvasTextNode,
    addRelationship, updateRelationship, removeRelationship,
    deleteSystemMap, deleteAnalysis, showToast, scenarioDetailId, closeScenarioDetail,
  } = appState;

  const project = projects.find((p) => p.id === activeProjectId) || null;
  const projectClusters = clusters.filter((cl) => cl.project_id === activeProjectId);
  const projectNodes = canvasNodes.filter((n) => n.projectId === activeProjectId);
  const projectTextNodes = canvasTextNodes.filter((n) => n.projectId === activeProjectId);
  const projectRels = relationships
    .filter((r) => r.projectId === activeProjectId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const [viewMode, setViewMode] = useState("canvas");
  const [confirmDeleteMap, setConfirmDeleteMap] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [relModalOpen, setRelModalOpen] = useState(false);
  const [pendingRel, setPendingRel] = useState(null);
  const [editingRelId, setEditingRelId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isPanning, setIsPanning] = useState(false);

  // Keyboard shortcuts: Escape, Space (pan), Tab (toggle panels)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setConnectMode(false);
        setRelModalOpen(false);
        setPendingRel(null);
        setEditingRelId(null);
        setIsFullscreen(false);
      }
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsPanning(true);
      }
      if (e.key === "Tab") {
        const tag = document.activeElement?.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" ||
            document.activeElement?.isContentEditable) return;
        e.preventDefault();
        setPanelsHidden((h) => !h);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") setIsPanning(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Pre-select a scenario in the inspector when navigating from ProjectDetail
  useEffect(() => {
    if (scenarioDetailId) {
      setSelectedItem({ type: "scenario", scenarioId: scenarioDetailId });
      setRightOpen(true);
      closeScenarioDetail();
    }
  }, [scenarioDetailId, closeScenarioDetail]);

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

  // React Flow connection callback
  const onConnect = useCallback((connection) => {
    const fromNode = projectNodes.find((n) => n.id === connection.source);
    const toNode = projectNodes.find((n) => n.id === connection.target);
    if (fromNode && toNode) {
      setPendingRel({
        fromClusterId: fromNode.clusterId,
        toClusterId: toNode.clusterId,
        sourceHandle: connection.sourceHandle || null,
        targetHandle: connection.targetHandle || null,
      });
      setRelModalOpen(true);
      setConnectMode(false);
    }
  }, [projectNodes]);

  // Persist position on drag end
  const onNodeDragStop = useCallback((_, rfNode) => {
    if (rfNode.type === "textNode") {
      updateCanvasTextNode(rfNode.id, { x: rfNode.position.x, y: rfNode.position.y });
      return;
    }
    updateCanvasNodePos(rfNode.id, { x: rfNode.position.x, y: rfNode.position.y });
  }, [updateCanvasNodePos, updateCanvasTextNode]);

  const editingRel = editingRelId ? relationships.find((r) => r.id === editingRelId) : null;
  const fromCluster = pendingRel
    ? clusters.find((cl) => cl.id === pendingRel.fromClusterId)
    : editingRel ? clusters.find((cl) => cl.id === editingRel.fromClusterId) : null;
  const toCluster = pendingRel
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
    <div style={isFullscreen
      ? { position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: c.bg }
      : { display: "flex", flexDirection: "column", height: "100%", background: c.bg }
    }>
      {/* Top bar */}
      <div style={{ padding: "14px 22px 12px", background: c.white, borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.09em", color: c.hint }}>
            {project.name}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>System Map</div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>
              {projectNodes.length} cluster{projectNodes.length !== 1 ? "s" : ""} on canvas
              &nbsp;·&nbsp;
              {projectRels.length} relationship{projectRels.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(projectNodes.length > 0 || projectRels.length > 0) && (
              <button
                onClick={() => setConfirmDeleteMap(true)}
                style={{ fontSize: 11, padding: "5px 11px", borderRadius: 6, border: `1px solid ${c.redBorder}`, background: "transparent", color: c.red800, cursor: "pointer", fontFamily: "inherit" }}
              >Clear Map</button>
            )}
            <div style={{ display: "flex", border: `1px solid ${c.border}`, borderRadius: 7, overflow: "hidden" }}>
              {[
                { mode: "canvas", label: "Canvas", icon: <LayoutDashboard size={13} /> },
                { mode: "table",  label: "Table",  icon: <Logs size={13} /> },
              ].map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: "6px 14px",
                    background: viewMode === mode ? c.brand : c.white,
                    color: viewMode === mode ? c.white : c.muted,
                    border: "none", fontSize: 11,
                    fontWeight: viewMode === mode ? 500 : 400,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >{icon}{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {confirmDeleteMap && (
        <ConfirmDialog
          title="Clear System Map?"
          message={`This will remove all nodes and relationships from the map and delete the System Analysis for "${project.name}". This cannot be undone.`}
          confirmLabel="Clear Map"
          onConfirm={() => { deleteSystemMap(activeProjectId); deleteAnalysis(activeProjectId); showToast("System map cleared"); setConfirmDeleteMap(false); }}
          onClose={() => setConfirmDeleteMap(false)}
        />
      )}

      {viewMode === "table" ? (
        <TableView
          clusters={projectClusters}
          relationships={projectRels}
          canvasNodes={projectNodes}
          allClusters={clusters}
          onEditRel={handleEditRel}
          onDeleteRel={handleDeleteRel}
          onAddRel={(draft) => addRelationship({ ...draft, projectId: activeProjectId })}
        />
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <LeftSidebar
            clusters={projectClusters}
            canvasNodes={projectNodes}
            onAdd={handleAddToCanvas}
            collapsed={!leftOpen || panelsHidden}
            onToggle={() => setLeftOpen((o) => !o)}
          />

          <ReactFlowProvider>
            <CanvasArea
              projectNodes={projectNodes}
              projectRels={projectRels}
              clusters={clusters}
              projectTextNodes={projectTextNodes}
              activeProjectId={activeProjectId}
              onAddTextNode={addCanvasTextNode}
              onUpdateTextNode={updateCanvasTextNode}
              onRemoveTextNode={removeCanvasTextNode}
              connectMode={connectMode}
              setConnectMode={setConnectMode}
              selectedItem={selectedItem}
              setSelectedItem={setSelectedItem}
              onConnect={onConnect}
              onNodeDragStop={onNodeDragStop}
              onRemoveNode={handleRemoveFromCanvas}
              isPanning={isPanning}
              panelsHidden={panelsHidden}
              onTogglePanels={() => setPanelsHidden((h) => !h)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            />
          </ReactFlowProvider>

          <Inspector
            selectedItem={selectedItem}
            clusters={clusters}
            scenarios={scenarios}
            relationships={projectRels}
            onEditRel={handleEditRel}
            onDeleteRel={handleDeleteRel}
            onClose={() => setSelectedItem(null)}
            collapsed={!rightOpen || panelsHidden}
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

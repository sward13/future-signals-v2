import { useState, useRef, useEffect, useCallback } from "react";
import {
  ReactFlow,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ─── constants ───────────────────────────────────────────────────────────────

const FONTS = [
  { label: "Sans",  value: "Inter, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono",  value: "'Menlo', 'Courier New', monospace" },
];

const SIZES = [12, 14, 16, 20, 24, 32, 48];

const COLORS = [
  { hex: "#1a1a1a", label: "Black" },
  { hex: "#374151", label: "Dark gray" },
  { hex: "#6b7280", label: "Gray" },
  { hex: "#1d4ed8", label: "Blue" },
  { hex: "#0f6e56", label: "Teal" },
  { hex: "#993c1d", label: "Coral" },
  { hex: "#993556", label: "Pink" },
  { hex: "#854f0b", label: "Amber" },
];

let _id = 1;
const newId = () => `txt-${_id++}`;

// ─── TextNode ─────────────────────────────────────────────────────────────────
// Uses a <textarea> instead of contentEditable so ReactFlow doesn't
// swallow keyboard events.

function TextNodeComponent({ id, data, selected }) {
  const { setNodes } = useReactFlow();
  const taRef = useRef(null);
  const [editing, setEditing] = useState(data.autoFocus ?? false);

  // Auto-size textarea to its content
  function resize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.width = "auto";
    el.style.height = el.scrollHeight + "px";
    el.style.width = Math.max(el.scrollWidth, 80) + "px";
  }

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.select();
    }
    resize();
  }, [editing]);

  function commit(value) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, text: value, autoFocus: false } }
          : n
      )
    );
    setEditing(false);
  }

  const sharedStyle = {
    fontFamily: data.fontFamily,
    fontSize: data.fontSize + "px",
    fontWeight: data.bold ? "700" : "400",
    fontStyle: data.italic ? "italic" : "normal",
    color: data.color,
    lineHeight: "1.4",
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
      onDoubleClick={() => setEditing(true)}
    >
      {/* selection ring */}
      {selected && !editing && (
        <div style={{
          position: "absolute", inset: -5,
          border: "1.5px solid #4f8ef7",
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
          onInput={(e) => { resize(); }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation(); // prevent ReactFlow from stealing keys
            if (e.key === "Escape") commit(e.target.value);
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit(e.target.value);
            }
          }}
        />
      ) : (
        <div style={{ ...sharedStyle, whiteSpace: "pre-wrap", minHeight: "1.4em", cursor: "default" }}>
          {data.text || (
            <span style={{ color: "rgba(120,120,120,0.5)", fontStyle: "italic" }}>Text</span>
          )}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { textNode: TextNodeComponent };

// ─── FormatBar ────────────────────────────────────────────────────────────────

function FormatBar({ node, onUpdate, onDuplicate, onDelete }) {
  if (!node) return null;
  const d = node.data;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "#1c1c1e", borderRadius: 8,
      padding: "6px 10px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
    }}>
      {/* Font */}
      <select
        value={d.fontFamily}
        onChange={(e) => onUpdate({ fontFamily: e.target.value })}
        style={selectSty}
      >
        {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>

      <div style={sep} />

      {/* Size */}
      <select
        value={d.fontSize}
        onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
        style={selectSty}
      >
        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div style={sep} />

      {/* Bold */}
      <button
        style={{ ...fmtBtn, fontWeight: 700, background: d.bold ? "rgba(255,255,255,0.18)" : "none" }}
        onClick={() => onUpdate({ bold: !d.bold })}
      >B</button>

      {/* Italic */}
      <button
        style={{ ...fmtBtn, fontStyle: "italic", background: d.italic ? "rgba(255,255,255,0.18)" : "none" }}
        onClick={() => onUpdate({ italic: !d.italic })}
      >I</button>

      <div style={sep} />

      {/* Color swatches */}
      {COLORS.map((c) => (
        <button
          key={c.hex}
          title={c.label}
          onClick={() => onUpdate({ color: c.hex })}
          style={{
            width: 15, height: 15, borderRadius: "50%",
            background: c.hex, border: "none", padding: 0,
            cursor: "pointer", flexShrink: 0,
            outline: d.color === c.hex ? "2px solid #fff" : "none",
            outlineOffset: 1,
            transform: d.color === c.hex ? "scale(1.2)" : "scale(1)",
            transition: "transform 0.1s",
          }}
        />
      ))}

      <div style={sep} />

      {/* Actions */}
      <button style={actionBtn} onClick={onDuplicate} title="Duplicate">⧉</button>
      <button style={{ ...actionBtn, color: "#f87171" }} onClick={onDelete} title="Delete">✕</button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sep = { width: 1, height: 18, background: "rgba(255,255,255,0.14)", flexShrink: 0 };

const selectSty = {
  background: "rgba(255,255,255,0.07)", border: "none",
  color: "#d0d0d0", fontSize: 12, borderRadius: 4,
  padding: "3px 5px", cursor: "pointer", outline: "none",
};

const fmtBtn = {
  background: "none", border: "none", color: "#d0d0d0",
  fontSize: 13, cursor: "pointer", borderRadius: 4, padding: "3px 7px",
  lineHeight: 1,
};

const actionBtn = {
  background: "none", border: "none", color: "#9ca3af",
  fontSize: 14, cursor: "pointer", borderRadius: 4, padding: "2px 6px",
};

// ─── Canvas ───────────────────────────────────────────────────────────────────

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [textToolActive, setTextToolActive] = useState(false);
  const rf = useReactFlow();
  const wrapperRef = useRef(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  // Deselect on escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { setSelectedId(null); setTextToolActive(false); }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        const node = nodes.find((n) => n.id === selectedId);
        // only delete if not currently editing
        if (node && !document.activeElement?.tagName === "TEXTAREA") {
          deleteNode(selectedId);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, nodes]);

  function addTextNode(clientX, clientY) {
    const container = wrapperRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pos = rf.screenToFlowPosition({ x: clientX - rect.left, y: clientY - rect.top });
    const id = newId();
    setNodes((ns) => [
      ...ns.map((n) => ({ ...n, selected: false })),
      {
        id, type: "textNode",
        position: pos,
        selected: true,
        data: {
          text: "", fontFamily: FONTS[0].value, fontSize: 16,
          color: COLORS[0].hex, bold: false, italic: false, autoFocus: true,
        },
      },
    ]);
    setSelectedId(id);
    setTextToolActive(false);
  }

  function onPaneClick(e) {
    if (textToolActive) {
      addTextNode(e.clientX, e.clientY);
    } else {
      setSelectedId(null);
      setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
    }
  }

  function onNodeClick(e, node) {
    e.stopPropagation();
    setSelectedId(node.id);
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === node.id })));
  }

  function updateSelected(patch) {
    setNodes((ns) =>
      ns.map((n) => n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)
    );
  }

  function deleteNode(id) {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setSelectedId(null);
  }

  function duplicateNode(node) {
    const id = newId();
    setNodes((ns) => [
      ...ns.map((n) => ({ ...n, selected: false })),
      {
        ...node, id,
        position: { x: node.position.x + 16, y: node.position.y + 16 },
        selected: true,
        data: { ...node.data, autoFocus: false },
      },
    ]);
    setSelectedId(id);
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100vw", height: "100vh", position: "relative",
        cursor: textToolActive ? "crosshair" : "default",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView={false}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        panOnDrag={textToolActive ? false : [1]}
        selectionOnDrag={false}
        nodesDraggable={!textToolActive}
        nodesConnectable={false}
        elementsSelectable={true}
        deleteKeyCode={null}
        style={{ background: "#f7f6f1" }}
      >
        <Background color="#c8c6bc" gap={24} size={1} variant="dots" />

        {/* Bottom-left controls — matching FS canvas position */}
        <Controls showInteractive={false} position="bottom-left" />

        {/* ── Text tool button — sits in the canvas toolbar area ── */}
        {/* In production this belongs in the canvas bottom toolbar alongside the pan/zoom toggle */}
        <Panel position="bottom-center">
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.92)", borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.1)",
            padding: "6px 12px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            marginBottom: 8,
            fontSize: 12, color: "#6b7280",
          }}>
            <span>Space + drag to pan · Scroll to zoom</span>
            <div style={{ width: 1, height: 14, background: "rgba(0,0,0,0.12)" }} />
            <button
              onClick={() => setTextToolActive((v) => !v)}
              title="Add text (T)"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", border: "none", borderRadius: 6,
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: textToolActive ? "#1c1c1e" : "rgba(0,0,0,0.06)",
                color: textToolActive ? "#fff" : "#374151",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                <text x="1" y="11" fontFamily="Georgia, serif" fontSize="12" fill="currentColor" fontWeight="600">T</text>
              </svg>
              {textToolActive ? "Click to place" : "Text"}
            </button>
          </div>
        </Panel>

        {/* ── Format bar — floats above canvas when node selected ── */}
        {selectedNode && (
          <Panel position="top-center">
            <div style={{ marginTop: 12 }}>
              <FormatBar
                node={selectedNode}
                onUpdate={updateSelected}
                onDuplicate={() => duplicateNode(selectedNode)}
                onDelete={() => deleteNode(selectedId)}
              />
            </div>
          </Panel>
        )}

        {/* ── Top-right hint: mirrors the "+ Add relationship" button position ── */}
        {!selectedNode && !textToolActive && (
          <Panel position="top-right">
            <div style={{
              marginTop: 12, marginRight: 12,
              background: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(0,0,0,0.09)",
              borderRadius: 6, padding: "5px 12px",
              fontSize: 11, color: "#9ca3af",
            }}>
              Enable the Text tool, then click to place
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

export default function TextNodePrototype() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

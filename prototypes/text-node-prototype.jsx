import { useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const FONTS = [
  { label: "Sans", value: "'Inter', system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'Menlo', 'Courier New', monospace" },
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

let nodeIdCounter = 1;
function newId() {
  return `t${nodeIdCounter++}`;
}

function TextNodeComponent({ id, data, selected }) {
  const ref = useRef(null);
  const { setNodes } = useReactFlow();

  function updateData(patch) {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  }

  useEffect(() => {
    if (data.editing && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [data.editing]);

  const isEmpty = !data.text || data.text === "";

  const textStyle = {
    fontFamily: data.fontFamily,
    fontSize: data.fontSize + "px",
    fontWeight: data.bold ? "700" : "400",
    fontStyle: data.italic ? "italic" : "normal",
    color: data.color,
    outline: "none",
    cursor: data.editing ? "text" : "default",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    minWidth: "40px",
    minHeight: "1em",
    lineHeight: "1.4",
    padding: "2px 4px",
    borderRadius: "2px",
    background: data.editing ? "rgba(59,130,246,0.06)" : "transparent",
  };

  return (
    <div
      style={{ position: "relative", minWidth: 40, minHeight: 24 }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        updateData({ editing: true });
      }}
    >
      {selected && !data.editing && (
        <div
          style={{
            position: "absolute",
            inset: "-4px",
            border: "1.5px solid #4f8ef7",
            borderRadius: "4px",
            pointerEvents: "none",
          }}
        />
      )}
      {isEmpty && !data.editing && (
        <span
          style={{
            position: "absolute",
            top: 2,
            left: 4,
            color: "rgba(100,100,100,0.45)",
            fontStyle: "italic",
            fontFamily: data.fontFamily,
            fontSize: data.fontSize + "px",
            pointerEvents: "none",
          }}
        >
          Text
        </span>
      )}
      <div
        ref={ref}
        contentEditable={data.editing ? "true" : "false"}
        suppressContentEditableWarning
        style={textStyle}
        onBlur={(e) => updateData({ text: e.target.innerText, editing: false })}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            updateData({ text: e.target.innerText, editing: false });
          }
          e.stopPropagation();
        }}
        onClick={(e) => {
          if (data.editing) e.stopPropagation();
        }}
        dangerouslySetInnerHTML={{ __html: data.text || "" }}
      />
    </div>
  );
}

const nodeTypes = { textNode: TextNodeComponent };

const btnStyle = {
  background: "none",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#e0e0e0",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const selectStyle = {
  background: "rgba(255,255,255,0.08)",
  border: "none",
  color: "#d0d0d0",
  fontSize: 12,
  borderRadius: 4,
  padding: "3px 5px",
  cursor: "pointer",
  outline: "none",
};

const fmtBtn = {
  background: "none",
  border: "none",
  color: "#d0d0d0",
  fontSize: 13,
  cursor: "pointer",
  borderRadius: 4,
  padding: "3px 7px",
};

const sepStyle = {
  width: 1,
  height: 18,
  background: "rgba(255,255,255,0.15)",
  margin: "0 2px",
  flexShrink: 0,
};

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const rf = useReactFlow();
  const wrapperRef = useRef(null);

  const selectedNode = nodes.find((n) => n.id === selectedId);

  function addTextNode(e) {
    const container = wrapperRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pos = rf.screenToFlowPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    const id = newId();
    const node = {
      id,
      type: "textNode",
      position: pos,
      data: {
        text: "",
        fontFamily: FONTS[0].value,
        fontSize: 16,
        color: COLORS[0].hex,
        bold: false,
        italic: false,
        editing: true,
      },
      selected: true,
    };
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node]);
    setSelectedId(id);
  }

  function onNodeClick(e, node) {
    e.stopPropagation();
    setSelectedId(node.id);
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === node.id })));
  }

  function onPaneClick(e) {
    addTextNode(e);
    setSelectedId(null);
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
  }

  function deleteSelected() {
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedNode) return;
    const id = newId();
    const clone = {
      ...selectedNode,
      id,
      position: {
        x: selectedNode.position.x + 20,
        y: selectedNode.position.y + 20,
      },
      selected: true,
      data: { ...selectedNode.data, editing: false },
    };
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), clone]);
    setSelectedId(id);
  }

  function updateSelected(patch) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    );
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedId) {
          const node = nodes.find((n) => n.id === selectedId);
          if (node && !node.data.editing) deleteSelected();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, nodes]);

  const showFormatBar = selectedNode && !selectedNode.data.editing;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#f0efe8",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          background: "#1e1e1e",
          borderRadius: 10,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          Click canvas to add text
        </span>
        {selectedNode && (
          <>
            <div style={sepStyle} />
            <button onClick={() => updateSelected({ editing: true })} style={btnStyle}>
              ✎ Edit
            </button>
            <button onClick={duplicateSelected} style={btnStyle}>
              ⧉ Duplicate
            </button>
            <button
              onClick={deleteSelected}
              style={{ ...btnStyle, color: "#f87171" }}
            >
              ✕ Delete
            </button>
          </>
        )}
      </div>

      {/* Format bar */}
      {showFormatBar && (
        <div
          style={{
            position: "absolute",
            top: 62,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            background: "#1e1e1e",
            borderRadius: 8,
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          }}
        >
          <select
            value={selectedNode.data.fontFamily}
            onChange={(e) => updateSelected({ fontFamily: e.target.value })}
            style={selectStyle}
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <div style={sepStyle} />

          <select
            value={selectedNode.data.fontSize}
            onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
            style={selectStyle}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div style={sepStyle} />

          <button
            onClick={() => updateSelected({ bold: !selectedNode.data.bold })}
            style={{
              ...fmtBtn,
              fontWeight: 700,
              background: selectedNode.data.bold
                ? "rgba(255,255,255,0.2)"
                : "none",
            }}
          >
            B
          </button>
          <button
            onClick={() => updateSelected({ italic: !selectedNode.data.italic })}
            style={{
              ...fmtBtn,
              fontStyle: "italic",
              background: selectedNode.data.italic
                ? "rgba(255,255,255,0.2)"
                : "none",
            }}
          >
            I
          </button>

          <div style={sepStyle} />

          {COLORS.map((c) => (
            <div
              key={c.hex}
              title={c.label}
              onClick={() => updateSelected({ color: c.hex })}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: c.hex,
                border: `2px solid ${
                  selectedNode.data.color === c.hex
                    ? "#fff"
                    : "rgba(255,255,255,0.2)"
                }`,
                cursor: "pointer",
                transform:
                  selectedNode.data.color === c.hex
                    ? "scale(1.25)"
                    : "scale(1)",
                transition: "transform 0.1s",
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Canvas */}
      <div ref={wrapperRef} style={{ width: "100%", height: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onPaneClick={onPaneClick}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView={false}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          panOnDrag={[1]}
          selectionOnDrag={false}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          deleteKeyCode={null}
          style={{ background: "transparent" }}
        >
          <Background color="#bbb" gap={20} size={1} variant="dots" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Hint */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          fontSize: 11,
          color: "rgba(0,0,0,0.35)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          background: "rgba(255,255,255,0.7)",
          padding: "4px 10px",
          borderRadius: 20,
        }}
      >
        Click to add · Double-click to edit · Select to format · Backspace to delete · Drag to move
      </div>
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

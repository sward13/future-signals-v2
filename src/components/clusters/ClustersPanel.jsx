/**
 * ClustersPanel — right-hand 320px panel of the Inputs workspace.
 * Hosts Manual/Suggested mode toggle, cluster list (list or card view),
 * new-cluster drop zone, and the cluster detail sliding panel.
 */
import { useState, useEffect, useRef } from "react";
import { c } from "../../styles/tokens.js";
import { SubtypeTag } from "../shared/Tag.jsx";
import { ClusterCard } from "./ClusterCard.jsx";
import { ClusterDetailPanel } from "./ClusterDetailPanel.jsx";
import { ClusterSuggestions } from "./ClusterSuggestions.jsx";

// ─── List-view row ─────────────────────────────────────────────────────────────

function ClusterListRow({ cluster, selected, onClick, isDropTarget, dropIsCopy, onDragOver, onDragLeave, onDrop }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 14px",
        borderBottom: `1px solid ${c.border}`,
        background: isDropTarget
          ? (dropIsCopy ? "#F0FDF4" : "#EFF6FF")
          : selected ? "#EFF6FF" : hovered ? "rgba(0,0,0,0.02)" : "transparent",
        cursor: "pointer",
        transition: "background 0.1s",
        outline: isDropTarget ? `2px solid ${dropIsCopy ? "#16a34a" : c.brand}` : "none",
        outlineOffset: -2,
        position: "relative",
      }}
    >
      {/* Name — flex, truncates */}
      <span style={{
        flex: 1,
        fontSize: 12,
        fontWeight: 500,
        color: selected ? c.brand : c.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        marginRight: 8,
      }}>
        {cluster.name}
      </span>

      {/* Type badge — 62px fixed container */}
      <div style={{ width: 62, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
        <SubtypeTag sub={cluster.subtype} />
      </div>

      {/* Input count or Move/Copy pill */}
      {isDropTarget ? (
        <span style={{
          fontSize: 10, fontWeight: 600, marginLeft: 8, flexShrink: 0,
          padding: "1px 7px", borderRadius: 4,
          background: dropIsCopy ? "#16a34a" : c.brand,
          color: "#fff",
        }}>
          {dropIsCopy ? "Copy" : "Move"}
        </span>
      ) : (
        <span style={{
          fontSize: 10,
          color: c.hint,
          marginLeft: 8,
          flexShrink: 0,
          minWidth: 24,
          textAlign: "right",
        }}>
          {cluster.input_ids?.length || 0}
        </span>
      )}
    </div>
  );
}

// ─── ClustersPanel ─────────────────────────────────────────────────────────────

export function ClustersPanel({
  clusters = [],
  inputs = [],
  onNewCluster,
  removeInputFromCluster,
  deleteCluster,
  showToast,
  dragIds = null,
  dragIsCopy = false,
  onDrop,
  onDropToNewCluster,
  // Optional — not yet passed by ProjectDetail; wired up in a future step.
  // When absent, accept/create actions in Suggested mode are no-ops.
  assignInputToCluster,
  addCluster,
}) {
  // Derive project-level identifiers from the clusters list.
  // Falls back to null when no clusters exist yet (Suggested mode is a no-op then).
  const projectId = clusters[0]?.project_id ?? null;
  const [mode, setMode] = useState("manual");    // "manual" | "suggested"
  const [view, setView] = useState("list");       // "list" | "card"
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [dropIsCopy,   setDropIsCopy]   = useState(false);
  const [dropOnZone,   setDropOnZone]   = useState(false);
  const panelRef = useRef(null);

  // Close detail panel on Escape or click outside the clusters panel
  useEffect(() => {
    if (!selectedClusterId) return;
    const onKey = (e) => { if (e.key === "Escape") setSelectedClusterId(null); };
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setSelectedClusterId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [selectedClusterId]);

  const selectedCluster = clusters.find((cl) => cl.id === selectedClusterId) || null;

  return (
    <div
      ref={panelRef}
      style={{
        width: 320,
        minWidth: 280,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: c.surfaceAlt,
        borderLeft: `1px solid ${c.border}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Panel header ─────────────────────────────────────── */}
      <div style={{ background: c.white, borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>

        {/* Row 1: label + new cluster button */}
        <div style={{ display: "flex", alignItems: "center", padding: "11px 14px 8px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.ink }}>Clusters</span>
          <button
            onClick={onNewCluster}
            style={{
              marginLeft: "auto",
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 12, fontWeight: 500, padding: "5px 11px",
              borderRadius: 6, border: "1px solid #BFDBFE",
              background: "#EFF6FF", color: c.brand,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            + New cluster
          </button>
        </div>

        {/* Row 2: mode toggle (left) + view toggle (right, hidden in Suggested) */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px 10px" }}>

          {/* Mode toggle */}
          <div style={{ display: "flex", border: `1px solid ${c.border}`, borderRadius: 6, overflow: "hidden" }}>
            {[
              { key: "manual",    label: "Manual" },
              { key: "suggested", label: "Suggested" },
            ].map(({ key, label }, i) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                style={{
                  padding: "4px 11px", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit", border: "none",
                  borderRight: i === 0 ? `1px solid ${c.border}` : "none",
                  background: mode === key ? c.brand : c.white,
                  color: mode === key ? c.white : c.muted,
                  transition: "background 0.1s, color 0.1s", whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle — hidden in Suggested mode */}
          {mode === "manual" && (
            <div style={{ marginLeft: "auto", display: "flex", border: `1px solid ${c.border}`, borderRadius: 6, overflow: "hidden" }}>
              {[
                { key: "list", icon: "☰" },
                { key: "card", icon: "⊞" },
              ].map(({ key, icon }, i) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  style={{
                    width: 28, height: 26, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                    border: "none",
                    borderRight: i === 0 ? `1px solid ${c.border}` : "none",
                    background: view === key ? c.brand : c.white,
                    color: view === key ? c.white : c.muted,
                    transition: "background 0.1s, color 0.1s",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Drop zone strip — manual mode only ───────────────── */}
      {mode === "manual" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDropOnZone(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOnZone(false); }}
          onDrop={(e) => { e.preventDefault(); setDropOnZone(false); onDropToNewCluster?.(); }}
          style={{
            margin: "10px 12px",
            padding: "8px 12px",
            border: `1px dashed ${dropOnZone ? c.brand : c.border}`,
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            flexShrink: 0,
            background: dropOnZone ? "#EFF6FF" : c.white,
            transition: "background 0.12s, border-color 0.12s",
          }}
        >
          <span style={{ fontSize: 11, color: dropOnZone ? c.brand : c.faint }}>
            ⊕ Drop inputs here to create a new cluster
          </span>
        </div>
      )}

      {/* ── Scrollable cluster list — manual mode ────────────── */}
      {mode === "manual" && (
        <div style={{ flex: 1, overflowY: "auto" }}>

          {clusters.length === 0 && (
            <div style={{ padding: "20px 14px", fontSize: 12, color: c.hint, fontStyle: "italic", textAlign: "center", lineHeight: 1.55 }}>
              No clusters yet.<br />Create one or drag inputs here.
            </div>
          )}

          {view === "list" && clusters.length > 0 && (
            <div>
              {clusters.map((cl) => (
                <ClusterListRow
                  key={cl.id}
                  cluster={cl}
                  selected={selectedClusterId === cl.id}
                  onClick={() => setSelectedClusterId(cl.id)}
                  isDropTarget={!!dragIds && dropTargetId === cl.id}
                  dropIsCopy={dropIsCopy}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!dragIds) return;
                    setDropTargetId(cl.id);
                    setDropIsCopy(e.altKey);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setDropTargetId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const isAlt = e.altKey;
                    setDropTargetId(null);
                    onDrop?.(cl.id, isAlt);
                  }}
                />
              ))}
            </div>
          )}

          {view === "card" && clusters.length > 0 && (
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
              {clusters.map((cl) => (
                <div
                  key={cl.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!dragIds) return;
                    setDropTargetId(cl.id);
                    setDropIsCopy(e.altKey);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setDropTargetId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const isAlt = e.altKey;
                    setDropTargetId(null);
                    onDrop?.(cl.id, isAlt);
                  }}
                >
                  <ClusterCard
                    cluster={cl}
                    selected={selectedClusterId === cl.id}
                    onClick={() => setSelectedClusterId(cl.id)}
                    isDropTarget={!!dragIds && dropTargetId === cl.id}
                    dropIsCopy={dropIsCopy}
                  />
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ── Suggested mode — AI suggestion panel ─────────────── */}
      {mode === "suggested" && (
        <ClusterSuggestions
          projectId={projectId}
          projectClusters={clusters}
          inputs={inputs}
          onAssignInput={assignInputToCluster}
          onCreateCluster={addCluster}
          showToast={showToast}
        />
      )}

      {/* ── Cluster detail panel (slides in from right) ──────── */}
      <ClusterDetailPanel
        open={!!selectedClusterId}
        cluster={selectedCluster}
        inputs={inputs}
        onClose={() => setSelectedClusterId(null)}
        onRemoveInput={removeInputFromCluster}
        onDelete={(id) => {
          deleteCluster(id);
          setSelectedClusterId(null);
          showToast?.("Cluster deleted", "success");
        }}
      />
    </div>
  );
}

/**
 * ClustersPanel — right-hand 320px panel of the Inputs workspace.
 * Hosts Manual/Suggested mode toggle, cluster list (list or card view),
 * new-cluster drop zone, and the cluster detail sliding panel.
 */
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { SubtypeTag } from "../shared/Tag.jsx";
import { ClusterCard } from "./ClusterCard.jsx";
import { ClusterDetailPanel } from "./ClusterDetailPanel.jsx";
import { ClusterSuggestions } from "./ClusterSuggestions.jsx";

/*
 * Remaining arbitrary values — no clean token equivalent exists yet:
 *
 *  h-[26px]           View toggle button height. 26px not on 4px grid.
 *  text-[13px/11px/10px]  Off Tailwind's type scale.
 *  rounded-[7px]      7px border-radius not in Tailwind's radius scale.
 *                     This is an intentional design tier (compact elements vs 8px containers)
 *                     — tokenize as --radius-btn when button components are migrated.
 *  [outline-offset:-2px]  Negative outline-offset; no built-in utility.
 */

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
      className={clsx(
        'flex items-center px-3.5 py-2 border-b border-border cursor-pointer transition-colors duration-100 relative',
        isDropTarget && dropIsCopy  && 'bg-green-25 outline outline-2 outline-green-600 [outline-offset:-2px]',
        isDropTarget && !dropIsCopy && 'bg-brand-bg outline outline-2 outline-brand [outline-offset:-2px]',
        !isDropTarget && selected   && 'bg-brand-bg',
        !isDropTarget && !selected  && hovered && 'bg-surface-hover',
      )}
    >
      {/* Name — flex, truncates */}
      <span className={clsx(
        'flex-1 text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap mr-2',
        selected ? 'text-brand' : 'text-ink',
      )}>
        {cluster.name}
      </span>

      {/* Type badge — 62px fixed container */}
      <div className="w-[62px] shrink-0 flex justify-end">
        <SubtypeTag sub={cluster.subtype} />
      </div>

      {/* Input count or Move/Copy pill */}
      {isDropTarget ? (
        <span className={clsx(
          'text-[10px] font-semibold ml-2 shrink-0 py-px px-1.75 rounded',
          dropIsCopy ? 'bg-green-600 text-white' : 'bg-brand text-white',
        )}>
          {dropIsCopy ? "Copy" : "Move"}
        </span>
      ) : (
        <span className="text-[10px] text-hint ml-2 shrink-0 min-w-6 text-right">
          {cluster.input_ids?.length || 0}
        </span>
      )}
    </div>
  );
}

// ─── ClustersPanel ─────────────────────────────────────────────────────────────

export function ClustersPanel({
  projectId = null,
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
  // Optional — wired up in a future step.
  // When absent, accept/create actions in Suggested mode are no-ops.
  assignInputToCluster,
  addCluster,
}) {
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
      className="w-80 min-w-[280px] shrink-0 flex flex-col bg-surface-alt border-l border-border relative overflow-hidden"
    >
      {/* ── Panel header ─────────────────────────────────────── */}
      <div className="bg-white border-b border-border shrink-0">

        {/* Row 1: label + new cluster button */}
        <div className="flex items-center pt-2.75 pb-2 px-3.5">
          <span className="text-ui font-semibold text-ink">Clusters</span>
          <button
            onClick={onNewCluster}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium py-1.25 px-2.75 rounded-md border border-brand-border bg-brand-bg text-brand cursor-pointer whitespace-nowrap"
          >
            + New cluster
          </button>
        </div>

        {/* Row 2: mode toggle (left) + view toggle (right, hidden in Suggested) */}
        <div className="flex items-center pb-2.5 px-3.5">

          {/* Mode toggle */}
          <div className="flex border border-border rounded-md overflow-hidden">
            {[
              { key: "manual",    label: "Manual" },
              { key: "suggested", label: "Suggested" },
            ].map(({ key, label }, i) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={clsx(
                  'px-2.75 py-1 text-xs font-medium cursor-pointer transition-colors duration-100 whitespace-nowrap',
                  i === 0 && 'border-r border-border',
                  mode === key ? 'bg-brand text-white' : 'bg-white text-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle — hidden in Suggested mode */}
          {mode === "manual" && (
            <div className="ml-auto flex border border-border rounded-md overflow-hidden">
              {[
                { key: "list", icon: "☰" },
                { key: "card", icon: "⊞" },
              ].map(({ key, icon }, i) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={clsx(
                    'w-7 h-[26px] flex items-center justify-center cursor-pointer text-ui transition-colors duration-100',
                    i === 0 && 'border-r border-border',
                    view === key ? 'bg-brand text-white' : 'bg-white text-muted',
                  )}
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
          className={clsx(
            'mx-3 my-2.5 px-3 py-2 rounded-[7px] flex items-center justify-center gap-1.5 shrink-0 transition-colors duration-[120ms]',
            dropOnZone
              ? 'border border-dashed border-brand bg-brand-bg'
              : 'border border-dashed border-border bg-white',
          )}
        >
          <span className={clsx('text-[11px]', dropOnZone ? 'text-brand' : 'text-faint')}>
            ⊕ Drop inputs here to create a new cluster
          </span>
        </div>
      )}

      {/* ── Scrollable cluster list — manual mode ────────────── */}
      {mode === "manual" && (
        <div className="flex-1 overflow-y-auto">

          {clusters.length === 0 && (
            <div className="px-3.5 py-5 text-xs text-hint italic text-center leading-body">
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
            <div className="px-3 py-2.5 flex flex-col gap-2.25">
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

/**
 * ClustersPanel — right-hand panel of the Cluster workspace.
 * Hosts Manual/Suggested mode toggle, search/filter controls,
 * cluster list (list or card view), and the cluster detail sliding panel.
 * Drop zone lives in the InputRail (ClusterScreen.jsx).
 */
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { SubtypeTag } from "../shared/Tag.jsx";
import { ClusterCard } from "./ClusterCard.jsx";
import { ClusterDetailPanel } from "./ClusterDetailPanel.jsx";
import { ClusterSuggestions } from "./ClusterSuggestions.jsx";
import { FilterDropdown } from "../shared/FilterDropdown.jsx";

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
  assignInputToCluster,
  addCluster,
  updateCluster,
  style,
  mode: modeProp = undefined,
  setMode: setModeProp = undefined,
}) {
  // Allow parent to lift mode state; fall back to internal state if props not provided
  const [_mode, _setMode] = useState("manual");
  const mode    = modeProp    !== undefined ? modeProp    : _mode;
  const setMode = setModeProp !== undefined ? setModeProp : _setMode;

  const [view, setView] = useState("list");       // "list" | "card"
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [dropIsCopy,   setDropIsCopy]   = useState(false);
  const [filterUntitled, setFilterUntitled] = useState(false);

  // Cluster search + filter state
  const [clusterSearch,          setClusterSearch]          = useState("");
  const [clusterFilterType,      setClusterFilterType]      = useState(null);
  const [clusterFilterHorizon,   setClusterFilterHorizon]   = useState(null);
  const [clusterFilterLikelihood,setClusterFilterLikelihood]= useState(null);
  const [openClusterFilter,      setOpenClusterFilter]      = useState(null);

  const panelRef = useRef(null);

  const isUntitled = (cl) => /^Untitled( \d+)?$/.test(cl.name);
  const untitledCount = clusters.filter(isUntitled).length;

  // Auto-clear filter when no untitled clusters remain (all renamed or deleted)
  useEffect(() => {
    if (untitledCount === 0) setFilterUntitled(false);
  }, [untitledCount]);

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

  const visibleClusters = clusters
    .filter(filterUntitled ? isUntitled : () => true)
    .filter((cl) => !clusterSearch          || cl.name.toLowerCase().includes(clusterSearch.toLowerCase()))
    .filter((cl) => !clusterFilterType      || cl.subtype   === clusterFilterType)
    .filter((cl) => !clusterFilterHorizon   || cl.horizon   === clusterFilterHorizon)
    .filter((cl) => !clusterFilterLikelihood|| cl.likelihood === clusterFilterLikelihood);

  return (
    <div
      ref={panelRef}
      style={style}
      className="w-80 min-w-[280px] shrink-0 flex flex-col bg-surface-alt border-l border-border relative overflow-hidden"
    >
      {/* ── Panel header ─────────────────────────────────────── */}
      <div className="bg-white border-b border-border shrink-0">

        {/* Row 1: label */}
        <div className="flex items-center pt-2.75 pb-2 px-3.5">
          <span className="text-ui font-semibold text-ink">Clusters</span>
        </div>

        {/* Row 2: mode toggle */}
        <div className="flex items-center pb-2.5 px-3.5">
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
        </div>
      </div>

      {/* ── Control bar — search + filters + view toggle, manual mode only ── */}
      {mode === "manual" && (
        <div className="px-3.5 py-2 border-b border-border bg-white shrink-0 flex items-center gap-1.5">
          {/* Search */}
          <input
            value={clusterSearch}
            onChange={(e) => setClusterSearch(e.target.value)}
            placeholder="Search clusters…"
            className="w-[200px] shrink-0 text-[11px] py-1 px-2.5 rounded-container border border-border bg-surface-alt text-ink placeholder:text-faint outline-none"
          />
            <FilterDropdown
              label="Type"
              value={clusterFilterType}
              options={["Trend", "Driver", "Tension"].map((v) => ({ value: v, label: v }))}
              onChange={setClusterFilterType}
              onClear={() => setClusterFilterType(null)}
              isOpen={openClusterFilter === "type"}
              onToggle={() => setOpenClusterFilter(openClusterFilter === "type" ? null : "type")}
              menuWidth={120}
            />
            <FilterDropdown
              label="Horizon"
              value={clusterFilterHorizon}
              options={["H1", "H2", "H3"].map((v) => ({ value: v, label: v }))}
              onChange={setClusterFilterHorizon}
              onClear={() => setClusterFilterHorizon(null)}
              isOpen={openClusterFilter === "horizon"}
              onToggle={() => setOpenClusterFilter(openClusterFilter === "horizon" ? null : "horizon")}
              menuWidth={100}
            />
            <FilterDropdown
              label="Likelihood"
              value={clusterFilterLikelihood}
              options={["Probable", "Plausible", "Possible"].map((v) => ({ value: v, label: v }))}
              onChange={setClusterFilterLikelihood}
              onClear={() => setClusterFilterLikelihood(null)}
              isOpen={openClusterFilter === "likelihood"}
              onToggle={() => setOpenClusterFilter(openClusterFilter === "likelihood" ? null : "likelihood")}
              menuWidth={130}
            />
            {/* View toggle — right-aligned */}
            <div className="ml-auto flex border border-border rounded-md overflow-hidden shrink-0">
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
        </div>
      )}

      {/* ── Untitled filter — manual mode, only when untitled clusters exist ── */}
      {mode === "manual" && untitledCount > 0 && (
        <div className="px-3.5 py-1.5 flex items-center border-b border-border bg-white shrink-0">
          <button
            onClick={() => setFilterUntitled((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-[11px] cursor-pointer bg-transparent border-none p-0 font-[inherit]',
              filterUntitled ? 'text-brand font-medium' : 'text-hint',
            )}
          >
            Untitled
            <span className={clsx(
              'text-[10px] px-1 py-px rounded-chip',
              filterUntitled ? 'bg-brand-bg text-brand' : 'bg-surface-alt text-faint',
            )}>
              {untitledCount}
            </span>
          </button>
          {filterUntitled && (
            <button
              onClick={() => setFilterUntitled(false)}
              className="ml-auto text-[10px] text-hint cursor-pointer bg-transparent border-none font-[inherit] p-0"
            >
              Show all
            </button>
          )}
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

          {clusters.length > 0 && visibleClusters.length === 0 && (
            <div className="px-3.5 py-5 text-xs text-hint italic text-center leading-body">
              No clusters match the current filters.
            </div>
          )}

          {view === "list" && clusters.length > 0 && (
            <div>
              {visibleClusters.map((cl) => (
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
            <div
              className="px-3 py-2.5 grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
            >
              {visibleClusters.map((cl) => (
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
        updateCluster={updateCluster}
      />
    </div>
  );
}

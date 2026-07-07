/**
 * ClustersPanel — right-hand panel of the Cluster workspace.
 * Hosts Manual/Suggested mode toggle, search/filter controls,
 * cluster list (list or card view), and the cluster detail sliding panel.
 * Drop zone lives in the InputRail (ClusterScreen.jsx).
 */
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { SubtypeTag, HorizTag } from "../shared/Tag.jsx";
import { ClusterCard } from "./ClusterCard.jsx";
import { ClusterDetailPanel } from "./ClusterDetailPanel.jsx";
import { ClusterSuggestions } from "./ClusterSuggestions.jsx";
import { FilterDropdown } from "../shared/FilterDropdown.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

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

function LikelihoodTag({ l }) {
  const map = {
    Probable:  "text-green-700 bg-green-50 border-green-border",
    Plausible: "text-blue-700 bg-blue-50 border-blue-border",
    Possible:  "text-amber-700 bg-amber-50 border-amber-border",
  };
  if (!l) return null;
  return (
    <span className={clsx(
      "text-[10px] px-1.75 py-px rounded-pill border whitespace-nowrap",
      map[l] || "text-hint border-border",
    )}>
      {l}
    </span>
  );
}

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
        'flex items-center gap-2 px-3.5 py-2 border-b border-border cursor-pointer transition-colors duration-100 relative',
        isDropTarget && dropIsCopy  && 'bg-green-25 outline outline-2 outline-green-600 [outline-offset:-2px]',
        isDropTarget && !dropIsCopy && 'bg-brand-bg outline outline-2 outline-brand [outline-offset:-2px]',
        !isDropTarget && selected   && 'bg-brand-bg',
        !isDropTarget && !selected  && hovered && 'bg-surface-hover',
      )}
    >
      {/* Name — flex, truncates */}
      <span className={clsx(
        'flex-1 min-w-0 text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap',
        selected ? 'text-brand' : 'text-ink',
      )}>
        {cluster.name}
      </span>

      {/* Type badge — 62px fixed container */}
      <div className="w-[62px] shrink-0 flex justify-start">
        <SubtypeTag sub={cluster.subtype} />
      </div>

      {/* Horizon — 52px fixed container (must match the "Horizon" header label's width, not just the badge) */}
      <div className="w-[52px] shrink-0">
        {cluster.horizon && <HorizTag h={cluster.horizon} />}
      </div>

      {/* Likelihood — 74px fixed container */}
      <div className="w-[74px] shrink-0">
        {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
      </div>

      {/* Input count or Move/Copy pill */}
      {isDropTarget ? (
        <span className={clsx(
          'text-[10px] font-semibold shrink-0 py-px px-1.75 rounded',
          dropIsCopy ? 'bg-green-600 text-white' : 'bg-brand text-white',
        )}>
          {dropIsCopy ? "Copy" : "Move"}
        </span>
      ) : (
        <span className="text-[10px] text-hint shrink-0 min-w-6 text-right">
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

  // Multi-select state for bulk delete
  const [selectedClusterIds,   setSelectedClusterIds]   = useState(new Set());
  const [lastCheckedClusterId, setLastCheckedClusterId] = useState(null);
  const [confirmBulkDelete,    setConfirmBulkDelete]    = useState(false);

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

  const handleClusterCheckboxClick = (id, e) => {
    e.stopPropagation();
    if (e.shiftKey && lastCheckedClusterId && lastCheckedClusterId !== id) {
      const idxA = visibleClusters.findIndex((cl) => cl.id === lastCheckedClusterId);
      const idxB = visibleClusters.findIndex((cl) => cl.id === id);
      if (idxA !== -1 && idxB !== -1) {
        const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        setSelectedClusterIds((prev) => {
          const next = new Set(prev);
          visibleClusters.slice(lo, hi + 1).forEach((cl) => next.add(cl.id));
          return next;
        });
      }
    } else {
      setSelectedClusterIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
    setLastCheckedClusterId(id);
  };

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

        {/* Mode toggle */}
        <div className="flex items-center pt-4 pb-2.5 px-3.5">
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
              {/* Column headers */}
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border-b border-border">
                <span className="flex-1 min-w-0 text-[10px] tracking-[0.07em] text-hint">Name</span>
                <span className="w-[62px] shrink-0 text-[10px] tracking-[0.07em] text-hint">Type</span>
                <span className="w-[52px] shrink-0 text-[10px] tracking-[0.07em] text-hint">Horizon</span>
                <span className="w-[74px] shrink-0 text-[10px] tracking-[0.07em] text-hint">Likelihood</span>
                <span className="min-w-6 shrink-0 text-[10px] tracking-[0.07em] text-hint text-right">#</span>
              </div>
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
                    isSelected={selectedClusterIds.has(cl.id)}
                    onCheckboxClick={(e) => handleClusterCheckboxClick(cl.id, e)}
                    anySelected={selectedClusterIds.size > 0}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Multi-select action bar — visible in both list and card view */}
          {selectedClusterIds.size > 0 && (
            <div className="sticky bottom-0 flex items-center gap-2 px-3.5 py-2 bg-white border-t border-border">
              <span className="text-[11px] text-muted flex-1">
                {selectedClusterIds.size} selected
              </span>
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="text-[11px] text-red-800 bg-transparent border border-red-border rounded-btn px-2.75 py-1 cursor-pointer font-[inherit] shrink-0 hover:bg-red-50"
              >
                Delete {selectedClusterIds.size}
              </button>
              <button
                onClick={() => { setSelectedClusterIds(new Set()); setLastCheckedClusterId(null); }}
                className="text-[11px] text-muted bg-transparent border-none cursor-pointer font-[inherit] shrink-0"
              >
                ✕ Clear
              </button>
            </div>
          )}

        </div>
      )}

      {confirmBulkDelete && (
        <ConfirmDialog
          title={`Delete ${selectedClusterIds.size} cluster${selectedClusterIds.size !== 1 ? "s" : ""}?`}
          message="This will permanently delete the selected clusters. Inputs linked to them will not be deleted. This cannot be undone."
          confirmLabel={`Delete ${selectedClusterIds.size}`}
          onConfirm={() => {
            const count = selectedClusterIds.size;
            [...selectedClusterIds].forEach((id) => deleteCluster(id));
            setSelectedClusterIds(new Set());
            setLastCheckedClusterId(null);
            setSelectedClusterId(null);
            setConfirmBulkDelete(false);
            showToast?.(`${count} cluster${count !== 1 ? "s" : ""} deleted`, "success");
          }}
          onClose={() => setConfirmBulkDelete(false)}
        />
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

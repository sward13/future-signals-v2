/**
 * ClusterRail — full-viewport-height, right-side, NON-MODAL rail for viewing a
 * cluster. Phase 2 of the cluster-workbench redesign: read-only view only, no
 * new write paths. It replaces ClusterDetailPanel's in-panel slide-in as the
 * cluster detail surface; the input table and cluster grid stay visible and
 * usable while it's open (no backdrop, content pads left on wide viewports).
 *
 * Editing is unchanged in this phase: the "Edit" button still opens the
 * existing modal ClusterDrawer. Moving editing into the rail (with draft/dirty
 * staging) is a later phase.
 *
 * Field rendering (badges, name, description, linked inputs with ✕ unlink)
 * mirrors ClusterDetailPanel.jsx so the two stay visually identical.
 *
 * @param {{ open: boolean, cluster: object|null, inputs: object[], onClose: () => void, onRemoveInput: (inputId, clusterId) => void, onDelete: (id) => void, updateCluster: (id, fields) => void }} props
 */
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { SubtypeTag, HorizTag } from "../shared/Tag.jsx";
import { ClusterDrawer } from "./ClusterDrawer.jsx";

const LIKELIHOOD_CLASSES = {
  Probable:  "text-green-700 bg-green-50 border-green-border",
  Plausible: "text-blue-700 bg-blue-50 border-blue-border",
  Possible:  "text-amber-700 bg-amber-50 border-amber-border",
};

function LikelihoodTag({ l }) {
  if (!l) return null;
  return (
    <span className={clsx(
      "text-[10px] px-1.75 py-0.5 rounded-pill border whitespace-nowrap",
      LIKELIHOOD_CLASSES[l] || "text-hint border-border",
    )}>
      {l}
    </span>
  );
}

export function ClusterRail({ open, cluster, inputs, onClose, onRemoveInput, onDelete, updateCluster }) {
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const closeBtnRef = useRef(null);
  const lastFocusedRef = useRef(null);

  // Reset editDrawerOpen when the selected cluster changes (swap between
  // clusters without closing), without an effect — adjust state during render.
  const [prevClusterId, setPrevClusterId] = useState(cluster?.id);
  if (cluster?.id !== prevClusterId) {
    setPrevClusterId(cluster?.id);
    setEditDrawerOpen(false);
  }

  // Escape-to-close + focus handling. The edit modal owns Escape while it's
  // open, so the rail only listens when it's the topmost surface.
  useEffect(() => {
    if (!open || editDrawerOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, editDrawerOpen, onClose]);

  // Move focus into the rail on open; return it to the trigger on close.
  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement;
      closeBtnRef.current?.focus();
    } else if (lastFocusedRef.current instanceof HTMLElement) {
      lastFocusedRef.current.focus();
      lastFocusedRef.current = null;
    }
  }, [open]);

  const linkedInputs = cluster ? inputs.filter((i) => cluster.input_ids?.includes(i.id)) : [];

  return (
    <>
      <aside
        role="dialog"
        aria-modal="false"
        aria-label={cluster ? `Cluster: ${cluster.name}` : "Cluster detail"}
        aria-hidden={!open}
        className={clsx(
          "fixed top-0 right-0 bottom-0 z-20 flex flex-col bg-white border-l border-border shadow-[-18px_0_34px_-22px_rgba(0,0,0,0.28)] transition-transform duration-[220ms] ease-in-out",
          "w-[400px] max-[860px]:left-0 max-[860px]:w-auto",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="pt-5 px-5 pb-3.5 border-b border-border flex items-center justify-between shrink-0">
          <div className="text-[11px] tracking-[0.02em] text-hint">Cluster</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditDrawerOpen(true)}
              className="bg-transparent border border-border-strong cursor-pointer font-[inherit] text-[11px] text-muted py-1 px-2.5 rounded-btn"
            >
              Edit
            </button>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              aria-label="Close"
              className="bg-transparent border-none cursor-pointer font-[inherit] text-base py-0.5 px-1.5 text-muted rounded-btn"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 px-5">
          {cluster && (
            <>
              {/* Badges */}
              <div className="flex gap-1.25 mb-2.5 flex-wrap">
                <SubtypeTag sub={cluster.subtype} />
                {cluster.horizon && <HorizTag h={cluster.horizon} />}
                {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
              </div>

              {/* Name */}
              <div className="text-lg font-semibold text-ink mb-2 leading-[1.3]">
                {cluster.name}
              </div>

              {/* Description */}
              <div className={clsx(
                "text-xs leading-[1.65] mb-4",
                cluster.description ? "text-muted not-italic" : "text-hint italic",
              )}>
                {cluster.description || "No description."}
              </div>

              <div className="h-px bg-border mb-3" />

              {/* Linked inputs */}
              <div className="text-[11px] tracking-[0.02em] text-hint mb-2">
                Linked inputs ({linkedInputs.length})
              </div>

              {linkedInputs.length === 0 ? (
                <div className="text-xs text-hint italic">No inputs linked yet.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {linkedInputs.map((inp) => (
                    <div key={inp.id} className="flex items-center gap-1.75 py-1.75 px-2.5 bg-surface-alt rounded-btn border border-border">
                      <span className="text-[8px] text-hint shrink-0">●</span>
                      <span className="text-xs text-ink flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {inp.name}
                      </span>
                      <button
                        onClick={() => onRemoveInput(inp.id, cluster.id)}
                        className="bg-transparent border-none cursor-pointer text-[11px] text-hint py-0 px-0.5 font-[inherit] shrink-0 leading-none"
                        title="Remove from cluster"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {cluster && (
        <ClusterDrawer
          open={editDrawerOpen}
          onClose={() => setEditDrawerOpen(false)}
          mode="edit"
          initialValues={{
            name: cluster.name,
            subtype: cluster.subtype,
            horizon: cluster.horizon,
            likelihood: cluster.likelihood,
            description: cluster.description,
          }}
          onSave={(fields) => { updateCluster(cluster.id, fields); setEditDrawerOpen(false); }}
          onDelete={() => { setEditDrawerOpen(false); onDelete(cluster.id); }}
          projectId={cluster.project_id}
          projectInputs={[]}
        />
      )}
    </>
  );
}

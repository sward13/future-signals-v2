/**
 * ClusterDetailPanel — slides in from the right within the 320px ClustersPanel.
 * Uses position:absolute / translateX so the inputs panel stays fully visible.
 *
 * Read-only: no destructive action lives here. Delete moved to ClusterDrawer's
 * edit-mode Danger Zone — see docs/edit-view-mode-consistency-audit-prompt.md.
 * The "X" unlink-input-from-cluster action stays here, unconditionally
 * available — a reversible relationship change, not a destructive one.
 *
 * @param {{ open: boolean, cluster: object|null, inputs: object[], onClose: () => void, onRemoveInput: (inputId, clusterId) => void, onDelete: (id) => void }} props
 */
import { useState } from "react";
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

export function ClusterDetailPanel({ open, cluster, inputs, onClose, onRemoveInput, onDelete, updateCluster }) {
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  // Reset editDrawerOpen when the selected cluster changes, without an
  // effect (react-hooks/set-state-in-effect) — adjust state during render.
  const [prevClusterId, setPrevClusterId] = useState(cluster?.id);
  if (cluster?.id !== prevClusterId) {
    setPrevClusterId(cluster?.id);
    setEditDrawerOpen(false);
  }

  const linkedInputs = cluster ? inputs.filter((i) => cluster.input_ids?.includes(i.id)) : [];

  return (
    <>
      <div
        className={clsx(
          "absolute inset-0 bg-white flex flex-col z-10 border-l border-border overflow-hidden transition-transform duration-[220ms] ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >

        {/* Header */}
        <div className="py-2.75 px-3.5 border-b border-border flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer font-[inherit] text-xs text-blue-700 p-0 flex items-center gap-1"
          >
            ← Clusters
          </button>
          <button
            onClick={() => setEditDrawerOpen(true)}
            className="bg-transparent border border-border-strong cursor-pointer font-[inherit] text-[11px] text-muted py-1 px-2.5 rounded-btn"
          >
            Edit
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-3.5 px-3.5 pb-2.5">

          {cluster && (
            <>
              {/* Badges */}
              <div className="flex gap-1.25 mb-2.5 flex-wrap">
                <SubtypeTag sub={cluster.subtype} />
                <HorizTag h={cluster.horizon} />
                {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
              </div>

              {/* Name */}
              <div className="text-base font-semibold text-ink mb-2 leading-[1.3]">
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
      </div>

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

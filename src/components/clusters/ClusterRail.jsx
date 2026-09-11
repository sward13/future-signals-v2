/**
 * ClusterRail — full-viewport-height, right-side, NON-MODAL rail for a cluster.
 *
 * Phase 2 introduced this as a read-only view. Phase 3 moves editing INTO the
 * rail: the "Edit" button now flips the rail body into an inline edit form
 * (name / subtype / horizon / likelihood / description) instead of opening the
 * modal ClusterDrawer. Edits are staged in local draft state and committed only
 * on an explicit "Save changes". There is no unsaved-changes navigate-away
 * guard yet — switching clusters or closing while editing discards the draft
 * (matching prior behaviour); that guard is a later phase.
 *
 * Scope note: this only replaces the Cluster-tab edit flow. System Map's
 * separate ClusterDetailDrawer.jsx is intentionally left untouched — the two
 * were never consolidated and that remains a separate decision.
 *
 * Field markup mirrors ClusterDrawer.jsx so the inline form matches the form it
 * replaces. Read-view rendering mirrors ClusterDetailPanel.jsx.
 *
 * @param {{ open: boolean, cluster: object|null, inputs: object[], onClose: () => void, onRemoveInput: (inputId, clusterId) => void, onDelete: (id) => void, updateCluster: (id, fields) => void }} props
 */
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { SubtypeTag, HorizTag } from "../shared/Tag.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

const SUBTYPES = [
  { id: "Trend",   label: "Trend",   desc: "A directional shift gaining momentum." },
  { id: "Driver",  label: "Driver",  desc: "A force accelerating or shaping change." },
  { id: "Tension", label: "Tension", desc: "A conflict or pressure between forces." },
];
const HORIZONS = ["H1", "H2", "H3"];
const LIKELIHOODS = ["Possible", "Plausible", "Probable"];

const HORIZON_CLASSES = {
  H1: "border-green-border bg-green-50 text-green-700",
  H2: "border-blue-border bg-blue-50 text-blue-700",
  H3: "border-amber-border bg-amber-50 text-amber-700",
};

const LIKELIHOOD_CLASSES = {
  Probable:  "text-green-700 bg-green-50 border-green-border",
  Plausible: "text-blue-700 bg-blue-50 border-blue-border",
  Possible:  "text-amber-700 bg-amber-50 border-amber-border",
};

const inpClass = "w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-ui font-[inherit] outline-none box-border";
const taClass = clsx(inpClass, "resize-none leading-[1.55]");
const btnSecClass = "py-2.25 px-4.5 rounded-container bg-transparent text-muted border border-border-strong text-ui cursor-pointer font-[inherit]";
const btnPClass = "py-2.5 px-5.5 rounded-container bg-brand text-white border-none text-ui font-medium cursor-pointer font-[inherit]";
const flClass = "text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5";

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

function fieldsFromCluster(cluster) {
  return {
    name:        cluster?.name        || "",
    subtype:     cluster?.subtype     || "Trend",
    horizon:     cluster?.horizon     || "H1",
    likelihood:  cluster?.likelihood  || "Plausible",
    description: cluster?.description || "",
  };
}

export function ClusterRail({ open, cluster, inputs, onClose, onRemoveInput, onDelete, updateCluster }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(() => fieldsFromCluster(cluster));
  const [nameError, setNameError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeBtnRef = useRef(null);
  const lastFocusedRef = useRef(null);

  // Reset edit state when the selected cluster changes (swap between clusters
  // without closing), without an effect — adjust state during render.
  const [prevClusterId, setPrevClusterId] = useState(cluster?.id);
  if (cluster?.id !== prevClusterId) {
    setPrevClusterId(cluster?.id);
    setEditing(false);
    setNameError(false);
    setConfirmDelete(false);
    setFields(fieldsFromCluster(cluster));
  }

  const set = (key, val) => setFields((f) => ({ ...f, [key]: val }));

  const handleEdit = () => {
    setFields(fieldsFromCluster(cluster));
    setNameError(false);
    setEditing(true);
  };
  const handleCancel = () => {
    setFields(fieldsFromCluster(cluster));
    setNameError(false);
    setEditing(false);
  };
  const handleSave = () => {
    if (!fields.name.trim()) { setNameError(true); return; }
    updateCluster(cluster.id, {
      name: fields.name.trim(),
      subtype: fields.subtype,
      horizon: fields.horizon,
      likelihood: fields.likelihood,
      description: fields.description,
    });
    setEditing(false);
  };

  // Escape: cancel the edit if editing, otherwise close the rail. The delete
  // confirm dialog owns Escape while it's open.
  useEffect(() => {
    if (!open || confirmDelete) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (editing) handleCancel();
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, confirmDelete, onClose]);

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
          <div className="text-[11px] tracking-[0.02em] text-hint">
            {editing ? "Edit cluster" : "Cluster"}
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={handleEdit}
                className="bg-transparent border border-border-strong cursor-pointer font-[inherit] text-[11px] text-muted py-1 px-2.5 rounded-btn"
              >
                Edit
              </button>
            )}
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
          {cluster && !editing && (
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

          {cluster && editing && (
            <>
              {/* Name */}
              <div className="mb-4.5">
                <div className={flClass}>Cluster name <span className="ml-0.5">*</span></div>
                <input
                  className={clsx(inpClass, nameError && "border-red-border")}
                  type="text"
                  value={fields.name}
                  onChange={(e) => { set("name", e.target.value); setNameError(false); }}
                  placeholder="e.g. Regulatory Fragmentation"
                  autoFocus
                />
                {nameError && <div className="text-[11px] text-red-800 mt-1">Cluster name is required.</div>}
              </div>

              {/* Subtype — 3-card selector */}
              <div className="mb-4.5">
                <div className={flClass}>Subtype</div>
                <div className="grid grid-cols-3 gap-2">
                  {SUBTYPES.map(({ id, label, desc }) => {
                    const on = fields.subtype === id;
                    return (
                      <button
                        key={id}
                        onClick={() => set("subtype", id)}
                        className={clsx(
                          "p-2.5 rounded-container border text-left cursor-pointer font-[inherit]",
                          on ? "border-ink bg-black/[0.02]" : "border-border bg-white",
                        )}
                      >
                        <div className="text-[11px] font-medium text-ink mb-[3px]">{label}</div>
                        <div className="text-[10px] text-muted leading-[1.4]">{desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horizon */}
              <div className="mb-4.5">
                <div className={flClass}>Horizon</div>
                <div className="flex gap-2">
                  {HORIZONS.map((h) => {
                    const on = fields.horizon === h;
                    return (
                      <button
                        key={h}
                        onClick={() => set("horizon", h)}
                        className={clsx(
                          "py-1.5 px-5.5 rounded-[20px] border text-xs cursor-pointer font-[inherit]",
                          on ? clsx(HORIZON_CLASSES[h], "font-semibold") : "border-border bg-white text-muted font-normal",
                        )}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Likelihood */}
              <div className="mb-4.5">
                <div className={flClass}>Likelihood</div>
                <div className="flex gap-2">
                  {LIKELIHOODS.map((l) => {
                    const on = fields.likelihood === l;
                    return (
                      <button
                        key={l}
                        onClick={() => set("likelihood", l)}
                        className={clsx(
                          "py-1.5 px-4 rounded-[20px] border text-xs cursor-pointer font-[inherit]",
                          on ? "border-border-strong bg-ink text-white font-medium" : "border-border bg-white text-muted font-normal",
                        )}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="mb-2">
                <div className={flClass}>Description</div>
                <textarea
                  className={taClass}
                  rows={4}
                  value={fields.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="e.g. Diverging national frameworks create compliance complexity across jurisdictions…"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer — edit mode only: Save/Cancel row, then Danger Zone below a
            second border (matches ClusterDrawer's convention). */}
        {cluster && editing && (
          <div className="shrink-0">
            <div className="pt-3.5 px-5 pb-4 border-t border-border flex items-center justify-end gap-2">
              <button onClick={handleCancel} className={btnSecClass}>Cancel</button>
              <button
                onClick={handleSave}
                className={clsx(btnPClass, fields.name.trim() ? "opacity-100" : "opacity-40")}
              >
                Save changes
              </button>
            </div>
            <div className="px-5 pb-4 border-t border-border">
              <div className="pt-3.5 flex items-center justify-between">
                <div className="text-[11px] text-hint">Danger zone</div>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-[11px] py-1 px-3 rounded-btn border border-red-border bg-transparent text-red-800 cursor-pointer font-[inherit]"
                >
                  Delete cluster
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {confirmDelete && cluster && (
        <ConfirmDialog
          title={`Delete "${cluster.name}"?`}
          message="This will permanently delete the cluster. Inputs linked to it will not be deleted. This cannot be undone."
          onConfirm={() => { setConfirmDelete(false); onDelete(cluster.id); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

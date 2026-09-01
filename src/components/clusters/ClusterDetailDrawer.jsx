/**
 * ClusterDetailDrawer — right-side drawer showing full cluster detail with read/edit mode.
 * Shows name, subtype, horizon, likelihood, description, and linked inputs.
 * This is System Map's own, independent cluster-detail implementation —
 * separate from the Cluster tab's ClusterDetailPanel.jsx/ClusterDrawer.jsx
 * pair. Not consolidated with that pair in this pass (a separate future
 * decision); patched in place instead.
 *
 * Read-only: no destructive action lives in view mode. Delete moved to the
 * edit-mode Danger Zone — see docs/edit-view-mode-consistency-audit-prompt.md.
 * The linked-input "×" unlink action was found edit-only here, which
 * disagreed with the Cluster tab's ClusterDetailPanel.jsx (where the
 * equivalent action is unconditional in view mode). Aligned here: unlink is
 * now available in both view and edit mode, since it's a reversible
 * relationship change, not a destructive one. "+ Add input" (AssignPicker)
 * stays edit-only — it has no unconditional-in-view precedent in the
 * Cluster tab pair to align with, so it wasn't moved. The "Related inputs"
 * search panel (Add/Dismiss) was already unconditional in both modes before
 * this pass — no change needed there.
 *
 * @param {{ clusterId: string|null, clusters: object[], inputs: object[], onClose: () => void, onSave: (id, fields) => void, onRemoveInput: (inputId, clusterId) => void, onAssignInput: (inputId, clusterId) => void }} props
 */
import { useState } from "react";
import clsx from "clsx";
import { SubtypeTag, HorizTag, Tag } from "../shared/Tag.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";
import { supabase } from "../../lib/supabase.js";

const SUBTYPES = ["Trend", "Driver", "Tension"];
const HORIZONS  = ["H1", "H2", "H3"];
const LIKELIHOODS = ["Possible", "Plausible", "Probable"];

const HORIZON_CLASSES = {
  H1: "border-green-border bg-green-50 text-green-700",
  H2: "border-blue-border bg-blue-50 text-blue-700",
  H3: "border-amber-border bg-amber-50 text-amber-700",
};

function LikelihoodTag({ l }) {
  const map = {
    Probable:  ["var(--color-green-700)",  "var(--color-green-50)",  "var(--color-green-border)"],
    Plausible: ["var(--color-blue-700)",   "var(--color-blue-50)",   "var(--color-blue-border)"],
    Possible:  ["var(--color-amber-700)",  "var(--color-amber-50)",  "var(--color-amber-border)"],
  };
  const [col, bg, brd] = map[l] || ["var(--color-hint)", "transparent", "var(--color-border)"];
  return <Tag label={l} color={col} bg={bg} border={brd} />;
}

function AssignPicker({ availableInputs, onAssign, onClose }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[350]" />
      <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-pill shadow-[0_6px_24px_rgba(0,0,0,0.12)] min-w-[260px] z-[351] overflow-hidden">
        {availableInputs.length === 0 ? (
          <div className="py-3 px-3.5 text-xs text-hint">All project inputs already linked.</div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto">
            {availableInputs.map((i) => (
              <button
                key={i.id}
                onClick={() => onAssign(i.id)}
                className="block w-full py-2.25 px-3.5 bg-transparent border-none border-b border-border text-left cursor-pointer font-[inherit] text-xs text-ink"
              >
                {i.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const RELATED_CATEGORIES = [
  { key: "likely",     label: "Likely matches",  dot: "var(--color-green-700)",  desc: "Supports or extends"     },
  { key: "possible",   label: "Possible matches", dot: "var(--color-blue-700)",   desc: "Partial or ambiguous"   },
  { key: "challenges", label: "Challenges",       dot: "var(--color-amber-700)",  desc: "Complicates or strains" },
];

const inpClass = "w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-ui font-[inherit] outline-none box-border";
const taClass = clsx(inpClass, "resize-none leading-[1.55]");
const btnPClass = "py-2.5 px-5.5 rounded-container bg-brand text-white border-none text-ui font-medium cursor-pointer font-[inherit]";
const btnSecClass = "py-2.25 px-4.5 rounded-container bg-transparent text-muted border border-border-strong text-ui cursor-pointer font-[inherit]";
const flClass = "text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5";

export function ClusterDetailDrawer({ clusterId, clusters, inputs, onClose, onSave, onRemoveInput, onAssignInput, onDelete, startInEditMode = false }) {
  const cluster = clusters.find((cl) => cl.id === clusterId) || null;

  const [editing, setEditing] = useState(!!startInEditMode);
  const [fields, setFields] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Related inputs panel state
  const [relatedResults,    setRelatedResults]    = useState(null);   // null = never run
  const [loadingRelated,    setLoadingRelated]    = useState(false);
  const [relatedError,      setRelatedError]      = useState(null);
  const [dismissedIds,      setDismissedIds]      = useState(new Set());

  // Re-seed fields (and reset transient UI state) when the selected cluster
  // changes, without an effect (react-hooks/set-state-in-effect) — adjust
  // state during render.
  const [prevClusterId, setPrevClusterId] = useState(clusterId);
  if (clusterId !== prevClusterId) {
    setPrevClusterId(clusterId);
    setFields(cluster ? {
      name:        cluster.name        || "",
      subtype:     cluster.subtype     || "Trend",
      horizon:     cluster.horizon     || "H1",
      likelihood:  cluster.likelihood  || "Plausible",
      description: cluster.description || "",
    } : {});
    setEditing(!!startInEditMode);
    setPickerOpen(false);
    setConfirmDelete(false);
    // Reset related panel when a different cluster is opened
    setRelatedResults(null);
    setLoadingRelated(false);
    setRelatedError(null);
    setDismissedIds(new Set());
  }

  if (!cluster) return null;

  const set = (key, val) => setFields((f) => ({ ...f, [key]: val }));

  const linkedInputs = inputs.filter((i) => cluster.input_ids?.includes(i.id));
  const projectInputs = inputs.filter((i) => i.project_id === cluster.project_id);
  const availableInputs = projectInputs.filter((i) => !cluster.input_ids?.includes(i.id));

  const handleSave = () => { onSave(cluster.id, fields); setEditing(false); };
  const handleCancel = () => {
    setFields({ name: cluster.name || "", subtype: cluster.subtype || "Trend", horizon: cluster.horizon || "H1", likelihood: cluster.likelihood || "Plausible", description: cluster.description || "" });
    setEditing(false);
  };

  const handleFindRelated = async () => {
    if (loadingRelated) return;
    setLoadingRelated(true);
    setRelatedError(null);
    setDismissedIds(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("find-related-inputs", {
        body: { cluster_id: cluster.id, project_id: cluster.project_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setRelatedResults(data);
    } catch (err) {
      setRelatedError(err.message || "Failed to find related inputs.");
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleAddFromRelated = (result) => {
    onAssignInput(result.input_id, cluster.id);
    setDismissedIds((prev) => new Set([...prev, result.input_id]));
  };

  const handleDismissFromRelated = (inputId) => {
    setDismissedIds((prev) => new Set([...prev, inputId]));
  };

  const totalRelatedVisible = relatedResults
    ? RELATED_CATEGORIES.flatMap((cat) => relatedResults[cat.key] || [])
        .filter((r) => !dismissedIds.has(r.input_id)).length
    : 0;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/25 z-[300]" />
      <div
        className="fixed top-0 right-0 bottom-0 w-[460px] bg-white border-l border-border z-[301] flex flex-col"
        style={{ animation: "drawerSlideIn 0.28s ease" }}
      >
        {/* Header */}
        <div className="pt-4.5 px-6 pb-3.5 border-b border-border flex items-center gap-2 shrink-0">
          <SubtypeTag sub={cluster.subtype} />
          <div className="flex-1" />
          {!editing && (
            <button onClick={() => setEditing(true)} className={clsx(btnSecClass, "text-[11px] py-1.25 px-3.5")}>Edit</button>
          )}
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer font-[inherit] text-base py-0.5 px-1.5 text-muted rounded-btn">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-5 px-6">

          {/* Name */}
          <div className="mb-4">
            {editing ? (
              <>
                <div className={flClass}>Cluster name</div>
                <input className={inpClass} value={fields.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </>
            ) : (
              <div className="text-[17px] font-medium text-ink">{cluster.name}</div>
            )}
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <HorizTag h={cluster.horizon} />
            {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
          </div>

          {/* Subtype (edit) */}
          {editing && (
            <div className="mb-4">
              <div className={flClass}>Subtype</div>
              <div className="flex gap-2">
                {SUBTYPES.map((s) => {
                  const on = fields.subtype === s;
                  return (
                    <button
                      key={s}
                      onClick={() => set("subtype", s)}
                      className={clsx(
                        "py-1.25 px-4 rounded-[20px] border text-[11px] cursor-pointer font-[inherit]",
                        on ? "border-ink bg-ink text-white" : "border-border bg-white text-muted",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Horizon (edit) */}
          {editing && (
            <div className="mb-4">
              <div className={flClass}>Horizon</div>
              <div className="flex gap-2">
                {HORIZONS.map((h) => {
                  const on = fields.horizon === h;
                  return (
                    <button
                      key={h}
                      onClick={() => set("horizon", h)}
                      className={clsx(
                        "py-1.25 px-4.5 rounded-[20px] border text-xs cursor-pointer font-[inherit]",
                        on ? clsx(HORIZON_CLASSES[h], "font-semibold") : "border-border bg-white text-muted font-normal",
                      )}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Likelihood (edit) */}
          {editing && (
            <div className="mb-4">
              <div className={flClass}>Likelihood</div>
              <div className="flex gap-2">
                {LIKELIHOODS.map((l) => {
                  const on = fields.likelihood === l;
                  return (
                    <button
                      key={l}
                      onClick={() => set("likelihood", l)}
                      className={clsx(
                        "py-1.25 px-3.5 rounded-[20px] border text-[11px] cursor-pointer font-[inherit]",
                        on ? "border-border-strong bg-ink text-white" : "border-border bg-white text-muted",
                      )}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-5">
            <div className="text-[11px] tracking-[0.02em] text-hint mb-1.5">Description</div>
            {editing ? (
              <textarea className={taClass} rows={3} value={fields.description} onChange={(e) => set("description", e.target.value)} placeholder="What does this cluster represent?" />
            ) : cluster.description ? (
              <div className="text-xs text-muted leading-[1.65]">{cluster.description}</div>
            ) : (
              <span className="text-xs text-hint italic">No description.</span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border mb-4" />

          {/* Linked inputs */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[11px] tracking-[0.02em] text-hint">
                Linked inputs ({linkedInputs.length})
              </div>
              {editing && (
                <div className="relative">
                  <button
                    onClick={() => setPickerOpen((s) => !s)}
                    className={clsx(btnSecClass, "text-[11px] py-1 px-2.5")}
                  >
                    + Add input
                  </button>
                  {pickerOpen && (
                    <AssignPicker
                      availableInputs={availableInputs}
                      onAssign={(inputId) => { onAssignInput(inputId, cluster.id); setPickerOpen(false); }}
                      onClose={() => setPickerOpen(false)}
                    />
                  )}
                </div>
              )}
            </div>
            {linkedInputs.length === 0 ? (
              <div className="text-xs text-hint italic">No inputs linked yet.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {linkedInputs.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 py-2 px-3 bg-surface-alt border border-border rounded-container">
                    <span className="text-[10px] text-hint">◎</span>
                    <span className="text-xs text-ink flex-1">{i.name}</span>
                    {i.horizon && <HorizTag h={i.horizon} />}
                    <button
                      onClick={() => onRemoveInput(i.id, cluster.id)}
                      className="bg-transparent border-none text-hint text-sm cursor-pointer py-0 px-0.5 font-[inherit]"
                      title="Remove from cluster"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border mt-1 mb-3.5" />

          {/* ── Related inputs ──────────────────────────────────── */}
          <div className="mb-2">

            {/* Section header */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <div className="text-[11px] tracking-[0.02em] text-hint">
                  🔍 Related inputs
                </div>
                {relatedResults !== null && totalRelatedVisible > 0 && (
                  <span className="text-[10px] py-px px-1.5 rounded-container bg-black/[0.06] text-muted">
                    {totalRelatedVisible}
                  </span>
                )}
              </div>
              {linkedInputs.length > 0 && (
                relatedResults !== null && !loadingRelated ? (
                  <button onClick={handleFindRelated} className="text-[11px] py-1.75 px-3 rounded-btn bg-transparent text-muted border-none cursor-pointer font-[inherit]">Re-run</button>
                ) : (
                  <button
                    onClick={handleFindRelated}
                    disabled={loadingRelated}
                    className={clsx(btnSecClass, "text-[11px] py-1 px-2.5")}
                  >
                    Find related
                  </button>
                )
              )}
            </div>

            {/* Body */}
            {linkedInputs.length === 0 ? (
              <div className="text-[11px] text-hint italic">
                Add inputs to this cluster before finding related ones.
              </div>
            ) : loadingRelated ? (
              <div className="py-4.5 px-3.5 bg-surface-alt border border-border rounded-container flex items-center gap-2">
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  border: "2px solid var(--color-border)", borderTopColor: "var(--color-muted)",
                  animation: "relatedSpinner 0.7s linear infinite",
                }} />
                <span className="text-xs text-muted">Searching…</span>
                <style>{`@keyframes relatedSpinner { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : relatedError ? (
              <div className="py-2.5 px-3 bg-red-50 border border-red-border rounded-container text-[11px] text-red-800">
                {relatedError}
              </div>
            ) : relatedResults === null ? (
              <div className="py-5 px-4 bg-surface-alt border border-border rounded-container text-center">
                <div className="text-[11px] text-muted leading-[1.55] mb-3">
                  Search across all project inputs to find what supports, extends, or challenges this cluster.
                </div>
                <button onClick={handleFindRelated} className={clsx(btnPClass, "text-[11px] py-1.5 px-4")}>
                  Find related inputs
                </button>
              </div>
            ) : totalRelatedVisible === 0 ? (
              <div className="py-3 px-3.5 bg-surface-alt border border-border rounded-container text-xs text-muted text-center">
                ✓ All suggestions reviewed.
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {RELATED_CATEGORIES.map(({ key, label, dot, desc }) => {
                  const items = (relatedResults[key] || []).filter((r) => !dismissedIds.has(r.input_id));
                  if (items.length === 0) return null;
                  return (
                    <div key={key}>
                      {/* Category header */}
                      <div className="flex items-center gap-1.5 mb-1.75">
                        <span className="w-1.75 h-1.75 rounded-full inline-block shrink-0" style={{ background: dot }} />
                        <span className="text-[11px] tracking-[0.02em] text-ink font-medium">
                          {label}
                        </span>
                        <span className="text-[10px] text-hint italic ml-auto">
                          {desc}
                        </span>
                      </div>
                      {/* Result cards */}
                      <div className="flex flex-col gap-1.5">
                        {items.map((result) => (
                          <div key={result.input_id} className="py-2.5 px-3 bg-white border border-border rounded-container">
                            <div className="text-[13px] font-medium text-ink mb-1 leading-[1.35]">
                              {result.title}
                            </div>
                            <div className="text-[11px] text-muted leading-[1.55] mb-2.25 line-clamp-2">
                              {result.rationale}
                            </div>
                            <div className="flex gap-1.25">
                              <button
                                onClick={() => handleAddFromRelated(result)}
                                className="text-[11px] py-0.75 px-2.75 rounded-[5px] bg-brand text-white border-none cursor-pointer font-[inherit] font-medium"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => handleDismissFromRelated(result.input_id)}
                                className="text-[11px] py-0.75 px-2.25 rounded-btn bg-transparent text-muted border-none cursor-pointer font-[inherit]"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer (edit mode): Cancel/Save row, then Danger Zone row below a
            second border — matches EditProjectDrawer.jsx's convention. */}
        {editing && (
          <div className="shrink-0">
            <div className="pt-3.5 px-6 pb-5 border-t border-border flex items-center justify-end gap-2">
              <button onClick={handleCancel} className={btnSecClass}>Cancel</button>
              <button onClick={handleSave} className={btnPClass}>Save changes</button>
            </div>
            {onDelete && (
              <div className="px-6 pb-5 border-t border-border">
                <div className="pt-3.5 flex items-center justify-between">
                  <div className="text-[11px] text-hint">Danger zone</div>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-[11px] py-1.25 px-3 rounded-[6px] border border-red-border bg-transparent text-red-800 cursor-pointer font-[inherit]"
                  >
                    Delete cluster
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${cluster.name}"?`}
          message="This will permanently delete the cluster. Inputs linked to it will not be deleted. This cannot be undone."
          onConfirm={() => { setConfirmDelete(false); onDelete(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

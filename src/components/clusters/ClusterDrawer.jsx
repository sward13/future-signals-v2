/**
 * ClusterDrawer — slide-over drawer for creating or editing a cluster.
 * Fields: name (only required field), subtype (3-card selector), horizon (pill), likelihood (pill), description, linked inputs (create mode only).
 *
 * Danger Zone (delete) lives here, in edit mode only — not in
 * ClusterDetailPanel, the read/view surface. See
 * docs/edit-view-mode-consistency-audit-prompt.md. Matches
 * EditProjectDrawer.jsx's convention: below the Cancel/Save row, in its own
 * bordered footer section.
 *
 * @param {{ open: boolean, onClose: () => void, onSave: (fields: object) => void, onDelete?: () => void, projectId: string, projectInputs: object[] }} props
 */
import { useState, useEffect } from "react";
import clsx from "clsx";
import { StrengthDot, HorizTag, SubtypeTag } from "../shared/Tag.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";

const SUBTYPES = [
  { id: "Trend",   label: "Trend",   desc: "A directional shift gaining momentum." },
  { id: "Driver",  label: "Driver",  desc: "A force accelerating or shaping change." },
  { id: "Tension", label: "Tension", desc: "A conflict or pressure between forces." },
];

const HORIZONS = ["H1", "H2", "H3"];
const LIKELIHOODS = ["Possible", "Plausible", "Probable"];

const EMPTY = { name: "", subtype: "Trend", horizon: "H1", likelihood: "Plausible", description: "" };

const HORIZON_CLASSES = {
  H1: "border-green-border bg-green-50 text-green-700",
  H2: "border-blue-border bg-blue-50 text-blue-700",
  H3: "border-amber-border bg-amber-50 text-amber-700",
};

const inpClass = "w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-ui font-[inherit] outline-none box-border";
const taClass = clsx(inpClass, "resize-none leading-[1.55]");
const btnSecClass = "py-2.25 px-4.5 rounded-container bg-transparent text-muted border border-border-strong text-ui cursor-pointer font-[inherit]";
const btnPClass = "py-2.5 px-5.5 rounded-container bg-brand text-white border-none text-ui font-medium cursor-pointer font-[inherit]";
const flClass = "text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5";
const fhClass = "text-[11px] text-hint mb-1.5 italic leading-[1.45]";
const legendClass = "text-[11px] text-hint mt-1";

export function ClusterDrawer({ open, onClose, onSave, onDelete, projectId, projectInputs = [], preselectedInputIds = [], onAddInput, projects = [], initialValues, mode = "create" }) {
  const [fields, setFields] = useState(EMPTY);
  const [nameError, setNameError] = useState(false);
  const [selectedInputIds, setSelectedInputIds] = useState([]);
  const [addInputLayerOpen, setAddInputLayerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Seed fields from initialValues (edit mode) or EMPTY (create mode) on each open
  useEffect(() => {
    if (open) {
      setFields(initialValues ?? EMPTY);
      setNameError(false);
      setSelectedInputIds([...preselectedInputIds]);
      setConfirmDelete(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => { setFields(EMPTY); setNameError(false); setSelectedInputIds([]); };
  const handleClose = () => { reset(); onClose(); };
  const set = (key, val) => setFields((f) => ({ ...f, [key]: val }));

  const toggleInput = (id) =>
    setSelectedInputIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSave = () => {
    if (!fields.name.trim()) { setNameError(true); return; }
    if (mode === "edit") {
      onSave({ name: fields.name.trim(), subtype: fields.subtype, horizon: fields.horizon, likelihood: fields.likelihood, description: fields.description });
    } else {
      onSave({ ...fields, name: fields.name.trim(), project_id: projectId, input_ids: selectedInputIds });
    }
    reset();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/25 z-[300]"
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-[420px] bg-white border-l border-border z-[301] flex flex-col"
        style={{ animation: "drawerSlideIn 0.28s ease" }}
      >
        {/* Header */}
        <div className="pt-5 px-6 pb-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <div className="text-[11px] tracking-[0.02em] text-hint mb-0.5">
              {mode === "edit" ? "Edit cluster" : "New cluster"}
            </div>
            <div className="text-[17px] font-medium text-ink">
              {mode === "edit" ? "Edit cluster" : "Build a cluster"}
            </div>
          </div>
          <button onClick={handleClose} className="bg-transparent border-none cursor-pointer font-[inherit] text-base py-0.5 px-1.5 text-muted rounded-btn">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-5 px-6">

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
            <div className={legendClass}>* required</div>
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
          <div className="mb-4.5">
            <div className={flClass}>Description</div>
            <div className={fhClass}>What does this cluster represent? What drives it?</div>
            <textarea
              className={taClass}
              rows={4}
              value={fields.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Diverging national frameworks create compliance complexity across jurisdictions…"
            />
          </div>

          {/* Link inputs — create mode only */}
          {mode === "create" && (
          <div className="mb-2">
            <div className={flClass}>Link inputs</div>
            <div className={fhClass}>Select the inputs that belong to this cluster.</div>

            {projectInputs.length === 0 ? (
              <div className="py-3 px-3.5 bg-surface-alt border border-border rounded-container text-xs text-muted">
                No inputs in this project yet —{" "}
                {onAddInput ? (
                  <button
                    onClick={() => setAddInputLayerOpen(true)}
                    className="bg-transparent border-none p-0 text-xs text-ink underline cursor-pointer font-[inherit]"
                  >
                    add one now
                  </button>
                ) : (
                  "add some first."
                )}
              </div>
            ) : (
              <div className="border border-border rounded-container overflow-hidden">
                {projectInputs.map((input, idx) => {
                  const checked = selectedInputIds.includes(input.id);
                  return (
                    <div
                      key={input.id}
                      onClick={() => toggleInput(input.id)}
                      className={clsx(
                        "flex items-center gap-2.5 py-2.25 px-3 cursor-pointer transition-colors duration-100",
                        checked ? "bg-black/[0.02]" : "bg-white",
                        idx > 0 && "border-t border-border",
                      )}
                    >
                      {/* Checkbox */}
                      <div className={clsx(
                        "w-[15px] h-[15px] rounded-[3px] shrink-0 flex items-center justify-center border-[1.5px]",
                        checked ? "border-ink bg-ink" : "border-border-strong bg-white",
                      )}>
                        {checked && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {/* Title */}
                      <span className={clsx(
                        "flex-1 text-xs text-ink overflow-hidden text-ellipsis whitespace-nowrap",
                        checked ? "font-medium" : "font-normal",
                      )}>
                        {input.name}
                      </span>
                      {/* Tags */}
                      <div className="flex items-center gap-1.25 shrink-0">
                        {input.subtype && <SubtypeTag sub={input.subtype} />}
                        {input.signal_strength && <StrengthDot str={input.signal_strength} />}
                        {input.horizon && <HorizTag h={input.horizon} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Counter */}
            <div className="text-[11px] text-muted mt-2">
              {selectedInputIds.length > 0
                ? `${selectedInputIds.length} input${selectedInputIds.length !== 1 ? "s" : ""} selected`
                : "No inputs linked yet"}
            </div>
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0">
          <div className="pt-3.5 px-6 pb-5 border-t border-border flex items-center justify-end gap-2">
            <button onClick={handleClose} className={btnSecClass}>Cancel</button>
            <button
              onClick={handleSave}
              className={clsx(btnPClass, fields.name.trim() ? "opacity-100" : "opacity-40")}
            >
              {mode === "edit" ? "Save changes" : "Build cluster"}
            </button>
          </div>

          {/* Danger zone — delete, edit mode only (no record exists yet in
              "create" mode). Matches EditProjectDrawer.jsx's convention. */}
          {mode === "edit" && onDelete && (
            <div className="px-6 pb-5 border-t border-border">
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
          )}
        </div>
      </div>

      {/* Layered input drawer — opens on top of cluster builder, returns user here on close */}
      {onAddInput && (
        <InputDrawer
          open={addInputLayerOpen}
          onClose={() => setAddInputLayerOpen(false)}
          onSave={(fields) => { onAddInput(fields); setAddInputLayerOpen(false); }}
          projects={projects}
          defaultProjectId={projectId}
          zIndex={400}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${initialValues?.name}"?`}
          message="This will permanently delete the cluster. Inputs linked to it will not be deleted. This cannot be undone."
          onConfirm={() => { setConfirmDelete(false); onDelete(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

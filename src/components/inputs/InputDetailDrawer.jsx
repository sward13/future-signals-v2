/**
 * InputDetailDrawer — right-side drawer showing full input detail with read/edit mode.
 * Read-only by default; clicking Edit makes all fields editable.
 *
 * Read-only: no destructive action lives in view mode. Delete moved to the
 * edit-mode Danger Zone — see docs/edit-view-mode-consistency-audit-prompt.md.
 * "Duplicate to cluster" stays in view mode: it creates a new copy elsewhere
 * and never mutates or destroys this input, so it's a read-adjacent
 * convenience action, not a destructive one — same category as the Cluster
 * tab's "X" unlink action.
 *
 * Note: this drawer hand-rolls its own backdrop/panel shell rather than
 * using the shared Drawer.jsx (which InputDrawer.jsx, the create-only
 * sibling, already uses) — a pre-existing inconsistency, out of scope here.
 *
 * @param {{ inputId: string|null, inputs: object[], projects: object[], onClose: () => void, onSave: (id, fields) => void }} props
 */
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { INPUT_TYPES, ThreeCardSelector, SteepleSelector, HorizonSelector, TypeSwitcherChip } from "./InputFormFields.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";
import { AddToProjectButton } from "../shared/AddToProjectButton.jsx";
import { computeFlipPosition } from "../../lib/panelPosition.js";
import { sanitizeUrl } from "../../utils/sanitizeUrl.js";

// Worst-case height estimate for the duplicate-to-cluster picker below
// (header + 220px-capped list + footer), used by computeFlipPosition's
// viewport-collision check.
const DUPE_PICKER_MAX_HEIGHT = 300;

// This drawer's own backdrop/panel sit at zIndex 300/301 (below). Any portal
// opened from a control inside the drawer needs a z-index explicitly above
// that pair, or it paints underneath the drawer despite being correctly
// portaled to document.body — z-index alone determines paint order once
// both are direct participants in the root stacking context. The
// duplicate-to-cluster picker below already uses 400/401 for this reason;
// AddToProjectButton's dropdown (rendered from this same drawer, just above)
// gets the same tier for consistency, passed via its zIndex prop.
const OVERLAY_Z_INDEX = 400;

const HORIZON_CLASSES = {
  H1: "text-green-700 bg-green-50 border-green-border",
  H2: "text-blue-700 bg-blue-50 border-blue-border",
  H3: "text-amber-700 bg-amber-50 border-amber-border",
};

function TypeChip({ typeId }) {
  const t = INPUT_TYPES.find((x) => x.id === typeId) || INPUT_TYPES[0];
  return (
    <span
      className="inline-flex items-center gap-1.25 text-[11px] font-medium py-0.75 px-2.5 rounded-[20px] border"
      style={{ background: t.bg, color: t.color, borderColor: t.border }}
    >
      {t.icon} {t.label}
    </span>
  );
}

const SIGNAL_STRENGTH_OPTIONS = [
  { value: "weak",     title: "Weak",     desc: "Single source, edge case, or very early emergence",           dotColor: "var(--color-amber-700)" },
  { value: "moderate", title: "Moderate", desc: "Multiple sources or visible within a specific community",      dotColor: "var(--color-blue-700)" },
  { value: "strong",   title: "Strong",   desc: "Widespread, data-backed, or reported by mainstream sources",   dotColor: "var(--color-green-700)" },
];

const SOURCE_CONFIDENCE_OPTIONS = [
  { value: "low",    title: "Low",    desc: "Social media, blogs, unverified sources",                               dotColor: "var(--color-amber-700)" },
  { value: "medium", title: "Medium", desc: "Quality journalism, industry reports, expert commentary",               dotColor: "var(--color-blue-700)" },
  { value: "high",   title: "High",   desc: "Peer-reviewed research, official statistics, established institutions",  dotColor: "var(--color-green-700)" },
];

const STRENGTH_CLASSES = {
  weak:     "text-amber-700 bg-amber-50 border-amber-border",
  moderate: "text-blue-700 bg-blue-50 border-blue-border",
  high:     "text-green-700 bg-green-50 border-green-border",
};

const CONFIDENCE_CLASSES = {
  low:    "text-amber-700 bg-amber-50 border-amber-border",
  medium: "text-blue-700 bg-blue-50 border-blue-border",
  high:   "text-green-700 bg-green-50 border-green-border",
};

const inpClass = "w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-ui font-[inherit] outline-none box-border";
const taClass = clsx(inpClass, "resize-none leading-[1.55]");
const btnPClass = "py-2.5 px-5.5 rounded-container bg-brand text-white border-none text-ui font-medium cursor-pointer font-[inherit]";
const btnSecClass = "py-2.25 px-4.5 rounded-container bg-transparent text-muted border border-border-strong text-ui cursor-pointer font-[inherit]";
const flClass = "text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5";

export function InputDetailDrawer({ inputId, inputs, projects, clusters = [], onClose, onSave, onDelete, onAccept, onSaveToProject, onDismissSuggested, projectClusters, onAssignToCluster, onOpenCluster, onDuplicateToCluster }) {
  const input = inputs.find((i) => i.id === inputId) || null;

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [dupePickerOpen, setDupePickerOpen] = useState(false);
  const [dupeAnchorRect, setDupeAnchorRect] = useState(null);
  const dupeButtonRef = useRef(null);

  // Re-seed fields (and reset transient UI state) when the selected input
  // changes, without an effect (react-hooks/set-state-in-effect) — adjust
  // state during render.
  const [prevInputId, setPrevInputId] = useState(inputId);
  if (inputId !== prevInputId) {
    setPrevInputId(inputId);
    setFields(input ? {
      name:              input.name              || "",
      description:       input.description       || "",
      source_url:        input.source_url        || "",
      subtype:           input.subtype           || "signal",
      steepled:          input.steepled          || [],
      signal_strength:   input.signal_strength   || null,
      source_confidence: input.source_confidence || null,
      horizon:           input.horizon           || null,
      project_id:        input.project_id        || "",
    } : {});
    setEditing(false);
    setReassigning(false);
    setDupePickerOpen(false);
  }

  if (!input) return null;

  // Only treat as AI-suggested while still in the Inbox (no project assigned).
  // Once accepted into a project the input is a regular project input and
  // should show the Delete button like any other.
  const isAiSuggested = !!(input.is_seeded && input.metadata?.source === 'scanner' && !input.project_id);

  const set = (key, val) => setFields((f) => ({ ...f, [key]: val }));
  const toggleSteeple = (cat) => set("steepled", fields.steepled.includes(cat) ? fields.steepled.filter((x) => x !== cat) : [...fields.steepled, cat]);

  const handleSave = () => {
    // Sanitize before sending: omit project_id if empty string (project
    // assignment is managed separately via saveInputToProject, and sending
    // "" for a UUID column causes a 400 from Supabase).
    const { project_id, ...editableFields } = fields;
    const payload = project_id ? { ...editableFields, project_id } : editableFields;
    onSave(input.id, payload);
    setEditing(false);
  };

  const handleCancel = () => {
    setFields({
      name: input.name || "", description: input.description || "",
      source_url: input.source_url || "", subtype: input.subtype || "signal",
      steepled: input.steepled || [], signal_strength: input.signal_strength || null, source_confidence: input.source_confidence || null,
      horizon: input.horizon || null,
      project_id: input.project_id || "",
    });
    setEditing(false);
  };

  const assignedProject  = projects.find((p) => p.id === (fields.project_id || input.project_id));
  const assignedClusters = clusters.filter((cl) => (cl.input_ids || []).includes(input.id));

  const eligibleClusters = projectClusters
    ? projectClusters.filter((cl) => !(cl.input_ids || []).includes(input.id))
    : [];
  const canDupe = !!onDuplicateToCluster && eligibleClusters.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/25 z-[300]" />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-[460px] bg-white border-l border-border z-[301] flex flex-col"
        style={{ animation: "drawerSlideIn 0.28s ease" }}
      >
        {/* Header row 1: type badge + panel controls */}
        <div className="pt-4.5 px-6 pb-3 flex items-center gap-2.5 shrink-0">
          <TypeChip typeId={input.subtype} />
          <div className="flex-1" />
          {!editing && (
            <button onClick={() => setEditing(true)} className={clsx(btnSecClass, "text-[11px] py-1.25 px-3.5")}>
              Edit
            </button>
          )}
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer font-[inherit] text-base py-0.5 px-1.5 text-muted rounded-btn">×</button>
        </div>

        {/* Header row 2: scanner action buttons (AI suggested only) */}
        {!editing && isAiSuggested && (
          <div className="px-6 pb-3 flex items-center gap-1.5 border-b border-border">
            {onAccept && (
              <button
                onClick={() => { onAccept(input); onClose(); }}
                className="text-[11px] py-1.25 px-3.5 rounded-container bg-ink text-white border-none cursor-pointer font-[inherit] font-medium"
              >
                Accept →
              </button>
            )}
            {onSaveToProject && (
              <AddToProjectButton
                projects={projects}
                recommendedProjectId={input.metadata?.suggested_projects?.[0]?.id}
                onAdd={(projectId) => onSaveToProject(input.id, projectId)}
                buttonStyle={{ fontSize: 11, padding: "5px 14px", borderRadius: 8, background: "transparent", color: "var(--color-muted)", border: "1px solid var(--color-border-strong)", cursor: "pointer", fontFamily: "inherit" }}
                zIndex={OVERLAY_Z_INDEX}
              />
            )}
            {onDismissSuggested && (
              <button
                onClick={() => { onDismissSuggested(input); onClose(); }}
                className="text-[11px] py-1.25 px-3.5 rounded-container bg-transparent text-muted border-none cursor-pointer font-[inherit]"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Divider for non-AI inputs (matches visual rhythm) */}
        {(editing || !isAiSuggested) && (
          <div className="h-px bg-border shrink-0" />
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-5 px-6">

          {/* Title */}
          <div className="mb-4">
            {editing ? (
              <>
                <div className={flClass}>Title / Name</div>
                <input className={inpClass} value={fields.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </>
            ) : (
              <div className="text-[17px] font-medium text-ink leading-[1.35]">{input.name}</div>
            )}
          </div>

          {/* Type switcher (edit only) — same chip+dropdown as Add panel */}
          {editing && (
            <>
              <TypeSwitcherChip selectedType={fields.subtype} onChange={(v) => set("subtype", v)} />
              {/* Description banner for selected type */}
              {(() => {
                const t = INPUT_TYPES.find((x) => x.id === fields.subtype);
                if (!t) return null;
                return (
                  <div
                    className="py-2.5 px-3.5 rounded-container border text-xs leading-body mb-5.5"
                    style={{ background: t.bg, borderColor: t.border, color: t.color }}
                  >
                    {t.description}
                  </div>
                );
              })()}
            </>
          )}

          {/* Description */}
          <div className="mb-4">
            {editing ? (
              <>
                <div className={flClass}>Description</div>
                <textarea className={taClass} rows={3} value={fields.description} onChange={(e) => set("description", e.target.value)} />
              </>
            ) : input.description ? (
              <div className="text-xs text-muted leading-[1.65]">{input.description}</div>
            ) : (
              <div className="text-xs text-hint italic">No description.</div>
            )}
          </div>

          {/* Source URL */}
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.02em] text-hint mb-1.5">Source</div>
            {editing ? (
              <input className={inpClass} type="url" value={fields.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" />
            ) : input.source_url ? (
              <a href={sanitizeUrl(input.source_url)} target="_blank" rel="noreferrer" className="text-xs text-blue-700 break-all">
                {input.source_url}
              </a>
            ) : (
              <span className="text-xs text-hint italic">No source URL.</span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border my-4" />

          {/* STEEPLED */}
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-[0.02em] text-hint mb-1.5">STEEPLED</div>
            {editing ? (
              <SteepleSelector selected={fields.steepled} onToggle={toggleSteeple} />
            ) : (
              <div className="flex flex-wrap gap-1.25">
                {(input.steepled || []).length === 0 ? (
                  <span className="text-xs text-hint italic">None tagged.</span>
                ) : (
                  (input.steepled || []).map((t) => (
                    <span key={t} className="text-[10px] py-0.5 px-1.75 rounded-pill bg-surface-alt text-muted border border-border">{t}</span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Cluster membership */}
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.02em] text-hint mb-1.5">Cluster</div>
            {projectClusters && onAssignToCluster ? (
              assignedClusters.length === 0 || reassigning ? (
                <select
                  className="w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-xs font-[inherit] outline-none appearance-none box-border"
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onAssignToCluster(input.id, e.target.value);
                    setReassigning(false);
                  }}
                >
                  <option value="" disabled>{reassigning ? "— Select a cluster —" : "— Assign to cluster —"}</option>
                  {projectClusters.map((cl) => (
                    <option key={cl.id} value={cl.id}>{cl.name}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {assignedClusters.map((cl) => (
                    <span
                      key={cl.id}
                      onClick={() => onOpenCluster?.(cl.id)}
                      className={clsx(
                        "text-[11px] py-0.75 px-2.5 rounded-container bg-blue-50 text-blue-700 border border-blue-border",
                        onOpenCluster ? "cursor-pointer" : "cursor-default",
                      )}
                    >
                      {cl.name} {onOpenCluster && <span className="opacity-60">›</span>}
                    </span>
                  ))}
                  <button
                    onClick={() => setReassigning(true)}
                    className="text-[11px] text-muted bg-transparent border-none cursor-pointer font-[inherit] p-0"
                  >
                    Reassign
                  </button>
                </div>
              )
            ) : (
              <div className="flex flex-wrap gap-1.25">
                {assignedClusters.length === 0 ? (
                  <span className="text-xs text-hint italic">Unassigned</span>
                ) : (
                  assignedClusters.map((cl) => (
                    <span key={cl.id} className="text-[10px] py-0.5 px-2 rounded-container bg-surface-alt text-muted border border-border">
                      {cl.name}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Signal strength */}
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.02em] text-hint mb-1.5">Signal strength</div>
            {editing ? (
              <ThreeCardSelector
                label=""
                selected={fields.signal_strength}
                onSelect={(v) => set("signal_strength", v)}
                options={SIGNAL_STRENGTH_OPTIONS}
              />
            ) : (() => {
              const opt = SIGNAL_STRENGTH_OPTIONS.find((o) => o.value === input.signal_strength);
              return opt ? (
                <div>
                  <span className={clsx(
                    "text-[11px] py-0.5 px-2.25 rounded-pill border",
                    STRENGTH_CLASSES[input.signal_strength] || "text-hint bg-surface-alt border-border",
                  )}>
                    {opt.title}
                  </span>
                  <div className="text-[11px] text-muted mt-1.25 leading-[1.45]">{opt.desc}</div>
                </div>
              ) : (
                <span className="text-[11px] text-hint italic">Not set</span>
              );
            })()}
          </div>

          {/* Source confidence */}
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.02em] text-hint mb-1.5">Source confidence</div>
            {editing ? (
              <ThreeCardSelector
                label=""
                selected={fields.source_confidence}
                onSelect={(v) => set("source_confidence", v)}
                options={SOURCE_CONFIDENCE_OPTIONS}
              />
            ) : (() => {
              const opt = SOURCE_CONFIDENCE_OPTIONS.find((o) => o.value === input.source_confidence);
              return opt ? (
                <div>
                  <span className={clsx(
                    "text-[11px] py-0.5 px-2.25 rounded-pill border",
                    CONFIDENCE_CLASSES[input.source_confidence] || "text-hint bg-surface-alt border-border",
                  )}>
                    {opt.title}
                  </span>
                  <div className="text-[11px] text-muted mt-1.25 leading-[1.45]">{opt.desc}</div>
                </div>
              ) : (
                <span className="text-[11px] text-hint italic">Not set</span>
              );
            })()}
          </div>

          {/* Horizon */}
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.02em] text-hint mb-1.5">Horizon</div>
            {editing ? (
              <HorizonSelector selected={fields.horizon} onSelect={(v) => set("horizon", v)} />
            ) : (
              <span className={clsx(
                "text-[11px] py-0.5 px-2.25 rounded-pill border",
                HORIZON_CLASSES[input.horizon] || "text-hint bg-transparent border-border",
              )}>
                {input.horizon || "Not set"}
              </span>
            )}
          </div>

          {/* Project assignment */}
          <div className="mb-2">
            <div className="text-[11px] tracking-[0.02em] text-hint mb-1.5">Project</div>
            {editing ? (
              <select
                className={clsx(inpClass, "appearance-none")}
                value={fields.project_id}
                onChange={(e) => set("project_id", e.target.value)}
              >
                <option value="">Inbox (unassigned)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <span className={clsx(
                "text-xs py-0.5 px-2.25 rounded-container border",
                assignedProject ? "bg-blue-50 text-blue-700 border-blue-border" : "bg-surface-alt text-hint border-border",
              )}>
                {assignedProject ? assignedProject.name : "Inbox"}
              </span>
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
            {onDelete && !isAiSuggested && (
              <div className="px-6 pb-5 border-t border-border">
                <div className="pt-3.5 flex items-center justify-between">
                  <div className="text-[11px] text-hint">Danger zone</div>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-[11px] py-1.25 px-3 rounded-[6px] border border-red-border bg-transparent text-red-800 cursor-pointer font-[inherit]"
                  >
                    Delete input
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer (view mode): Duplicate to cluster only — a read-adjacent
            convenience action (creates a copy elsewhere, doesn't mutate or
            destroy this input), so it stays available in view mode. */}
        {!editing && canDupe && !isAiSuggested && (
          <div className="pt-3 px-6 pb-4.5 border-t border-border shrink-0">
            <div className="relative">
              <button
                ref={dupeButtonRef}
                onClick={() => {
                  const rect = dupeButtonRef.current?.getBoundingClientRect();
                  setDupeAnchorRect(rect ?? null);
                  setDupePickerOpen((o) => !o);
                }}
                className="text-[11px] py-1.25 px-3 rounded-[6px] border border-border-strong bg-transparent text-muted cursor-pointer font-[inherit]"
              >
                Duplicate to cluster
              </button>
              {dupePickerOpen && dupeAnchorRect && createPortal(
                <>
                  <div onClick={() => setDupePickerOpen(false)} className="fixed inset-0" style={{ zIndex: OVERLAY_Z_INDEX }} />
                  <div
                    className="bg-white border border-border rounded-pill shadow-[0_6px_24px_rgba(0,0,0,0.12)] min-w-[220px] overflow-hidden"
                    style={computeFlipPosition(dupeAnchorRect, {
                      panelHeight: DUPE_PICKER_MAX_HEIGHT,
                      preferredDirection: "up",
                      align: "left",
                      zIndex: OVERLAY_Z_INDEX + 1,
                    })}
                  >
                    <div className="pt-2 px-3.5 pb-1 text-[11px] tracking-[0.02em] text-muted font-medium">
                      Copy to cluster
                    </div>
                    <div className="max-h-[220px] overflow-y-auto">
                      {eligibleClusters.map((cl) => (
                        <button
                          key={cl.id}
                          onClick={async () => {
                            setDupePickerOpen(false);
                            await onDuplicateToCluster(cl.id);
                          }}
                          className="block w-full py-2.25 px-3.5 bg-transparent border-none border-b border-border text-left cursor-pointer text-xs text-ink font-[inherit] hover:bg-surface-alt"
                        >
                          {cl.name}
                        </button>
                      ))}
                    </div>
                    <div className="py-1.5 px-3.5 border-t border-border">
                      <button onClick={() => setDupePickerOpen(false)} className="text-[11px] text-muted bg-transparent border-none cursor-pointer font-[inherit]">
                        Cancel
                      </button>
                    </div>
                  </div>
                </>,
                document.body
              )}
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${input.name}"?`}
          message="This will permanently remove the input and unlink it from any clusters. This cannot be undone."
          onConfirm={onDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

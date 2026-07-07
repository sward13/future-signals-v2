/**
 * InputDetailDrawer — right-side drawer showing full input detail with read/edit mode.
 * Read-only by default; clicking Edit makes all fields editable.
 * @param {{ inputId: string|null, inputs: object[], projects: object[], onClose: () => void, onSave: (id, fields) => void }} props
 */
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { c, inp, ta, btnP, btnSec, btnG, fl } from "../../styles/tokens.js";
import { INPUT_TYPES, ThreeCardSelector, SteepleSelector, HorizonSelector, TypeSwitcherChip } from "./InputFormFields.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";
import { AddToProjectButton } from "../shared/AddToProjectButton.jsx";
import { sanitizeUrl } from "../../utils/sanitizeUrl.js";

const HORIZON_COLORS = {
  H1: [c.green700, c.green50, c.greenBorder],
  H2: [c.blue700,  c.blue50,  c.blueBorder],
  H3: [c.amber700, c.amber50, c.amberBorder],
};

function TypeChip({ typeId }) {
  const t = INPUT_TYPES.find((x) => x.id === typeId) || INPUT_TYPES[0];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 500,
      padding: "3px 10px", borderRadius: 20,
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
    }}>
      {t.icon} {t.label}
    </span>
  );
}

const SIGNAL_STRENGTH_OPTIONS = [
  { value: "weak",     title: "Weak",     desc: "Single source, edge case, or very early emergence",           dotColor: c.amber700 },
  { value: "moderate", title: "Moderate", desc: "Multiple sources or visible within a specific community",      dotColor: c.blue700 },
  { value: "high",     title: "High",     desc: "Widespread, data-backed, or reported by mainstream sources",   dotColor: c.green700 },
];

const SOURCE_CONFIDENCE_OPTIONS = [
  { value: "low",    title: "Low",    desc: "Social media, blogs, unverified sources",                               dotColor: c.amber700 },
  { value: "medium", title: "Medium", desc: "Quality journalism, industry reports, expert commentary",               dotColor: c.blue700 },
  { value: "high",   title: "High",   desc: "Peer-reviewed research, official statistics, established institutions",  dotColor: c.green700 },
];

const STRENGTH_COLORS = {
  weak:     [c.amber700, c.amber50, c.amberBorder],
  moderate: [c.blue700,  c.blue50,  c.blueBorder],
  high:     [c.green700, c.green50, c.greenBorder],
};

const CONFIDENCE_COLORS = {
  low:    [c.amber700, c.amber50, c.amberBorder],
  medium: [c.blue700,  c.blue50,  c.blueBorder],
  high:   [c.green700, c.green50, c.greenBorder],
};

export function InputDetailDrawer({ inputId, inputs, projects, clusters = [], onClose, onSave, onDelete, onAccept, onSaveToProject, onDismissSuggested, projectClusters, onAssignToCluster, onOpenCluster, onDuplicateToCluster }) {
  const input = inputs.find((i) => i.id === inputId) || null;

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [dupePickerOpen, setDupePickerOpen] = useState(false);
  const [dupeAnchorRect, setDupeAnchorRect] = useState(null);
  const dupeButtonRef = useRef(null);

  useEffect(() => {
    if (input) {
      setFields({
        name:              input.name              || "",
        description:       input.description       || "",
        source_url:        input.source_url        || "",
        subtype:           input.subtype           || "signal",
        steepled:          input.steepled          || [],
        signal_strength:   input.signal_strength   || null,
        source_confidence: input.source_confidence || null,
        horizon:           input.horizon           || null,
        project_id:        input.project_id        || "",
      });
    }
    setEditing(false);
    setReassigning(false);
    setDupePickerOpen(false);
  }, [inputId]);

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

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 300 }} />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 460,
        background: c.white, borderLeft: `1px solid ${c.border}`,
        zIndex: 301, display: "flex", flexDirection: "column",
        animation: "drawerSlideIn 0.28s ease",
      }}>
        {/* Header row 1: type badge + panel controls */}
        <div style={{
          padding: "18px 24px 12px",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <TypeChip typeId={input.subtype} />
          <div style={{ flex: 1 }} />
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ ...btnSec, fontSize: 11, padding: "5px 14px" }}>
              Edit
            </button>
          )}
          <button onClick={onClose} style={{ ...btnG, fontSize: 16, padding: "2px 6px", color: c.muted }}>×</button>
        </div>

        {/* Header row 2: scanner action buttons (AI suggested only) */}
        {!editing && isAiSuggested && (
          <div style={{
            padding: "0 24px 12px",
            display: "flex", alignItems: "center", gap: 6,
            borderBottom: `1px solid ${c.border}`,
          }}>
            {onAccept && (
              <button
                onClick={() => { onAccept(input); onClose(); }}
                style={{ fontSize: 11, padding: "5px 14px", borderRadius: 8, background: c.ink, color: c.white, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
              >
                Accept →
              </button>
            )}
            {onSaveToProject && (
              <AddToProjectButton
                projects={projects}
                recommendedProjectId={input.metadata?.suggested_projects?.[0]?.id}
                onAdd={(projectId) => onSaveToProject(input.id, projectId)}
                buttonStyle={{ fontSize: 11, padding: "5px 14px", borderRadius: 8, background: "transparent", color: c.muted, border: `1px solid ${c.borderStrong}`, cursor: "pointer", fontFamily: "inherit" }}
              />
            )}
            {onDismissSuggested && (
              <button
                onClick={() => { onDismissSuggested(input); onClose(); }}
                style={{ fontSize: 11, padding: "5px 14px", borderRadius: 8, background: "transparent", color: c.muted, border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Divider for non-AI inputs (matches visual rhythm) */}
        {(editing || !isAiSuggested) && (
          <div style={{ height: 1, background: c.border, flexShrink: 0 }} />
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            {editing ? (
              <>
                <div style={fl}>Title / Name</div>
                <input style={inp} value={fields.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </>
            ) : (
              <div style={{ fontSize: 17, fontWeight: 500, color: c.ink, lineHeight: 1.35 }}>{input.name}</div>
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
                  <div style={{
                    padding: "10px 14px", borderRadius: 8,
                    background: t.bg, border: `1px solid ${t.border}`,
                    fontSize: 12, color: t.color, lineHeight: 1.55, marginBottom: 22,
                  }}>
                    {t.description}
                  </div>
                );
              })()}
            </>
          )}

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            {editing ? (
              <>
                <div style={fl}>Description</div>
                <textarea style={ta} rows={3} value={fields.description} onChange={(e) => set("description", e.target.value)} />
              </>
            ) : input.description ? (
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.65 }}>{input.description}</div>
            ) : (
              <div style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>No description.</div>
            )}
          </div>

          {/* Source URL */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 6 }}>Source</div>
            {editing ? (
              <input style={inp} type="url" value={fields.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" />
            ) : input.source_url ? (
              <a href={sanitizeUrl(input.source_url)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: c.blue700, wordBreak: "break-all" }}>
                {input.source_url}
              </a>
            ) : (
              <span style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>No source URL.</span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: c.border, margin: "16px 0" }} />

          {/* STEEPLED */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.02em", color: c.hint, marginBottom: 6 }}>STEEPLED</div>
            {editing ? (
              <SteepleSelector selected={fields.steepled} onToggle={toggleSteeple} />
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(input.steepled || []).length === 0 ? (
                  <span style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>None tagged.</span>
                ) : (
                  (input.steepled || []).map((t) => (
                    <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}` }}>{t}</span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Cluster membership */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 6 }}>Cluster</div>
            {projectClusters && onAssignToCluster ? (
              assignedClusters.length === 0 || reassigning ? (
                <select
                  style={{ ...inp, fontSize: 12, appearance: "none" }}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {assignedClusters.map((cl) => (
                    <span
                      key={cl.id}
                      onClick={() => onOpenCluster?.(cl.id)}
                      style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 8,
                        background: c.blue50, color: c.blue700, border: `1px solid ${c.blueBorder}`,
                        cursor: onOpenCluster ? "pointer" : "default",
                      }}
                    >
                      {cl.name} {onOpenCluster && <span style={{ opacity: 0.6 }}>›</span>}
                    </span>
                  ))}
                  <button
                    onClick={() => setReassigning(true)}
                    style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                  >
                    Reassign
                  </button>
                </div>
              )
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {assignedClusters.length === 0 ? (
                  <span style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>Unassigned</span>
                ) : (
                  assignedClusters.map((cl) => (
                    <span key={cl.id} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}` }}>
                      {cl.name}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Signal strength */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 6 }}>Signal strength</div>
            {editing ? (
              <ThreeCardSelector
                label=""
                selected={fields.signal_strength}
                onSelect={(v) => set("signal_strength", v)}
                options={SIGNAL_STRENGTH_OPTIONS}
              />
            ) : (() => {
              const opt = SIGNAL_STRENGTH_OPTIONS.find((o) => o.value === input.signal_strength);
              const [col, bg, brd] = STRENGTH_COLORS[input.signal_strength] || [c.hint, c.surfaceAlt, c.border];
              return opt ? (
                <div>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 10, background: bg, color: col, border: `1px solid ${brd}` }}>
                    {opt.title}
                  </span>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 5, lineHeight: 1.45 }}>{opt.desc}</div>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: c.hint, fontStyle: "italic" }}>Not set</span>
              );
            })()}
          </div>

          {/* Source confidence */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 6 }}>Source confidence</div>
            {editing ? (
              <ThreeCardSelector
                label=""
                selected={fields.source_confidence}
                onSelect={(v) => set("source_confidence", v)}
                options={SOURCE_CONFIDENCE_OPTIONS}
              />
            ) : (() => {
              const opt = SOURCE_CONFIDENCE_OPTIONS.find((o) => o.value === input.source_confidence);
              const [col, bg, brd] = CONFIDENCE_COLORS[input.source_confidence] || [c.hint, c.surfaceAlt, c.border];
              return opt ? (
                <div>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 10, background: bg, color: col, border: `1px solid ${brd}` }}>
                    {opt.title}
                  </span>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 5, lineHeight: 1.45 }}>{opt.desc}</div>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: c.hint, fontStyle: "italic" }}>Not set</span>
              );
            })()}
          </div>

          {/* Horizon */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 6 }}>Horizon</div>
            {editing ? (
              <HorizonSelector selected={fields.horizon} onSelect={(v) => set("horizon", v)} />
            ) : (
              (() => {
                const h = input.horizon;
                const [col, bg, brd] = HORIZON_COLORS[h] || [c.hint, "transparent", c.border];
                return (
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 10, background: bg, color: col, border: `1px solid ${brd}` }}>
                    {h || "Not set"}
                  </span>
                );
              })()
            )}
          </div>

          {/* Project assignment */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 6 }}>Project</div>
            {editing ? (
              <select
                style={{ ...inp, appearance: "none" }}
                value={fields.project_id}
                onChange={(e) => set("project_id", e.target.value)}
              >
                <option value="">Inbox (unassigned)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <span style={{
                fontSize: 12, padding: "2px 9px", borderRadius: 8,
                background: assignedProject ? c.blue50 : c.surfaceAlt,
                color: assignedProject ? c.blue700 : c.hint,
                border: `1px solid ${assignedProject ? c.blueBorder : c.border}`,
              }}>
                {assignedProject ? assignedProject.name : "Inbox"}
              </span>
            )}
          </div>
        </div>

        {/* Footer (edit mode only) */}
        {editing && (
          <div style={{
            padding: "14px 24px 20px", borderTop: `1px solid ${c.border}`,
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0,
          }}>
            <button onClick={handleCancel} style={btnSec}>Cancel</button>
            <button onClick={handleSave} style={btnP}>Save changes</button>
          </div>
        )}
        {!editing && (onDelete || onDuplicateToCluster) && !isAiSuggested && (() => {
          const eligibleClusters = projectClusters
            ? projectClusters.filter((cl) => !(cl.input_ids || []).includes(input.id))
            : [];
          const canDupe = !!onDuplicateToCluster && eligibleClusters.length > 0;
          return (
            <div style={{ padding: "12px 24px 18px", borderTop: `1px solid ${c.border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              {canDupe ? (
                <div style={{ position: "relative" }}>
                  <button
                    ref={dupeButtonRef}
                    onClick={() => {
                      const rect = dupeButtonRef.current?.getBoundingClientRect();
                      setDupeAnchorRect(rect ?? null);
                      setDupePickerOpen((o) => !o);
                    }}
                    style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6, border: `1px solid ${c.borderStrong}`, background: "transparent", color: c.muted, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Duplicate to cluster
                  </button>
                  {dupePickerOpen && dupeAnchorRect && createPortal(
                    <>
                      <div onClick={() => setDupePickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 400 }} />
                      <div style={{
                        position: "fixed",
                        bottom: window.innerHeight - dupeAnchorRect.top + 4,
                        left: dupeAnchorRect.left,
                        background: c.white,
                        border: `1px solid ${c.border}`,
                        borderRadius: 10,
                        boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
                        minWidth: 220,
                        zIndex: 401,
                        overflow: "hidden",
                      }}>
                        <div style={{ padding: "8px 14px 4px", fontSize: 11, letterSpacing: "0.02em", color: c.muted, fontWeight: 500 }}>
                          Copy to cluster
                        </div>
                        <div style={{ maxHeight: 220, overflowY: "auto" }}>
                          {eligibleClusters.map((cl) => (
                            <button
                              key={cl.id}
                              onClick={async () => {
                                setDupePickerOpen(false);
                                await onDuplicateToCluster(cl.id);
                              }}
                              style={{
                                display: "block", width: "100%", padding: "9px 14px",
                                background: "transparent", border: "none",
                                borderBottom: `1px solid ${c.border}`,
                                textAlign: "left", cursor: "pointer",
                                fontSize: 12, color: c.ink, fontFamily: "inherit",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = c.surfaceAlt; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              {cl.name}
                            </button>
                          ))}
                        </div>
                        <div style={{ padding: "6px 14px", borderTop: `1px solid ${c.border}` }}>
                          <button onClick={() => setDupePickerOpen(false)} style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              ) : <div />}
              {onDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6, border: `1px solid ${c.redBorder}`, background: "transparent", color: c.red800, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Delete input
                </button>
              )}
            </div>
          );
        })()}
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

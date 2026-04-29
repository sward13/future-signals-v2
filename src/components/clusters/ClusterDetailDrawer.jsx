/**
 * ClusterDetailDrawer — right-side drawer showing full cluster detail with read/edit mode.
 * Shows name, subtype, horizon, likelihood, description, and linked inputs.
 * @param {{ clusterId: string|null, clusters: object[], inputs: object[], onClose: () => void, onSave: (id, fields) => void, onRemoveInput: (inputId, clusterId) => void, onAssignInput: (inputId, clusterId) => void }} props
 */
import { useState, useEffect } from "react";
import { c, inp, ta, btnP, btnSec, btnG, fl } from "../../styles/tokens.js";
import { SubtypeTag, HorizTag, Tag } from "../shared/Tag.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";
import { supabase } from "../../lib/supabase.js";

const SUBTYPES = ["Trend", "Driver", "Tension"];
const HORIZONS  = ["H1", "H2", "H3"];
const LIKELIHOODS = ["Possible", "Plausible", "Probable"];

const HORIZON_COLORS = {
  H1: [c.green700, c.green50, c.greenBorder],
  H2: [c.blue700,  c.blue50,  c.blueBorder],
  H3: [c.amber700, c.amber50, c.amberBorder],
};

function LikelihoodTag({ l }) {
  const map = {
    Probable:  [c.green700,  c.green50,  c.greenBorder],
    Plausible: [c.blue700,   c.blue50,   c.blueBorder],
    Possible:  [c.amber700,  c.amber50,  c.amberBorder],
  };
  const [col, bg, brd] = map[l] || [c.hint, "transparent", c.border];
  return <Tag label={l} color={col} bg={bg} border={brd} />;
}

function AssignPicker({ availableInputs, onAssign, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 350 }} />
      <div style={{
        position: "absolute", top: "100%", left: 0, marginTop: 4,
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
        minWidth: 260, zIndex: 351, overflow: "hidden",
      }}>
        {availableInputs.length === 0 ? (
          <div style={{ padding: "12px 14px", fontSize: 12, color: c.hint }}>All project inputs already linked.</div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {availableInputs.map((i) => (
              <button
                key={i.id}
                onClick={() => onAssign(i.id)}
                style={{
                  display: "block", width: "100%", padding: "9px 14px",
                  background: "transparent", border: "none", borderBottom: `1px solid ${c.border}`,
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12, color: c.ink,
                }}
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
  { key: "likely",     label: "Likely matches",  dot: c.green700,  desc: "Supports or extends"     },
  { key: "possible",   label: "Possible matches", dot: c.blue700,   desc: "Partial or ambiguous"   },
  { key: "challenges", label: "Challenges",       dot: c.amber700,  desc: "Complicates or strains" },
];

export function ClusterDetailDrawer({ clusterId, clusters, inputs, onClose, onSave, onRemoveInput, onAssignInput, onDelete }) {
  const cluster = clusters.find((cl) => cl.id === clusterId) || null;

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Related inputs panel state
  const [relatedResults,    setRelatedResults]    = useState(null);   // null = never run
  const [loadingRelated,    setLoadingRelated]    = useState(false);
  const [relatedError,      setRelatedError]      = useState(null);
  const [dismissedIds,      setDismissedIds]      = useState(new Set());

  useEffect(() => {
    if (cluster) {
      setFields({
        name:        cluster.name        || "",
        subtype:     cluster.subtype     || "Trend",
        horizon:     cluster.horizon     || "H1",
        likelihood:  cluster.likelihood  || "Plausible",
        description: cluster.description || "",
      });
    }
    setEditing(false);
    setPickerOpen(false);
    setConfirmDelete(false);
    // Reset related panel when a different cluster is opened
    setRelatedResults(null);
    setLoadingRelated(false);
    setRelatedError(null);
    setDismissedIds(new Set());
  }, [clusterId]);

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
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 300 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 460,
        background: c.white, borderLeft: `1px solid ${c.border}`,
        zIndex: 301, display: "flex", flexDirection: "column",
        animation: "drawerSlideIn 0.28s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px 14px", borderBottom: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <SubtypeTag sub={cluster.subtype} />
          <div style={{ flex: 1 }} />
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ ...btnSec, fontSize: 11, padding: "5px 14px" }}>Edit</button>
          )}
          <button onClick={onClose} style={{ ...btnG, fontSize: 16, padding: "2px 6px", color: c.muted }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            {editing ? (
              <>
                <div style={fl}>Cluster name</div>
                <input style={inp} value={fields.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </>
            ) : (
              <div style={{ fontSize: 17, fontWeight: 500, color: c.ink }}>{cluster.name}</div>
            )}
          </div>

          {/* Tags row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <HorizTag h={cluster.horizon} />
            {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
          </div>

          {/* Subtype (edit) */}
          {editing && (
            <div style={{ marginBottom: 16 }}>
              <div style={fl}>Subtype</div>
              <div style={{ display: "flex", gap: 8 }}>
                {SUBTYPES.map((s) => {
                  const on = fields.subtype === s;
                  return (
                    <button key={s} onClick={() => set("subtype", s)} style={{
                      padding: "5px 16px", borderRadius: 20,
                      border: `1px solid ${on ? c.ink : c.border}`,
                      background: on ? c.ink : c.white, color: on ? c.white : c.muted,
                      fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Horizon (edit) */}
          {editing && (
            <div style={{ marginBottom: 16 }}>
              <div style={fl}>Horizon</div>
              <div style={{ display: "flex", gap: 8 }}>
                {HORIZONS.map((h) => {
                  const on = fields.horizon === h;
                  const [col, bg, brd] = HORIZON_COLORS[h];
                  return (
                    <button key={h} onClick={() => set("horizon", h)} style={{
                      padding: "5px 18px", borderRadius: 20,
                      border: `1px solid ${on ? brd : c.border}`,
                      background: on ? bg : c.white, color: on ? col : c.muted,
                      fontSize: 12, fontWeight: on ? 600 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Likelihood (edit) */}
          {editing && (
            <div style={{ marginBottom: 16 }}>
              <div style={fl}>Likelihood</div>
              <div style={{ display: "flex", gap: 8 }}>
                {LIKELIHOODS.map((l) => {
                  const on = fields.likelihood === l;
                  return (
                    <button key={l} onClick={() => set("likelihood", l)} style={{
                      padding: "5px 14px", borderRadius: 20,
                      border: `1px solid ${on ? c.borderMid : c.border}`,
                      background: on ? c.ink : c.white, color: on ? c.white : c.muted,
                      fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>Description</div>
            {editing ? (
              <textarea style={ta} rows={3} value={fields.description} onChange={(e) => set("description", e.target.value)} placeholder="What does this cluster represent?" />
            ) : cluster.description ? (
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.65 }}>{cluster.description}</div>
            ) : (
              <span style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>No description.</span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: c.border, marginBottom: 16 }} />

          {/* Linked inputs */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint }}>
                Linked inputs ({linkedInputs.length})
              </div>
              {editing && (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setPickerOpen((s) => !s)}
                    style={{ ...btnSec, fontSize: 11, padding: "4px 10px" }}
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
              <div style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>No inputs linked yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {linkedInputs.map((i) => (
                  <div key={i.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", background: c.surfaceAlt,
                    border: `1px solid ${c.border}`, borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 10, color: c.hint }}>◎</span>
                    <span style={{ fontSize: 12, color: c.ink, flex: 1 }}>{i.name}</span>
                    {i.horizon && <HorizTag h={i.horizon} />}
                    {editing && (
                      <button
                        onClick={() => onRemoveInput(i.id, cluster.id)}
                        style={{ background: "transparent", border: "none", color: c.hint, fontSize: 14, cursor: "pointer", padding: "0 2px", fontFamily: "inherit" }}
                        title="Remove from cluster"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: c.border, margin: "4px 0 14px" }} />

          {/* ── Related inputs ──────────────────────────────────── */}
          <div style={{ marginBottom: 8 }}>

            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint }}>
                  🔍 Related inputs
                </div>
                {relatedResults !== null && totalRelatedVisible > 0 && (
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 8,
                    background: "rgba(0,0,0,0.06)", color: c.muted,
                  }}>
                    {totalRelatedVisible}
                  </span>
                )}
              </div>
              {relatedResults !== null && !loadingRelated ? (
                <button
                  onClick={handleFindRelated}
                  style={{ ...btnG, fontSize: 11 }}
                >
                  Re-run
                </button>
              ) : (
                <button
                  onClick={handleFindRelated}
                  disabled={loadingRelated}
                  style={{ ...btnSec, fontSize: 11, padding: "4px 10px" }}
                >
                  Find related
                </button>
              )}
            </div>

            {/* Body */}
            {loadingRelated ? (
              <div style={{
                padding: "18px 14px",
                background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 8,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${c.border}`, borderTopColor: c.muted,
                  animation: "relatedSpinner 0.7s linear infinite",
                }} />
                <span style={{ fontSize: 12, color: c.muted }}>Searching…</span>
                <style>{`@keyframes relatedSpinner { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : relatedError ? (
              <div style={{
                padding: "10px 12px", background: c.red50,
                border: `1px solid ${c.redBorder}`, borderRadius: 8,
                fontSize: 11, color: c.red800,
              }}>
                {relatedError}
              </div>
            ) : relatedResults === null ? (
              <div style={{
                padding: "20px 16px", background: c.surfaceAlt,
                border: `1px solid ${c.border}`, borderRadius: 8,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.55, marginBottom: 12 }}>
                  Search across all project inputs to find what supports, extends, or challenges this cluster.
                </div>
                <button onClick={handleFindRelated} style={{ ...btnP, fontSize: 11, padding: "6px 16px" }}>
                  Find related inputs
                </button>
              </div>
            ) : totalRelatedVisible === 0 ? (
              <div style={{
                padding: "12px 14px", background: c.surfaceAlt,
                border: `1px solid ${c.border}`, borderRadius: 8,
                fontSize: 12, color: c.muted, textAlign: "center",
              }}>
                ✓ All suggestions reviewed.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {RELATED_CATEGORIES.map(({ key, label, dot, desc }) => {
                  const items = (relatedResults[key] || []).filter((r) => !dismissedIds.has(r.input_id));
                  if (items.length === 0) return null;
                  return (
                    <div key={key}>
                      {/* Category header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: dot, display: "inline-block", flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.ink, fontWeight: 500 }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 10, color: c.hint, fontStyle: "italic", marginLeft: "auto" }}>
                          {desc}
                        </span>
                      </div>
                      {/* Result cards */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {items.map((result) => (
                          <div key={result.input_id} style={{
                            padding: "10px 12px",
                            background: c.white, border: `1px solid ${c.border}`, borderRadius: 8,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 4, lineHeight: 1.35 }}>
                              {result.title}
                            </div>
                            <div style={{
                              fontSize: 11, color: c.muted, lineHeight: 1.55, marginBottom: 9,
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                            }}>
                              {result.rationale}
                            </div>
                            <div style={{ display: "flex", gap: 5 }}>
                              <button
                                onClick={() => handleAddFromRelated(result)}
                                style={{
                                  fontSize: 11, padding: "3px 11px", borderRadius: 5,
                                  background: c.brand, color: c.white, border: "none",
                                  cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                                }}
                              >
                                Add
                              </button>
                              <button
                                onClick={() => handleDismissFromRelated(result.input_id)}
                                style={{ ...btnG, fontSize: 11, padding: "3px 9px" }}
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
        {!editing && onDelete && (
          <div style={{ padding: "12px 24px 18px", borderTop: `1px solid ${c.border}`, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6, border: `1px solid ${c.redBorder}`, background: "transparent", color: c.red800, cursor: "pointer", fontFamily: "inherit" }}
            >
              Delete cluster
            </button>
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

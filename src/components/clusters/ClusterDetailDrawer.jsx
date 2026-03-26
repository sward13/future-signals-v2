/**
 * ClusterDetailDrawer — right-side drawer showing full cluster detail with read/edit mode.
 * Shows name, subtype, horizon, likelihood, description, and linked inputs.
 * @param {{ clusterId: string|null, clusters: object[], inputs: object[], onClose: () => void, onSave: (id, fields) => void, onRemoveInput: (inputId, clusterId) => void, onAssignInput: (inputId, clusterId) => void }} props
 */
import { useState, useEffect } from "react";
import { c, inp, ta, btnP, btnSec, btnG, fl } from "../../styles/tokens.js";
import { SubtypeTag, HorizTag, Tag } from "../shared/Tag.jsx";

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

export function ClusterDetailDrawer({ clusterId, clusters, inputs, onClose, onSave, onRemoveInput, onAssignInput }) {
  const cluster = clusters.find((cl) => cl.id === clusterId) || null;

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);

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
          <div style={{ marginBottom: 8 }}>
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
      </div>
    </>
  );
}

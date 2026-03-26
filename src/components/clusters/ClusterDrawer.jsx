/**
 * ClusterDrawer — slide-over drawer for creating a new cluster.
 * Fields: name (required), subtype (3-card selector), horizon (pill), likelihood (pill), description.
 * @param {{ open: boolean, onClose: () => void, onSave: (fields: object) => void, projectId: string }} props
 */
import { useState } from "react";
import { c, inp, ta, btnP, btnSec, btnG, fl, fh, badg } from "../../styles/tokens.js";

const SUBTYPES = [
  { id: "Trend",   label: "Trend",   desc: "A directional shift gaining momentum." },
  { id: "Driver",  label: "Driver",  desc: "A force accelerating or shaping change." },
  { id: "Tension", label: "Tension", desc: "A conflict or pressure between forces." },
];

const HORIZONS = ["H1", "H2", "H3"];
const LIKELIHOODS = ["Possible", "Plausible", "Probable"];

const EMPTY = { name: "", subtype: "Trend", horizon: "H1", likelihood: "Plausible", description: "" };

const HORIZON_COLORS = {
  H1: [c.green700, c.green50, c.greenBorder],
  H2: [c.blue700,  c.blue50,  c.blueBorder],
  H3: [c.amber700, c.amber50, c.amberBorder],
};

export function ClusterDrawer({ open, onClose, onSave, projectId }) {
  const [fields, setFields] = useState(EMPTY);
  const [nameError, setNameError] = useState(false);

  const reset = () => { setFields(EMPTY); setNameError(false); };
  const handleClose = () => { reset(); onClose(); };
  const set = (key, val) => setFields((f) => ({ ...f, [key]: val }));

  const handleSave = () => {
    if (!fields.name.trim()) { setNameError(true); return; }
    onSave({ ...fields, name: fields.name.trim(), project_id: projectId });
    reset();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 300 }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: c.white, borderLeft: `1px solid ${c.border}`,
        zIndex: 301, display: "flex", flexDirection: "column",
        animation: "drawerSlideIn 0.28s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: `1px solid ${c.border}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 2 }}>
              New cluster
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, color: c.ink }}>Create a cluster</div>
          </div>
          <button onClick={handleClose} style={{ ...btnG, fontSize: 16, padding: "2px 6px", color: c.muted }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <div style={fl}>Cluster name <span style={badg}>required</span></div>
            <input
              style={{ ...inp, borderColor: nameError ? c.redBorder : undefined }}
              type="text"
              value={fields.name}
              onChange={(e) => { set("name", e.target.value); setNameError(false); }}
              placeholder="e.g. Regulatory Fragmentation"
              autoFocus
            />
            {nameError && <div style={{ fontSize: 11, color: c.red800, marginTop: 4 }}>Cluster name is required.</div>}
          </div>

          {/* Subtype — 3-card selector */}
          <div style={{ marginBottom: 18 }}>
            <div style={fl}>Subtype</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {SUBTYPES.map(({ id, label, desc }) => {
                const on = fields.subtype === id;
                return (
                  <button
                    key={id}
                    onClick={() => set("subtype", id)}
                    style={{
                      padding: "10px", borderRadius: 8,
                      border: `1px solid ${on ? c.ink : c.border}`,
                      background: on ? "rgba(0,0,0,0.02)" : c.white,
                      textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 10, color: c.muted, lineHeight: 1.4 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horizon */}
          <div style={{ marginBottom: 18 }}>
            <div style={fl}>Horizon</div>
            <div style={{ display: "flex", gap: 8 }}>
              {HORIZONS.map((h) => {
                const on = fields.horizon === h;
                const [col, bg, brd] = HORIZON_COLORS[h];
                return (
                  <button
                    key={h}
                    onClick={() => set("horizon", h)}
                    style={{
                      padding: "6px 22px", borderRadius: 20,
                      border: `1px solid ${on ? brd : c.border}`,
                      background: on ? bg : c.white,
                      color: on ? col : c.muted,
                      fontSize: 12, fontWeight: on ? 600 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Likelihood */}
          <div style={{ marginBottom: 18 }}>
            <div style={fl}>Likelihood</div>
            <div style={{ display: "flex", gap: 8 }}>
              {LIKELIHOODS.map((l) => {
                const on = fields.likelihood === l;
                return (
                  <button
                    key={l}
                    onClick={() => set("likelihood", l)}
                    style={{
                      padding: "6px 16px", borderRadius: 20,
                      border: `1px solid ${on ? c.borderMid : c.border}`,
                      background: on ? c.ink : c.white,
                      color: on ? c.white : c.muted,
                      fontSize: 12, fontWeight: on ? 500 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 8 }}>
            <div style={fl}>Description <span style={{ ...badg, marginLeft: 2 }}>optional</span></div>
            <div style={fh}>What does this cluster represent? What drives it?</div>
            <textarea
              style={ta}
              rows={4}
              value={fields.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Diverging national frameworks create compliance complexity across jurisdictions…"
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px 20px", borderTop: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0,
        }}>
          <button onClick={handleClose} style={btnSec}>Cancel</button>
          <button
            onClick={handleSave}
            style={{ ...btnP, opacity: fields.name.trim() ? 1 : 0.4 }}
          >
            Create cluster
          </button>
        </div>
      </div>
    </>
  );
}

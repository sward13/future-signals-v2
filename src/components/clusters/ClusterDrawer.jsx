/**
 * ClusterDrawer — slide-over drawer for creating a new cluster.
 * Fields: name (required), subtype (3-card selector), horizon (pill), likelihood (pill), description, linked inputs.
 * @param {{ open: boolean, onClose: () => void, onSave: (fields: object) => void, projectId: string, projectInputs: object[] }} props
 */
import { useState, useEffect } from "react";
import { c, inp, ta, btnP, btnSec, btnG, fl, fh, badg } from "../../styles/tokens.js";
import { StrengthDot, HorizTag, SubtypeTag } from "../shared/Tag.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";

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

export function ClusterDrawer({ open, onClose, onSave, projectId, projectInputs = [], preselectedInputIds = [], onAddInput, projects = [] }) {
  const [fields, setFields] = useState(EMPTY);
  const [nameError, setNameError] = useState(false);
  const [selectedInputIds, setSelectedInputIds] = useState([]);
  const [addInputLayerOpen, setAddInputLayerOpen] = useState(false);

  // Sync pre-selected IDs whenever the drawer is opened
  useEffect(() => {
    if (open) setSelectedInputIds([...preselectedInputIds]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => { setFields(EMPTY); setNameError(false); setSelectedInputIds([]); };
  const handleClose = () => { reset(); onClose(); };
  const set = (key, val) => setFields((f) => ({ ...f, [key]: val }));

  const toggleInput = (id) =>
    setSelectedInputIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSave = () => {
    if (!fields.name.trim()) { setNameError(true); return; }
    onSave({ ...fields, name: fields.name.trim(), project_id: projectId, input_ids: selectedInputIds });
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
            <div style={{ fontSize: 17, fontWeight: 500, color: c.ink }}>Build a cluster</div>
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
          <div style={{ marginBottom: 18 }}>
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

          {/* Link inputs */}
          <div style={{ marginBottom: 8 }}>
            <div style={fl}>Link inputs <span style={{ ...badg, marginLeft: 2 }}>optional</span></div>
            <div style={fh}>Select the inputs that belong to this cluster.</div>

            {projectInputs.length === 0 ? (
              <div style={{
                padding: "12px 14px",
                background: c.surfaceAlt,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                fontSize: 12,
                color: c.muted,
              }}>
                No inputs in this project yet —{" "}
                {onAddInput ? (
                  <button
                    onClick={() => setAddInputLayerOpen(true)}
                    style={{
                      background: "none", border: "none", padding: 0,
                      fontSize: 12, color: c.ink, textDecoration: "underline",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    add one now
                  </button>
                ) : (
                  "add some first."
                )}
              </div>
            ) : (
              <div style={{
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                overflow: "hidden",
              }}>
                {projectInputs.map((input, idx) => {
                  const checked = selectedInputIds.includes(input.id);
                  return (
                    <div
                      key={input.id}
                      onClick={() => toggleInput(input.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        cursor: "pointer",
                        background: checked ? "rgba(0,0,0,0.02)" : c.white,
                        borderTop: idx > 0 ? `1px solid ${c.border}` : "none",
                        transition: "background 0.1s",
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 15, height: 15, borderRadius: 3, flexShrink: 0,
                        border: `1.5px solid ${checked ? c.ink : c.borderMid}`,
                        background: checked ? c.ink : c.white,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {checked && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {/* Title */}
                      <span style={{
                        flex: 1, fontSize: 12, color: c.ink, fontWeight: checked ? 500 : 400,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {input.name}
                      </span>
                      {/* Tags */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        {input.subtype && <SubtypeTag sub={input.subtype} />}
                        {input.strength && <StrengthDot str={input.strength} />}
                        {input.horizon && <HorizTag h={input.horizon} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Counter */}
            <div style={{ fontSize: 11, color: c.muted, marginTop: 8 }}>
              {selectedInputIds.length > 0
                ? `${selectedInputIds.length} input${selectedInputIds.length !== 1 ? "s" : ""} selected`
                : "No inputs linked yet"}
            </div>
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
            Build cluster
          </button>
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
    </>
  );
}

/**
 * ScenarioDrawer — slide-over drawer for creating a new scenario.
 * Shared between ScenarioCanvas and ProjectDetail.
 * @param {{ projectClusters: object[], onClose: () => void, onSave: (fields: object) => void }} props
 */
import { useState } from "react";
import { c, btnP, btnSec, btnG, inp, ta, fl } from "../../styles/tokens.js";
import { SubtypeTag } from "../shared/Tag.jsx";

export const ARCHETYPES = [
  { key: "Continuation",   desc: "Trends extend; the future broadly resembles the present." },
  { key: "Collapse",       desc: "A critical system breaks down; discontinuity is sharp." },
  { key: "Constraint",     desc: "Growth hits hard limits; forced adaptation without collapse." },
  { key: "Transformation", desc: "Fundamental structural shift opens new possibilities." },
];

export const HORIZON_COLORS = {
  H1: { col: c.green700, bg: c.green50,  border: c.greenBorder },
  H2: { col: c.blue700,  bg: c.blue50,   border: c.blueBorder  },
  H3: { col: c.amber700, bg: c.amber50,  border: c.amberBorder },
};

function SmallCheckbox({ checked }) {
  return (
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
  );
}

export function ScenarioDrawer({ projectClusters, onClose, onSave }) {
  const [name,       setName]       = useState("");
  const [archetype,  setArchetype]  = useState("Continuation");
  const [horizon,    setHorizon]    = useState("H2");
  const [clusterIds, setClusterIds] = useState([]);
  const [narrative,  setNarrative]  = useState("");

  const toggleCluster = (id) =>
    setClusterIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), archetype, horizon, cluster_ids: clusterIds, narrative });
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 300 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
        background: c.white, borderLeft: `1px solid ${c.border}`,
        zIndex: 301, display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
        animation: "drawerSlideIn 0.25s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, fontSize: 16, fontWeight: 500, color: c.ink }}>New Scenario</div>
            <button onClick={onClose} style={{ ...btnG, padding: "4px 8px", fontSize: 16 }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>

          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={fl}>Name <span style={{ color: c.red800 }}>*</span></label>
            <input
              style={inp} autoFocus
              placeholder="e.g. The Governance Chasm"
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          {/* Archetype */}
          <div style={{ marginBottom: 18 }}>
            <label style={fl}>Archetype</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {ARCHETYPES.map(({ key, desc }) => {
                const isSel = archetype === key;
                return (
                  <button key={key} onClick={() => setArchetype(key)} style={{
                    padding: "10px 11px", borderRadius: 8, textAlign: "left",
                    border: `1.5px solid ${isSel ? c.ink : c.border}`,
                    background: isSel ? c.ink : c.white,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isSel ? c.white : c.ink, marginBottom: 3 }}>{key}</div>
                    <div style={{ fontSize: 10, color: isSel ? "rgba(255,255,255,0.6)" : c.hint, lineHeight: 1.4 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horizon */}
          <div style={{ marginBottom: 18 }}>
            <label style={fl}>Horizon</label>
            <div style={{ display: "flex", gap: 7 }}>
              {["H1", "H2", "H3"].map((h) => {
                const hc = HORIZON_COLORS[h];
                const isSel = horizon === h;
                return (
                  <button key={h} onClick={() => setHorizon(h)} style={{
                    padding: "6px 18px", borderRadius: 20,
                    border: `1.5px solid ${isSel ? hc.col : c.border}`,
                    background: isSel ? hc.bg : "transparent",
                    color: isSel ? hc.col : c.muted,
                    fontSize: 12, fontWeight: isSel ? 600 : 400,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{h}</button>
                );
              })}
            </div>
          </div>

          {/* Link clusters */}
          {projectClusters.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={fl}>Link clusters</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {projectClusters.map((cl) => {
                  const checked = clusterIds.includes(cl.id);
                  return (
                    <button key={cl.id} onClick={() => toggleCluster(cl.id)} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "7px 10px", borderRadius: 6,
                      border: `1px solid ${checked ? c.borderMid : c.border}`,
                      background: checked ? "rgba(0,0,0,0.02)" : c.white,
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}>
                      <SmallCheckbox checked={checked} />
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cl.name}
                      </span>
                      <SubtypeTag sub={cl.subtype} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {projectClusters.length === 0 && (
            <div style={{ marginBottom: 18, padding: "10px 12px", borderRadius: 8, background: c.surfaceAlt, border: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 11, color: c.hint }}>No clusters yet. Create clusters first to link them to this scenario.</div>
            </div>
          )}

          {/* Narrative seed */}
          <div>
            <label style={fl}>
              Narrative seed{" "}
              <span style={{ fontSize: 10, color: c.hint, fontWeight: 400, fontStyle: "italic" }}>(optional)</span>
            </label>
            <textarea
              style={{ ...ta, minHeight: 80 }}
              placeholder="A brief opening framing for this scenario…"
              value={narrative} onChange={(e) => setNarrative(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 22px", borderTop: `1px solid ${c.border}`, display: "flex", gap: 9, flexShrink: 0 }}>
          <button onClick={onClose} style={btnSec}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{ ...btnP, flex: 1, opacity: name.trim() ? 1 : 0.35, cursor: name.trim() ? "pointer" : "default" }}
          >
            Create scenario
          </button>
        </div>
      </div>

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

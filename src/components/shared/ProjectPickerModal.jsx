import { useState } from "react";
import { c } from "../../styles/tokens.js";

export function ProjectPickerModal({ projects, onSelect, onClose, onCreateProject }) {
  const [hovered, setHovered] = useState(null);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 400 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 401, width: 360, background: c.white, borderRadius: 12,
        border: `1px solid ${c.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.16)", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, marginBottom: 2 }}>Save to project</div>
          <div style={{ fontSize: 11, color: c.muted }}>Select a project to assign this input to.</div>
        </div>
        {projects.length === 0 ? (
          <div style={{ padding: "28px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: c.muted, marginBottom: 12 }}>No projects yet.</div>
            {onCreateProject && (
              <button onClick={() => { onClose(); onCreateProject(); }} style={{ fontSize: 12, color: c.blue700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                + Create project
              </button>
            )}
          </div>
        ) : (
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {projects.map((p) => (
              <div key={p.id} onClick={() => onSelect(p)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 20px", cursor: "pointer",
                  background: hovered === p.id ? c.surfaceAlt : c.white,
                  borderBottom: `1px solid ${c.border}`,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: c.muted }}>{p.domain}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

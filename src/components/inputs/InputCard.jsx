/**
 * InputCard — displays a single input in the Inbox or project context.
 * @param {{ input: object, projects: object[], onSaveToProject?: (id, projectId) => void, onDismiss?: (id) => void }} props
 */
import { c, btnSm, btnG } from "../../styles/tokens.js";
import { StrengthDot, HorizTag } from "../shared/Tag.jsx";

const SUBTYPE_LABELS = {
  article: "Article",
  report: "Report",
  data: "Data",
  observation: "Observation",
  other: "Other",
};

/** @param {{ input: object, projects: object[], onSaveToProject?: Function, onDismiss?: Function, onClick?: Function }} props */
export function InputCard({ input, projects = [], onSaveToProject, onDismiss, onClick }) {
  const project = projects.find((p) => p.id === input.project_id);

  return (
    <div
      onClick={onClick}
      style={{
        background: c.white,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        transition: "border-color 0.15s",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* Top meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {input.subtype && (
          <span style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 4,
            background: "#f0f0ee",
            color: c.faint,
          }}>
            {SUBTYPE_LABELS[input.subtype] || input.subtype}
          </span>
        )}
        {project && (
          <span style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 4,
            background: c.blue50,
            color: c.blue700,
            border: `1px solid ${c.blueBorder}`,
          }}>
            {project.name}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          <StrengthDot str={input.strength} />
        </span>
      </div>

      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, lineHeight: 1.35, marginBottom: 5 }}>
        {input.name}
      </div>

      {/* Description */}
      {input.description && (
        <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.6, marginBottom: 10 }}>
          {input.description}
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {(input.steepled || []).map((cat) => (
          <span key={cat} style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 4,
            background: "#f0f0ee",
            color: c.muted,
          }}>
            {cat}
          </span>
        ))}
        <HorizTag h={input.horizon} />
        <span style={{ fontSize: 10, color: c.hint, marginLeft: 2 }}>{input.created_at}</span>

        {(onSaveToProject || onDismiss) && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {onDismiss && (
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(input.id); }}
                style={{ ...btnG, fontSize: 11, padding: "4px 8px", color: c.hint }}
              >
                Dismiss
              </button>
            )}
            {onSaveToProject && !input.project_id && (
              <button
                onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }}
                style={{ ...btnSm, fontSize: 11, padding: "4px 12px" }}
              >
                Save to project
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

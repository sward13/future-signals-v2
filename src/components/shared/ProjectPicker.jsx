/**
 * ProjectPicker — shown on Clustering and Systems screens when no project is active.
 * Displays all projects with counts; clicking one sets it as the active project.
 * @param {{ heading: string, description: string, projects: object[], inputs: object[], clusters: object[], scenarios: object[], onSelect: (id: string) => void, onNewProject: () => void }} props
 */
import { c, btnSm, btnG } from "../../styles/tokens.js";

export function ProjectPicker({ heading, description, projects, inputs, clusters, scenarios, onSelect, onNewProject }) {
  if (projects.length === 0) {
    return (
      <div style={{ padding: "40px 32px", background: c.bg, minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 28, opacity: 0.1, marginBottom: 14 }}>◎</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: c.muted, marginBottom: 6 }}>No projects yet</div>
        <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.65, maxWidth: 300, marginBottom: 20 }}>
          Create your first project to get started.
        </div>
        <button onClick={onNewProject} style={btnSm}>+ New project</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 560 }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, marginBottom: 6 }}>{heading}</div>
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 24, lineHeight: 1.6 }}>{description}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map((p) => {
            const inputCount   = inputs.filter((i)  => i.project_id  === p.id).length;
            const clusterCount = clusters.filter((cl) => cl.project_id === p.id).length;
            const scenCount    = scenarios.filter((s)  => s.project_id  === p.id).length;

            return (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 18px", borderRadius: 10, textAlign: "left",
                  background: c.white, border: `1px solid ${c.border}`,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "border-color 0.1s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = c.borderMid}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = c.border}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {p.domain && (
                      <span style={{ fontSize: 10, color: c.muted }}>{p.domain}</span>
                    )}
                    <span style={{ fontSize: 10, color: c.hint }}>·</span>
                    <span style={{ fontSize: 10, color: c.hint }}>
                      {inputCount} input{inputCount !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 10, color: c.hint }}>·</span>
                    <span style={{ fontSize: 10, color: c.hint }}>
                      {clusterCount} cluster{clusterCount !== 1 ? "s" : ""}
                    </span>
                    {scenCount > 0 && (
                      <>
                        <span style={{ fontSize: 10, color: c.hint }}>·</span>
                        <span style={{ fontSize: 10, color: c.hint }}>
                          {scenCount} scenario{scenCount !== 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 14, color: c.hint }}>›</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onNewProject}
          style={{
            marginTop: 14, width: "100%",
            padding: "10px 0", borderRadius: 9,
            border: `1px dashed ${c.borderMid}`,
            background: "transparent",
            color: c.muted, fontSize: 12,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          + New project
        </button>
      </div>
    </div>
  );
}

/**
 * Dashboard screen — workspace overview with stats, projects list, and recent inputs.
 */
import { c, btnP, btnG } from "../../styles/tokens.js";
import { StrengthDot, HorizTag } from "../shared/Tag.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";

/**
 * @param {{ appState: object }} props
 */
export default function Dashboard({ appState }) {
  const { inputs, clusters, scenarios, projects, setActiveScreen, openProjectModal, openProject } = appState;

  const inboxCount  = inputs.filter((i) => i.project_id === null).length;
  const recentInputs = [...inputs.filter((i) => i.project_id === null)]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  return (
    <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 28,
      }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
            Workspace
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Dashboard</div>
        </div>
        <button onClick={openProjectModal} style={btnP}>+ New project</button>
      </div>

      {/* Stats row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 10,
        marginBottom: 28,
      }}>
        {[
          { label: "Projects",        value: projects.length, sub: "active" },
          { label: "Inputs in Inbox", value: inboxCount,      sub: "unassigned" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{
            background: c.white,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            padding: "16px 18px",
          }}>
            <div style={{ fontSize: 24, fontWeight: 500, color: c.ink, lineHeight: 1, marginBottom: 4 }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: c.muted }}>{label}</div>
            <div style={{ fontSize: 10, color: c.hint }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Projects section */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Projects</div>
        {projects.length > 0 && (
          <div style={{ fontSize: 11, color: c.hint }}>{projects.length} active</div>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon="◻"
          title="No projects yet"
          body="Create a project to give your inquiry a structured home — then assign signals to it."
          ctaLabel="+ New project"
          onCta={openProjectModal}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
          {projects.map((p) => {
            const projectInputs = inputs.filter((i) => i.project_id === p.id);
            const projectClusters = clusters.filter((cl) => cl.project_id === p.id);
            const projectScenarios = scenarios.filter((s) => s.project_id === p.id);

            return (
              <div
                key={p.id}
                onClick={() => openProject(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 18px",
                  background: c.white,
                  border: `1px solid ${c.border}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "border-color 0.12s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = c.borderMid}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = c.border}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: c.hint, margin: "0 6px" }}>·</span>
                  <span style={{ fontSize: 11, color: c.muted }}>{p.domain}</span>
                  <span style={{
                    marginLeft: 8,
                    fontSize: 10, padding: "1px 7px", borderRadius: 8,
                    background: p.mode === "deep_analysis" ? c.violet50 : c.surfaceAlt,
                    color: p.mode === "deep_analysis" ? c.violet700 : c.hint,
                    border: `1px solid ${p.mode === "deep_analysis" ? c.violetBorder : c.border}`,
                  }}>
                    {p.mode === "deep_analysis" ? "Deep analysis" : "Quick scan"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: c.hint, flexShrink: 0 }}>
                  <span>{projectInputs.length} inputs</span>
                  <span>{projectClusters.length} clusters</span>
                  <span>{projectScenarios.length} systems</span>
                </div>
                <span style={{ fontSize: 12, color: c.hint, flexShrink: 0 }}>→</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent inputs */}
      {recentInputs.length > 0 && (
        <div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Recent inputs</div>
            <button
              onClick={() => setActiveScreen("inbox")}
              style={{ ...btnG, fontSize: 11 }}
            >
              View all →
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentInputs.map((inp) => (
              <div key={inp.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: c.white,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
              }}>
                <StrengthDot str={inp.strength} />
                <div style={{ fontSize: 12, color: c.ink, flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inp.name}
                  </div>
                </div>
                <HorizTag h={inp.horizon} />
                <span style={{ fontSize: 10, color: c.hint }}>{inp.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

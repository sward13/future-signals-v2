/**
 * ProjectDetail screen — project metadata, two-column layout:
 * left = inputs list, right = clusters/systems summary stubs.
 */
import { useState } from "react";
import { c, btnP, btnSm, btnSec, btnG, fl } from "../../styles/tokens.js";
import { StrengthDot, HorizTag, SubtypeTag } from "../shared/Tag.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { AddFromInboxModal } from "../inputs/AddFromInboxModal.jsx";

// ─── Read-only horizon bar ─────────────────────────────────────────────────────

function HorizonBar({ project }) {
  const start = parseInt(project.h1_start, 10) || 2025;
  const end = parseInt(project.h3_end, 10) || 2040;
  const h1End = parseInt(project.h1_end, 10) || start + 3;
  const h2End = parseInt(project.h2_end, 10) || h1End + 5;
  const span = end - start || 15;

  const h1Pct = ((h1End - start) / span) * 100;
  const h2Pct = ((h2End - start) / span) * 100;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: "relative", height: 32, borderRadius: 8, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: `${h1Pct}%`, height: "100%",
          background: c.green50, borderRight: `2px solid ${c.white}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.green700 }}>H1</span>
        </div>
        <div style={{
          position: "absolute", left: `${h1Pct}%`, top: 0,
          width: `${h2Pct - h1Pct}%`, height: "100%",
          background: c.blue50, borderRight: `2px solid ${c.white}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.blue700 }}>H2</span>
        </div>
        <div style={{
          position: "absolute", left: `${h2Pct}%`, top: 0, right: 0, height: "100%",
          background: c.amber50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.amber700 }}>H3</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
        <div style={{ fontSize: 11, color: c.green700 }}>{project.h1_start}–{project.h1_end}</div>
        <div style={{ fontSize: 11, color: c.blue700, textAlign: "center" }}>{project.h2_start}–{project.h2_end}</div>
        <div style={{ fontSize: 11, color: c.amber700, textAlign: "right" }}>{project.h3_start}–{project.h3_end}</div>
      </div>
    </div>
  );
}

// ─── Input card (Inbox-style, no 'Curated from' attribution) ──────────────────

function InputCard({ input, onClick }) {
  const SUBTYPE_ICONS = {
    signal: "◎", issue: "▲", projection: "◆", plan: "◉", obstacle: "▲", source: "◻",
  };
  const icon = SUBTYPE_ICONS[input.subtype] || "◎";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "11px 14px",
        background: c.white,
        border: `1px solid ${c.border}`,
        borderRadius: 9,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 11, color: c.hint, width: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {input.name}
        </div>
        {input.description && (
          <div style={{ fontSize: 11, color: c.muted, marginTop: 2, lineHeight: 1.45,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {input.description}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
          {input.subtype && (
            <span style={{ fontSize: 10, color: c.hint, textTransform: "capitalize" }}>{input.subtype}</span>
          )}
          {input.strength && <StrengthDot str={input.strength} />}
          {input.horizon && <HorizTag h={input.horizon} />}
        </div>
      </div>
    </div>
  );
}

// ─── Right-column summary card ─────────────────────────────────────────────────

function SummaryCard({ icon, title, count, countLabel, emptyBody, ctaLabel, onCta, children }) {
  return (
    <div style={{
      background: c.white,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: count > 0 ? `1px solid ${c.border}` : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12, color: c.hint }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{title}</span>
        </div>
        <span style={{
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 8,
          background: count > 0 ? c.ink : "rgba(0,0,0,0.06)",
          color: count > 0 ? c.white : c.hint,
          fontWeight: 500,
        }}>
          {count} {countLabel}
        </span>
      </div>
      {count > 0 ? (
        <div style={{ padding: "10px 14px" }}>
          {children}
        </div>
      ) : (
        <div style={{ padding: "16px 16px" }}>
          <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.55, marginBottom: ctaLabel ? 10 : 0 }}>{emptyBody}</div>
          {ctaLabel && (
            <button onClick={onCta} style={{
              fontSize: 11, color: c.ink, background: "transparent", border: `1px solid ${c.borderMid}`,
              borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit",
            }}>
              {ctaLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

/**
 * @param {{ appState: object }} props
 */
export default function ProjectDetail({ appState }) {
  const {
    activeProjectId, projects, inputs, clusters, scenarios,
    addInput, saveInputsToProject, showToast, setActiveScreen,
    openInputDetail, openClusterDetail,
  } = appState;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);

  const project = projects.find((p) => p.id === activeProjectId);

  if (!project) {
    return (
      <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, marginBottom: 8 }}>No project selected</div>
        <button onClick={() => setActiveScreen("dashboard")} style={{ ...btnSec, marginTop: 8 }}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const projectInputs = inputs.filter((i) => i.project_id === project.id);
  const projectClusters = clusters.filter((cl) => cl.project_id === project.id);
  const projectScenarios = scenarios.filter((s) => s.project_id === project.id);

  const inboxInputs = inputs.filter((i) => i.project_id === null);

  const handleAddInput = (fields) => {
    addInput({ ...fields, project_id: project.id });
    showToast("Input added to project");
    setDrawerOpen(false);
  };

  const handleAddFromInbox = (ids) => {
    saveInputsToProject(ids, project.id);
    setInboxModalOpen(false);
    showToast(`${ids.length} input${ids.length !== 1 ? "s" : ""} added to "${project.name}"`);
  };

  return (
    <>
      <div style={{ padding: "24px 32px", background: c.bg, minHeight: "100%", overflowY: "auto" }}>

        {/* ── Breadcrumb ──────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <button
            onClick={() => setActiveScreen("dashboard")}
            style={{ ...btnG, padding: "3px 0", fontSize: 11, color: c.hint }}
          >
            Projects
          </button>
          <span style={{ fontSize: 11, color: c.hint }}>›</span>
          <span style={{ fontSize: 11, color: c.muted }}>{project.name}</span>
        </div>

        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>{project.name}</div>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 8,
                background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}`,
              }}>
                {project.domain}
              </span>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 8,
                background: project.mode === "deep_analysis" ? c.violet50 : c.surfaceAlt,
                color: project.mode === "deep_analysis" ? c.violet700 : c.muted,
                border: `1px solid ${project.mode === "deep_analysis" ? c.violetBorder : c.border}`,
              }}>
                {project.mode === "deep_analysis" ? "Deep analysis" : "Quick scan"}
              </span>
            </div>
            {project.question && (
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.6, fontStyle: "italic", marginTop: 4, maxWidth: 560 }}>
                "{project.question}"
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setInboxModalOpen(true)}
              style={{ ...btnSec, fontSize: 12, padding: "8px 16px" }}
            >
              Add from Inbox
            </button>
            <button onClick={() => setDrawerOpen(true)} style={btnP}>+ Add input</button>
          </div>
        </div>

        {/* ── Horizon bar ─────────────────────────────────────── */}
        {project.h1_start && (
          <div style={{
            padding: "14px 18px",
            background: c.white,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: c.muted, marginBottom: 10 }}>Time horizons</div>
            <HorizonBar project={project} />
          </div>
        )}

        {/* ── Two-column body ──────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: 20,
          alignItems: "start",
        }}>

          {/* ── LEFT: Inputs list ────────────────────────────── */}
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>
                Inputs
                {projectInputs.length > 0 && (
                  <span style={{
                    marginLeft: 7, fontSize: 10, padding: "1px 6px", borderRadius: 8,
                    background: c.ink, color: c.white, fontWeight: 500,
                  }}>
                    {projectInputs.length}
                  </span>
                )}
              </div>
              {projectInputs.length > 0 && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setInboxModalOpen(true)} style={{ ...btnG, fontSize: 11 }}>Add from Inbox</button>
                  <button onClick={() => setDrawerOpen(true)} style={{ ...btnG, fontSize: 11 }}>+ Add</button>
                </div>
              )}
            </div>

            {projectInputs.length === 0 ? (
              <div style={{
                background: c.white, border: `1px dashed ${c.border}`,
                borderRadius: 12, padding: "36px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 26, opacity: 0.12, marginBottom: 10 }}>◎</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: c.muted, marginBottom: 5 }}>No inputs yet</div>
                <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.6, marginBottom: 18 }}>
                  Add your first signal, issue, or projection to get started.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button onClick={() => setDrawerOpen(true)} style={btnP}>+ Add input</button>
                  <button onClick={() => setInboxModalOpen(true)} style={{ ...btnSec, fontSize: 13 }}>Add from Inbox</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {projectInputs.map((inp) => (
                    <InputCard key={inp.id} input={inp} onClick={() => openInputDetail(inp.id)} />
                  ))}
                </div>
                <button
                  onClick={() => setDrawerOpen(true)}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "10px 0",
                    border: `1px dashed ${c.borderMid}`,
                    borderRadius: 9,
                    background: "transparent",
                    color: c.muted,
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + Add another input
                </button>
              </>
            )}
          </div>

          {/* ── RIGHT: Clusters & Systems summary ───────────── */}
          <div>
            <SummaryCard
              icon="◈"
              title="Clusters"
              count={projectClusters.length}
              countLabel="built"
              emptyBody={
                projectInputs.length < 3
                  ? `Add at least 3 inputs before clustering. You have ${projectInputs.length} so far.`
                  : "Group your inputs into themes and drivers."
              }
              ctaLabel={projectInputs.length >= 3 ? "Go to Clustering →" : undefined}
              onCta={() => setActiveScreen("clustering")}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {projectClusters.map((cl) => (
                  <div key={cl.id} onClick={() => openClusterDetail(cl.id)} style={{
                    padding: "9px 12px",
                    background: c.surfaceAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <SubtypeTag sub={cl.subtype} />
                      <HorizTag h={cl.horizon} />
                      <span style={{ fontSize: 10, color: c.hint, marginLeft: "auto" }}>{cl.input_ids?.length || 0} inputs</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{cl.name}</div>
                  </div>
                ))}
              </div>
            </SummaryCard>

            <SummaryCard
              icon="◆"
              title="Systems"
              count={projectScenarios.length}
              countLabel="built"
              emptyBody="Systems are built from clusters. Complete your clustering step first."
              ctaLabel={projectClusters.length > 0 ? "Go to Systems →" : undefined}
              onCta={() => setActiveScreen("scenarios")}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {projectScenarios.map((s) => (
                  <div key={s.id} style={{
                    padding: "9px 12px",
                    background: c.surfaceAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{s.name}</div>
                    {s.description && (
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 3 }}>{s.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </SummaryCard>

            {/* Metadata strip */}
            {(project.geo || project.unit || project.stakeholders) && (
              <div style={{
                padding: "12px 14px",
                background: c.white,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 10 }}>
                  Project details
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {project.geo && (
                    <div>
                      <div style={{ fontSize: 10, color: c.hint, marginBottom: 1 }}>Geography</div>
                      <div style={{ fontSize: 12, color: c.ink }}>{project.geo}</div>
                    </div>
                  )}
                  {project.unit && (
                    <div>
                      <div style={{ fontSize: 10, color: c.hint, marginBottom: 1 }}>Unit of analysis</div>
                      <div style={{ fontSize: 12, color: c.ink }}>{project.unit}</div>
                    </div>
                  )}
                  {project.stakeholders && (
                    <div>
                      <div style={{ fontSize: 10, color: c.hint, marginBottom: 1 }}>Stakeholders</div>
                      <div style={{ fontSize: 12, color: c.ink }}>{project.stakeholders}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input drawer pre-scoped to this project */}
      <InputDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleAddInput}
        projects={projects}
        defaultProjectId={project.id}
      />

      {/* Add from Inbox modal */}
      <AddFromInboxModal
        open={inboxModalOpen}
        onClose={() => setInboxModalOpen(false)}
        onConfirm={handleAddFromInbox}
        inboxInputs={inboxInputs}
        projectName={project.name}
        onCreateNew={() => { setInboxModalOpen(false); setDrawerOpen(true); }}
      />
    </>
  );
}

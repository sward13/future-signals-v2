/**
 * FutureModels hub — scrollable project-level page showing Scenarios,
 * Preferred Future, and Strategic Options in stacked section cards.
 * Create/edit/detail views are not built here (Prompt 3+).
 */
import { useState } from "react";
import { c, btnSm, btnSec } from "../../styles/tokens.js";
import { HorizTag } from "../shared/Tag.jsx";

// ─── Feasibility badge ────────────────────────────────────────────────────────

function FeasibilityBadge({ value }) {
  if (!value) return null;
  const map = {
    high:   [c.green700,  c.green50,  c.greenBorder],
    medium: [c.amber700,  c.amber50,  c.amberBorder],
    low:    [c.red800,    c.red50,    c.redBorder],
  };
  const [col, bg, brd] = map[value.toLowerCase()] || [c.hint, c.surfaceAlt, c.border];
  const label = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 10,
      background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─── Section card shell ───────────────────────────────────────────────────────

function SectionCard({ children }) {
  return (
    <div style={{
      background: c.white,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      marginBottom: 20,
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, count, action }) {
  return (
    <div style={{
      padding: "14px 20px 13px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      borderBottom: `1px solid ${c.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: c.ink }}>{title}</span>
        {count > 0 && (
          <span style={{
            fontSize: 11, color: c.muted, background: c.bg,
            padding: "1px 7px", borderRadius: 8,
          }}>
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── Scenario card (2-col grid) ───────────────────────────────────────────────

function ScenarioCard({ scenario, clusterName, onClick }) {
  const [hovered, setHovered] = useState(false);
  const diffs = Array.isArray(scenario.key_differences) ? scenario.key_differences : [];
  const forces = Array.isArray(scenario.driving_forces) ? scenario.driving_forces : [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: c.white,
        border: `1px solid ${hovered ? c.borderMid : c.border}`,
        borderRadius: 12, padding: "16px 18px",
        cursor: "pointer",
        transition: "border-color 0.12s, box-shadow 0.12s",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.07)" : "none",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Top row: name + horizon */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, lineHeight: 1.35 }}>
          {scenario.name}
        </div>
        <div style={{ flexShrink: 0 }}>
          {scenario.archetype && (
            <span style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 10,
              background: c.surfaceAlt, color: c.muted,
              border: `1px solid ${c.border}`, marginRight: 4,
            }}>
              {scenario.archetype}
            </span>
          )}
          {scenario.horizon && <HorizTag h={scenario.horizon} />}
        </div>
      </div>

      {/* Key differences */}
      {diffs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12, flex: 1 }}>
          {diffs.slice(0, 3).map((diff, i) => (
            <div key={i} style={{
              fontSize: 11, color: c.muted, lineHeight: 1.45,
              paddingLeft: 10, borderLeft: `2px solid ${c.border}`,
            }}>
              {diff}
            </div>
          ))}
        </div>
      )}

      {/* Driving forces footer */}
      {forces.length > 0 && (
        <div style={{
          display: "flex", gap: 4, flexWrap: "wrap",
          paddingTop: 10, borderTop: `1px solid ${c.border}`,
        }}>
          {forces.slice(0, 4).map((id) => (
            <span key={id} style={{
              fontSize: 10, color: c.muted, background: c.bg,
              borderRadius: 4, padding: "1px 6px",
              border: `1px solid ${c.border}`,
            }}>
              {clusterName(id)}
            </span>
          ))}
          {forces.length > 4 && (
            <span style={{ fontSize: 10, color: c.hint }}>+{forces.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Preferred Future card ─────────────────────────────────────────────────────

function PreferredFutureCard({ pf, scenarioName, onClick }) {
  const [hovered, setHovered] = useState(false);
  const outcomes     = Array.isArray(pf.guiding_principles)   ? pf.guiding_principles   : [];
  const principles   = Array.isArray(pf.strategic_priorities)  ? pf.strategic_priorities  : [];
  const indicators   = Array.isArray(pf.indicators)           ? pf.indicators           : [];
  const scenarioIds  = Array.isArray(pf.scenario_ids)         ? pf.scenario_ids         : [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: c.white,
        border: `1px solid ${hovered ? c.borderMid : c.border}`,
        borderRadius: 12, overflow: "hidden", cursor: "pointer",
        transition: "border-color 0.12s, box-shadow 0.12s",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.07)" : "none",
      }}
    >
      {/* Top: name + description + horizon */}
      <div style={{ padding: "16px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: c.ink, lineHeight: 1.3, marginBottom: 5 }}>
            {pf.name}
          </div>
          {pf.description && (
            <div style={{
              fontSize: 12, color: c.muted, lineHeight: 1.6,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              maxWidth: 500,
            }}>
              {pf.description}
            </div>
          )}
        </div>
        {pf.horizon && (
          <div style={{ flexShrink: 0 }}>
            <HorizTag h={pf.horizon} />
          </div>
        )}
      </div>

      {/* 3-column field grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 16, padding: "12px 20px",
        borderTop: `1px solid ${c.border}`,
      }}>
        {[
          { label: "Desired outcomes",     value: pf.desired_outcomes },
          { label: "Guiding principles",   value: outcomes[0] },
          { label: "Indicators",           value: indicators[0] },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{
              fontSize: 10, fontWeight: 500, color: c.hint,
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4,
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 12, color: c.muted, lineHeight: 1.5,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {value || <span style={{ color: c.hint }}>—</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Sources footer */}
      {scenarioIds.length > 0 && (
        <div style={{
          padding: "9px 20px", borderTop: `1px solid ${c.border}`,
          display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 10, color: c.hint }}>Draws from:</span>
          {scenarioIds.map((id) => (
            <span key={id} style={{
              fontSize: 10, color: c.muted, background: c.bg,
              border: `1px solid ${c.border}`, borderRadius: 4, padding: "1px 6px",
            }}>
              {scenarioName(id)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Strategic Option row ──────────────────────────────────────────────────────

function StrategicOptionRow({ option, index, scenarioName, onClick }) {
  const [hovered, setHovered] = useState(false);
  const scenarioIds = Array.isArray(option.scenario_ids) ? option.scenario_ids : [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: "flex", gap: 12, alignItems: "flex-start",
        padding: "12px 14px",
        background: c.white,
        border: `1px solid ${hovered ? c.borderMid : c.border}`,
        borderRadius: 9, cursor: "pointer",
        transition: "border-color 0.12s, box-shadow 0.12s",
        boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 500, color: c.hint,
        minWidth: 20, paddingTop: 1, flexShrink: 0,
      }}>
        {String(index + 1).padStart(2, "0")}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 3 }}>
          {option.name}
        </div>
        {option.description && (
          <div style={{
            fontSize: 12, color: c.muted, lineHeight: 1.5, marginBottom: 6,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {option.description}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {option.horizon && <HorizTag h={option.horizon} />}
          {scenarioIds.length > 0 && (
            <span style={{ fontSize: 10, color: c.hint }}>
              → {scenarioIds.map((id) => scenarioName(id)).join(", ")}
            </span>
          )}
          {option.feasibility && (
            <div style={{ marginLeft: "auto" }}>
              <FeasibilityBadge value={option.feasibility} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hub empty states ─────────────────────────────────────────────────────────

function ScenarioEmptyState({ clusterCount, onNew }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "16px 18px",
      border: `1px dashed ${c.border}`, borderRadius: 9,
      background: c.surfaceAlt,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 500, color: c.hint,
          letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6,
        }}>
          Start from your analysis
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, color: c.muted, background: c.white,
            border: `1px solid ${c.border}`, borderRadius: 12, padding: "2px 9px",
          }}>
            {clusterCount} cluster{clusterCount !== 1 ? "s" : ""}
          </span>
          <span style={{
            fontSize: 11, color: c.muted, background: c.white,
            border: `1px solid ${c.border}`, borderRadius: 12, padding: "2px 9px",
          }}>
            Build from your clusters
          </span>
        </div>
      </div>
      <button onClick={onNew} style={{ ...btnSm, whiteSpace: "nowrap", flexShrink: 0 }}>
        + New scenario
      </button>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FutureModels({ appState }) {
  const {
    scenarios, preferredFutures, strategicOptions, clusters,
    activeProjectId, projects, setActiveScreen,
    openScenario, openScenarioNew,
  } = appState;

  const project          = projects.find((p) => p.id === activeProjectId);
  const projectScenarios = scenarios.filter((s) => s.project_id === activeProjectId);
  const projectClusters  = clusters.filter((cl) => cl.project_id === activeProjectId);
  const projectPFs       = (preferredFutures || []).filter((pf) => pf.project_id === activeProjectId);
  const projectOptions   = (strategicOptions || []).filter((o) => o.project_id === activeProjectId);

  const clusterName = (id) => projectClusters.find((cl) => cl.id === id)?.name || "Unknown cluster";
  const scenarioName = (id) => projectScenarios.find((s) => s.id === id)?.name || "Unknown scenario";

  if (!project) {
    return (
      <div style={{ padding: "28px 32px", background: c.bg }}>
        <div style={{ fontSize: 14, color: c.muted }}>No project selected.</div>
      </div>
    );
  }

  const handlePlaceholder = () => {
    appState.showToast("Coming in the next prompt");
  };

  return (
    <div style={{ padding: "28px 36px 64px", background: c.bg, minHeight: "100%" }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
          color: c.hint, marginBottom: 4,
        }}>
          Future Models
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          {project.name}
        </div>
        <div style={{ fontSize: 13, color: c.muted, maxWidth: 520, lineHeight: 1.6 }}>
          Build scenarios from your analysis, articulate a preferred future, and develop strategic options.
        </div>
      </div>

      <div style={{ maxWidth: 960 }}>

        {/* ── Scenarios ───────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader
            title="Scenarios"
            count={projectScenarios.length}
            action={
              <button onClick={() => openScenarioNew()} style={{ ...btnSec, fontSize: 11, padding: "5px 14px" }}>
                + New scenario
              </button>
            }
          />
          <div style={{ padding: "16px 20px 20px" }}>
            {projectScenarios.length === 0 ? (
              <ScenarioEmptyState
                clusterCount={projectClusters.length}
                onNew={() => openScenarioNew()}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {projectScenarios.map((s) => (
                  <ScenarioCard
                    key={s.id}
                    scenario={s}
                    clusterName={clusterName}
                    onClick={() => openScenario(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Preferred Future ─────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader
            title="Preferred Future"
            count={projectPFs.length}
            action={
              projectPFs.length > 0 ? (
                <button onClick={handlePlaceholder} style={{ ...btnSec, fontSize: 11, padding: "5px 14px" }}>
                  Edit
                </button>
              ) : null
            }
          />
          <div style={{ padding: "16px 20px 20px" }}>
            {projectPFs.length === 0 ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "16px 18px",
                border: `1px dashed ${c.border}`, borderRadius: 9,
                background: c.surfaceAlt,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.muted, marginBottom: 4 }}>
                    Define the future you want to move toward
                  </div>
                  <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.5 }}>
                    Articulate desired outcomes, guiding principles, and indicators of progress.
                  </div>
                </div>
                <button onClick={handlePlaceholder} style={{ ...btnSm, whiteSpace: "nowrap", flexShrink: 0 }}>
                  + Define preferred future
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {projectPFs.map((pf) => (
                  <PreferredFutureCard
                    key={pf.id}
                    pf={pf}
                    scenarioName={scenarioName}
                    onClick={handlePlaceholder}
                  />
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Strategic Options ─────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader
            title="Strategic Options"
            count={projectOptions.length}
            action={
              <button onClick={handlePlaceholder} style={{ ...btnSec, fontSize: 11, padding: "5px 14px" }}>
                + New option
              </button>
            }
          />
          <div style={{ padding: "16px 20px 20px" }}>
            {projectOptions.length === 0 ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "16px 18px",
                border: `1px dashed ${c.border}`, borderRadius: 9,
                background: c.surfaceAlt,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.muted, marginBottom: 4 }}>
                    Develop strategic responses to your scenarios
                  </div>
                  <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.5 }}>
                    What actions, investments, or positions should you consider?
                  </div>
                </div>
                <button onClick={handlePlaceholder} style={{ ...btnSm, whiteSpace: "nowrap", flexShrink: 0 }}>
                  + New option
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projectOptions.map((option, i) => (
                  <StrategicOptionRow
                    key={option.id}
                    option={option}
                    index={i}
                    scenarioName={scenarioName}
                    onClick={handlePlaceholder}
                  />
                ))}
              </div>
            )}
          </div>
        </SectionCard>

      </div>
    </div>
  );
}

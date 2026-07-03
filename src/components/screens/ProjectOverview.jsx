import { useState, useMemo } from "react";
import { c, btnSec } from "../../styles/tokens.js";
import { HorizonBar } from "../shared/HorizonBar.jsx";
import { analysisHasCont } from "./SystemAnalysisCanvas.jsx";
import EditProjectDrawer from "../projects/EditProjectDrawer.jsx";

// ─── Analysis panel spec (minimal — full spec lives in SystemAnalysisCanvas) ──

const ANALYSIS_PANELS = [
  { id: "key_dynamics",           type: "text",       label: "Key Dynamics" },
  { id: "description",            type: "text",       label: "Description" },
  { id: "critical_uncertainties", type: "chips",      label: "Uncertainties" },
  { id: "implications",           type: "text",       label: "Implications" },
  { id: "confidence",             type: "confidence", label: "Confidence" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function phaseStatusKey(ts) {
  if (!ts) return "not-started";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 24 * 60 * 60 * 1000)     return "active-today";
  if (diff < 7 * 24 * 60 * 60 * 1000) return "active-week";
  return "earlier";
}

const PHASE_STATUS = {
  "not-started": { borderTop: `3px solid ${c.border}`,    label: null,              labelColor: null },
  "active-today": { borderTop: `3px solid ${c.brand}`,    label: "Active today",    labelColor: c.brand },
  "active-week":  { borderTop: `3px solid ${c.green600}`, label: "Active this week",labelColor: c.green700 },
  "earlier":      { borderTop: `3px solid ${c.border}`,   label: null,              labelColor: null },
};

function relativeTime(ts) {
  if (!ts) return null;
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseCard({ name, statusKey, isResume, onClick, children }) {
  const { borderTop, label, labelColor } = PHASE_STATUS[statusKey];
  return (
    <div
      onClick={onClick}
      style={{
        background: c.white,
        border: `1px solid ${c.border}`,
        borderTop,
        borderRadius: 8,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.07)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{
        padding: "9px 11px 7px",
        borderBottom: `1px solid ${c.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: c.ink }}>{name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {label && (
            <span style={{ fontSize: 9, color: labelColor }}>{label}</span>
          )}
          {isResume && (
            <span style={{
              fontSize: 9, fontWeight: 500,
              padding: "2px 6px", borderRadius: 10,
              background: c.brand, color: c.white,
            }}>
              Continue here
            </span>
          )}
        </div>
      </div>
      <div style={{ padding: "9px 11px 11px", flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      padding: "2px 0",
    }}>
      <span style={{ fontSize: 11, color: c.muted }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: accent || c.ink }}>{value}</span>
    </div>
  );
}

function HorizonScatter({ clusters }) {
  if (!clusters.length) return null;
  const zones = { H1: [], H2: [], H3: [] };
  clusters.forEach(cl => { if (zones[cl.horizon]) zones[cl.horizon].push(cl); });
  const zoneColors = { H1: c.green600, H2: c.blue700, H3: c.amber700 };
  const zoneBg    = { H1: c.green50,  H2: c.blue50,  H3: c.amber50  };
  const W = 170, H = 36, zw = W / 3;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", marginTop: 6 }}>
      {["H1", "H2", "H3"].map((hz, zi) => {
        const x0 = zi * zw;
        return (
          <g key={hz}>
            <rect x={x0} y={0} width={zw} height={H} fill={zoneBg[hz]} />
            <text x={x0 + zw / 2} y={10} textAnchor="middle" fontSize={8} fontWeight={600} fill={zoneColors[hz]}>{hz}</text>
            {zones[hz].slice(0, 8).map((cl, i) => {
              const seed = (cl.id.charCodeAt(0) ?? 0) + (cl.id.charCodeAt(2) ?? 0);
              const cx = x0 + 7 + ((seed * 7 + i * 13) % (zw - 14));
              const cy = 16 + ((seed * 3 + i * 7) % 14);
              return <circle key={cl.id} cx={cx} cy={cy} r={3} fill={zoneColors[hz]} opacity={0.7} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function AnalysisFillGrid({ analysis }) {
  // Layout: [Key Dynamics (row-span) | Description   | Implications ]
  //         [Key Dynamics (row-span) | Uncertainties | Confidence   ]
  const getVal = (id) => analysis?.[id];
  const filled = (panel) => analysisHasCont(panel.type, getVal(panel.id));

  const cellBase = {
    borderRadius: 4,
    padding: "3px 6px",
    display: "flex",
    alignItems: "center",
    fontSize: 10,
  };

  const cellStyle = (panel) => ({
    ...cellBase,
    background: filled(panel) ? c.green25 : c.surfaceAlt,
    border: `1px solid ${filled(panel) ? c.greenBorder : c.border}`,
    color: filled(panel) ? c.green700 : c.faint,
    fontWeight: filled(panel) ? 500 : 400,
  });

  const [kd, desc, uncert, impl, conf] = ANALYSIS_PANELS;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gridTemplateRows: "auto auto",
      gap: 3,
      marginTop: 6,
    }}>
      <div style={{ ...cellStyle(kd), gridRow: "1 / 3", alignItems: "flex-start", paddingTop: 5, paddingBottom: 5 }}>
        {kd.label}
      </div>
      <div style={cellStyle(desc)}>{desc.label}</div>
      <div style={cellStyle(impl)}>{impl.label}</div>
      <div style={cellStyle(uncert)}>{uncert.label}</div>
      <div style={cellStyle(conf)}>{conf.label}</div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProjectOverview({ appState }) {
  const {
    activeProjectId,
    projects,
    inputs,
    clusters,
    analyses,
    scenarios,
    preferredFutures,
    strategicOptions,
    canvasNodes,
    canvasTextNodes,
    relationships,
    projectSources,
    setActiveScreen,
  } = appState;

  const project = projects.find(p => p.id === activeProjectId) || null;

  // Capture prior-session last_visited_at before openProject() stamps it.
  // openProject() is fire-and-forget (no setProjects call), so state still
  // holds the previous session's value at mount time.
  const [priorVisitedAt] = useState(() => project?.last_visited_at ?? null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  if (!project) return null;

  // ── Scoped data ────────────────────────────────────────────────────────────
  const projectInputs      = inputs.filter(i  => i.project_id  === activeProjectId);
  const projectClusters    = clusters.filter(cl => cl.project_id === activeProjectId);
  const analysis           = (analyses || []).find(a => a.project_id === activeProjectId) || null;
  const projectScenarios   = (scenarios || []).filter(s => s.project_id === activeProjectId);
  const projectFutures     = (preferredFutures || []).filter(f => f.project_id === activeProjectId);
  const projectOptions     = (strategicOptions || []).filter(o => o.project_id === activeProjectId);
  const projectNodes       = (canvasNodes || []).filter(n => n.projectId === activeProjectId);
  const projectRels        = (relationships || []).filter(r => r.project_id === activeProjectId);
  const projectTextNodes   = (canvasTextNodes || []).filter(n => n.projectId === activeProjectId);

  // ── Scanner ─────────────────────────────────────────────────────────────────
  const newSignalCount = useMemo(() => {
    if (!priorVisitedAt) return 0;
    return inputs.filter(i =>
      i.project_id === null &&
      i.metadata?.suggested_projects?.some(p => p.id === activeProjectId) &&
      !i.metadata?.dismissed &&
      i.created_at > priorVisitedAt
    ).length;
  }, [inputs, activeProjectId, priorVisitedAt]);

  const activeSources = useMemo(
    () => (projectSources || []).filter(ps => ps.opted_in && ps.sources?.active),
    [projectSources]
  );

  const aiSuggestionCount = useMemo(
    () => inputs.filter(i =>
      i.project_id === null &&
      i.metadata?.suggested_projects?.some(p => p.id === activeProjectId) &&
      !i.metadata?.dismissed
    ).length,
    [inputs, activeProjectId]
  );

  // ── Phase timestamps ────────────────────────────────────────────────────────
  const latestScanTs = useMemo(() => {
    const sorted = projectInputs.map(i => i.created_at).filter(Boolean).sort();
    return sorted[sorted.length - 1] || null;
  }, [projectInputs]);

  const latestClusterTs = useMemo(() => {
    const sorted = projectClusters.map(cl => cl.created_at).filter(Boolean).sort();
    return sorted[sorted.length - 1] || null;
  }, [projectClusters]);

  const latestMapTs = useMemo(() => {
    const sorted = [
      ...projectRels.map(r => r.created_at),
      ...projectTextNodes.map(n => n.created_at),
    ].filter(Boolean).sort();
    return sorted[sorted.length - 1] || null;
  }, [projectRels, projectTextNodes]);

  const latestAnalysisTs = analysis?.updated_at || null;

  const latestFuturesTs = useMemo(() => {
    const all = [
      ...projectScenarios.map(s => s.created_at),
      ...projectFutures.map(f => f.created_at),
      ...projectOptions.map(o => o.created_at),
    ].filter(Boolean).sort();
    return all[all.length - 1] || null;
  }, [projectScenarios, projectFutures, projectOptions]);

  const resumeStage = useMemo(() => {
    const entries = [
      ["scan",      latestScanTs],
      ["cluster",   latestClusterTs],
      ["systemmap", latestMapTs],
      ["analysis",  latestAnalysisTs],
      ["futures",   latestFuturesTs],
    ].filter(([, ts]) => ts);
    if (!entries.length) return null;
    return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  }, [latestScanTs, latestClusterTs, latestMapTs, latestAnalysisTs, latestFuturesTs]);

  // ── Cluster stats ───────────────────────────────────────────────────────────
  const clusterBySubtype = projectClusters.reduce(
    (acc, cl) => { acc[cl.subtype] = (acc[cl.subtype] || 0) + 1; return acc; },
    {}
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", overflowY: "auto", background: c.bg }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 28px 48px" }}>

        {/* Title row */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: c.faint, marginBottom: 4 }}>{project.name}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: c.ink, margin: 0 }}>Overview</h1>
            <button
              onClick={() => setEditDrawerOpen(true)}
              style={{ ...btnSec, fontSize: 12, padding: "6px 14px" }}
            >
              ⚙ Project settings
            </button>
          </div>
        </div>

        {/* Key Question card */}
        <div style={{
          background: c.white,
          border: `1px solid ${c.border}`,
          borderRadius: 8,
          padding: "14px 16px",
          marginBottom: 12,
          display: "flex",
          gap: 20,
        }}>
          <div style={{ flex: "0 0 60%", minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.08em", color: c.brand, textTransform: "uppercase", marginBottom: 6 }}>
              KEY QUESTION
            </div>
            <div style={{ fontSize: 13, color: c.ink, fontStyle: "italic", lineHeight: 1.55 }}>
              {project.question || <span style={{ color: c.faint }}>No key question set.</span>}
            </div>
          </div>
          <div style={{
            flex: 1,
            borderLeft: `1px solid ${c.border}`,
            paddingLeft: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            {project.domain && (
              <div>
                <div style={{ fontSize: 10, color: c.faint, marginBottom: 2 }}>Domain</div>
                <div style={{ fontSize: 12, color: c.ink }}>{project.domain}</div>
              </div>
            )}
            {project.geo && (
              <div>
                <div style={{ fontSize: 10, color: c.faint, marginBottom: 2 }}>Geography</div>
                <div style={{ fontSize: 12, color: c.ink }}>{project.geo}</div>
              </div>
            )}
          </div>
        </div>

        {/* Time horizons */}
        {project.h1_start && <HorizonBar project={project} />}

        {/* Scanner card */}
        <div style={{
          background: c.white,
          border: `1px solid ${c.border}`,
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 3 }}>
              {newSignalCount > 0
                ? `${newSignalCount} new signal${newSignalCount !== 1 ? "s" : ""} since your last visit`
                : "No new signals since your last visit"}
            </div>
            <div style={{ fontSize: 12, color: c.muted }}>
              {activeSources.length > 0
                ? `Scanning active · ${activeSources.length} source${activeSources.length !== 1 ? "s" : ""}`
                : "No sources active"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {aiSuggestionCount > 0 && (
              <button
                onClick={() => setActiveScreen("inbox")}
                style={{
                  fontSize: 12, padding: "6px 14px", borderRadius: 7,
                  background: c.brandBg, color: c.brand,
                  border: `1px solid ${c.brandBorder}`,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Review {aiSuggestionCount} →
              </button>
            )}
            <button
              onClick={() => setActiveScreen("inbox")}
              style={{ ...btnSec, fontSize: 12, padding: "6px 14px" }}
            >
              Manage sources
            </button>
          </div>
        </div>

        {/* Context card (collapsible) */}
        <div style={{
          background: c.white,
          border: `1px solid ${c.border}`,
          borderRadius: 8,
          marginBottom: 24,
          overflow: "hidden",
        }}>
          <button
            onClick={() => setContextExpanded(e => !e)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Project context</span>
            <span style={{ fontSize: 10, color: c.faint }}>{contextExpanded ? "▲" : "▼"}</span>
          </button>
          {contextExpanded && (
            <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 28px" }}>
              {project.focus && (
                <div>
                  <div style={{ fontSize: 10, color: c.faint, marginBottom: 3 }}>Focus</div>
                  <div style={{ fontSize: 12, color: c.ink, lineHeight: 1.5 }}>{project.focus}</div>
                </div>
              )}
              {project.audience && (
                <div>
                  <div style={{ fontSize: 10, color: c.faint, marginBottom: 3 }}>Audience</div>
                  <div style={{ fontSize: 12, color: c.ink, lineHeight: 1.5 }}>{project.audience}</div>
                </div>
              )}
              {project.stakeholders && (
                <div>
                  <div style={{ fontSize: 10, color: c.faint, marginBottom: 3 }}>Stakeholders</div>
                  <div style={{ fontSize: 12, color: c.ink, lineHeight: 1.5 }}>{project.stakeholders}</div>
                </div>
              )}
              {project.assumptions && (
                <div>
                  <div style={{ fontSize: 10, color: c.faint, marginBottom: 3 }}>Assumptions</div>
                  <div style={{ fontSize: 12, color: c.ink, lineHeight: 1.5 }}>{project.assumptions}</div>
                </div>
              )}
              {project.scope_in?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: c.faint, marginBottom: 5 }}>In scope</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {project.scope_in.map(s => (
                      <span key={s} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: c.green50, color: c.green700, border: `1px solid ${c.greenBorder}` }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {project.scope_out?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: c.faint, marginBottom: 5 }}>Out of scope</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {project.scope_out.map(s => (
                      <span key={s} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}` }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phase cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>

          {/* Scan */}
          <PhaseCard
            name="Scan"
            statusKey={phaseStatusKey(latestScanTs)}
            isResume={resumeStage === "scan"}
            onClick={() => setActiveScreen("project")}
          >
            <Stat label="Inputs" value={projectInputs.length} />
            {aiSuggestionCount > 0 && (
              <Stat label="AI suggestions" value={aiSuggestionCount} accent={c.brand} />
            )}
            {latestScanTs && (
              <div style={{ fontSize: 10, color: c.faint, marginTop: 7 }}>{relativeTime(latestScanTs)}</div>
            )}
          </PhaseCard>

          {/* Cluster */}
          <PhaseCard
            name="Cluster"
            statusKey={phaseStatusKey(latestClusterTs)}
            isResume={resumeStage === "cluster"}
            onClick={() => setActiveScreen("project")}
          >
            <Stat label="Clusters" value={projectClusters.length} />
            {projectClusters.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                {clusterBySubtype.Trend > 0 && (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: c.violet50, color: c.violet700 }}>
                    {clusterBySubtype.Trend} Trend
                  </span>
                )}
                {clusterBySubtype.Driver > 0 && (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: c.violet50, color: c.violet700 }}>
                    {clusterBySubtype.Driver} Driver
                  </span>
                )}
                {clusterBySubtype.Tension > 0 && (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: c.amber50, color: c.amber700 }}>
                    {clusterBySubtype.Tension} Tension
                  </span>
                )}
              </div>
            )}
            {projectClusters.length > 0 && <HorizonScatter clusters={projectClusters} />}
            {latestClusterTs && (
              <div style={{ fontSize: 10, color: c.faint, marginTop: 5 }}>{relativeTime(latestClusterTs)}</div>
            )}
          </PhaseCard>

          {/* System Map */}
          <PhaseCard
            name="System Map"
            statusKey={phaseStatusKey(latestMapTs)}
            isResume={resumeStage === "systemmap"}
            onClick={() => setActiveScreen("scenarios")}
          >
            <Stat label="Nodes" value={projectNodes.length} />
            <Stat label="Connections" value={projectRels.length} />
            {latestMapTs && (
              <div style={{ fontSize: 10, color: c.faint, marginTop: 7 }}>{relativeTime(latestMapTs)}</div>
            )}
          </PhaseCard>

          {/* System Analysis */}
          <PhaseCard
            name="System Analysis"
            statusKey={phaseStatusKey(latestAnalysisTs)}
            isResume={resumeStage === "analysis"}
            onClick={() => setActiveScreen("analysis")}
          >
            <AnalysisFillGrid analysis={analysis} />
            {latestAnalysisTs && (
              <div style={{ fontSize: 10, color: c.faint, marginTop: 7 }}>{relativeTime(latestAnalysisTs)}</div>
            )}
          </PhaseCard>

          {/* Future Models */}
          <PhaseCard
            name="Future Models"
            statusKey={phaseStatusKey(latestFuturesTs)}
            isResume={resumeStage === "futures"}
            onClick={() => setActiveScreen("future-models")}
          >
            <Stat label="Scenarios" value={projectScenarios.length} />
            <Stat label="Preferred Futures" value={projectFutures.length} />
            <Stat label="Strat. Options" value={projectOptions.length} />
            {latestFuturesTs && (
              <div style={{ fontSize: 10, color: c.faint, marginTop: 7 }}>{relativeTime(latestFuturesTs)}</div>
            )}
          </PhaseCard>

        </div>
      </div>

      {editDrawerOpen && (
        <EditProjectDrawer appState={appState} onClose={() => setEditDrawerOpen(false)} />
      )}
    </div>
  );
}

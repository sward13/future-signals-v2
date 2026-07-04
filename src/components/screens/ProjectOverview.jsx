import { useState, useMemo } from "react";
import clsx from "clsx";
import { HorizonBar } from "../shared/HorizonBar.jsx";
import { analysisHasCont } from "./SystemAnalysisCanvas.jsx";
import { EditProjectDrawer } from "../projects/EditProjectDrawer.jsx";

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
  "not-started":  { borderClass: null,                                 label: null,               labelClass: null },
  "active-today": { borderClass: "border-l-[3px] border-l-brand",     label: "Active today",     labelClass: "text-brand" },
  "active-week":  { borderClass: "border-l-[3px] border-l-green-600", label: "Active this week", labelClass: "text-green-700" },
  "earlier":      { borderClass: null,                                 label: null,               labelClass: null },
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
  const { borderClass, label, labelClass } = PHASE_STATUS[statusKey];
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-white border border-border rounded-container overflow-hidden",
        "flex flex-col transition-shadow duration-150",
        onClick ? "cursor-pointer hover:shadow-hover" : "cursor-default",
        borderClass
      )}
    >
      <div className="py-3 px-4 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-[14px] font-semibold text-ink">{name}</span>
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          {label && (
            <span className={clsx("text-[9px] shrink-0", labelClass)}>{label}</span>
          )}
          {isResume && (
            <span className="text-[10px] font-medium py-0.5 px-2 rounded-pill bg-brand-bg text-brand border border-brand-border shrink-0">
              Continue here
            </span>
          )}
        </div>
      </div>
      <div className="pt-3 px-4 pb-3 flex-1">
        {children}
      </div>
    </div>
  );
}

function BigStat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-faint">{label}</div>
      <div className="text-[22px] font-semibold text-ink leading-none my-1">{value}</div>
    </div>
  );
}

function HorizonScatter({ clusters }) {
  if (!clusters.length) return null;
  const zones = { H1: [], H2: [], H3: [] };
  clusters.forEach(cl => { if (zones[cl.horizon]) zones[cl.horizon].push(cl); });
  const zoneColors = {
    H1: "var(--color-green-600)",
    H2: "var(--color-blue-700)",
    H3: "var(--color-amber-700)",
  };
  const zoneBg = {
    H1: "var(--color-green-50)",
    H2: "var(--color-blue-50)",
    H3: "var(--color-amber-50)",
  };
  const W = 170, H = 36, zw = W / 3;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[36px] block mt-1.5">
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
  const getVal = (id) => analysis?.[id];
  const filled = (panel) => analysisHasCont(panel.type, getVal(panel.id));

  const cellClass = (panel, isKd = false) =>
    clsx(
      "rounded-chip px-1.5 flex overflow-hidden border",
      isKd
        ? "items-start py-1.25 row-span-2"
        : "items-center py-[3px]",
      filled(panel)
        ? "bg-green-25 border-green-border"
        : "bg-surface-alt border-border"
    );

  const [kd, desc, uncert, impl, conf] = ANALYSIS_PANELS;

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-[3px] mt-1.5">
      <div className={cellClass(kd, true)} title={kd.label} />
      <div className={cellClass(desc)} title={desc.label} />
      <div className={cellClass(impl)} title={impl.label} />
      <div className={cellClass(uncert)} title={uncert.label} />
      <div className={cellClass(conf)} title={conf.label} />
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
    setInboxProjectFilter,
    setOpenScanningPrefs,
    updateProject,
    deleteProject,
    workspaceScanningEnabled,
  } = appState;

  const project = projects.find(p => p.id === activeProjectId) || null;

  // Capture prior-session last_visited_at before openProject() stamps it.
  const [priorVisitedAt] = useState(() => project?.last_visited_at ?? null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  // ── Scoped data ──────────────────────────────────────────────────────────────
  const projectInputs    = inputs.filter(i  => i.project_id === activeProjectId);
  const projectClusters  = clusters.filter(cl => cl.project_id === activeProjectId);
  const analysis         = (analyses || []).find(a => a.project_id === activeProjectId) || null;
  const projectScenarios = (scenarios || []).filter(s => s.project_id === activeProjectId);
  const projectFutures   = (preferredFutures || []).filter(f => f.project_id === activeProjectId);
  const projectOptions   = (strategicOptions || []).filter(o => o.project_id === activeProjectId);
  const projectNodes     = (canvasNodes || []).filter(n => n.projectId === activeProjectId);
  const projectRels      = (relationships || []).filter(r => r.project_id === activeProjectId);
  const projectTextNodes = (canvasTextNodes || []).filter(n => n.projectId === activeProjectId);

  // ── Scanner ──────────────────────────────────────────────────────────────────
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

  // ── Phase timestamps ─────────────────────────────────────────────────────────
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

  // Early return AFTER all hooks — prevents React error #310 (hook count mismatch)
  if (!project) return null;

  // ── Cluster stats ────────────────────────────────────────────────────────────
  const clusterBySubtype = projectClusters.reduce(
    (acc, cl) => { acc[cl.subtype] = (acc[cl.subtype] || 0) + 1; return acc; },
    {}
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="max-w-[1120px] mx-auto pt-6 px-7 pb-12">

        {/* Title row */}
        <div className="mb-5">
          <div className="text-[11px] text-faint mb-1">{project.name}</div>
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-medium text-ink m-0">Overview</h1>
            <button
              onClick={() => setEditDrawerOpen(true)}
              className="py-1.5 px-3.5 rounded-container bg-transparent text-muted border border-border-mid text-xs cursor-pointer [font-family:inherit]"
            >
              ⚙ Project settings
            </button>
          </div>
        </div>

        {/* Key Question + Context — always visible, no collapse */}
        <div className="bg-white border border-border rounded-container py-6 px-7 mb-4">
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-8">
            <div>
              <div className="text-xs font-semibold text-brand mb-1.5">Key question</div>
              <div
                className="text-[19px] italic leading-[1.5] text-ink"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {project.question || <span className="not-italic text-faint">No key question set.</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-faint mb-1">Domain</div>
              {project.domain
                ? <div className="text-sm text-ink">{project.domain}</div>
                : <div className="text-sm text-faint italic">Not set</div>}
            </div>
            <div>
              <div className="text-xs text-faint mb-1">Geography</div>
              {project.geo
                ? <div className="text-sm text-ink">{project.geo}</div>
                : <div className="text-sm text-faint italic">Not set</div>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-border mt-5 pt-5">
            <div>
              <div className="text-xs text-faint mb-1">Focus</div>
              {project.focus
                ? <div className="text-sm text-ink leading-normal">{project.focus}</div>
                : <div className="text-sm text-faint italic">Not set</div>}
            </div>
            <div>
              <div className="text-xs text-faint mb-1">Audience</div>
              {project.audience
                ? <div className="text-sm text-ink leading-normal">{project.audience}</div>
                : <div className="text-sm text-faint italic">Not set</div>}
            </div>
            <div>
              <div className="text-xs text-faint mb-1">Stakeholders</div>
              {project.stakeholders
                ? <div className="text-sm text-ink leading-normal">{project.stakeholders}</div>
                : <div className="text-sm text-faint italic">Not set</div>}
            </div>
            <div>
              <div className="text-xs text-faint mb-1">Assumptions</div>
              {project.assumptions
                ? <div className="text-sm text-ink leading-normal">{project.assumptions}</div>
                : <div className="text-sm text-faint italic">Not set</div>}
            </div>
            <div>
              <div className="text-xs text-faint mb-1.5">In scope</div>
              {project.scope_in?.length > 0
                ? <div className="flex flex-wrap gap-1">
                    {project.scope_in.map(s => (
                      <span key={s} className="text-xs py-1 px-2.5 rounded-[6px] bg-green-50 text-green-700">{s}</span>
                    ))}
                  </div>
                : <div className="text-sm text-faint italic">Not set</div>}
            </div>
            <div>
              <div className="text-xs text-faint mb-1.5">Out of scope</div>
              {project.scope_out?.length > 0
                ? <div className="flex flex-wrap gap-1">
                    {project.scope_out.map(s => (
                      <span key={s} className="text-xs py-1 px-2.5 rounded-[6px] bg-surface-alt text-muted">{s}</span>
                    ))}
                  </div>
                : <div className="text-sm text-faint italic">Not set</div>}
            </div>
          </div>
        </div>

        {/* Time horizons */}
        {project.h1_start && (
          <div className="bg-white border border-border rounded-container py-6 px-7 mb-4">
            <div className="text-xs text-faint mb-3">Time horizons</div>
            <HorizonBar project={project} />
          </div>
        )}

        {/* Scanner card */}
        <div className="bg-white border border-border rounded-container py-4 px-7 mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-[14px] font-semibold text-ink mb-[3px]">
              {newSignalCount > 0
                ? `${newSignalCount} new signal${newSignalCount !== 1 ? "s" : ""} since your last visit`
                : "No new signals since your last visit"}
            </div>
            <div className="text-[13px] text-faint">
              {activeSources.length > 0
                ? `Scanning active · ${activeSources.length} source${activeSources.length !== 1 ? "s" : ""}`
                : "No sources active"}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {aiSuggestionCount > 0 && (
              <button
                onClick={() => { setInboxProjectFilter(activeProjectId); setActiveScreen("inbox"); }}
                className="text-xs py-1.5 px-3.5 rounded-btn bg-brand-bg text-brand border border-brand-border cursor-pointer [font-family:inherit]"
              >
                Review {aiSuggestionCount} →
              </button>
            )}
            <button
              onClick={() => { setOpenScanningPrefs(true); setActiveScreen("project"); }}
              className="py-2 px-4 rounded-container bg-transparent text-muted border border-border-mid text-[13px] cursor-pointer [font-family:inherit]"
            >
              Manage sources
            </button>
          </div>
        </div>

        {/* Workflow cards */}
        <div className="text-xs text-faint mb-2.5">Workflow</div>
        <div className="grid grid-cols-5 gap-3.5">

          {/* Scan */}
          <PhaseCard
            name="Scan"
            statusKey={phaseStatusKey(latestScanTs)}
            isResume={resumeStage === "scan"}
            onClick={() => setActiveScreen("project")}
          >
            <BigStat label="Inputs" value={projectInputs.length} />
            {aiSuggestionCount > 0 && (
              <div className="text-xs text-brand mt-1">
                {aiSuggestionCount} AI suggestion{aiSuggestionCount !== 1 ? "s" : ""}
              </div>
            )}
            <div className="text-xs text-faint mt-1">
              {latestScanTs ? relativeTime(latestScanTs) : "Not started"}
            </div>
          </PhaseCard>

          {/* Cluster */}
          <PhaseCard
            name="Cluster"
            statusKey={phaseStatusKey(latestClusterTs)}
            isResume={resumeStage === "cluster"}
            onClick={() => setActiveScreen("cluster")}
          >
            <BigStat label="Clusters" value={projectClusters.length} />
            {projectClusters.length > 0 && (
              <div className="flex flex-wrap gap-[3px] mt-1">
                {clusterBySubtype.Trend > 0 && (
                  <span className="text-[9px] py-px px-1.5 rounded-pill bg-violet-50 text-violet-700">
                    {clusterBySubtype.Trend} Trend
                  </span>
                )}
                {clusterBySubtype.Driver > 0 && (
                  <span className="text-[9px] py-px px-1.5 rounded-pill bg-violet-50 text-violet-700">
                    {clusterBySubtype.Driver} Driver
                  </span>
                )}
                {clusterBySubtype.Tension > 0 && (
                  <span className="text-[9px] py-px px-1.5 rounded-pill bg-amber-50 text-amber-700">
                    {clusterBySubtype.Tension} Tension
                  </span>
                )}
              </div>
            )}
            {projectClusters.length > 0 && <HorizonScatter clusters={projectClusters} />}
            <div className="text-xs text-faint mt-1">
              {latestClusterTs ? relativeTime(latestClusterTs) : "Not started"}
            </div>
          </PhaseCard>

          {/* System Map */}
          <PhaseCard
            name="System Map"
            statusKey={phaseStatusKey(latestMapTs)}
            isResume={resumeStage === "systemmap"}
            onClick={() => setActiveScreen("scenarios")}
          >
            <BigStat label="Nodes" value={projectNodes.length} />
            <div className="text-xs text-faint mt-0.5">Connections: {projectRels.length}</div>
            <div className="text-xs text-faint mt-1">
              {latestMapTs ? relativeTime(latestMapTs) : "Not started"}
            </div>
          </PhaseCard>

          {/* System Analysis */}
          <PhaseCard
            name="System Analysis"
            statusKey={phaseStatusKey(latestAnalysisTs)}
            isResume={resumeStage === "analysis"}
            onClick={() => setActiveScreen("analysis")}
          >
            <AnalysisFillGrid analysis={analysis} />
            <div className="text-xs text-faint mt-1.5">
              {latestAnalysisTs ? relativeTime(latestAnalysisTs) : "Not started"}
            </div>
          </PhaseCard>

          {/* Future Models */}
          <PhaseCard
            name="Future Models"
            statusKey={phaseStatusKey(latestFuturesTs)}
            isResume={resumeStage === "futures"}
            onClick={() => setActiveScreen("future-models")}
          >
            <BigStat label="Scenarios" value={projectScenarios.length} />
            <div className="text-xs text-faint mt-0.5">Preferred Futures: {projectFutures.length}</div>
            <div className="text-xs text-faint mt-0.5">Strat. Options: {projectOptions.length}</div>
            <div className="text-xs text-faint mt-1">
              {latestFuturesTs ? relativeTime(latestFuturesTs) : "Not started"}
            </div>
          </PhaseCard>

        </div>
      </div>

      {editDrawerOpen && (
        <EditProjectDrawer
          project={project}
          onClose={() => setEditDrawerOpen(false)}
          onSave={(fields) => updateProject(project.id, fields)}
          onDelete={() => deleteProject(project.id)}
          workspaceScanningEnabled={workspaceScanningEnabled}
        />
      )}
    </div>
  );
}

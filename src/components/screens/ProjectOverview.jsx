import { useState, useMemo } from "react";
import { SquarePen } from "lucide-react";
import clsx from "clsx";
import { HorizonBar } from "../shared/HorizonBar.jsx";
import { analysisHasCont } from "./SystemAnalysisCanvas.jsx";
import { EditProjectDrawer } from "../projects/EditProjectDrawer.jsx";
import { projectDomainLabel } from "../../lib/projectDomains.js";

// ─── Analysis panel spec (minimal — full spec lives in SystemAnalysisCanvas) ──

const ANALYSIS_PANELS = [
  { id: "key_dynamics",           type: "text",       label: "Key Dynamics" },
  { id: "description",            type: "text",       label: "Description" },
  { id: "critical_uncertainties", type: "chips",      label: "Uncertainties" },
  { id: "implications",           type: "text",       label: "Implications" },
  { id: "confidence",             type: "confidence", label: "Confidence" },
];

const CLUSTER_SUBTYPES = ["Trend", "Driver", "Tension"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function phaseStatusKey(ts) {
  if (!ts) return "not-started";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 24 * 60 * 60 * 1000)     return "active-today";
  if (diff < 7 * 24 * 60 * 60 * 1000) return "active-week";
  return "earlier";
}

const STATUS_PILLS = {
  "not-started":  { text: "Not started",      cls: "bg-surface-alt text-faint" },
  "active-today": { text: "Active today",     cls: "bg-green-50 text-green-700" },
  "active-week":  { text: "Active this week", cls: "bg-green-50 text-green-700" },
  "earlier":      { text: "Earlier",          cls: "bg-surface-alt text-muted" },
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
  const pill = isResume
    ? { text: "Continue here", cls: "bg-brand-bg text-brand" }
    : STATUS_PILLS[statusKey];

  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-white border border-border rounded-container p-4 flex flex-col transition-shadow duration-150",
        onClick ? "cursor-pointer hover:shadow-hover" : "cursor-default"
      )}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[14px] font-semibold text-ink min-w-0 truncate">{name}</span>
        {pill && (
          <span className={clsx("text-[11px] py-0.5 px-2.5 rounded-pill whitespace-nowrap shrink-0", pill.cls)}>
            {pill.text}
          </span>
        )}
      </div>
      {children}
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

function MetricRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="text-xs text-faint">{label}</span>
      <span className="text-[15px] font-semibold text-ink">{value}</span>
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
    showToast,
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

  // ── Derived stats (non-hook — computed in render body after early return) ────
  const clusterBySubtype = projectClusters.reduce(
    (acc, cl) => { acc[cl.subtype] = (acc[cl.subtype] || 0) + 1; return acc; },
    {}
  );

  const assignedInputIds = new Set(projectClusters.flatMap(cl => cl.input_ids || []));
  const assignedCount    = projectInputs.filter(i => assignedInputIds.has(i.id)).length;
  const unassignedCount  = projectInputs.length - assignedCount;

  const filledSections = ANALYSIS_PANELS.filter(
    p => analysisHasCont(p.type, analysis?.[p.id])
  ).length;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="max-w-[1120px] mx-auto pt-6 px-7 pb-12">

        {/* Title row */}
        <div className="mb-5">
          <div className="text-[11px] text-faint mb-1">{project.name}</div>
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-medium text-ink m-0 font-heading">Overview</h1>
            <button
              onClick={() => setEditDrawerOpen(true)}
              className="flex items-center gap-1.5 py-2.5 px-5.5 rounded-container bg-transparent text-muted border border-border-strong text-ui cursor-pointer [font-family:inherit]"
            >
              <SquarePen size={13} className="shrink-0" /> Project settings
            </button>
          </div>
        </div>

        {/* Key Question + Context — always visible */}
        <div className="bg-white border border-border rounded-container py-6 px-7 mb-4">
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-8">
            <div>
              <div className="text-xs font-semibold text-blue-700 mb-1.5">Key question</div>
              <div
                className="text-[19px] italic leading-[1.5] text-ink"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {project.question || <span className="not-italic text-faint">No key question set.</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-faint mb-1">Domain</div>
              {projectDomainLabel(project)
                ? <div className="text-sm text-ink">{projectDomainLabel(project)}</div>
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
              className="py-2 px-4 rounded-container bg-transparent text-muted border border-border-strong text-[13px] cursor-pointer [font-family:inherit]"
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
            {projectInputs.length > 0 ? (
              <>
                <MetricRow label="Total inputs"  value={projectInputs.length} />
                <MetricRow label="Assigned"       value={assignedCount} />
                <MetricRow label="Unassigned"     value={unassignedCount} />
                {aiSuggestionCount > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); setInboxProjectFilter(activeProjectId); setActiveScreen("inbox"); }}
                    className="text-xs text-brand mt-1 cursor-pointer bg-transparent border-0 p-0 [font-family:inherit] text-left"
                  >
                    {aiSuggestionCount} AI suggestion{aiSuggestionCount !== 1 ? "s" : ""}
                  </button>
                )}
              </>
            ) : (
              <>
                <BigStat label="Inputs" value={0} />
                <div className="text-xs text-faint mt-1">Not started</div>
              </>
            )}
          </PhaseCard>

          {/* Cluster */}
          <PhaseCard
            name="Cluster"
            statusKey={phaseStatusKey(latestClusterTs)}
            isResume={resumeStage === "cluster"}
            onClick={() => setActiveScreen("cluster")}
          >
            <BigStat
              label={projectClusters.length > 0 ? "Total clusters" : "Clusters"}
              value={projectClusters.length}
            />
            {projectClusters.length > 0 ? (
              <div className="flex gap-1.5 mt-2.5">
                {CLUSTER_SUBTYPES.filter(t => clusterBySubtype[t] > 0).map(type => (
                  <div key={type} className="flex-1 text-center bg-surface-alt rounded-[6px] py-1.5 px-1">
                    <div className="text-[14px] font-semibold text-ink leading-none">{clusterBySubtype[type]}</div>
                    <div className="text-[10px] text-faint mt-0.5">{type}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-faint mt-1">Not started</div>
            )}
          </PhaseCard>

          {/* System Map */}
          <PhaseCard
            name="System Map"
            statusKey={phaseStatusKey(latestMapTs)}
            isResume={resumeStage === "systemmap"}
            onClick={() => setActiveScreen("scenarios")}
          >
            {projectNodes.length > 0 ? (
              <>
                <MetricRow label="Nodes"       value={projectNodes.length} />
                <MetricRow label="Connections" value={projectRels.length} />
              </>
            ) : (
              <>
                <BigStat label="Nodes" value={0} />
                <div className="text-xs text-faint mt-1">Needs clusters first</div>
              </>
            )}
          </PhaseCard>

          {/* System Analysis */}
          <PhaseCard
            name="System Analysis"
            statusKey={phaseStatusKey(latestAnalysisTs)}
            isResume={resumeStage === "analysis"}
            onClick={() => setActiveScreen("analysis")}
          >
            <div className="text-xs text-faint">Sections complete</div>
            <div className="text-[22px] font-semibold text-ink leading-none my-1">
              {filledSections}/5
            </div>
            <div className="flex gap-1 mt-1.5">
              {ANALYSIS_PANELS.map((p, i) => (
                <div
                  key={p.id}
                  className={clsx("flex-1 h-1.5 rounded-full", i < filledSections ? "bg-brand" : "bg-surface-alt")}
                />
              ))}
            </div>
            {!latestAnalysisTs && (
              <div className="text-xs text-faint mt-2">Needs a system map first</div>
            )}
          </PhaseCard>

          {/* Future Models */}
          <PhaseCard
            name="Future Models"
            statusKey={phaseStatusKey(latestFuturesTs)}
            isResume={resumeStage === "futures"}
            onClick={() => setActiveScreen("future-models")}
          >
            <BigStat label="Scenarios" value={projectScenarios.length} />
            {projectScenarios.length > 0 || projectFutures.length > 0 || projectOptions.length > 0 ? (
              <>
                <div className="text-xs text-faint mt-0.5">Preferred Futures: {projectFutures.length}</div>
                <div className="text-xs text-faint mt-0.5">Strat. Options: {projectOptions.length}</div>
              </>
            ) : (
              <div className="text-xs text-faint mt-1">Needs analysis first</div>
            )}
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
          showToast={showToast}
          appState={appState}
        />
      )}
    </div>
  );
}

/**
 * Dashboard screen — workspace overview with stats, projects list, and recent inputs.
 */
import { useState } from "react";
import { c, btnP, btnSec, btnG } from "../../styles/tokens.js";
import { LayoutGrid, List, CirclePlus } from "lucide-react";
import { EmptyState } from "../shared/EmptyState.jsx";
import { ViewToggle } from "../ViewToggle.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";

const STEEPLED_ABB = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const COL = { type: 80, quality: 100, horizon: 55, steepled: 120 };

const QUALITY_COLORS = {
  Emerging:    [c.amber700, c.amber50,  c.amberBorder],
  Established: [c.blue700,  c.blue50,   c.blueBorder],
  Confirmed:   [c.green700, c.green50,  c.greenBorder],
};

function QualityPill({ value }) {
  if (!value) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  const [col, bg, brd] = QUALITY_COLORS[value] || [c.hint, c.surfaceAlt, c.border];
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Project picker popover (for Recent inputs hover action) ──────────────────

function ProjectPickerPopover({ projects, onSelect, onClose, onCreateProject }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
      <div style={{
        position: "absolute", top: "100%", right: 0, marginTop: 4,
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
        minWidth: 220, zIndex: 51, overflow: "hidden",
      }}>
        {projects.length === 0 ? (
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: c.hint, marginBottom: 8 }}>No projects yet.</div>
            <button onClick={() => { onClose(); onCreateProject(); }} style={{ fontSize: 11, color: c.blue700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              + Create project
            </button>
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {projects.map((p) => (
              <button key={p.id} onClick={() => onSelect(p)} style={{
                display: "block", width: "100%", padding: "9px 14px",
                background: "transparent", border: "none", borderBottom: `1px solid ${c.border}`,
                textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, color: c.ink,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: "6px 14px", borderTop: `1px solid ${c.border}` }}>
          <button onClick={onClose} style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, inputCount, clusterCount, systemMapCount, analysisCount, futuresTotal, onClick }) {
  const [hovered, setHovered] = useState(false);

  // Derive time horizon from h1_start / h3_end if no dedicated field
  const timeHorizon = project.time_horizon ||
    (project.h1_start && project.h3_end ? `${project.h1_start}–${project.h3_end}` : null);

  // Active stage: furthest stage with content
  const activeStage =
    futuresTotal > 0   ? "futures"   :
    analysisCount > 0  ? "analysis"  :
    systemMapCount > 0 ? "systemmap" :
    clusterCount > 0   ? "clusters"  :
                         "inputs";

  const STAGES = [
    { key: "inputs",    label: "Inputs",     filled: inputCount > 0,    display: String(inputCount) },
    { key: "clusters",  label: "Clusters",   filled: clusterCount > 0,  display: String(clusterCount) },
    { key: "systemmap", label: "System Map", filled: systemMapCount > 0, display: systemMapCount > 0 ? "✓" : "—" },
    { key: "analysis",  label: "Analysis",   filled: analysisCount > 0,  display: analysisCount > 0 ? "✓" : "—" },
    { key: "futures",   label: "Futures",    filled: futuresTotal > 0,   display: futuresTotal > 0 ? "✓" : "—" },
  ];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: c.white,
        border: `1px solid ${hovered ? c.borderMid : c.border}`,
        borderRadius: 10,
        padding: "16px",
        cursor: "pointer",
        boxShadow: hovered ? "0 2px 14px rgba(0,0,0,0.07)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header: title + domain left, time horizon pill right */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </div>
          {project.domain && (
            <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
              {project.domain}
            </div>
          )}
        </div>
        {timeHorizon && (
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 10, flexShrink: 0,
            background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}`,
            whiteSpace: "nowrap",
          }}>
            {timeHorizon}
          </span>
        )}
      </div>

      {/* Key question — 3-line clamp */}
      <div style={{
        fontSize: 12,
        color: project.question ? c.muted : c.hint,
        fontStyle: project.question ? "normal" : "italic",
        lineHeight: 1.5,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
      }}>
        {project.question || "No key question set"}
      </div>

      {/* 5-stage pipeline */}
      <div style={{ display: "flex", gap: 6 }}>
        {STAGES.map((stage) => {
          const isActive = stage.key === activeStage;
          const barBg = stage.filled
            ? isActive ? "#C7D2FE" : "#6366F1"
            : "rgba(0,0,0,0.08)";
          return (
            <div key={stage.key} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 4, borderRadius: 2, background: barBg, marginBottom: 5 }} />
              <div style={{
                fontSize: 10, color: isActive ? "#6366F1" : stage.filled ? c.muted : c.hint,
                fontWeight: isActive ? 500 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                marginBottom: 2,
              }}>
                {stage.label}
              </div>
              <div style={{ fontSize: 10, color: isActive ? "#6366F1" : stage.filled ? c.muted : c.hint }}>
                {isActive ? "→" : stage.display}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `0.5px solid ${c.border}`,
        paddingTop: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, color: c.hint }}>
          Updated {formatDate(project.updated_at || project.created_at)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{ background: "none", border: "none", fontSize: 11, color: c.muted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
        >
          Open project →
        </button>
      </div>
    </div>
  );
}


/**
 * @param {{ appState: object }} props
 */
export default function Dashboard({ appState }) {
  const {
    inputs, clusters, scenarios, preferredFutures, strategicOptions,
    projects, analyses, canvasNodes,
    setActiveScreen, openProjectModal, openProject,
    addInput, openInputDetail, showToast,
  } = appState;

  const [inputDrawerOpen, setInputDrawerOpen] = useState(false);
  const [projectView,     setProjectView]     = useState(() => {
    try { return localStorage.getItem("fs_project_view") || "cards"; }
    catch { return "cards"; }
  });

  const handleSetProjectView = (v) => {
    setProjectView(v);
    try { localStorage.setItem("fs_project_view", v); } catch {}
  };

  const inboxCount   = inputs.filter((i) => i.project_id === null && !(i.is_seeded && i.metadata?.source === "scanner" && i.metadata?.dismissed)).length;
  const recentInputs = [...inputs.filter((i) => i.project_id === null)]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  const handleAddInput = (fields) => {
    addInput(fields);
    showToast("Input saved to Inbox");
    setInputDrawerOpen(false);
  };

  return (
    <>
      <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
              Workspace
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Dashboard</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setInputDrawerOpen(true)} style={btnSec}>Add an input</button>
            <button onClick={openProjectModal} style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}><CirclePlus size={14} />New project</button>
          </div>
        </div>

        {/* Stats inline */}
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 28 }}>
          {projects.length} project{projects.length !== 1 ? "s" : ""}
          <span style={{ color: c.hint, margin: "0 7px" }}>·</span>
          {inboxCount} input{inboxCount !== 1 ? "s" : ""} in Inbox
        </div>

        {/* Projects section */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Projects</div>
          {projects.length > 0 && (
            <ViewToggle
              view={projectView}
              onChange={handleSetProjectView}
              options={[
                { value: "table", icon: <List size={14} />, title: "List view" },
                { value: "cards", icon: <LayoutGrid size={14} />, title: "Card view" },
              ]}
            />
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
        ) : projectView === "cards" ? (
          /* ── Card view ── */
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}>
            {projects.map((p) => {
              const pInputs    = inputs.filter((i)   => i.project_id  === p.id);
              const pClusters  = clusters.filter((cl) => cl.project_id === p.id);
              const hasCanvas  = canvasNodes.some((n) => n.projectId   === p.id);
              const pAnalyses  = analyses.filter((a)  => a.project_id  === p.id);
              const pScenarios = (scenarios       || []).filter((s)  => s.project_id === p.id);
              const pPFs       = (preferredFutures || []).filter((pf) => pf.project_id === p.id);
              const pOptions   = (strategicOptions || []).filter((o)  => o.project_id === p.id);
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  inputCount={pInputs.length}
                  clusterCount={pClusters.length}
                  systemMapCount={hasCanvas ? 1 : 0}
                  analysisCount={pAnalyses.length}
                  futuresTotal={pScenarios.length + pPFs.length + pOptions.length}
                  onClick={() => openProject(p.id)}
                />
              );
            })}
          </div>
        ) : (
          /* ── Table view ── */
          <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 28 }}>
            {/* Header row */}
            {(() => {
              const cell = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, flexShrink: 0 };
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 30, borderBottom: "0.5px solid rgba(0,0,0,0.09)" }}>
                  <div style={{ flex: 1, minWidth: 0, ...cell }}>Name</div>
                  <div style={{ width: 160, ...cell }}>Domain</div>
                  <div style={{ width: 80, textAlign: "right", ...cell }}>Inputs</div>
                  <div style={{ width: 80, textAlign: "right", ...cell }}>Clusters</div>
                  <div style={{ width: 80, textAlign: "right", ...cell }}>System Map</div>
                  <div style={{ width: 80, textAlign: "right", ...cell }}>Analysis</div>
                  <div style={{ width: 80, textAlign: "right", ...cell }}>Futures</div>
                  <div style={{ width: 32, ...cell }} />
                </div>
              );
            })()}
            {/* Data rows */}
            {projects.map((p) => {
              const pInputs    = inputs.filter((i)   => i.project_id === p.id);
              const pClusters  = clusters.filter((cl) => cl.project_id === p.id);
              const hasCanvas  = canvasNodes.some((n) => n.projectId  === p.id);
              const pAnalyses  = analyses.filter((a)  => a.project_id === p.id);
              const pFutures   =
                (scenarios        || []).filter((s)  => s.project_id  === p.id).length +
                (preferredFutures || []).filter((pf) => pf.project_id === p.id).length +
                (strategicOptions || []).filter((o)  => o.project_id  === p.id).length;
              return (
                <div
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  onMouseEnter={(e) => e.currentTarget.style.background = c.surfaceAlt}
                  onMouseLeave={(e) => e.currentTarget.style.background = c.white}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 42, borderBottom: `1px solid ${c.border}`, cursor: "pointer", transition: "background 0.08s" }}
                >
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    {p.name}
                  </div>
                  <div style={{ width: 160, flexShrink: 0, fontSize: 11, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.domain || <span style={{ color: c.hint }}>—</span>}
                  </div>
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right", fontSize: 11, color: c.muted }}>
                    {pInputs.length}
                  </div>
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right", fontSize: 11, color: c.muted }}>
                    {pClusters.length}
                  </div>
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right", fontSize: 11, color: c.muted }}>
                    {hasCanvas ? "✓" : <span style={{ color: c.hint }}>—</span>}
                  </div>
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right", fontSize: 11, color: c.muted }}>
                    {pAnalyses.length > 0 ? "✓" : <span style={{ color: c.hint }}>—</span>}
                  </div>
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right", fontSize: 11, color: c.muted }}>
                    {pFutures > 0 ? "✓" : <span style={{ color: c.hint }}>—</span>}
                  </div>
                  <div style={{ width: 32, flexShrink: 0, textAlign: "right", fontSize: 12, color: c.hint }}>→</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent inputs */}
        {recentInputs.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Recent inputs</div>
              <button onClick={() => setActiveScreen("inbox")} style={{ ...btnG, fontSize: 11 }}>
                View all →
              </button>
            </div>
            <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
              {/* Header row */}
              {(() => {
                const cell = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, flexShrink: 0 };
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 30, borderBottom: "0.5px solid rgba(0,0,0,0.09)" }}>
                    <div style={{ flex: 1, minWidth: 0, ...cell }}>Title</div>
                    <div style={{ width: COL.type,     ...cell }}>Type</div>
                    <div style={{ width: COL.quality,  ...cell }}>Quality</div>
                    <div style={{ width: COL.horizon,  ...cell }}>Horizon</div>
                    <div style={{ width: COL.steepled, ...cell }}>STEEPLED</div>
                  </div>
                );
              })()}
              {/* Data rows */}
              {recentInputs.map((inp) => {
                const steepled = inp.steepled || [];
                const visible2 = steepled.slice(0, 2);
                const overflow = steepled.length - 2;
                return (
                  <div
                    key={inp.id}
                    onClick={() => openInputDetail(inp.id)}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.02)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = c.white}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "0 14px", height: 38,
                      borderBottom: `1px solid ${c.border}`,
                      background: c.white,
                      transition: "background 0.08s",
                      cursor: "pointer",
                    }}
                  >
                    {/* Title */}
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {inp.name}
                    </div>
                    {/* Type */}
                    <div style={{ width: COL.type, flexShrink: 0, fontSize: 11, color: c.muted }}>
                      {inp.subtype
                        ? inp.subtype.charAt(0).toUpperCase() + inp.subtype.slice(1)
                        : <span style={{ color: c.hint }}>—</span>}
                    </div>
                    {/* Quality */}
                    <div style={{ width: COL.quality, flexShrink: 0 }}>
                      <QualityPill value={inp.signal_quality} />
                    </div>
                    {/* Horizon */}
                    <div style={{ width: COL.horizon, flexShrink: 0, fontSize: 11, color: inp.horizon ? c.muted : c.hint }}>
                      {inp.horizon || "—"}
                    </div>
                    {/* STEEPLED */}
                    <div style={{ width: COL.steepled, flexShrink: 0, display: "flex", gap: 3, alignItems: "center" }}>
                      {visible2.map((t) => (
                        <span key={t} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: c.surfaceAlt, color: c.muted }}>
                          {STEEPLED_ABB[t] || t}
                        </span>
                      ))}
                      {overflow > 0 && <span style={{ fontSize: 9, color: c.hint }}>+{overflow}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <InputDrawer
        open={inputDrawerOpen}
        onClose={() => setInputDrawerOpen(false)}
        onSave={handleAddInput}
        projects={projects}
      />
    </>
  );
}

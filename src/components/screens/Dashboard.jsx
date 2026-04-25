/**
 * Dashboard screen — workspace overview with stats, projects list, and recent inputs.
 */
import { useState } from "react";
import { c, btnP, btnSec, btnG, btnSm } from "../../styles/tokens.js";
import { LayoutGrid, Logs, CirclePlus } from "lucide-react";
import { StrengthDot, HorizTag, ConfidenceBadge } from "../shared/Tag.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";

const STEEPLED_ABB = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const COL = { curated: 32, strength: 90, confidence: 90, steepled: 120, horizon: 60, actions: 200 };

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

function ProjectCard({ project, inputCount, clusterCount, scenarioCount, analysisCount, onClick }) {
  const [hovered, setHovered] = useState(false);

  const q = project.question || null;
  const displayQ = q ? (q.length > 100 ? q.slice(0, 100) + "…" : q) : null;

  const cta =
    inputCount    === 0 ? "Add an input →" :
    clusterCount  === 0 ? "Build a cluster →" :
    scenarioCount === 0 ? "Map a system →" :
    analysisCount === 0 ? "Start analysis →" :
    "Open project →";

  const nodeColor  = (n) => n > 0 ? c.ink : "rgba(0,0,0,0.12)";
  const lineColor  = (n) => n > 0 ? c.ink : "rgba(0,0,0,0.10)";
  const labelColor = (n) => n > 0 ? c.muted : c.hint;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: c.white,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: "16px",
        cursor: "pointer",
        boxShadow: hovered ? "0 2px 14px rgba(0,0,0,0.07)" : "none",
        transition: "box-shadow 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header: name + mode badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, lineHeight: 1.3, minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </div>
      </div>

      {/* Domain */}
      {project.domain && (
        <div style={{ fontSize: 11, color: c.muted, marginTop: -6 }}>
          {project.domain}
        </div>
      )}

      {/* Key question */}
      <div style={{
        borderLeft: displayQ ? "2px solid rgba(0,0,0,0.10)" : "2px dashed rgba(0,0,0,0.15)",
        paddingLeft: 10,
        fontSize: 12,
        fontStyle: "italic",
        color: displayQ ? c.muted : c.hint,
        lineHeight: 1.5,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {displayQ || "No key question set"}
      </div>

      {/* Pipeline */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* Inputs node */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: nodeColor(inputCount) }} />
          <span style={{ fontSize: 11, color: labelColor(inputCount), whiteSpace: "nowrap" }}>{inputCount} Inputs</span>
        </div>
        {/* Line 1 */}
        <div style={{ flex: 1, height: 1, background: lineColor(clusterCount), margin: "0 8px" }} />
        {/* Clusters node */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: nodeColor(clusterCount) }} />
          <span style={{ fontSize: 11, color: labelColor(clusterCount), whiteSpace: "nowrap" }}>{clusterCount} Clusters</span>
        </div>
        {/* Line 2 */}
        <div style={{ flex: 1, height: 1, background: lineColor(scenarioCount), margin: "0 8px" }} />
        {/* Systems node */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: nodeColor(scenarioCount) }} />
          <span style={{ fontSize: 11, color: labelColor(scenarioCount), whiteSpace: "nowrap" }}>{scenarioCount} System maps</span>
        </div>
        {/* Line 3 */}
        <div style={{ flex: 1, height: 1, background: lineColor(analysisCount), margin: "0 8px" }} />
        {/* Analysis node */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: nodeColor(analysisCount) }} />
          <span style={{ fontSize: 11, color: labelColor(analysisCount), whiteSpace: "nowrap" }}>{analysisCount} Analysis</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "0.5px solid rgba(0,0,0,0.10)",
        paddingTop: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 2,
      }}>
        <span style={{ fontSize: 11, color: c.hint }}>Created {formatDate(project.created_at)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{ background: "none", border: "none", fontSize: 11, color: c.muted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

// ─── View toggle ──────────────────────────────────────────────────────────────

function ViewToggle({ value, onChange }) {
  const btn = (v, icon) => (
    <button
      onClick={() => onChange(v)}
      title={v === "cards" ? "Card view" : "Table view"}
      style={{
        padding: "5px 8px",
        border: "none",
        background: value === v ? c.brand : "transparent",
        color: value === v ? c.white : c.muted,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      {icon}
    </button>
  );
  return (
    <div style={{
      display: "flex",
      border: "0.5px solid rgba(0,0,0,0.18)",
      borderRadius: 6,
      overflow: "hidden",
    }}>
      {btn("cards", <LayoutGrid size={14} />)}
      {btn("table", <Logs size={14} />)}
    </div>
  );
}

/**
 * @param {{ appState: object }} props
 */
export default function Dashboard({ appState }) {
  const {
    inputs, clusters, scenarios, projects, analyses, canvasNodes,
    setActiveScreen, openProjectModal, openProject,
    addInput, saveInputToProject, openInputDetail, showToast,
  } = appState;

  const [inputDrawerOpen, setInputDrawerOpen] = useState(false);
  const [pickerForId,     setPickerForId]     = useState(null);
  const [projectView,     setProjectView]     = useState(() => {
    try { return localStorage.getItem("fs_project_view") || "cards"; }
    catch { return "cards"; }
  });

  const handleSetProjectView = (v) => {
    setProjectView(v);
    try { localStorage.setItem("fs_project_view", v); } catch {}
  };

  const inboxCount   = inputs.filter((i) => i.project_id === null).length;
  const recentInputs = [...inputs.filter((i) => i.project_id === null)]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  const handleAddInput = (fields) => {
    addInput(fields);
    showToast("Input saved to Inbox");
    setInputDrawerOpen(false);
  };

  const handleAddToProject = (inp, project) => {
    saveInputToProject(inp.id, project.id);
    showToast(`"${inp.name}" added to "${project.name}"`);
    setPickerForId(null);
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Projects</div>
            {projects.length > 0 && (
              <div style={{ fontSize: 11, color: c.hint }}>{projects.length} active</div>
            )}
          </div>
          {projects.length > 0 && (
            <ViewToggle value={projectView} onChange={handleSetProjectView} />
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
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  inputCount={pInputs.length}
                  clusterCount={pClusters.length}
                  scenarioCount={hasCanvas ? 1 : 0}
                  analysisCount={pAnalyses.length}
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
                  <div style={{ width: 32, ...cell }} />
                </div>
              );
            })()}
            {/* Data rows */}
            {projects.map((p) => {
              const pInputs   = inputs.filter((i)   => i.project_id === p.id);
              const pClusters = clusters.filter((cl) => cl.project_id === p.id);
              const hasCanvas = canvasNodes.some((n) => n.projectId  === p.id);
              const pAnalyses = analyses.filter((a)  => a.project_id === p.id);
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
                    {hasCanvas ? 1 : 0}
                  </div>
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right", fontSize: 11, color: c.muted }}>
                    {pAnalyses.length}
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
                    <div style={{ width: COL.curated,    flexShrink: 0 }} />
                    <div style={{ width: COL.strength,   ...cell }}>Strength</div>
                    <div style={{ width: COL.confidence, ...cell }}>Confidence</div>
                    <div style={{ width: COL.steepled,   ...cell }}>STEEPLED</div>
                    <div style={{ width: COL.horizon,    ...cell }}>Horizon</div>
                    <div style={{ width: COL.actions,    flexShrink: 0 }} />
                  </div>
                );
              })()}
              {/* Data rows */}
              {recentInputs.map((inp) => {
                const steepled  = inp.steepled || [];
                const visible2  = steepled.slice(0, 2);
                const overflow  = steepled.length - 2;
                return (
                  <div
                    key={inp.id}
                    onClick={() => openInputDetail(inp.id)}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.02)"}
                    onMouseLeave={(e) => { e.currentTarget.style.background = c.white; setPickerForId(null); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "0 14px", height: 38,
                      borderBottom: `1px solid ${c.border}`,
                      background: c.white,
                      transition: "background 0.08s",
                      position: "relative",
                      cursor: "pointer",
                    }}
                  >
                    {/* Title */}
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {inp.name}
                    </div>
                    {/* Curated indicator */}
                    <div style={{ width: COL.curated, flexShrink: 0, textAlign: "center" }}>
                      {inp.is_seeded && (
                        <span title="Surfaced by Future Signals" style={{ fontSize: 11, color: c.hint }}>✦</span>
                      )}
                    </div>
                    {/* Strength */}
                    <div style={{ width: COL.strength, flexShrink: 0 }}>
                      {inp.strength ? <StrengthDot str={inp.strength} /> : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
                    </div>
                    {/* Confidence */}
                    <div style={{ width: COL.confidence, flexShrink: 0 }}>
                      <ConfidenceBadge conf={inp.source_confidence} />
                    </div>
                    {/* STEEPLED */}
                    <div style={{ width: COL.steepled, flexShrink: 0, display: "flex", gap: 3, alignItems: "center" }}>
                      {visible2.map((t) => (
                        <span key={t} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#f0f0ee", color: c.muted }}>
                          {STEEPLED_ABB[t] || t}
                        </span>
                      ))}
                      {overflow > 0 && <span style={{ fontSize: 9, color: c.hint }}>+{overflow}</span>}
                    </div>
                    {/* Horizon */}
                    <div style={{ width: COL.horizon, flexShrink: 0 }}>
                      {inp.horizon ? <HorizTag h={inp.horizon} /> : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
                    </div>
                    {/* Date + Add to project */}
                    <div style={{ width: COL.actions, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: c.hint }}>{formatDate(inp.created_at)}</span>
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPickerForId(pickerForId === inp.id ? null : inp.id); }}
                          style={{ ...btnSm, fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }}
                        >
                          Add to project →
                        </button>
                        {pickerForId === inp.id && (
                          <ProjectPickerPopover
                            projects={projects}
                            onSelect={(p) => handleAddToProject(inp, p)}
                            onClose={() => setPickerForId(null)}
                            onCreateProject={openProjectModal}
                          />
                        )}
                      </div>
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

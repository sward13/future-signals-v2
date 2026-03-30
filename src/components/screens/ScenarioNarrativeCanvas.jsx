/**
 * ScenarioNarrativeCanvas — Spatial BMC-style canvas for writing scenario narratives.
 * Implements the Spatial variant from narrative-canvas-variants.jsx, adapted to real project data.
 * Grid: Forces/Tensions (left causes) | World (centre, spans 2 rows) | Who/Implications (right effects)
 *       Watchlist (full-width bottom row)
 * @param {{ appState: object }} props
 */
import { useState, useMemo, useRef } from "react";
import { c, btnSec } from "../../styles/tokens.js";
import { ProjectPicker } from "../shared/ProjectPicker.jsx";

// ─── Color maps ────────────────────────────────────────────────────────────────

const SUBTYPE_COLORS = {
  Trend:   { bg: c.green50,  color: c.green700, border: c.greenBorder },
  Driver:  { bg: c.blue50,   color: c.blue700,  border: c.blueBorder  },
  Tension: { bg: c.amber50,  color: c.amber700, border: c.amberBorder },
};

const ARCHETYPE_TYPES = [
  {
    id: "Continuation",
    label: "Continuation",
    icon: "◎",
    category: "Gradual",
    categoryColor: c.green700, categoryBg: c.green50, categoryBorder: c.greenBorder,
    color: c.green700, bg: c.green50, border: c.greenBorder,
    description: "The present trajectory extends with incremental shifts but no fundamental breaks.",
  },
  {
    id: "Collapse",
    label: "Collapse",
    icon: "▼",
    category: "Disruptive",
    categoryColor: c.red800, categoryBg: c.red50, categoryBorder: c.redBorder,
    color: c.red800, bg: c.red50, border: c.redBorder,
    description: "A critical system fails or fractures, triggering cascading breakdown.",
  },
  {
    id: "Constraint",
    label: "Constraint",
    icon: "◈",
    category: "Structural",
    categoryColor: c.amber700, categoryBg: c.amber50, categoryBorder: c.amberBorder,
    color: c.amber700, bg: c.amber50, border: c.amberBorder,
    description: "Growing limits — regulatory, resource, or social — reshape what's possible.",
  },
  {
    id: "Transformation",
    label: "Transformation",
    icon: "◆",
    category: "Disruptive",
    categoryColor: c.violet700, categoryBg: c.violet50, categoryBorder: c.violetBorder,
    color: c.violet700, bg: c.violet50, border: c.violetBorder,
    description: "A fundamental reorganisation of the system creates a new equilibrium.",
  },
];

// ─── Spatial cell definitions ─────────────────────────────────────────────────

const CELLS = [
  {
    id: "forces",
    area: "forces",
    icon: "◉",
    label: "Forces at work",
    seeds: "forces",
    prompt: "What systemic forces created and sustain this future? Draw from your linked clusters.",
    placeholder: "The collapse was driven by a compounding of institutional failures across both public and private sectors…",
  },
  {
    id: "world",
    area: "world",
    icon: "◎",
    label: "The world that emerges",
    seeds: "question",
    prompt: "Set the scene. What does this future look, feel, and sound like? Write in the present tense, as if you're already there.",
    placeholder: "In the wake of the AI boom, research labs and design studios sit half-empty…",
  },
  {
    id: "who",
    area: "who",
    icon: "◆",
    label: "Who it affects",
    seeds: "stakeholders",
    prompt: "Who wins, who loses, who adapts? Use your named stakeholders as anchors. Avoid false universalism — specify.",
    placeholder: "Agricultural investors who bet on AI-optimised supply chains face the steepest losses…",
  },
  {
    id: "tensions",
    area: "tensions",
    icon: "◈",
    label: "Tensions that define it",
    seeds: "tensions",
    prompt: "What contradictions or unresolved conflicts give this world its texture? Name the fault lines clearly.",
    placeholder: "Between the efficiency gains of surviving AI systems and the widespread distrust of their outputs…",
  },
  {
    id: "impl",
    area: "impl",
    icon: "◉",
    label: "Strategic implications",
    seeds: "stakeholders",
    prompt: "Given this future, what does it demand of your stakeholders now? What would it mean to be prepared — or caught off-guard?",
    placeholder: "For policy makers, the implication is not to accelerate AI adoption but to build the institutional capacity to evaluate AI claims independently…",
  },
  {
    id: "watch",
    area: "watch",
    icon: "◎",
    label: "What to watch for",
    seeds: "signals",
    prompt: "What early indicators would signal this future is beginning to materialise? Draw from your captured inputs.",
    placeholder: "Watch for: rising retraction rates in AI-assisted research · increasing public AI audits · defensive policy positioning by tech majors",
  },
];

function isComplete(text) {
  return text.trim().length >= 20;
}

// ─── Seed chip components ──────────────────────────────────────────────────────

function ForceChip({ cluster }) {
  const st = SUBTYPE_COLORS[cluster.subtype] || { bg: "#f0f0ee", color: c.muted, border: c.border };
  return (
    <span style={{
      fontSize: 9, padding: "1px 6px", borderRadius: 3, lineHeight: 1.4,
      background: st.bg, color: st.color, border: `0.5px solid ${st.border}`,
      whiteSpace: "nowrap",
    }}>
      {cluster.name}
    </span>
  );
}

function NeutralChip({ label }) {
  return (
    <span style={{
      fontSize: 9, padding: "1px 6px", borderRadius: 3, lineHeight: 1.4,
      background: "#f0f0ee", color: c.muted, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function SignalChip({ label }) {
  return (
    <span style={{
      fontSize: 9, padding: "1px 6px", borderRadius: 3, lineHeight: 1.4,
      background: c.surfaceAlt, color: c.muted, border: `0.5px solid ${c.border}`,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─── Archetype switcher chip ───────────────────────────────────────────────────

/** @param {{ selected: string|null, onChange: (id: string) => void }} props */
function ArchetypeSwitcherChip({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const arch = ARCHETYPE_TYPES.find((a) => a.id === selected) || null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px 3px 8px", borderRadius: 20,
          border: `1px solid ${arch ? arch.border : c.borderMid}`,
          background: arch ? arch.bg : c.surfaceAlt,
          color: arch ? arch.color : c.muted,
          fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          transition: "all .1s",
        }}
      >
        <span style={{ fontSize: 10 }}>{arch ? arch.icon : "◇"}</span>
        <span>{arch ? arch.label : "Set archetype"}</span>
        <span style={{ fontSize: 8, opacity: 0.65, marginLeft: 1 }}>▾</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
      )}

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 21,
          background: c.white, border: `1px solid ${c.borderMid}`,
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          minWidth: 320, overflow: "hidden",
        }}>
          {ARCHETYPE_TYPES.map((a) => {
            const active = selected === a.id;
            return (
              <button
                key={a.id}
                onClick={() => { onChange(a.id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", width: "100%",
                  background: active ? "rgba(0,0,0,0.03)" : "transparent",
                  border: "none", borderBottom: `1px solid ${c.border}`,
                  cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: a.bg, border: `1px solid ${a.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: a.color,
                }}>
                  {a.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{a.label}</span>
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 8,
                      background: a.categoryBg, color: a.categoryColor, border: `1px solid ${a.categoryBorder}`,
                    }}>
                      {a.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.4, marginTop: 1 }}>{a.description}</div>
                </div>
                {active && <span style={{ fontSize: 11, color: c.ink, flexShrink: 0 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Spatial cell component ───────────────────────────────────────────────────

function SpatialCell({ cell, content, onChange, selected, onSelect, seeds }) {
  const isFocused = selected === cell.id;
  const hasCont   = content.trim().length > 0;
  const done      = isComplete(content);

  const renderSeeds = () => {
    if (!seeds) return null;
    const { forces, question, stakeholders, tensions, signals } = seeds;

    if (cell.seeds === "forces" && forces?.length) {
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
          {forces.map((cl) => <ForceChip key={cl.id} cluster={cl} />)}
        </div>
      );
    }
    if (cell.seeds === "question" && question) {
      return (
        <div style={{ fontSize: 9, color: c.muted, fontStyle: "italic", lineHeight: 1.5, marginBottom: 5 }}>
          {question}
        </div>
      );
    }
    if (cell.seeds === "stakeholders" && stakeholders?.length) {
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
          {stakeholders.map((s, i) => <NeutralChip key={i} label={s} />)}
        </div>
      );
    }
    if (cell.seeds === "tensions" && tensions?.length) {
      return (
        <div style={{ marginBottom: 5 }}>
          {tensions.map((t, i) => (
            <div key={i} style={{ fontSize: 9, color: c.muted, fontStyle: "italic", lineHeight: 1.4, marginBottom: 1 }}>
              — {t}
            </div>
          ))}
        </div>
      );
    }
    if (cell.seeds === "signals" && signals?.length) {
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
          {signals.map((s, i) => <SignalChip key={i} label={s} />)}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      onClick={() => onSelect(cell.id)}
      style={{
        gridArea: cell.area,
        border: `0.5px solid ${isFocused ? c.ink : c.borderMid}`,
        borderRadius: 7,
        background: c.white,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        outline: isFocused ? `2px solid ${c.ink}` : "none",
        outlineOffset: 2,
        transition: "border-color .15s, outline .15s",
        cursor: "default",
        position: "relative",
      }}
    >
      {/* Cell header */}
      <div style={{
        padding: "6px 9px 5px",
        borderBottom: `0.5px solid ${c.border}`,
        background: isFocused ? c.ink : c.surfaceAlt,
        display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
        transition: "background .15s",
      }}>
        <span style={{ fontSize: 9, color: isFocused ? "rgba(255,255,255,.5)" : c.hint }}>
          {cell.icon}
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, color: isFocused ? c.white : c.ink }}>
          {cell.label}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          {done && (
            <span style={{ fontSize: 8, color: isFocused ? "rgba(255,255,255,.55)" : c.green700 }}>✓</span>
          )}
          {hasCont && (
            <span style={{ fontSize: 8, color: isFocused ? "rgba(255,255,255,.4)" : c.hint }}>
              {content.trim().split(/\s+/).length}w
            </span>
          )}
        </div>
      </div>

      {/* Seeds + prompt — shown when focused or no content written */}
      {(isFocused || !hasCont) && (
        <div style={{ padding: "5px 8px 0", flexShrink: 0 }}>
          {isFocused && (
            <div style={{ fontSize: 8, color: c.hint, fontStyle: "italic", lineHeight: 1.5, marginBottom: 4 }}>
              {cell.prompt}
            </div>
          )}
          {renderSeeds()}
        </div>
      )}

      {/* Writing area */}
      <textarea
        value={content}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.value); }}
        onClick={(e) => e.stopPropagation()}
        onFocus={() => onSelect(cell.id)}
        placeholder={cell.placeholder}
        style={{
          flex: 1,
          width: "100%",
          boxSizing: "border-box",
          padding: "5px 9px 7px",
          border: "none",
          background: "transparent",
          color: c.ink,
          fontSize: 11,
          fontFamily: "inherit",
          outline: "none",
          resize: "none",
          lineHeight: 1.6,
          cursor: "text",
        }}
      />
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ScenarioNarrativeCanvas({ appState }) {
  const {
    activeProjectId, setActiveProjectId, projects, inputs, clusters, scenarios,
    setActiveScreen, openProjectModal, updateScenario,
  } = appState;

  // Content keyed as `${scenarioId}_${cellId}` — persists across scenario switches
  const [content,          setContent]          = useState({});
  const [selected,         setSelected]         = useState(null);
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [showExport,       setShowExport]       = useState(false);

  // Inline title editing
  const [titleEditing,  setTitleEditing]  = useState(false);
  const [titleDraft,    setTitleDraft]    = useState("");
  const titleInputRef = useRef(null);

  const project          = projects.find((p) => p.id === activeProjectId) || null;
  const projectScenarios = useMemo(
    () => scenarios.filter((s) => s.project_id === activeProjectId),
    [scenarios, activeProjectId]
  );

  const scenario = projectScenarios.find((s) => s.id === activeScenarioId)
    || projectScenarios[0]
    || null;

  // Seed data derived from the active scenario
  const scenarioClusters = useMemo(() => {
    if (!scenario) return [];
    return clusters.filter((cl) => (scenario.cluster_ids || []).includes(cl.id));
  }, [scenario, clusters]);

  const scenarioInputs = useMemo(() => {
    const ids = new Set(scenarioClusters.flatMap((cl) => cl.input_ids || []));
    return inputs.filter((i) => ids.has(i.id));
  }, [scenarioClusters, inputs]);

  const stakeholders = useMemo(() => {
    if (!project?.stakeholders) return [];
    return project.stakeholders.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }, [project]);

  const tensionLabels = useMemo(
    () => scenarioClusters.filter((cl) => cl.subtype === "Tension").map((cl) => cl.name),
    [scenarioClusters]
  );

  const seeds = scenario ? {
    forces:       scenarioClusters,
    question:     scenario.narrative || project?.question || "",
    stakeholders,
    tensions:     tensionLabels,
    signals:      scenarioInputs.slice(0, 8).map((i) => i.name),
  } : {};

  // Horizon display label
  const horizonLabel = useMemo(() => {
    if (!scenario || !project) return "";
    const h = scenario.horizon;
    const startKey = h === "H1" ? "h1_start" : h === "H2" ? "h2_start" : "h3_start";
    const endKey   = h === "H1" ? "h1_end"   : h === "H2" ? "h2_end"   : "h3_end";
    const start = project[startKey];
    const end   = project[endKey];
    if (start && end) return `${h} · ${start}–${end}`;
    return h || "";
  }, [scenario, project]);

  // Per-cell content helpers
  const getKey  = (cellId) => `${scenario?.id}_${cellId}`;
  const getCont = (cellId) => content[getKey(cellId)] || "";
  const setCont = (cellId) => (val) =>
    setContent((prev) => ({ ...prev, [getKey(cellId)]: val }));

  const completedCount  = CELLS.filter((cell) => isComplete(getCont(cell.id))).length;

  // Inline title edit handlers
  const startEditTitle = () => {
    setTitleDraft(scenario?.name || "");
    setTitleEditing(true);
    setTimeout(() => { titleInputRef.current?.select(); }, 0);
  };
  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== scenario?.name && scenario) {
      updateScenario(scenario.id, { name: trimmed });
    }
    setTitleEditing(false);
  };
  const handleTitleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
    if (e.key === "Escape") setTitleEditing(false);
  };

  // Archetype selection handler
  const handleArchetype = (archetype) => {
    if (scenario && archetype !== scenario.archetype) {
      updateScenario(scenario.id, { archetype });
    }
  };

  // ── No active project ──────────────────────────────────────────────────────
  if (!project) {
    return (
      <ProjectPicker
        heading="Select a project to work in"
        description="The Scenario Canvas builds narrative context for a specific scenario within a project."
        projects={projects}
        inputs={inputs}
        clusters={clusters}
        scenarios={scenarios}
        onSelect={(id) => setActiveProjectId(id)}
        onNewProject={openProjectModal}
      />
    );
  }

  // ── No scenarios in project ───────────────────────────────────────────────
  if (projectScenarios.length === 0) {
    return (
      <div style={{ padding: "36px 32px", background: c.bg, minHeight: "100%" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, marginBottom: 8 }}>Scenarios</div>
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.7, marginBottom: 20 }}>
            No scenarios yet for <strong>{project.name}</strong>. Build your System Map first, then create a scenario to start writing narrative.
          </div>
          <button onClick={() => setActiveScreen("scenarios")} style={{ ...btnSec, fontSize: 12 }}>
            Go to System Map →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: c.white }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: "8px 16px 0",
        borderBottom: `0.5px solid ${c.border}`,
        background: c.surfaceAlt,
        flexShrink: 0,
      }}>
        {/* Top row: title + right-side controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>

            {/* Inline-editable scenario name */}
            {titleEditing ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={handleTitleKey}
                style={{
                  fontSize: 13, fontWeight: 500, color: c.ink,
                  background: "transparent",
                  border: "none", borderBottom: `1px solid ${c.ink}`,
                  outline: "none", fontFamily: "inherit",
                  padding: "0 0 1px 0", minWidth: 120, maxWidth: 320,
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Editable title */}
                <span
                  onClick={startEditTitle}
                  title="Click to rename"
                  style={{
                    fontSize: 13, fontWeight: 500, color: c.ink,
                    cursor: "text",
                    borderBottom: "1px solid transparent",
                    transition: "border-color .15s",
                    paddingBottom: 1,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = c.borderMid; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = "transparent"; }}
                >
                  {scenario?.name}
                </span>
                {/* Scenario switcher — only when multiple scenarios exist */}
                {projectScenarios.length > 1 && (
                  <div style={{ position: "relative" }}>
                    <select
                      value={scenario?.id || ""}
                      onChange={(e) => setActiveScenarioId(e.target.value)}
                      style={{
                        fontSize: 10, color: c.muted, background: "transparent",
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                        outline: "none", appearance: "none", paddingRight: 12,
                      }}
                    >
                      {projectScenarios.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <span style={{
                      fontSize: 8, position: "absolute", right: 0, top: "50%",
                      transform: "translateY(-50%)", color: c.hint, pointerEvents: "none",
                    }}>▾</span>
                  </div>
                )}
              </div>
            )}

            {/* Horizon label */}
            {horizonLabel && (
              <span style={{ fontSize: 10, color: c.hint, flexShrink: 0 }}>{horizonLabel}</span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* Completion counter */}
            <span style={{ fontSize: 10, color: c.hint }}>
              {completedCount}/{CELLS.length}
            </span>

            {/* Export */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowExport((e) => !e)}
                style={{
                  padding: "5px 11px", borderRadius: 6, background: c.ink,
                  border: "none", color: c.white, fontSize: 11, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                ↓ Export
              </button>
              {showExport && (
                <>
                  <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 11,
                    background: c.white, border: `0.5px solid ${c.borderMid}`,
                    borderRadius: 7, padding: 8, minWidth: 130,
                    boxShadow: "0 4px 16px rgba(0,0,0,.1)",
                  }}>
                    {[["↓  Markdown", ".md"], ["↓  PDF", ".pdf"]].map(([label, ext]) => (
                      <div key={ext} style={{
                        padding: "7px 10px", borderRadius: 5, cursor: "pointer",
                        fontSize: 11, color: c.muted, display: "flex", justifyContent: "space-between",
                      }}>
                        <span>{label}</span>
                        <span style={{ color: c.hint }}>{ext}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Archetype type-switcher */}
        <div style={{ paddingBottom: 8 }}>
          <ArchetypeSwitcherChip
            selected={scenario?.archetype || null}
            onChange={handleArchetype}
          />
        </div>
      </div>

      {/* ── Spatial grid ────────────────────────────────────────────────── */}
      <div
        onClick={() => setSelected(null)}
        style={{
          flex: 1,
          padding: 10,
          display: "grid",
          gridTemplateAreas: `"forces world who" "tensions world impl" "watch watch watch"`,
          gridTemplateColumns: "1fr 1.5fr 1fr",
          gridTemplateRows: "1fr 1fr 100px",
          gap: 7,
          overflow: "hidden",
        }}
      >
        {CELLS.map((cell) => (
          <SpatialCell
            key={cell.id}
            cell={cell}
            content={getCont(cell.id)}
            onChange={setCont(cell.id)}
            selected={selected}
            onSelect={setSelected}
            seeds={seeds}
          />
        ))}
      </div>

      {/* ── Bottom nav hint ──────────────────────────────────────────────── */}
      <div style={{
        padding: "5px 16px",
        borderTop: `0.5px solid ${c.border}`,
        background: c.surfaceAlt,
        display: "flex", alignItems: "center",
        fontSize: 9, color: c.hint, flexShrink: 0,
      }}>
        <span>← Causes</span>
        <span style={{ flex: 1, textAlign: "center" }}>Core narrative</span>
        <span>Effects →</span>
      </div>
    </div>
  );
}

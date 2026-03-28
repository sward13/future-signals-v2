/**
 * Clustering screen — three-tab interface for grouping project inputs into clusters.
 * Tabs: Inputs | AI Suggestions | Clusters
 * Shows a project picker when no project is active.
 * Inputs tab supports multi-select with bulk assign-to-cluster action bar.
 * @param {{ appState: object }} props
 */
import { useState, useEffect, useRef } from "react";
import { c, btnP, btnSm, btnSec, btnG, fl } from "../../styles/tokens.js";
import { StrengthDot, HorizTag, SubtypeTag, Tag } from "../shared/Tag.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { ProjectPicker } from "../shared/ProjectPicker.jsx";
import { ClusterDrawer } from "../clusters/ClusterDrawer.jsx";
import { InputDrawer } from "../inputs/InputDrawer.jsx";

// ─── Likelihood tag ────────────────────────────────────────────────────────────

function LikelihoodTag({ l }) {
  const map = {
    Probable:  [c.green700,  c.green50,  c.greenBorder],
    Plausible: [c.blue700,   c.blue50,   c.blueBorder],
    Possible:  [c.amber700,  c.amber50,  c.amberBorder],
  };
  const [col, bg, brd] = map[l] || [c.hint, "transparent", c.border];
  return <Tag label={l} color={col} bg={bg} border={brd} />;
}

// ─── STEEPLED pills ────────────────────────────────────────────────────────────

function SteepleList({ tags = [] }) {
  if (!tags.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {tags.map((t) => (
        <span key={t} style={{
          fontSize: 10, padding: "1px 6px", borderRadius: 8,
          background: c.surfaceAlt, color: c.muted,
          border: `1px solid ${c.border}`,
        }}>
          {t}
        </span>
      ))}
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${c.border}`, marginBottom: 20 }}>
      {tabs.map(({ id, label, count }) => {
        const on = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              padding: "10px 18px", fontSize: 12,
              fontWeight: on ? 500 : 400,
              color: on ? c.ink : c.muted,
              background: "transparent", border: "none",
              borderBottom: `2px solid ${on ? c.ink : "transparent"}`,
              marginBottom: -1, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {label}
            {count != null && (
              <span style={{
                fontSize: 10, padding: "1px 5px", borderRadius: 8,
                background: on ? c.ink : "rgba(0,0,0,0.06)",
                color: on ? c.white : c.muted,
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Mock AI suggestion generator ─────────────────────────────────────────────

const SUGGESTION_META = {
  Political:     { name: "Governance & Regulatory Pressures",  subtype: "Driver",  expl: "These inputs converge on political and governance dynamics. Together they point to a structural shift in how states are asserting control over emerging technologies and systemic risks — shaping the operating rules for multiple industries." },
  Legal:         { name: "Legal & Compliance Constraints",     subtype: "Tension", expl: "A shared legal dimension connects these inputs. Each signals a domain where formal rules are being written, contested, or enforced — creating near-term compliance complexity and longer-term regulatory uncertainty." },
  Technological: { name: "Technology Disruption Dynamics",     subtype: "Driver",  expl: "These inputs each point to a distinct layer of technology-driven change. Taken together, they describe an accelerating structural shift in how AI and digital systems are being deployed, absorbed, and regulated across sectors." },
  Social:        { name: "Social & Behavioural Shifts",        subtype: "Trend",   expl: "These inputs reflect changing social behaviours, expectations, and public attitudes. Together they suggest a reconfiguration of trust, identity, and how people relate to institutions — with cascading effects on both demand and legitimacy." },
  Economic:      { name: "Economic Structural Change",         subtype: "Trend",   expl: "These inputs share an economic dimension, pointing toward structural changes in finance, labour markets, and capital allocation patterns that are likely to persist across multiple time horizons." },
  Environmental: { name: "Environmental & Resource Pressures", subtype: "Driver",  expl: "These inputs track environmental constraints and the physical realities of decarbonisation. Together they represent converging pressures on energy systems, emissions accounting, and infrastructure investment." },
  Ethical:       { name: "Ethical & Values Tensions",          subtype: "Tension", expl: "These inputs raise questions of values and ethics — where norms are contested, obligations are unclear, or the distribution of benefit and risk is uneven across populations and jurisdictions." },
  Demographic:   { name: "Demographic & Workforce Shifts",     subtype: "Trend",   expl: "These inputs track population and workforce dynamics. Together they signal structural shifts in how societies organise labour, education, and care over coming decades." },
};

const CONFIDENCE_LEVELS = [88, 74, 63];

function generateSuggestions(projectInputs) {
  if (projectInputs.length < 2) return [];
  const groups = {};
  for (const inp of projectInputs) {
    for (const tag of (inp.steepled || [])) {
      if (!groups[tag]) groups[tag] = [];
      if (!groups[tag].some((i) => i.id === inp.id)) groups[tag].push(inp);
    }
  }
  return Object.entries(groups)
    .filter(([, inps]) => inps.length >= 2)
    .slice(0, 3)
    .map(([tag, inps], i) => {
      const meta = SUGGESTION_META[tag] || { name: `${tag} Cluster`, subtype: "Trend", expl: `These inputs share a ${tag.toLowerCase()} dimension.` };
      return {
        id: `sug-${i}-${tag}`,
        name: meta.name,
        suggestedSubtype: meta.subtype,
        confidence: CONFIDENCE_LEVELS[i] ?? 60,
        explanation: meta.expl,
        inputIds: inps.slice(0, 4).map((inp) => inp.id),
      };
    });
}

// ─── Cluster assign popover ────────────────────────────────────────────────────

function AssignPicker({ clusters, onAssign, onNewCluster, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
      <div style={{
        position: "absolute", top: "100%", right: 0, marginTop: 4,
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
        minWidth: 240, zIndex: 51, overflow: "hidden",
      }}>
        {clusters.length === 0 ? (
          <div style={{ padding: "12px 14px", fontSize: 12, color: c.hint }}>No clusters yet</div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {clusters.map((cl) => (
              <button
                key={cl.id}
                onClick={() => onAssign(cl)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "10px 14px",
                  background: "transparent", border: "none",
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  borderBottom: `1px solid ${c.border}`,
                }}
              >
                <SubtypeTag sub={cl.subtype} />
                <span style={{ fontSize: 12, color: c.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cl.name}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onNewCluster}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", padding: "10px 14px",
            background: "transparent", border: "none",
            textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, color: c.muted,
          }}
        >
          <span style={{ fontSize: 14 }}>+</span> Build a cluster
        </button>
      </div>
    </>
  );
}

// ─── Inline checkbox ──────────────────────────────────────────────────────────

function RowCheckbox({ checked, visible }) {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: 3, flexShrink: 0,
      border: `1.5px solid ${checked ? c.ink : visible ? c.borderMid : "rgba(0,0,0,0.12)"}`,
      background: checked ? c.ink : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "border-color 0.15s, background 0.15s",
      pointerEvents: "none",
    }}>
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ─── Input card (Inputs tab) ───────────────────────────────────────────────────

function ClusteringInputCard({ input, clusters, assignedCluster, onAssign, onNewCluster, onOpenDetail, selected, onToggleSelect, anySelected }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const SUBTYPE_ICONS = { signal: "◎", issue: "▲", projection: "◆", plan: "◉", obstacle: "▲", source: "◻" };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: c.white,
        border: `1px solid ${selected ? c.borderMid : c.border}`,
        borderRadius: 10, padding: "14px 16px",
        transition: "border-color 0.1s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Checkbox */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelect(input.id); }}
          style={{ paddingTop: 2, flexShrink: 0, cursor: "pointer" }}
        >
          <RowCheckbox checked={selected} visible={anySelected || hovered} />
        </div>

        {/* Subtype icon */}
        <span style={{ fontSize: 11, color: c.hint, marginTop: 2, flexShrink: 0 }}>
          {SUBTYPE_ICONS[input.subtype] || "◎"}
        </span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title — click toggles selection */}
          <div
            onClick={(e) => { e.stopPropagation(); onToggleSelect(input.id); }}
            style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 4, cursor: "pointer" }}
          >
            {input.name}
          </div>
          {input.description && (
            <div
              onClick={onOpenDetail}
              style={{
                fontSize: 11, color: c.muted, lineHeight: 1.5, marginBottom: 8, cursor: "pointer",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}
            >
              {input.description}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: assignedCluster ? 8 : 0 }}>
            <SteepleList tags={input.steepled} />
            {input.strength && <StrengthDot str={input.strength} />}
            {input.horizon && <HorizTag h={input.horizon} />}
          </div>
          {assignedCluster && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 10, color: c.green700,
              padding: "2px 8px", borderRadius: 8,
              background: c.green50, border: `1px solid ${c.greenBorder}`,
            }}>
              ✓ {assignedCluster.name}
            </div>
          )}
        </div>

        {/* Per-card assign button — hidden when in bulk-select mode */}
        {!anySelected && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setPickerOpen((s) => !s); }}
              style={{
                ...btnSm,
                background: assignedCluster ? c.surfaceAlt : c.ink,
                color: assignedCluster ? c.muted : c.white,
                border: assignedCluster ? `1px solid ${c.border}` : "none",
                fontSize: 11, whiteSpace: "nowrap",
              }}
            >
              {assignedCluster ? "Reassign →" : "Assign to cluster →"}
            </button>
            {pickerOpen && (
              <AssignPicker
                clusters={clusters}
                onAssign={(cl) => { onAssign(input.id, cl); setPickerOpen(false); }}
                onNewCluster={() => { setPickerOpen(false); onNewCluster(); }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Suggestion card ────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, inputs, onAccept, onDismiss }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(suggestion.name);
  const nameRef = useRef(null);

  useEffect(() => {
    if (editingName && nameRef.current) nameRef.current.focus();
  }, [editingName]);

  const sugInputs = inputs.filter((inp) => suggestion.inputIds.includes(inp.id));

  const SUBTYPE_COLORS = {
    Trend:   [c.violet700, c.violet50, c.violetBorder],
    Driver:  [c.cyan700,   c.cyan50,   c.cyanBorder],
    Tension: [c.amber700,  c.amber50,  c.amberBorder],
  };
  const [col, bg, brd] = SUBTYPE_COLORS[suggestion.suggestedSubtype] || [c.muted, c.surfaceAlt, c.border];

  return (
    <div style={{
      background: c.white, border: `1px solid ${c.border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${c.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
              style={{
                fontSize: 14, fontWeight: 500, color: c.ink,
                border: "none", outline: `2px solid ${c.borderMid}`,
                borderRadius: 4, padding: "2px 6px",
                background: c.fieldBg, fontFamily: "inherit", width: "100%",
              }}
            />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 500, color: c.ink }}>{name}</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
            <span style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 8,
              background: bg, color: col, border: `1px solid ${brd}`,
            }}>
              {suggestion.suggestedSubtype}
            </span>
            <span style={{ fontSize: 11, color: c.muted }}>
              AI confidence: <strong style={{ color: c.ink }}>{suggestion.confidence}%</strong>
            </span>
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}` }}>
        <div style={{ fontSize: 11, color: c.hint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Why these inputs belong together
        </div>
        <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.65 }}>{suggestion.explanation}</div>
      </div>
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${c.border}` }}>
        <div style={{ fontSize: 11, color: c.hint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Inputs grouped ({sugInputs.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {sugInputs.map((inp) => (
            <div key={inp.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 10, color: c.hint }}>◎</span>
              <span style={{ fontSize: 12, color: c.ink, flex: 1 }}>{inp.name}</span>
              {inp.horizon && <HorizTag h={inp.horizon} />}
            </div>
          ))}
          {sugInputs.length === 0 && (
            <div style={{ fontSize: 12, color: c.hint }}>No matching inputs in this project.</div>
          )}
        </div>
      </div>
      <div style={{ padding: "12px 18px", display: "flex", gap: 8 }}>
        <button onClick={() => onAccept({ ...suggestion, name })} style={{ ...btnSm, fontSize: 11 }}>
          Accept as cluster
        </button>
        <button onClick={() => setEditingName(true)} style={{ ...btnSec, padding: "6px 14px", fontSize: 11 }}>
          Edit name
        </button>
        <button onClick={onDismiss} style={{ ...btnG, fontSize: 11, marginLeft: "auto" }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Cluster card ──────────────────────────────────────────────────────────────

function ClusterCard({ cluster, inputs, onClick }) {
  const clusterInputs = inputs.filter((inp) => cluster.input_ids?.includes(inp.id));
  return (
    <div
      onClick={onClick}
      style={{
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 11, overflow: "hidden", cursor: "pointer",
      }}
    >
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>{cluster.name}</span>
            <SubtypeTag sub={cluster.subtype} />
            <HorizTag h={cluster.horizon} />
            {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
          </div>
          {cluster.description && (
            <div style={{
              fontSize: 11, color: c.muted, lineHeight: 1.5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {cluster.description}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: c.hint }}>{clusterInputs.length} inputs</span>
          <span style={{ fontSize: 11, color: c.hint }}>›</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Clustering({ appState }) {
  const {
    activeProjectId, setActiveProjectId, projects, inputs, clusters,
    addCluster, addInput,
    assignInputToCluster,
    showToast, setActiveScreen, openProjectModal,
    openInputDetail, openClusterDetail, scenarios,
  } = appState;

  const [activeTab,             setActiveTab]             = useState("inputs");
  const [newClusterDrawerOpen,  setNewClusterDrawerOpen]  = useState(false);
  const [inputDrawerOpen,       setInputDrawerOpen]       = useState(false);
  const [selectedInputIds,      setSelectedInputIds]      = useState([]);
  const [assignPickerOpen,      setAssignPickerOpen]      = useState(false);
  const [preselectedForCluster, setPreselectedForCluster] = useState([]);

  const project         = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null;
  const projectInputs   = project ? inputs.filter((i)  => i.project_id  === project.id) : [];
  const projectClusters = project ? clusters.filter((cl) => cl.project_id === project.id) : [];

  // AI suggestions: regenerate when project changes
  const [suggestions,  setSuggestions]  = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [acceptedIds,  setAcceptedIds]  = useState(new Set());

  useEffect(() => {
    setSuggestions(generateSuggestions(projectInputs));
    setDismissedIds(new Set());
    setAcceptedIds(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // Clear selection when switching away from inputs tab
  useEffect(() => {
    if (activeTab !== "inputs") setSelectedInputIds([]);
  }, [activeTab]);

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.has(s.id) && !acceptedIds.has(s.id)
  );

  const getInputCluster = (inputId) =>
    projectClusters.find((cl) => cl.input_ids?.includes(inputId)) || null;

  // Single-input assign (per-card button)
  const handleAssignInput = (inputId, cluster) => {
    assignInputToCluster(inputId, cluster.id);
    showToast(`Input assigned to "${cluster.name}"`);
  };

  // Bulk assign selected inputs to a cluster
  const handleBulkAssign = (cluster) => {
    selectedInputIds.forEach((id) => assignInputToCluster(id, cluster.id));
    const n = selectedInputIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} assigned to "${cluster.name}"`);
    setSelectedInputIds([]);
    setAssignPickerOpen(false);
  };

  // Open new cluster drawer with selected inputs pre-checked
  const handleNewClusterFromSelection = () => {
    setPreselectedForCluster([...selectedInputIds]);
    setSelectedInputIds([]);
    setAssignPickerOpen(false);
    setNewClusterDrawerOpen(true);
  };

  const toggleSelectInput = (id) => {
    setSelectedInputIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAcceptSuggestion = (sug) => {
    const newCluster = addCluster({
      name: sug.name,
      subtype: sug.suggestedSubtype,
      horizon: "H1",
      likelihood: "Plausible",
      description: "",
      project_id: project.id,
      input_ids: sug.inputIds,
    });
    setAcceptedIds((prev) => new Set([...prev, sug.id]));
    showToast(`Cluster "${newCluster.name}" created`);
    setActiveTab("clusters");
  };

  const handleCreateCluster = (fields) => {
    addCluster({ ...fields, project_id: project.id });
    setNewClusterDrawerOpen(false);
    setPreselectedForCluster([]);
    const n = (fields.input_ids || []).length;
    showToast(n > 0 ? `Cluster created with ${n} input${n !== 1 ? "s" : ""}` : "Cluster created — no inputs linked yet");
  };

  const handleAddInput = (fields) => {
    addInput({ ...fields, project_id: project.id });
    showToast("Input added to project");
    setInputDrawerOpen(false);
  };

  const tabs = [
    { id: "inputs",      label: "Inputs",        count: projectInputs.length },
    { id: "suggestions", label: "AI Suggestions", count: visibleSuggestions.length || null },
    { id: "clusters",    label: "Clusters",       count: projectClusters.length },
  ];

  const anySelected = selectedInputIds.length > 0;

  // ── No active project: show picker ────────────────────────────────
  if (!project) {
    return (
      <ProjectPicker
        heading="Select a project to work in"
        description="Choose a project to cluster its inputs into themes, trends, and drivers."
        projects={projects}
        inputs={inputs}
        clusters={clusters}
        scenarios={scenarios}
        onSelect={(id) => setActiveProjectId(id)}
        onNewProject={openProjectModal}
      />
    );
  }

  return (
    <>
      <div style={{ padding: "24px 32px", background: c.bg, minHeight: "100%", overflowY: "auto" }}>

        {/* ── Header ────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint }}>
                {project.name}
              </div>
              <button
                onClick={() => setActiveProjectId(null)}
                style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 4,
                  border: `1px solid ${c.border}`, background: "transparent",
                  color: c.hint, cursor: "pointer", fontFamily: "inherit",
                  letterSpacing: 0, textTransform: "none",
                }}
              >switch ↕</button>
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Clustering</div>
          </div>
          <button onClick={() => setNewClusterDrawerOpen(true)} style={btnP}>
            Build a cluster
          </button>
        </div>

        {/* Context strip */}
        <div style={{ fontSize: 11, color: c.muted, marginBottom: 24 }}>
          {projectInputs.length} inputs · {projectClusters.length} clusters
        </div>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {/* ── Inputs tab ────────────────────────────────────── */}
        {activeTab === "inputs" && (
          <>
            {/* Tab header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 12, color: c.muted }}>
                {projectInputs.length > 0
                  ? `${projectInputs.length} input${projectInputs.length !== 1 ? "s" : ""} in this project`
                  : "No inputs yet"}
              </div>
              <button onClick={() => setInputDrawerOpen(true)} style={{ ...btnSm, fontSize: 11 }}>
                Add an input
              </button>
            </div>

            {/* Bulk selection action bar */}
            {anySelected && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px",
                background: c.white,
                border: `1px solid ${c.borderMid}`,
                borderRadius: 9, marginBottom: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, flex: 1 }}>
                  {selectedInputIds.length} input{selectedInputIds.length !== 1 ? "s" : ""} selected
                </span>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setAssignPickerOpen((s) => !s)}
                    style={{ ...btnSm, fontSize: 11 }}
                  >
                    Assign to cluster →
                  </button>
                  {assignPickerOpen && (
                    <AssignPicker
                      clusters={projectClusters}
                      onAssign={handleBulkAssign}
                      onNewCluster={handleNewClusterFromSelection}
                      onClose={() => setAssignPickerOpen(false)}
                    />
                  )}
                </div>
                <button
                  onClick={() => setSelectedInputIds([])}
                  style={{ ...btnG, fontSize: 11, color: c.muted }}
                >
                  Clear selection
                </button>
              </div>
            )}

            {projectInputs.length === 0 ? (
              <EmptyState
                icon="◎"
                title="No inputs in this project"
                body="Create a new input directly, or head to the Inbox to pull in existing signals."
                ctaLabel="Add an input"
                onCta={() => setInputDrawerOpen(true)}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {projectInputs.map((inp) => (
                  <ClusteringInputCard
                    key={inp.id}
                    input={inp}
                    clusters={projectClusters}
                    assignedCluster={getInputCluster(inp.id)}
                    onAssign={handleAssignInput}
                    onNewCluster={() => setNewClusterDrawerOpen(true)}
                    onOpenDetail={() => openInputDetail(inp.id)}
                    selected={selectedInputIds.includes(inp.id)}
                    onToggleSelect={toggleSelectInput}
                    anySelected={anySelected}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── AI Suggestions tab ────────────────────────────── */}
        {activeTab === "suggestions" && (
          <>
            {projectInputs.length < 2 ? (
              <EmptyState
                icon="◈"
                title="Not enough inputs"
                body="Add at least 2 inputs to this project to generate cluster suggestions."
                ctaLabel="Add an input"
                onCta={() => { setActiveTab("inputs"); setInputDrawerOpen(true); }}
              />
            ) : visibleSuggestions.length === 0 ? (
              <EmptyState
                icon="◈"
                title="All suggestions handled"
                body="You've accepted or dismissed all AI suggestions. Add more inputs to generate new ones."
              />
            ) : (
              <>
                <div style={{
                  padding: "10px 14px", marginBottom: 20,
                  background: c.surfaceAlt, border: `1px solid ${c.border}`,
                  borderRadius: 9, fontSize: 12, color: c.muted, lineHeight: 1.55,
                }}>
                  These groupings were generated by analysing STEEPLED dimensions across your inputs. Accept to create a cluster, edit the name to refine, or dismiss to ignore.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {visibleSuggestions.map((sug) => (
                    <SuggestionCard
                      key={sug.id}
                      suggestion={sug}
                      inputs={projectInputs}
                      onAccept={handleAcceptSuggestion}
                      onDismiss={() => setDismissedIds((prev) => new Set([...prev, sug.id]))}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Clusters tab ──────────────────────────────────── */}
        {activeTab === "clusters" && (
          <>
            {projectClusters.length === 0 ? (
              <EmptyState
                icon="◈"
                title="No clusters yet"
                body={
                  projectInputs.length < 3
                    ? `Add at least 3 inputs before clustering. You have ${projectInputs.length} so far.`
                    : "Build your first cluster manually or accept an AI suggestion."
                }
                ctaLabel={projectInputs.length >= 2 ? "View AI suggestions" : undefined}
                onCta={() => setActiveTab("suggestions")}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {projectClusters.map((cl) => (
                  <ClusterCard
                    key={cl.id}
                    cluster={cl}
                    inputs={projectInputs}
                    onClick={() => openClusterDetail(cl.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ClusterDrawer
        open={newClusterDrawerOpen}
        onClose={() => { setNewClusterDrawerOpen(false); setPreselectedForCluster([]); }}
        onSave={handleCreateCluster}
        projectId={project.id}
        projectInputs={projectInputs}
        preselectedInputIds={preselectedForCluster}
      />

      <InputDrawer
        open={inputDrawerOpen}
        onClose={() => setInputDrawerOpen(false)}
        onSave={handleAddInput}
        projects={projects}
        defaultProjectId={project.id}
      />
    </>
  );
}

/**
 * Clustering screen — single scrollable view for grouping project inputs into clusters.
 * Three stacked sections: Clusters grid (top), Unassigned inputs table (middle),
 * AI suggestions table (bottom). No tabs.
 * @param {{ appState: object }} props
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { c, btnP, btnSm, btnSec, btnG } from "../../styles/tokens.js";
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
  if (!tags.length) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {tags.map((t) => (
        <span key={t} style={{
          fontSize: 9, padding: "1px 5px", borderRadius: 8,
          background: c.surfaceAlt, color: c.muted,
          border: `1px solid ${c.border}`,
        }}>
          {t}
        </span>
      ))}
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

// ─── Cluster card (grid) ───────────────────────────────────────────────────────

function ClusterCard({ cluster, inputs, onClick }) {
  const clusterInputs = inputs.filter((inp) => cluster.input_ids?.includes(inp.id));
  return (
    <div
      onClick={onClick}
      style={{
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 11, overflow: "hidden", cursor: "pointer",
        transition: "border-color 0.12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.borderMid; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; }}
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

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>{title}</div>
        {count != null && (
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 8,
            background: "rgba(0,0,0,0.06)", color: c.muted,
          }}>
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── Table header row ──────────────────────────────────────────────────────────

function TableHead({ cols }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: cols.map((c) => c.width).join(" "),
      padding: "6px 12px",
      borderBottom: `1px solid ${c.border}`,
      background: c.surfaceAlt,
      borderRadius: "8px 8px 0 0",
    }}>
      {cols.map((col) => (
        <div key={col.label} style={{
          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint,
          textAlign: col.align || "left",
        }}>
          {col.label}
        </div>
      ))}
    </div>
  );
}

// ─── Input table row ──────────────────────────────────────────────────────────

const SUBTYPE_ICONS = { signal: "◎", issue: "▲", projection: "◆", plan: "◉", obstacle: "▲", source: "◻" };

function InputTableRow({ input, clusters, assignedCluster, onAssign, onNewCluster, onOpenDetail, selected, onToggleSelect, anySelected, isLast }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const cols = "28px 1fr 80px 60px 160px 60px 120px";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        alignItems: "center",
        padding: "9px 12px",
        background: selected ? "rgba(0,0,0,0.02)" : c.white,
        borderBottom: isLast ? "none" : `1px solid ${c.border}`,
        transition: "background 0.1s",
        gap: 0,
      }}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggleSelect(input.id); }}
        style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
      >
        <RowCheckbox checked={selected} visible={anySelected || hovered} />
      </div>

      {/* Title */}
      <div
        onClick={onOpenDetail}
        style={{
          fontSize: 12, fontWeight: 500, color: c.ink,
          cursor: "pointer", paddingRight: 8,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <span style={{ fontSize: 10, color: c.hint, flexShrink: 0 }}>{SUBTYPE_ICONS[input.subtype] || "◎"}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{input.name}</span>
      </div>

      {/* Strength */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {input.strength ? <StrengthDot str={input.strength} /> : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
      </div>

      {/* Horizon */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {input.horizon ? <HorizTag h={input.horizon} /> : <span style={{ fontSize: 10, color: c.hint }}>—</span>}
      </div>

      {/* STEEPLED */}
      <div style={{ paddingRight: 8 }}>
        <SteepleList tags={input.steepled} />
      </div>

      {/* Cluster status */}
      <div>
        {assignedCluster ? (
          <span style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 8,
            background: c.green50, color: c.green700, border: `1px solid ${c.greenBorder}`,
            whiteSpace: "nowrap",
          }}>
            ✓ assigned
          </span>
        ) : (
          <span style={{ fontSize: 10, color: c.hint }}>—</span>
        )}
      </div>

      {/* Assign action */}
      {!anySelected && (
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setPickerOpen((s) => !s); }}
            style={{
              fontSize: 10, padding: "4px 10px", borderRadius: 6,
              background: assignedCluster ? "transparent" : c.ink,
              color: assignedCluster ? c.muted : c.white,
              border: `1px solid ${assignedCluster ? c.border : c.ink}`,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            {assignedCluster ? "Reassign" : "Assign →"}
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
      {anySelected && <div />}
    </div>
  );
}

// ─── Suggestion table row ──────────────────────────────────────────────────────

function SuggestionRow({ suggestion, inputs, onAccept, onDismiss, isLast }) {
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
      display: "grid",
      gridTemplateColumns: "1fr 80px 90px 80px 160px",
      alignItems: "center",
      padding: "10px 12px",
      background: c.white,
      borderBottom: isLast ? "none" : `1px solid ${c.border}`,
      gap: 0,
    }}>
      {/* Name */}
      <div style={{ paddingRight: 8 }}>
        {editingName ? (
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
            style={{
              fontSize: 12, fontWeight: 500, color: c.ink,
              border: "none", outline: `2px solid ${c.borderMid}`,
              borderRadius: 4, padding: "2px 6px",
              background: c.fieldBg, fontFamily: "inherit", width: "100%",
            }}
          />
        ) : (
          <div
            onClick={() => setEditingName(true)}
            style={{ fontSize: 12, fontWeight: 500, color: c.ink, cursor: "text" }}
            title="Click to rename"
          >
            {name}
          </div>
        )}
        <div style={{ fontSize: 10, color: c.hint, marginTop: 2, lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90%" }}>
          {suggestion.explanation}
        </div>
      </div>

      {/* Subtype */}
      <div>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 8,
          background: bg, color: col, border: `1px solid ${brd}`,
        }}>
          {suggestion.suggestedSubtype}
        </span>
      </div>

      {/* Confidence */}
      <div style={{ fontSize: 11, color: c.muted }}>
        <strong style={{ color: c.ink }}>{suggestion.confidence}%</strong>
      </div>

      {/* Inputs */}
      <div style={{ fontSize: 11, color: c.muted }}>
        {sugInputs.length} input{sugInputs.length !== 1 ? "s" : ""}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        <button
          onClick={() => onAccept({ ...suggestion, name })}
          style={{
            fontSize: 10, padding: "4px 10px", borderRadius: 6,
            background: c.ink, color: c.white, border: "none",
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          Accept
        </button>
        <button
          onClick={onDismiss}
          style={{
            fontSize: 10, padding: "4px 10px", borderRadius: 6,
            background: "transparent", color: c.muted,
            border: `1px solid ${c.border}`,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Table container ──────────────────────────────────────────────────────────

function TableContainer({ children }) {
  return (
    <div style={{
      border: `1px solid ${c.border}`,
      borderRadius: 9,
      overflow: "hidden",
    }}>
      {children}
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

  const [newClusterDrawerOpen,  setNewClusterDrawerOpen]  = useState(false);
  const [inputDrawerOpen,       setInputDrawerOpen]       = useState(false);
  const [selectedInputIds,      setSelectedInputIds]      = useState([]);
  const [assignPickerOpen,      setAssignPickerOpen]      = useState(false);
  const [preselectedForCluster, setPreselectedForCluster] = useState([]);
  const [inputSearch,           setInputSearch]           = useState("");

  // AI suggestions state
  const [suggestions,  setSuggestions]  = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [acceptedIds,  setAcceptedIds]  = useState(new Set());

  const project         = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null;
  const projectInputs   = project ? inputs.filter((i)  => i.project_id  === project.id) : [];
  const projectClusters = project ? clusters.filter((cl) => cl.project_id === project.id) : [];

  const unassignedInputs = useMemo(() =>
    projectInputs.filter((i) => !projectClusters.some((cl) => cl.input_ids?.includes(i.id))),
    [projectInputs, projectClusters]
  );

  const filteredUnassigned = useMemo(() => {
    if (!inputSearch.trim()) return unassignedInputs;
    const q = inputSearch.toLowerCase();
    return unassignedInputs.filter((i) =>
      i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q)
    );
  }, [unassignedInputs, inputSearch]);

  useEffect(() => {
    setSuggestions(generateSuggestions(projectInputs));
    setDismissedIds(new Set());
    setAcceptedIds(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.has(s.id) && !acceptedIds.has(s.id)
  );

  const getInputCluster = (inputId) =>
    projectClusters.find((cl) => cl.input_ids?.includes(inputId)) || null;

  const handleAssignInput = (inputId, cluster) => {
    assignInputToCluster(inputId, cluster.id);
    showToast(`Input assigned to "${cluster.name}"`);
  };

  const handleBulkAssign = (cluster) => {
    selectedInputIds.forEach((id) => assignInputToCluster(id, cluster.id));
    const n = selectedInputIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} assigned to "${cluster.name}"`);
    setSelectedInputIds([]);
    setAssignPickerOpen(false);
  };

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

  const anySelected = selectedInputIds.length > 0;

  // ── No active project ──────────────────────────────────────────────
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

  // ── Canvas ─────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ padding: "24px 32px", background: c.bg, minHeight: "100%", overflowY: "auto" }}>

        {/* ── Page header ──────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
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

        <div style={{ fontSize: 11, color: c.muted, marginBottom: 32 }}>
          {projectInputs.length} inputs · {projectClusters.length} clusters
        </div>

        {/* ── Section 1: Clusters ───────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <SectionHeader
            title="Clusters"
            count={projectClusters.length || null}
            action={
              <button onClick={() => setNewClusterDrawerOpen(true)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, cursor: "pointer", fontFamily: "inherit" }}>
                + New cluster
              </button>
            }
          />

          {projectClusters.length === 0 ? (
            <EmptyState
              icon="◈"
              title="No clusters yet"
              body={
                projectInputs.length < 3
                  ? `Add at least 3 inputs before clustering. You have ${projectInputs.length} so far.`
                  : "Build your first cluster manually or accept an AI suggestion below."
              }
              ctaLabel="Build a cluster"
              onCta={() => setNewClusterDrawerOpen(true)}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
        </div>

        {/* ── Section 2: Unassigned inputs ─────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <SectionHeader
            title="Unassigned inputs"
            count={unassignedInputs.length || null}
            action={
              <button onClick={() => setInputDrawerOpen(true)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, cursor: "pointer", fontFamily: "inherit" }}>
                + Add an input
              </button>
            }
          />

          {/* Bulk action bar */}
          {anySelected && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 14px", marginBottom: 10,
              background: c.white, border: `1px solid ${c.borderMid}`,
              borderRadius: 9, boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
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
                Clear
              </button>
            </div>
          )}

          {/* Search bar */}
          {unassignedInputs.length > 0 && (
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                placeholder="Search unassigned inputs…"
                style={{
                  width: "100%", padding: "7px 30px 7px 11px",
                  border: `1px solid ${c.borderMid}`, borderRadius: 8,
                  background: c.white, color: c.ink, fontSize: 12,
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
              {inputSearch && (
                <button
                  onClick={() => setInputSearch("")}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 14, color: c.hint, padding: 0, lineHeight: 1,
                  }}
                >×</button>
              )}
            </div>
          )}

          {unassignedInputs.length === 0 ? (
            projectInputs.length === 0 ? (
              <EmptyState
                icon="◎"
                title="No inputs in this project"
                body="Create a new input directly, or head to the Inbox to pull in existing signals."
                ctaLabel="Add an input"
                onCta={() => setInputDrawerOpen(true)}
              />
            ) : (
              <div style={{
                padding: "20px 24px", textAlign: "center",
                background: c.white, border: `1px solid ${c.border}`,
                borderRadius: 9,
              }}>
                <div style={{ fontSize: 13, color: c.muted, marginBottom: 4 }}>All inputs have been assigned to clusters.</div>
                <div style={{ fontSize: 11, color: c.hint }}>Well done — {projectInputs.length} input{projectInputs.length !== 1 ? "s" : ""} clustered.</div>
              </div>
            )
          ) : filteredUnassigned.length === 0 ? (
            <div style={{
              padding: "20px 24px", textAlign: "center",
              background: c.white, border: `1px solid ${c.border}`,
              borderRadius: 9,
            }}>
              <div style={{ fontSize: 13, color: c.muted, marginBottom: 6 }}>No inputs match your search.</div>
              <button
                onClick={() => setInputSearch("")}
                style={{ fontSize: 12, color: c.ink, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
              >
                Clear search
              </button>
            </div>
          ) : (
            <TableContainer>
              <TableHead cols={[
                { label: "", width: "28px" },
                { label: "Title", width: "1fr" },
                { label: "Strength", width: "80px" },
                { label: "Horizon", width: "60px" },
                { label: "STEEPLED", width: "160px" },
                { label: "Cluster", width: "60px" },
                { label: "", width: "120px" },
              ]} />
              {filteredUnassigned.map((inp, idx) => (
                <InputTableRow
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
                  isLast={idx === filteredUnassigned.length - 1}
                />
              ))}
            </TableContainer>
          )}
        </div>

        {/* ── Section 3: AI suggestions ─────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader
            title="AI suggestions"
            count={visibleSuggestions.length || null}
          />

          {projectInputs.length < 2 ? (
            <div style={{
              padding: "16px 18px", background: c.white,
              border: `1px solid ${c.border}`, borderRadius: 9,
              fontSize: 12, color: c.hint,
            }}>
              Add at least 2 inputs to generate cluster suggestions.
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <div style={{
              padding: "16px 18px", background: c.white,
              border: `1px solid ${c.border}`, borderRadius: 9,
              fontSize: 12, color: c.hint,
            }}>
              All suggestions accepted or dismissed. Add more inputs to generate new ones.
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 11, color: c.muted, lineHeight: 1.55, marginBottom: 10,
              }}>
                Groupings generated by analysing STEEPLED dimensions. Accept to create a cluster, click name to rename, or dismiss to ignore.
              </div>
              <TableContainer>
                <TableHead cols={[
                  { label: "Suggestion", width: "1fr" },
                  { label: "Type", width: "80px" },
                  { label: "Confidence", width: "90px" },
                  { label: "Inputs", width: "80px" },
                  { label: "", width: "160px" },
                ]} />
                {visibleSuggestions.map((sug, idx) => (
                  <SuggestionRow
                    key={sug.id}
                    suggestion={sug}
                    inputs={projectInputs}
                    onAccept={handleAcceptSuggestion}
                    onDismiss={() => setDismissedIds((prev) => new Set([...prev, sug.id]))}
                    isLast={idx === visibleSuggestions.length - 1}
                  />
                ))}
              </TableContainer>
            </>
          )}
        </div>

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

/**
 * SystemAnalysisCanvas — Full-screen three-column canvas for System Analysis.
 * Single record per project (not per scenario). Panels: Key Dynamics (left, full height),
 * Description + Critical Uncertainties (centre), Implications + Confidence (right).
 * @param {{ appState: object }} props
 */
import { useState, useEffect, useMemo } from "react";
import { c, btnSec, fontHeading } from "../../styles/tokens.js";
import { ProjectPicker } from "../shared/ProjectPicker.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";
import { RichTextField } from "../shared/RichTextField.jsx";
import { textToDoc, docToText, docIsEmpty } from "../../lib/richtextDoc.js";
import { serializeRichText } from "../shared/richtext/serialize.js";

// ─── Panel definitions ─────────────────────────────────────────────────────────

const PANELS = [
  {
    id: "key_dynamics",
    area: "dynamics",
    label: "Key Dynamics",
    prompt: "What are the most significant patterns, feedback loops, and interactions in this system?",
    placeholder: "The most significant pattern is a reinforcing loop between...",
    type: "text",
  },
  {
    id: "description",
    area: "description",
    label: "Description",
    prompt: "Summarise what this system is and what it is trying to explain.",
    placeholder: "This system maps the dynamics of...",
    type: "text",
  },
  {
    id: "critical_uncertainties",
    area: "uncertainties",
    label: "Critical Uncertainties",
    prompt: "What does this system not resolve? Where could it tip in fundamentally different directions?",
    type: "chips",
  },
  {
    id: "implications",
    area: "implications",
    label: "Implications",
    prompt: "What does this system analysis mean for the people and organisations involved?",
    placeholder: "The primary implication for...",
    type: "text",
  },
  {
    id: "confidence",
    area: "confidence",
    label: "Confidence",
    prompt: "How well does this system map account for the dynamics at play?",
    type: "confidence",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDefault(panel) {
  if (panel.type === "chips")      return [];
  if (panel.type === "confidence") return null;
  return null; // text panels hold a rich-text JSON doc (null when empty)
}

/**
 * Returns true if the given panel value contains practitioner-entered content.
 * Text panels now carry a rich-text JSON doc in the canvas, but this is also
 * called from ProjectOverview with the saved legacy text column (a string) —
 * so tolerate both shapes.
 */
export function analysisHasCont(panelType, value) {
  if (panelType === "text") {
    if (value && typeof value === "object") return !docIsEmpty(value); // rich-text doc
    return (value || "").trim().length > 0;                            // legacy string
  }
  if (panelType === "chips") return (value || []).length > 0;
  return value !== null && value !== undefined;
}

// ─── Chips sub-panel ───────────────────────────────────────────────────────────

function ChipsPanel({ value = [], onChange, onFocus }) {
  const [draft, setDraft] = useState("");

  const addItem = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };

  return (
    <div style={{ flex: 1, padding: "6px 9px 8px", display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {value.map((item) => (
            <span key={item} style={{
              // flex-start so the × pins to the top-right corner instead of the
              // vertical middle when a long entry wraps onto multiple lines.
              display: "inline-flex", alignItems: "flex-start", gap: 4,
              fontSize: 10, padding: "3px 8px",
              // pill radius reads oddly on a tall multi-line block — keep it modest
              borderRadius: 8, maxWidth: "100%",
              background: c.surfaceAlt, border: `0.5px solid ${c.borderMid}`, color: c.ink,
            }}>
              <span style={{ minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.45 }}>{item}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onChange(value.filter((v) => v !== item)); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: c.hint, fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0, marginTop: 1 }}
              >×</button>
            </span>
          ))}
        </div>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={onFocus}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
        placeholder="+ Add uncertainty"
        style={{
          border: "none", borderBottom: `0.5px solid ${c.border}`, background: "transparent",
          fontSize: 11, color: c.ink, fontFamily: "inherit", outline: "none",
          padding: "2px 0", width: "100%",
        }}
      />
    </div>
  );
}

// ─── Confidence sub-panel ──────────────────────────────────────────────────────

function ConfidencePanel({ value, onChange, prompt }) {
  return (
    <div style={{ flex: 1, padding: "8px 9px 10px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 13, color: c.muted, fontStyle: "italic", lineHeight: 1.55, marginBottom: 10 }}>
        {prompt}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {["Low", "Medium", "High"].map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={(e) => { e.stopPropagation(); onChange(active ? null : opt); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 6,
                border: `1px solid ${active ? c.ink : c.border}`,
                background: active ? "rgba(0,0,0,0.04)" : c.white,
                color: active ? c.ink : c.muted,
                fontSize: 11, fontWeight: active ? 500 : 400,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {opt}{active ? " ✓" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Analysis panel ────────────────────────────────────────────────────────────

function AnalysisPanel({ panel, value, onChange, selected, onSelect }) {
  const isFocused = selected === panel.id;

  const hasCont = analysisHasCont(panel.type, value);

  // Prompt: shown in header area for text/chips when focused or empty; confidence renders it inline
  const showPrompt = panel.type !== "confidence" && (isFocused || !hasCont);

  return (
    <div
      onClick={() => onSelect(panel.id)}
      style={{
        gridArea: panel.area,
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
      }}
    >
      {/* Panel header */}
      <div style={{
        padding: "6px 9px 5px",
        borderBottom: `0.5px solid ${c.border}`,
        background: isFocused ? c.ink : c.surfaceAlt,
        display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
        transition: "background .15s",
      }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: isFocused ? c.white : c.ink }}>{panel.label}</span>
      </div>

      {/* Prompt — visible when focused or empty (text/chips only) */}
      {showPrompt && (
        <div style={{ padding: "5px 9px 0", flexShrink: 0, fontSize: 13, color: c.muted, fontStyle: "italic", lineHeight: 1.55 }}>
          {panel.prompt}
        </div>
      )}

      {/* Content */}
      {panel.type === "text" && (
        <div
          onFocusCapture={() => onSelect(panel.id)}
          style={{ flex: 1, boxSizing: "border-box", padding: "5px 9px 7px", overflowY: "auto", cursor: "text" }}
        >
          <RichTextField
            variant="compact"
            value={value}
            onChange={onChange}
            placeholder={panel.placeholder}
          />
        </div>
      )}
      {panel.type === "chips" && (
        <ChipsPanel
          value={value}
          onChange={onChange}
          onFocus={() => onSelect(panel.id)}
        />
      )}
      {panel.type === "confidence" && (
        <ConfidencePanel value={value} onChange={onChange} prompt={panel.prompt} />
      )}
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function SystemAnalysisCanvas({ appState }) {
  const {
    activeProjectId, setActiveProjectId, projects, inputs, clusters, scenarios,
    openProjectModal, analyses, upsertAnalysis, deleteAnalysis, showToast,
  } = appState;

  const [selected,       setSelected]       = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [localFields,    setLocalFields]    = useState({});

  const project  = projects.find((p) => p.id === activeProjectId) || null;
  const analysis = (analyses || []).find((a) => a.project_id === activeProjectId) || null;

  // The saved value for a panel, in the shape the canvas edits it. Text panels
  // are rich-text docs: prefer the stored _doc, else wrap the legacy text column.
  const savedPanelValue = (panel) => {
    if (!analysis) return getDefault(panel);
    if (panel.type === "text") {
      return analysis[`${panel.id}_doc`] ?? textToDoc(analysis[panel.id] || "");
    }
    return analysis[panel.id] ?? getDefault(panel);
  };

  // Sync local fields from the saved analysis whenever the project or loaded record changes
  useEffect(() => {
    const init = {};
    for (const panel of PANELS) init[panel.id] = savedPanelValue(panel);
    // Intentional: reset the editable local copy when the loaded record changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalFields(init);
  }, [activeProjectId, analysis?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(() => {
    for (const panel of PANELS) {
      const local = localFields[panel.id] ?? getDefault(panel);
      const saved = savedPanelValue(panel);
      if (JSON.stringify(local) !== JSON.stringify(saved)) return true;
    }
    return false;
  }, [localFields, analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  const getValue = (panelId) => localFields[panelId] ?? getDefault(PANELS.find((p) => p.id === panelId));

  const setValue = (panelId) => (val) => {
    setLocalFields((prev) => ({ ...prev, [panelId]: val }));
  };

  const handleSave = async () => {
    // Build the DB payload. Text panels dual-write: the JSON doc is the source
    // of truth (normalized to the allowed schema); the legacy text column holds
    // a plain flattening for fallback/rollback. Chips/confidence are unchanged.
    const dbFields = {};
    for (const panel of PANELS) {
      const val = localFields[panel.id] ?? getDefault(panel);
      if (panel.type === "text") {
        const norm = await serializeRichText(val);
        dbFields[`${panel.id}_doc`] = norm;
        dbFields[panel.id] = norm ? docToText(norm) : null;
      } else {
        dbFields[panel.id] = val;
      }
    }
    upsertAnalysis(activeProjectId, dbFields);
    showToast("Analysis saved");
  };

  // ── No active project ────────────────────────────────────────────────────────
  if (!project) {
    return (
      <ProjectPicker
        heading="Select a project to work in"
        description="System Analysis synthesises your system map into key dynamics, uncertainties, and implications."
        projects={projects}
        inputs={inputs}
        clusters={clusters}
        scenarios={scenarios}
        onSelect={(id) => setActiveProjectId(id)}
        onNewProject={openProjectModal}
      />
    );
  }

  // ── Canvas ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: c.bg }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{
        padding: "8px 16px",
        borderBottom: `0.5px solid ${c.border}`,
        background: c.bg,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 2 }}>{project.name}</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, fontFamily: fontHeading }}>System Analysis</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Delete analysis */}
        {analysis && (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ fontSize: 11, padding: "5px 11px", borderRadius: 6, border: `1px solid ${c.redBorder}`, background: "transparent", color: c.red800, cursor: "pointer", fontFamily: "inherit" }}
          >
            Delete
          </button>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!isDirty}
          style={{
            padding: "5px 13px", borderRadius: 6,
            background: isDirty ? c.ink : "transparent",
            border: `1px solid ${isDirty ? c.ink : c.border}`,
            color: isDirty ? c.white : c.hint,
            fontSize: 11, fontWeight: 500,
            cursor: isDirty ? "pointer" : "default",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
        >
          Save
        </button>

        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this System Analysis?"
          message={`This will permanently delete the System Analysis for "${project.name}". This cannot be undone.`}
          onConfirm={() => { deleteAnalysis(activeProjectId); showToast("System Analysis deleted"); setConfirmDelete(false); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {/* ── Spatial grid ─────────────────────────────────────────────────── */}
      <div
        onClick={() => setSelected(null)}
        style={{
          flex: 1,
          padding: 10,
          display: "grid",
          gridTemplateAreas: `"dynamics description implications" "dynamics uncertainties confidence"`,
          gridTemplateColumns: "1fr 1.5fr 1fr",
          gridTemplateRows: "1fr 190px",
          gap: 7,
          overflow: "hidden",
        }}
      >
        {PANELS.map((panel) => (
          <AnalysisPanel
            key={panel.id}
            panel={panel}
            value={getValue(panel.id)}
            onChange={setValue(panel.id)}
            selected={selected}
            onSelect={setSelected}
          />
        ))}
      </div>
    </div>
  );
}

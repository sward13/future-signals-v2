/**
 * ScenarioForm — create and edit view for a scenario.
 * mode='new'  → creates a new scenario under the active project
 * mode='edit' → edits appState.activeScenarioId
 */
import { useState } from "react";
import { c, ta, sel, btnP, btnG, fl, fh } from "../../styles/tokens.js";

// ─── Zone divider ────────────────────────────────────────────────────────────

function ZoneDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 24px" }}>
      <div style={{ flex: 1, height: 1, background: c.border }} />
      <span style={{
        fontSize: 10, fontWeight: 500, color: c.hint,
        letterSpacing: "0.08em", textTransform: "uppercase",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: c.border }} />
    </div>
  );
}

// ─── Chip multi-select ───────────────────────────────────────────────────────

function ChipMultiSelect({ label, hint, clusters, selected, onChange }) {
  const selectedSet = new Set(selected);
  const toggle = (id) => {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={fl}>{label}</div>
      {hint && <div style={fh}>{hint}</div>}
      <div style={{
        border: `1px solid ${c.borderMid}`, borderRadius: 8,
        background: c.white, overflow: "hidden",
      }}>
        {/* Selected chips */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 5,
          padding: "8px 10px", minHeight: 40,
        }}>
          {selected.length === 0 && (
            <span style={{ fontSize: 12, color: c.hint, lineHeight: "24px" }}>None selected</span>
          )}
          {selected.map((id) => {
            const cl = clusters.find((c) => c.id === id);
            return (
              <span key={id} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, background: c.surfaceAlt, color: c.ink,
                border: `1px solid ${c.border}`, borderRadius: 5, padding: "3px 8px",
              }}>
                {cl?.name || id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: c.hint, fontSize: 13, lineHeight: 1, padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        {/* Available options */}
        {clusters.length > 0 && (
          <div style={{ borderTop: `1px solid ${c.border}`, background: c.fieldBg }}>
            {clusters.map((cl) => (
              <div
                key={cl.id}
                onClick={() => toggle(cl.id)}
                style={{
                  padding: "7px 12px", fontSize: 11,
                  color: selectedSet.has(cl.id) ? c.ink : c.muted,
                  fontWeight: selectedSet.has(cl.id) ? 500 : 400,
                  background: selectedSet.has(cl.id) ? "#f0eafa" : "transparent",
                  borderBottom: `1px solid ${c.border}`,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span>{cl.name}</span>
                {selectedSet.has(cl.id) && (
                  <span style={{ fontSize: 10, color: c.hint }}>✓</span>
                )}
              </div>
            ))}
          </div>
        )}
        {clusters.length === 0 && (
          <div style={{ padding: "10px 12px", fontSize: 11, color: c.hint, borderTop: `1px solid ${c.border}`, background: c.fieldBg }}>
            No clusters in this project yet
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Key differences list ─────────────────────────────────────────────────────

function KeyDiffsList({ diffs, onChange }) {
  const update = (i, val) => {
    const next = [...diffs];
    next[i] = val;
    onChange(next);
  };
  const remove = (i) => onChange(diffs.filter((_, idx) => idx !== i));
  const add = () => onChange([...diffs, ""]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={fl}>Key differences from today</div>
      <div style={fh}>Each item should be a concrete, present-tense statement about how this world differs.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {diffs.map((diff, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: c.hint, minWidth: 16, textAlign: "right" }}>
              {i + 1}
            </span>
            <input
              style={{
                flex: 1, padding: "8px 10px",
                border: `1px solid ${c.borderMid}`, borderRadius: 7,
                background: c.white, color: c.ink, fontSize: 13,
                fontFamily: "inherit", outline: "none",
              }}
              value={diff}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`Difference ${i + 1}…`}
            />
            {diffs.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: c.hint, fontSize: 16, lineHeight: 1, padding: "0 4px",
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        style={{
          marginTop: 8, background: "none",
          border: `1px dashed ${c.border}`, borderRadius: 7,
          padding: "6px 14px", fontSize: 11, color: c.hint,
          cursor: "pointer", fontFamily: "inherit", width: "100%",
        }}
      >
        + Add another
      </button>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

const HORIZONS = ["H1", "H2", "H3"];
const ARCHETYPES = ["Continuation", "Collapse", "Constraint", "Transformation"];

export default function ScenarioForm({ appState, mode }) {
  const {
    scenarios, clusters, activeProjectId, activeScenarioId,
    addScenario, updateScenario,
    setActiveScreen, openScenario, showToast,
  } = appState;

  const scenario = mode === "edit"
    ? scenarios.find((s) => s.id === activeScenarioId)
    : null;

  const projectClusters = clusters.filter((cl) => cl.project_id === activeProjectId);

  const [name,            setName]            = useState(scenario?.name            || "");
  const [horizon,         setHorizon]         = useState(scenario?.horizon         || "");
  const [archetype,       setArchetype]       = useState(scenario?.archetype       || "");
  const [drivingForces,   setDrivingForces]   = useState(
    Array.isArray(scenario?.driving_forces) ? scenario.driving_forces : []
  );
  const [suppressedForces,setSuppressedForces]= useState(
    Array.isArray(scenario?.suppressed_forces) ? scenario.suppressed_forces : []
  );
  const [description,     setDescription]     = useState(scenario?.description     || "");
  const [keyDiffs,        setKeyDiffs]        = useState(
    Array.isArray(scenario?.key_differences) && scenario.key_differences.length > 0
      ? scenario.key_differences
      : ["", "", ""]
  );
  const [narrative,       setNarrative]       = useState(scenario?.narrative       || "");
  const [saving,          setSaving]          = useState(false);

  const goBack = () => setActiveScreen("future-models");

  const handleSave = async () => {
    if (!name.trim()) { showToast("Scenario name is required", "error"); return; }
    setSaving(true);
    try {
      const fields = {
        name: name.trim(),
        horizon:          horizon || null,
        archetype:        archetype || null,
        description:      description.trim() || null,
        narrative:        narrative.trim() || null,
        key_differences:  keyDiffs.map((d) => d.trim()).filter(Boolean),
        driving_forces:   drivingForces,
        suppressed_forces:suppressedForces,
      };

      if (mode === "new") {
        const created = addScenario({ ...fields, project_id: activeProjectId });
        showToast("Scenario created");
        openScenario(created.id);
      } else {
        updateScenario(activeScenarioId, fields);
        showToast("Scenario updated");
        openScenario(activeScenarioId);
      }
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {
    ...sel,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 30,
    cursor: "pointer",
  };

  return (
    <div style={{ background: c.bg, minHeight: "100%" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px",
        background: c.white, borderBottom: `1px solid ${c.border}`,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={goBack} style={{ ...btnG, fontSize: 12, padding: "5px 0", color: c.muted }}>
          ← Future Models
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={goBack} style={{ ...btnG, fontSize: 12 }}>Discard</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...btnP, fontSize: 12, padding: "7px 20px", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Form body */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 80px" }}>

        {/* Eyebrow */}
        <div style={{
          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
          color: c.hint, marginBottom: 12,
        }}>
          {mode === "new" ? "New scenario" : "Edit scenario"}
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this scenario"
          autoFocus
          style={{
            width: "100%", fontSize: 24, fontWeight: 500, color: c.ink,
            border: "none", background: "transparent", outline: "none",
            fontFamily: "inherit", padding: "0 0 16px", borderBottom: `1px solid ${c.border}`,
            marginBottom: 24, boxSizing: "border-box",
          }}
        />

        {/* Zone 1: Frame */}
        <ZoneDivider label="Frame" />

        {/* Horizon + Archetype row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={fl}>Time horizon</div>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              style={selectStyle}
            >
              <option value="">— Select horizon</option>
              {HORIZONS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div style={fl}>Archetype <span style={{ color: c.hint, fontWeight: 400 }}>(optional)</span></div>
            <select
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              style={selectStyle}
            >
              <option value="">— Select archetype</option>
              {ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Driving forces */}
        <ChipMultiSelect
          label="Driving forces"
          hint="Which clusters are active and influential in this scenario?"
          clusters={projectClusters}
          selected={drivingForces}
          onChange={setDrivingForces}
        />

        {/* Suppressed forces */}
        <ChipMultiSelect
          label="Suppressed forces"
          hint="Which clusters are weakened, absent, or reversed in this scenario?"
          clusters={projectClusters}
          selected={suppressedForces}
          onChange={setSuppressedForces}
        />

        {/* Zone 2: Story */}
        <ZoneDivider label="Story" />

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Description</div>
          <div style={fh}>A brief summary — what is this scenario and what makes it distinct?</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={ta}
            placeholder="Describe this scenario in 1–2 sentences…"
          />
        </div>

        {/* Key differences */}
        <KeyDiffsList diffs={keyDiffs} onChange={setKeyDiffs} />

        {/* Narrative */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>
            Narrative <span style={{ color: c.hint, fontWeight: 400, fontSize: 11 }}>(optional)</span>
          </div>
          <div style={fh}>How does this world come to be? Write as much or as little as is useful.</div>
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={5}
            style={ta}
            placeholder="Write a narrative description of this scenario…"
          />
        </div>

      </div>
    </div>
  );
}

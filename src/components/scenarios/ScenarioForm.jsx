/**
 * ScenarioForm — create and edit view for a scenario.
 * mode='new'  → creates a new scenario under the active project
 * mode='edit' → edits appState.activeScenarioId
 */
import { useState } from "react";
import { c, sel, btnP, btnG, fl, fh, legend } from "../../styles/tokens.js";
import { RichTextField } from "../shared/RichTextField.jsx";
import { ClusterForcePicker } from "../shared/ClusterForcePicker.jsx";
import { textToDoc, docToText } from "../../lib/richtextDoc.js";
import { serializeRichText } from "../shared/richtext/serialize.js";

// ─── Zone divider ────────────────────────────────────────────────────────────

function ZoneDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 24px" }}>
      <div style={{ flex: 1, height: 1, background: c.border }} />
      <span style={{
        fontSize: 11, fontWeight: 500, color: c.hint,
        letterSpacing: "0.02em",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: c.border }} />
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
                border: `1px solid ${c.borderStrong}`, borderRadius: 7,
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
  const [descriptionDoc,  setDescriptionDoc]  = useState(scenario?.description_doc ?? textToDoc(scenario?.description || ""));
  const [keyDiffs,        setKeyDiffs]        = useState(
    Array.isArray(scenario?.key_differences) && scenario.key_differences.length > 0
      ? scenario.key_differences
      : ["", "", ""]
  );
  // Narrative is the rich-text PoC field: hold a Tiptap JSON doc. Seed from the
  // stored doc, or wrap the legacy plain-text value on first edit.
  const [narrativeDoc,    setNarrativeDoc]    = useState(
    scenario?.narrative_doc ?? textToDoc(scenario?.narrative || "")
  );
  const [saving,          setSaving]          = useState(false);

  const goBack = () => setActiveScreen("future-models");

  const handleSave = async () => {
    if (!name.trim()) { showToast("Scenario name is required", "error"); return; }
    setSaving(true);
    try {
      const narrativeNorm = await serializeRichText(narrativeDoc);
      const descNorm = await serializeRichText(descriptionDoc);
      const fields = {
        name: name.trim(),
        horizon:          horizon || null,
        archetype:        archetype || null,
        description:      descNorm ? docToText(descNorm) : null,
        description_doc:  descNorm,
        // Normalize to the allowed schema before persisting (strips anything a
        // hand-crafted/tampered doc might carry). Dual-write: the JSON doc is
        // the source of truth; the legacy `narrative` text column holds a plain
        // flattening for export/rollback/fallback.
        narrative_doc:    narrativeNorm,
        narrative:        narrativeNorm ? docToText(narrativeNorm) : null,
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
          fontSize: 11, letterSpacing: "0.02em",
          color: c.hint, marginBottom: 12,
        }}>
          {mode === "new" ? "New scenario" : "Edit scenario"}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 24 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this scenario"
            autoFocus
            style={{
              width: "100%", fontSize: 24, fontWeight: 500, color: c.ink,
              border: "none", background: "transparent", outline: "none",
              fontFamily: "inherit", padding: "0 0 16px", borderBottom: `1px solid ${c.border}`,
              boxSizing: "border-box",
            }}
          />
          <div style={legend}>* required</div>
        </div>

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
            <div style={fl}>Archetype</div>
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

        {/* Driving forces / Suppressed forces — side by side with a hairline
            divider, stacking to one column below ~700px. The Horizon/Archetype
            grid above has no responsive behavior to mirror (it's a bare
            gridTemplateColumns: "1fr 1fr" with no breakpoint), so this is new
            behavior, not a copy of an existing one — a plain inline `style`
            can't express a media query, hence the scoped <style> block below
            rather than a third-party layout dependency. */}
        <style>{`
          .scenario-forces-row {
            display: grid;
            grid-template-columns: 1fr 1px 1fr;
            gap: 16px;
          }
          .scenario-forces-divider { background: ${c.border}; }
          @media (max-width: 700px) {
            .scenario-forces-row { grid-template-columns: 1fr; gap: 20px; }
            .scenario-forces-divider { display: none; }
          }
        `}</style>
        <div className="scenario-forces-row">
          <div>
            <ClusterForcePicker
              role="driving"
              label="Driving forces"
              hint="Which clusters are active and influential in this scenario?"
              clusters={projectClusters}
              selected={drivingForces}
              otherSelected={suppressedForces}
              onChange={setDrivingForces}
              onGoToClusters={() => setActiveScreen("cluster")}
            />
          </div>
          <div className="scenario-forces-divider" />
          <div>
            <ClusterForcePicker
              role="suppressed"
              label="Suppressed forces"
              hint="Which clusters are weakened, absent, or reversed in this scenario?"
              clusters={projectClusters}
              selected={suppressedForces}
              otherSelected={drivingForces}
              onChange={setSuppressedForces}
              onGoToClusters={() => setActiveScreen("cluster")}
            />
          </div>
        </div>

        {/* Zone 2: Story */}
        <ZoneDivider label="Story" />

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Description</div>
          <div style={fh}>A brief summary — what is this scenario and what makes it distinct?</div>
          <RichTextField
            value={descriptionDoc}
            onChange={setDescriptionDoc}
            placeholder="Describe this scenario in 1–2 sentences…"
          />
        </div>

        {/* Key differences */}
        <KeyDiffsList diffs={keyDiffs} onChange={setKeyDiffs} />

        {/* Narrative — rich-text proof-of-concept field */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Narrative</div>
          <div style={fh}>How does this world come to be? Write as much or as little as is useful.</div>
          <RichTextField
            value={narrativeDoc}
            onChange={setNarrativeDoc}
            placeholder="Write a narrative description of this scenario…"
            minHeight={120}
          />
        </div>

      </div>
    </div>
  );
}

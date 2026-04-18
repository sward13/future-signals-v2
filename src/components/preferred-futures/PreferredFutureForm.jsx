/**
 * PreferredFutureForm — create and edit view for a preferred future.
 * mode='new'  → creates a new preferred future under the active project
 * mode='edit' → edits appState.activePFId
 *
 * guiding_principles, strategic_priorities, indicators are stored as jsonb
 * string arrays but presented as plain textareas (newline-separated).
 */
import { useState } from "react";
import { c, ta, sel, btnP, btnG, fl, fh } from "../../styles/tokens.js";

// ─── Zone divider ─────────────────────────────────────────────────────────────

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

// ─── Scenario multi-select ────────────────────────────────────────────────────

function ScenarioMultiSelect({ scenarios, selected, onChange }) {
  const selectedSet = new Set(selected);
  const toggle = (id) => {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={fl}>Informed by scenarios</div>
      <div style={fh}>Which scenarios does this preferred future draw from?</div>
      <div style={{
        border: `1px solid ${c.borderMid}`, borderRadius: 8,
        background: c.white, overflow: "hidden",
      }}>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 5,
          padding: "8px 10px", minHeight: 40,
        }}>
          {selected.length === 0 && (
            <span style={{ fontSize: 12, color: c.hint, lineHeight: "24px" }}>None selected</span>
          )}
          {selected.map((id) => {
            const s = scenarios.find((sc) => sc.id === id);
            return (
              <span key={id} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, background: c.surfaceAlt, color: c.ink,
                border: `1px solid ${c.border}`, borderRadius: 5, padding: "3px 8px",
              }}>
                {s?.name || id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: c.hint, fontSize: 13, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        {scenarios.length > 0 ? (
          <div style={{ borderTop: `1px solid ${c.border}`, background: c.fieldBg }}>
            {scenarios.map((sc) => (
              <div
                key={sc.id}
                onClick={() => toggle(sc.id)}
                style={{
                  padding: "7px 12px", fontSize: 11,
                  color: selectedSet.has(sc.id) ? c.ink : c.muted,
                  fontWeight: selectedSet.has(sc.id) ? 500 : 400,
                  background: selectedSet.has(sc.id) ? c.green50 : "transparent",
                  borderBottom: `1px solid ${c.border}`,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span>{sc.name}</span>
                {selectedSet.has(sc.id) && <span style={{ fontSize: 10, color: c.hint }}>✓</span>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "10px 12px", fontSize: 11, color: c.hint, borderTop: `1px solid ${c.border}`, background: c.fieldBg }}>
            No scenarios in this project yet
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const arrToText = (arr) => (Array.isArray(arr) ? arr.join("\n") : "");
const textToArr = (text) => text.split("\n").map((s) => s.trim()).filter(Boolean);

const HORIZONS = ["H1", "H2", "H3"];

const selectStyle = {
  ...sel,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 30,
  cursor: "pointer",
};

// ─── Main form ────────────────────────────────────────────────────────────────

export default function PreferredFutureForm({ appState, mode }) {
  const {
    preferredFutures, scenarios, activeProjectId, activePFId,
    addPreferredFuture, updatePreferredFuture,
    setActiveScreen, openPreferredFuture, showToast,
  } = appState;

  const pf = mode === "edit"
    ? preferredFutures.find((p) => p.id === activePFId)
    : null;

  const projectScenarios = scenarios.filter((s) => s.project_id === activeProjectId);

  const [name,               setName]               = useState(pf?.name               || "");
  const [description,        setDescription]        = useState(pf?.description        || "");
  const [desiredOutcomes,    setDesiredOutcomes]    = useState(pf?.desired_outcomes   || "");
  const [guidingPrinciples,  setGuidingPrinciples]  = useState(arrToText(pf?.guiding_principles));
  const [strategicPriorities,setStrategicPriorities]= useState(arrToText(pf?.strategic_priorities));
  const [indicators,         setIndicators]         = useState(arrToText(pf?.indicators));
  const [horizon,            setHorizon]            = useState(pf?.horizon            || "");
  const [scenarioIds,        setScenarioIds]        = useState(
    Array.isArray(pf?.scenario_ids) ? pf.scenario_ids : []
  );
  const [saving, setSaving] = useState(false);

  const goBack = () => setActiveScreen("future-models");

  const handleSave = async () => {
    if (!name.trim()) { showToast("Name is required", "error"); return; }
    setSaving(true);
    try {
      const fields = {
        name:                 name.trim(),
        description:          description.trim() || null,
        desired_outcomes:     desiredOutcomes.trim() || null,
        guiding_principles:   textToArr(guidingPrinciples),
        strategic_priorities: textToArr(strategicPriorities),
        indicators:           textToArr(indicators),
        horizon:              horizon || null,
        scenario_ids:         scenarioIds,
      };

      if (mode === "new") {
        const created = addPreferredFuture({ ...fields, project_id: activeProjectId });
        showToast("Preferred future created");
        openPreferredFuture(created.id);
      } else {
        updatePreferredFuture(activePFId, fields);
        showToast("Preferred future updated");
        openPreferredFuture(activePFId);
      }
    } finally {
      setSaving(false);
    }
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
          {mode === "new" ? "New preferred future" : "Edit preferred future"}
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this preferred future"
          autoFocus
          style={{
            width: "100%", fontSize: 24, fontWeight: 500, color: c.ink,
            border: "none", background: "transparent", outline: "none",
            fontFamily: "inherit", padding: "0 0 16px", borderBottom: `1px solid ${c.border}`,
            marginBottom: 24, boxSizing: "border-box",
          }}
        />

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={ta}
            placeholder="A brief summary of this preferred future…"
          />
        </div>

        {/* Desired outcomes */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Desired outcomes</div>
          <div style={fh}>What conditions or results define this future?</div>
          <textarea
            value={desiredOutcomes}
            onChange={(e) => setDesiredOutcomes(e.target.value)}
            rows={3}
            style={ta}
            placeholder="Describe the outcomes that would define this future as achieved…"
          />
        </div>

        {/* Zone — Values and direction */}
        <ZoneDivider label="Values and direction" />

        {/* Guiding principles */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Guiding principles</div>
          <div style={fh}>What values shape this future? Commitments that hold even when difficult. One per line.</div>
          <textarea
            value={guidingPrinciples}
            onChange={(e) => setGuidingPrinciples(e.target.value)}
            rows={3}
            style={ta}
            placeholder={"Equity is non-negotiable\nOpen systems over closed platforms\n…"}
          />
        </div>

        {/* Strategic priorities */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Strategic priorities</div>
          <div style={fh}>Broad areas of action. Directions, not plans. One per line.</div>
          <textarea
            value={strategicPriorities}
            onChange={(e) => setStrategicPriorities(e.target.value)}
            rows={3}
            style={ta}
            placeholder={"Invest in workforce reskilling\nBuild adaptive governance structures\n…"}
          />
        </div>

        {/* Indicators */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Indicators of progress</div>
          <div style={fh}>Observable signals that this future is beginning to emerge. One per line.</div>
          <textarea
            value={indicators}
            onChange={(e) => setIndicators(e.target.value)}
            rows={3}
            style={ta}
            placeholder={"Policy frameworks updated to reflect new norms\nNew institutions emerging in this space\n…"}
          />
        </div>

        {/* Zone — Scope and provenance */}
        <ZoneDivider label="Scope and provenance" />

        {/* Horizon + Scenarios row */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Time horizon</div>
          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value)}
            style={{ ...selectStyle, maxWidth: 240 }}
          >
            <option value="">— Select horizon</option>
            {HORIZONS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>

        <ScenarioMultiSelect
          scenarios={projectScenarios}
          selected={scenarioIds}
          onChange={setScenarioIds}
        />

      </div>
    </div>
  );
}

/**
 * StrategicOptionForm — create and edit view for a strategic option.
 * mode='new'  → creates a new option under the active project
 * mode='edit' → edits appState.activeSOId
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
      <div style={fl}>Responds to scenarios</div>
      <div style={fh}>Which scenarios is this option designed to address?</div>
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
                  background: selectedSet.has(sc.id) ? c.amber50 : "transparent",
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

// ─── Constants ────────────────────────────────────────────────────────────────

const HORIZONS     = ["H1", "H2", "H3"];
const FEASIBILITIES = ["High", "Medium", "Low"];

const selectStyle = {
  ...sel,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 30,
  cursor: "pointer",
};

// ─── Main form ────────────────────────────────────────────────────────────────

export default function StrategicOptionForm({ appState, mode }) {
  const {
    strategicOptions, scenarios, activeProjectId, activeSOId,
    addStrategicOption, updateStrategicOption,
    setActiveScreen, openStrategicOption, showToast,
  } = appState;

  const opt = mode === "edit"
    ? strategicOptions.find((o) => o.id === activeSOId)
    : null;

  const projectScenarios = scenarios.filter((s) => s.project_id === activeProjectId);

  const [name,            setName]            = useState(opt?.name             || "");
  const [description,     setDescription]     = useState(opt?.description      || "");
  const [intendedOutcome, setIntendedOutcome] = useState(opt?.intended_outcome || "");
  const [actions,         setActions]         = useState(opt?.actions          || "");
  const [implications,    setImplications]    = useState(opt?.implications     || "");
  const [horizon,         setHorizon]         = useState(opt?.horizon          || "");
  const [feasibility,     setFeasibility]     = useState(opt?.feasibility      || "");
  const [scenarioIds,     setScenarioIds]     = useState(
    Array.isArray(opt?.scenario_ids) ? opt.scenario_ids : []
  );
  const [dependencies,    setDependencies]    = useState(opt?.dependencies     || "");
  const [risks,           setRisks]           = useState(opt?.risks            || "");
  const [saving,          setSaving]          = useState(false);

  const goBack = () => setActiveScreen("future-models");

  const handleSave = async () => {
    if (!name.trim()) { showToast("Name is required", "error"); return; }
    setSaving(true);
    try {
      const fields = {
        name:             name.trim(),
        description:      description.trim()     || null,
        intended_outcome: intendedOutcome.trim()  || null,
        actions:          actions.trim()          || null,
        implications:     implications.trim()     || null,
        horizon:          horizon                 || null,
        feasibility:      feasibility             || null,
        scenario_ids:     scenarioIds,
        dependencies:     dependencies.trim()     || null,
        risks:            risks.trim()            || null,
      };

      if (mode === "new") {
        const created = addStrategicOption({ ...fields, project_id: activeProjectId });
        showToast("Strategic option created");
        openStrategicOption(created.id);
      } else {
        updateStrategicOption(activeSOId, fields);
        showToast("Strategic option updated");
        openStrategicOption(activeSOId);
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
          {mode === "new" ? "New strategic option" : "Edit strategic option"}
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this option"
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
          <div style={fh}>What this option is. Enough to identify it clearly.</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={ta}
            placeholder="A brief description of this option…"
          />
        </div>

        {/* Intended outcome */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Intended outcome</div>
          <div style={fh}>What are you trying to achieve? A direction to orient around.</div>
          <textarea
            value={intendedOutcome}
            onChange={(e) => setIntendedOutcome(e.target.value)}
            rows={3}
            style={ta}
            placeholder="Describe the outcome this option is aimed at…"
          />
        </div>

        {/* Zone — Detail */}
        <ZoneDivider label="Detail" />

        {/* What this involves */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>What this involves</div>
          <div style={fh}>What would this option entail? Orientation, not a project plan.</div>
          <textarea
            value={actions}
            onChange={(e) => setActions(e.target.value)}
            rows={4}
            style={ta}
            placeholder="Describe what pursuing this option would look like…"
          />
        </div>

        {/* Implications */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Implications</div>
          <div style={fh}>What does choosing this foreclose or make harder?</div>
          <textarea
            value={implications}
            onChange={(e) => setImplications(e.target.value)}
            rows={3}
            style={ta}
            placeholder="What trade-offs or opportunity costs does this carry?…"
          />
        </div>

        {/* Zone — Conditions and scope */}
        <ZoneDivider label="Conditions and scope" />

        {/* Horizon + Feasibility row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={fl}>Time horizon</div>
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)} style={selectStyle}>
              <option value="">— Select horizon</option>
              {HORIZONS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div style={fl}>Feasibility <span style={{ color: c.hint, fontWeight: 400 }}>(optional)</span></div>
            <select value={feasibility} onChange={(e) => setFeasibility(e.target.value)} style={selectStyle}>
              <option value="">— Select feasibility</option>
              {FEASIBILITIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Responds to scenarios */}
        <ScenarioMultiSelect
          scenarios={projectScenarios}
          selected={scenarioIds}
          onChange={setScenarioIds}
        />

        {/* Dependencies */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Dependencies <span style={{ color: c.hint, fontWeight: 400 }}>(optional)</span></div>
          <textarea
            value={dependencies}
            onChange={(e) => setDependencies(e.target.value)}
            rows={2}
            style={ta}
            placeholder="What capabilities, decisions, or conditions does this depend on?…"
          />
        </div>

        {/* Risks */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Risks <span style={{ color: c.hint, fontWeight: 400 }}>(optional)</span></div>
          <textarea
            value={risks}
            onChange={(e) => setRisks(e.target.value)}
            rows={2}
            style={ta}
            placeholder="What could go wrong or undermine this option?…"
          />
        </div>

      </div>
    </div>
  );
}

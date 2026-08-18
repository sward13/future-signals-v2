/**
 * StrategicOptionForm — create and edit view for a strategic option.
 * mode='new'  → creates a new option under the active project
 * mode='edit' → edits appState.activeSOId
 */
import { useState } from "react";
import { c, sel, btnP, btnG, fl, fh } from "../../styles/tokens.js";
import { RichTextField } from "../shared/RichTextField.jsx";
import { textToDoc, docToText } from "../../lib/richtextDoc.js";
import { serializeRichText } from "../shared/richtext/serialize.js";

// ─── Zone divider ─────────────────────────────────────────────────────────────

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
        border: `1px solid ${c.borderStrong}`, borderRadius: 8,
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
const HML = ["High", "Medium", "Low"];

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
  const [descriptionDoc,     setDescriptionDoc]     = useState(opt?.description_doc      ?? textToDoc(opt?.description      || ""));
  const [intendedOutcomeDoc, setIntendedOutcomeDoc] = useState(opt?.intended_outcome_doc ?? textToDoc(opt?.intended_outcome || ""));
  const [actionsDoc,         setActionsDoc]         = useState(opt?.actions_doc          ?? textToDoc(opt?.actions          || ""));
  const [implicationsDoc,    setImplicationsDoc]    = useState(opt?.implications_doc     ?? textToDoc(opt?.implications     || ""));
  const [horizon,         setHorizon]         = useState(opt?.horizon          || "");
  const [feasibility,     setFeasibility]     = useState(opt?.feasibility      || "");
  const [scenarioIds,     setScenarioIds]     = useState(
    Array.isArray(opt?.scenario_ids) ? opt.scenario_ids : []
  );
  const [dependenciesDoc,    setDependenciesDoc]    = useState(opt?.dependencies_doc     ?? textToDoc(opt?.dependencies     || ""));
  const [risksDoc,           setRisksDoc]           = useState(opt?.risks_doc            ?? textToDoc(opt?.risks            || ""));
  const [reversibility,      setReversibility]      = useState(opt?.reversibility      || "");
  const [resourceIntensity,  setResourceIntensity]  = useState(opt?.resource_intensity || "");
  const [saving,             setSaving]             = useState(false);

  const goBack = () => setActiveScreen("future-models");

  const handleSave = async () => {
    if (!name.trim()) { showToast("Name is required", "error"); return; }
    setSaving(true);
    try {
      // All six narrative fields dual-write: normalized JSON doc is the source
      // of truth; the legacy text column keeps a plain flattening for
      // export/rollback/fallback.
      const [descN, outN, actN, implN, depN, riskN] = await Promise.all([
        serializeRichText(descriptionDoc),
        serializeRichText(intendedOutcomeDoc),
        serializeRichText(actionsDoc),
        serializeRichText(implicationsDoc),
        serializeRichText(dependenciesDoc),
        serializeRichText(risksDoc),
      ]);
      const fields = {
        name:             name.trim(),
        description:          descN ? docToText(descN) : null,
        description_doc:      descN,
        intended_outcome:     outN ? docToText(outN) : null,
        intended_outcome_doc: outN,
        actions:              actN ? docToText(actN) : null,
        actions_doc:          actN,
        implications:         implN ? docToText(implN) : null,
        implications_doc:     implN,
        horizon:          horizon                 || null,
        feasibility:      feasibility             || null,
        scenario_ids:     scenarioIds,
        dependencies:        depN ? docToText(depN) : null,
        dependencies_doc:    depN,
        risks:               riskN ? docToText(riskN) : null,
        risks_doc:           riskN,
        reversibility:      reversibility           || null,
        resource_intensity: resourceIntensity       || null,
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
          fontSize: 11, letterSpacing: "0.02em",
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
          <RichTextField
            value={descriptionDoc}
            onChange={setDescriptionDoc}
            placeholder="A brief description of this option…"
          />
        </div>

        {/* Intended outcome */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Intended outcome</div>
          <div style={fh}>What are you trying to achieve? A direction to orient around.</div>
          <RichTextField
            value={intendedOutcomeDoc}
            onChange={setIntendedOutcomeDoc}
            placeholder="Describe the outcome this option is aimed at…"
            minHeight={120}
          />
        </div>

        {/* Zone — Detail */}
        <ZoneDivider label="Detail" />

        {/* What this involves */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>What this involves</div>
          <div style={fh}>What would this option entail? Orientation, not a project plan.</div>
          <RichTextField
            value={actionsDoc}
            onChange={setActionsDoc}
            placeholder="Describe what pursuing this option would look like…"
            minHeight={140}
          />
        </div>

        {/* Implications */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Implications</div>
          <div style={fh}>What does choosing this foreclose or make harder?</div>
          <RichTextField
            value={implicationsDoc}
            onChange={setImplicationsDoc}
            placeholder="What trade-offs or opportunity costs does this carry?…"
            minHeight={120}
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
            <div style={fl}>Feasibility</div>
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
          <div style={fl}>Dependencies</div>
          <RichTextField
            value={dependenciesDoc}
            onChange={setDependenciesDoc}
            placeholder="What capabilities, decisions, or conditions does this depend on?…"
          />
        </div>

        {/* Risks */}
        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Risks</div>
          <RichTextField
            value={risksDoc}
            onChange={setRisksDoc}
            placeholder="What could go wrong or undermine this option?…"
          />
        </div>

        {/* Reversibility + Resource Intensity */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={fl}>Reversibility</div>
            <select value={reversibility} onChange={(e) => setReversibility(e.target.value)} style={selectStyle}>
              <option value="">— Select reversibility</option>
              {HML.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={fl}>Resource Intensity</div>
            <select value={resourceIntensity} onChange={(e) => setResourceIntensity(e.target.value)} style={selectStyle}>
              <option value="">— Select intensity</option>
              {HML.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * StrategicOptionForm — create and edit view for a strategic option.
 * mode='new'  → creates a new option under the active project
 * mode='edit' → edits appState.activeSOId
 *
 * Danger Zone (delete) lives here, in edit mode only — not in
 * StrategicOptionRead, the read/view surface. See
 * docs/edit-view-mode-consistency-audit-prompt.md.
 *
 * Remaining arbitrary values — no clean Tailwind token equivalent yet:
 *   the select-arrow background-image (see selectArrowStyle below) — kept as
 *   an inline style, same precedent as ClustersPanel.jsx's grid-template-columns
 *   arbitrary style for content Tailwind can't cleanly express as a class.
 */
import { useState } from "react";
import clsx from "clsx";
import { RichTextField } from "../shared/RichTextField.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";
import { textToDoc, docToText } from "../../lib/richtextDoc.js";
import { serializeRichText } from "../shared/richtext/serialize.js";

// ─── Zone divider ─────────────────────────────────────────────────────────────

function ZoneDivider({ label }) {
  return (
    <div className="flex items-center gap-3 mt-7 mb-6">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-medium text-hint tracking-[0.02em]">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
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
    <div className="mb-5">
      <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Responds to scenarios</div>
      <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">Which scenarios is this option designed to address?</div>
      <div className="border border-border-strong rounded-container bg-white overflow-hidden">
        <div className="flex flex-wrap gap-1.25 py-2 px-2.5 min-h-10">
          {selected.length === 0 && (
            <span className="text-xs text-hint leading-6">None selected</span>
          )}
          {selected.map((id) => {
            const s = scenarios.find((sc) => sc.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1.25 text-[11px] bg-surface-alt text-ink border border-border rounded-[5px] py-0.75 px-2">
                {s?.name || id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="bg-transparent border-none cursor-pointer text-hint text-[13px] leading-none p-0"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        {scenarios.length > 0 ? (
          <div className="border-t border-border bg-field-bg">
            {scenarios.map((sc) => (
              <div
                key={sc.id}
                onClick={() => toggle(sc.id)}
                className={clsx(
                  "py-1.75 px-3 text-[11px] border-b border-border cursor-pointer flex items-center justify-between",
                  selectedSet.has(sc.id) ? "text-ink font-medium bg-amber-50" : "text-muted font-normal bg-transparent",
                )}
              >
                <span>{sc.name}</span>
                {selectedSet.has(sc.id) && <span className="text-[10px] text-hint">✓</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-2.5 px-3 text-[11px] text-hint border-t border-border bg-field-bg">
            No scenarios in this project yet
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HORIZONS      = ["H1", "H2", "H3"];
const FEASIBILITIES = ["High", "Medium", "Low"];
const HML = ["High", "Medium", "Low"];

const selectClass = "w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-ui font-[inherit] outline-none appearance-none pr-[30px] cursor-pointer bg-no-repeat";
const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundPosition: "right 10px center",
};

// ─── Main form ────────────────────────────────────────────────────────────────

export default function StrategicOptionForm({ appState, mode }) {
  const {
    strategicOptions, scenarios, activeProjectId, activeSOId,
    addStrategicOption, updateStrategicOption, deleteStrategicOption,
    setActiveScreen, openStrategicOption, showToast,
  } = appState;

  const opt = mode === "edit"
    ? strategicOptions.find((o) => o.id === activeSOId)
    : null;

  const projectScenarios = scenarios.filter((s) => s.project_id === activeProjectId);

  const [name,               setName]               = useState(opt?.name                || "");
  const [descriptionDoc,     setDescriptionDoc]     = useState(opt?.description_doc      ?? textToDoc(opt?.description      || ""));
  const [intendedOutcomeDoc, setIntendedOutcomeDoc] = useState(opt?.intended_outcome_doc ?? textToDoc(opt?.intended_outcome || ""));
  const [actionsDoc,         setActionsDoc]         = useState(opt?.actions_doc          ?? textToDoc(opt?.actions          || ""));
  const [implicationsDoc,    setImplicationsDoc]    = useState(opt?.implications_doc     ?? textToDoc(opt?.implications     || ""));
  const [horizon,            setHorizon]            = useState(opt?.horizon              || "");
  const [feasibility,        setFeasibility]        = useState(opt?.feasibility          || "");
  const [scenarioIds,        setScenarioIds]        = useState(
    Array.isArray(opt?.scenario_ids) ? opt.scenario_ids : []
  );
  const [dependenciesDoc,    setDependenciesDoc]    = useState(opt?.dependencies_doc     ?? textToDoc(opt?.dependencies     || ""));
  const [risksDoc,           setRisksDoc]           = useState(opt?.risks_doc            ?? textToDoc(opt?.risks            || ""));
  const [reversibility,      setReversibility]      = useState(opt?.reversibility        || "");
  const [resourceIntensity,  setResourceIntensity]  = useState(opt?.resource_intensity   || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        name:                  name.trim(),
        description:           descN ? docToText(descN) : null,
        description_doc:       descN,
        intended_outcome:      outN ? docToText(outN) : null,
        intended_outcome_doc:  outN,
        actions:               actN ? docToText(actN) : null,
        actions_doc:           actN,
        implications:          implN ? docToText(implN) : null,
        implications_doc:      implN,
        horizon:               horizon || null,
        feasibility:           feasibility || null,
        scenario_ids:          scenarioIds,
        dependencies:          depN ? docToText(depN) : null,
        dependencies_doc:      depN,
        risks:                 riskN ? docToText(riskN) : null,
        risks_doc:             riskN,
        reversibility:         reversibility || null,
        resource_intensity:    resourceIntensity || null,
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

  const handleDelete = () => {
    deleteStrategicOption(activeSOId);
    showToast("Strategic option deleted");
    setActiveScreen("future-models");
  };

  return (
    <div className="bg-bg min-h-full">

      {/* Top bar */}
      <div className="flex items-center justify-between py-3 px-6 bg-white border-b border-border sticky top-0 z-10">
        <button onClick={goBack} className="py-1.25 px-0 rounded-btn bg-transparent text-muted border-none text-xs cursor-pointer font-[inherit]">
          ← Future Models
        </button>
        <div className="flex gap-2 items-center">
          <button onClick={goBack} className="py-1.75 px-3 rounded-btn bg-transparent text-muted border-none text-xs cursor-pointer font-[inherit]">Discard</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              "py-1.75 px-5 rounded-container bg-brand text-white border-none text-xs font-medium cursor-pointer font-[inherit]",
              saving ? "opacity-60" : "opacity-100",
            )}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Form body */}
      <div className="max-w-[720px] mx-auto pt-9 px-6 pb-20">

        {/* Eyebrow */}
        <div className="text-[11px] tracking-[0.02em] text-hint mb-3">
          {mode === "new" ? "New strategic option" : "Edit strategic option"}
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this option"
          autoFocus
          className="w-full text-2xl font-medium text-ink border-none bg-transparent outline-none font-[inherit] pb-4 border-b border-border mb-6 box-border"
        />

        {/* Description */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Description</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">What this option is. Enough to identify it clearly.</div>
          <RichTextField
            value={descriptionDoc}
            onChange={setDescriptionDoc}
            placeholder="A brief description of this option…"
          />
        </div>

        {/* Intended outcome */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Intended outcome</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">What are you trying to achieve? A direction to orient around.</div>
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
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">What this involves</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">What would this option entail? Orientation, not a project plan.</div>
          <RichTextField
            value={actionsDoc}
            onChange={setActionsDoc}
            placeholder="Describe what pursuing this option would look like…"
            minHeight={140}
          />
        </div>

        {/* Implications */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Implications</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">What does choosing this foreclose or make harder?</div>
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
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Time horizon</div>
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)} className={selectClass} style={selectArrowStyle}>
              <option value="">— Select horizon</option>
              {HORIZONS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Feasibility</div>
            <select value={feasibility} onChange={(e) => setFeasibility(e.target.value)} className={selectClass} style={selectArrowStyle}>
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
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Dependencies</div>
          <RichTextField
            value={dependenciesDoc}
            onChange={setDependenciesDoc}
            placeholder="What capabilities, decisions, or conditions does this depend on?…"
          />
        </div>

        {/* Risks */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Risks</div>
          <RichTextField
            value={risksDoc}
            onChange={setRisksDoc}
            placeholder="What could go wrong or undermine this option?…"
          />
        </div>

        {/* Reversibility + Resource Intensity */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Reversibility</div>
            <select value={reversibility} onChange={(e) => setReversibility(e.target.value)} className={selectClass} style={selectArrowStyle}>
              <option value="">— Select reversibility</option>
              {HML.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Resource Intensity</div>
            <select value={resourceIntensity} onChange={(e) => setResourceIntensity(e.target.value)} className={selectClass} style={selectArrowStyle}>
              <option value="">— Select intensity</option>
              {HML.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Danger zone — delete, edit mode only (no record exists yet in "new" mode).
            Matches EditProjectDrawer.jsx's convention: visually separated below
            a border, label left / action right, confirmed via ConfirmDialog. */}
        {mode === "edit" && (
          <div className="pt-5 mt-2 border-t border-border flex items-center justify-between">
            <div className="text-[11px] text-hint">Danger zone</div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[11px] py-1 px-3 rounded-btn border border-red-border bg-transparent text-red-800 cursor-pointer font-[inherit]"
            >
              Delete option
            </button>
          </div>
        )}

      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete strategic option"
          message={`"${opt?.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete option"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

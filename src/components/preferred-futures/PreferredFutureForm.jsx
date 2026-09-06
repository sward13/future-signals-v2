/**
 * PreferredFutureForm — create and edit view for a preferred future.
 * mode='new'  → creates a new preferred future under the active project
 * mode='edit' → edits appState.activePFId
 *
 * guiding_principles, strategic_priorities, indicators are stored as jsonb
 * string arrays but presented as plain textareas (newline-separated).
 *
 * Danger Zone (delete) lives here, in edit mode only — not in
 * PreferredFutureRead, the read/view surface. See
 * docs/edit-view-mode-consistency-audit-prompt.md.
 *
 * Remaining arbitrary values — no clean Tailwind token equivalent yet:
 *   the select-arrow background-image (see selectStyle below) — kept as an
 *   inline style, same precedent as ClustersPanel.jsx's grid-template-columns
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
      <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Informed by scenarios</div>
      <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">Which scenarios does this preferred future draw from?</div>
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
                  selectedSet.has(sc.id) ? "text-ink font-medium bg-green-50" : "text-muted font-normal bg-transparent",
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const arrToText = (arr) => (Array.isArray(arr) ? arr.join("\n") : "");
const textToArr = (text) => text.split("\n").map((s) => s.trim()).filter(Boolean);

const HORIZONS = ["H1", "H2", "H3"];

const taClass = "w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-ui font-[inherit] outline-none resize-none leading-body box-border";
const selectClass = "w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-ui font-[inherit] outline-none appearance-none pr-[30px] cursor-pointer bg-no-repeat";
const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundPosition: "right 10px center",
};

// ─── Main form ────────────────────────────────────────────────────────────────

export default function PreferredFutureForm({ appState, mode }) {
  const {
    preferredFutures, scenarios, activeProjectId, activePFId,
    addPreferredFuture, updatePreferredFuture, deletePreferredFuture,
    setActiveScreen, openPreferredFuture, showToast,
  } = appState;

  const pf = mode === "edit"
    ? preferredFutures.find((p) => p.id === activePFId)
    : null;

  const projectScenarios = scenarios.filter((s) => s.project_id === activeProjectId);

  const [name,               setName]               = useState(pf?.name               || "");
  const [descriptionDoc,     setDescriptionDoc]     = useState(pf?.description_doc      ?? textToDoc(pf?.description      || ""));
  const [desiredOutcomesDoc, setDesiredOutcomesDoc] = useState(pf?.desired_outcomes_doc ?? textToDoc(pf?.desired_outcomes || ""));
  const [guidingPrinciples,  setGuidingPrinciples]  = useState(arrToText(pf?.guiding_principles));
  const [strategicPriorities,setStrategicPriorities]= useState(arrToText(pf?.strategic_priorities));
  const [indicators,         setIndicators]         = useState(arrToText(pf?.indicators));
  const [horizon,            setHorizon]            = useState(pf?.horizon            || "");
  const [scenarioIds,        setScenarioIds]        = useState(
    Array.isArray(pf?.scenario_ids) ? pf.scenario_ids : []
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const goBack = () => setActiveScreen("future-models");

  const handleSave = async () => {
    if (!name.trim()) { showToast("Name is required", "error"); return; }
    setSaving(true);
    try {
      // Rich-text fields dual-write: normalized JSON doc is source of truth; the
      // legacy text column keeps a plain flattening for export/rollback/fallback.
      const descNorm = await serializeRichText(descriptionDoc);
      const outNorm  = await serializeRichText(desiredOutcomesDoc);
      const fields = {
        name:                 name.trim(),
        description:          descNorm ? docToText(descNorm) : null,
        description_doc:      descNorm,
        desired_outcomes:     outNorm ? docToText(outNorm) : null,
        desired_outcomes_doc: outNorm,
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

  const handleDelete = () => {
    deletePreferredFuture(activePFId);
    showToast("Preferred future deleted");
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
          {mode === "new" ? "New preferred future" : "Edit preferred future"}
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this preferred future"
          autoFocus
          className="w-full text-2xl font-medium text-ink border-none bg-transparent outline-none font-[inherit] pb-4 border-b border-border mb-6 box-border"
        />

        {/* Description */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Description</div>
          <RichTextField
            value={descriptionDoc}
            onChange={setDescriptionDoc}
            placeholder="A brief summary of this preferred future…"
          />
        </div>

        {/* Desired outcomes */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Desired outcomes</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">What conditions or results define this future?</div>
          <RichTextField
            value={desiredOutcomesDoc}
            onChange={setDesiredOutcomesDoc}
            placeholder="Describe the outcomes that would define this future as achieved…"
            minHeight={120}
          />
        </div>

        {/* Zone — Values and direction */}
        <ZoneDivider label="Values and direction" />

        {/* Guiding principles */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Guiding principles</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">What values shape this future? Commitments that hold even when difficult. One per line.</div>
          <textarea
            value={guidingPrinciples}
            onChange={(e) => setGuidingPrinciples(e.target.value)}
            rows={3}
            className={taClass}
            placeholder={"Equity is non-negotiable\nOpen systems over closed platforms\n…"}
          />
        </div>

        {/* Strategic priorities */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Strategic priorities</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">Broad areas of action. Directions, not plans. One per line.</div>
          <textarea
            value={strategicPriorities}
            onChange={(e) => setStrategicPriorities(e.target.value)}
            rows={3}
            className={taClass}
            placeholder={"Invest in workforce reskilling\nBuild adaptive governance structures\n…"}
          />
        </div>

        {/* Indicators */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Indicators of progress</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">Observable signals that this future is beginning to emerge. One per line.</div>
          <textarea
            value={indicators}
            onChange={(e) => setIndicators(e.target.value)}
            rows={3}
            className={taClass}
            placeholder={"Policy frameworks updated to reflect new norms\nNew institutions emerging in this space\n…"}
          />
        </div>

        {/* Zone — Scope and provenance */}
        <ZoneDivider label="Scope and provenance" />

        {/* Horizon + Scenarios row */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Time horizon</div>
          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value)}
            className={clsx(selectClass, "max-w-[240px]")}
            style={selectArrowStyle}
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
              Delete preferred future
            </button>
          </div>
        )}

      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete preferred future"
          message={`"${pf?.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete preferred future"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

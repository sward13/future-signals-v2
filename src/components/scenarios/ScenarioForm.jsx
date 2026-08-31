/**
 * ScenarioForm — create and edit view for a scenario.
 * mode='new'  → creates a new scenario under the active project
 * mode='edit' → edits appState.activeScenarioId
 *
 * Danger Zone (delete) lives here, in edit mode only — not in ScenarioRead,
 * the read/view surface. See docs/edit-view-mode-consistency-audit-prompt.md.
 *
 * Remaining arbitrary values — no clean Tailwind token equivalent yet:
 *   bg-[url('data:image/svg+xml,...')]  Select-arrow icon (see selectStyle
 *     below) — kept as an inline style, same precedent as ClustersPanel.jsx's
 *     grid-template-columns arbitrary style for content Tailwind can't
 *     cleanly express as a utility class.
 */
import { useState } from "react";
import clsx from "clsx";
import { RichTextField } from "../shared/RichTextField.jsx";
import { ClusterForcePicker } from "../shared/ClusterForcePicker.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";
import { textToDoc, docToText } from "../../lib/richtextDoc.js";
import { serializeRichText } from "../shared/richtext/serialize.js";

// ─── Zone divider ────────────────────────────────────────────────────────────

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
    <div className="mb-5">
      <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Key differences from today</div>
      <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">Each item should be a concrete, present-tense statement about how this world differs.</div>
      <div className="flex flex-col gap-1.5">
        {diffs.map((diff, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-[10px] font-medium text-hint min-w-4 text-right">
              {i + 1}
            </span>
            <input
              className="flex-1 py-2 px-2.5 border border-border-strong rounded-btn bg-white text-ink text-ui font-[inherit] outline-none"
              value={diff}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`Difference ${i + 1}…`}
            />
            {diffs.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="bg-transparent border-none cursor-pointer text-hint text-base leading-none px-1 py-0"
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
        className="mt-2 bg-transparent border border-dashed border-border rounded-btn py-1.5 px-3.5 text-[11px] text-hint cursor-pointer font-[inherit] w-full"
      >
        + Add another
      </button>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

const HORIZONS = ["H1", "H2", "H3"];
const ARCHETYPES = ["Continuation", "Collapse", "Constraint", "Transformation"];

const selectClass = "w-full py-2.25 px-2.75 border border-border-strong rounded-container bg-white text-ink text-ui font-[inherit] outline-none appearance-none pr-[30px] cursor-pointer bg-no-repeat";
const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundPosition: "right 10px center",
};

export default function ScenarioForm({ appState, mode }) {
  const {
    scenarios, clusters, activeProjectId, activeScenarioId,
    addScenario, updateScenario, deleteScenario,
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
  const [confirmDelete,   setConfirmDelete]   = useState(false);

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

  const handleDelete = () => {
    deleteScenario(activeScenarioId);
    showToast("Scenario deleted");
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
          {mode === "new" ? "New scenario" : "Edit scenario"}
        </div>

        {/* Name */}
        <div className="mb-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this scenario"
            autoFocus
            className="w-full text-2xl font-medium text-ink border-none bg-transparent outline-none font-[inherit] pb-4 border-b border-border box-border"
          />
          <div className="text-[11px] text-hint mt-1">* required</div>
        </div>

        {/* Zone 1: Frame */}
        <ZoneDivider label="Frame" />

        {/* Horizon + Archetype row */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Time horizon</div>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className={selectClass}
              style={selectArrowStyle}
            >
              <option value="">— Select horizon</option>
              {HORIZONS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Archetype</div>
            <select
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              className={selectClass}
              style={selectArrowStyle}
            >
              <option value="">— Select archetype</option>
              {ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Driving forces / Suppressed forces — side by side with a hairline
            divider, stacking to one column below 700px. The Horizon/Archetype
            grid above has no responsive behavior to mirror (it's a bare
            2-col grid with no breakpoint), so this is new behavior, not a
            copy of an existing one. Uses Tailwind's arbitrary breakpoint
            variant (min-[700px]:) rather than a scoped <style> block with a
            hand-written media query, now that this file is on Tailwind. */}
        <div className="grid grid-cols-1 gap-5 min-[700px]:grid-cols-[1fr_1px_1fr] min-[700px]:gap-4">
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
          <div className="hidden min-[700px]:block bg-border" />
          <div>
            <ClusterForcePicker
              role="suppressed"
              label="Suppressed forces"
              hint="Which clusters are weakened or absent in this scenario?"
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
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Description</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">A brief summary — what is this scenario and what makes it distinct?</div>
          <RichTextField
            value={descriptionDoc}
            onChange={setDescriptionDoc}
            placeholder="Describe this scenario in 1–2 sentences…"
          />
        </div>

        {/* Key differences */}
        <KeyDiffsList diffs={keyDiffs} onChange={setKeyDiffs} />

        {/* Narrative — rich-text proof-of-concept field */}
        <div className="mb-5">
          <div className="text-xs font-medium text-ink mb-1.25 flex items-center gap-1.5">Narrative</div>
          <div className="text-[11px] text-hint mb-1.5 italic leading-[1.45]">How does this world come to be? Write as much or as little as is useful.</div>
          <RichTextField
            value={narrativeDoc}
            onChange={setNarrativeDoc}
            placeholder="Write a narrative description of this scenario…"
            minHeight={120}
          />
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
              Delete scenario
            </button>
          </div>
        )}

      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete scenario"
          message={`"${scenario?.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete scenario"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

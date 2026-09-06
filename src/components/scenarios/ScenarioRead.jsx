/**
 * ScenarioRead — read view for a single scenario.
 * Two-column layout: main content + metadata sidebar.
 *
 * Read-only: no destructive action lives here. Delete moved to ScenarioForm's
 * edit-mode Danger Zone — see docs/edit-view-mode-consistency-audit-prompt.md.
 */
import clsx from "clsx";
import { HorizTag, ArchTag } from "../shared/Tag.jsx";
import { RichTextField } from "../shared/RichTextField.jsx";
import { textToDoc, docIsEmpty } from "../../lib/richtextDoc.js";

const sideLabel = "text-[11px] font-medium text-hint tracking-[0.02em] mb-2";
const forcesRow = "flex items-center gap-1.75 py-1.5 px-2 bg-field-bg border border-border rounded-[6px] text-[11px]";

export default function ScenarioRead({ appState }) {
  const {
    scenarios, clusters, preferredFutures, strategicOptions,
    activeScenarioId, activeProjectId,
    openScenarioEdit, openClusterDetail,
    openPreferredFuture, openStrategicOption,
    setActiveScreen,
  } = appState;

  const scenario = scenarios.find((s) => s.id === activeScenarioId);

  if (!scenario) {
    return (
      <div className="py-7 px-8 bg-bg">
        <div className="text-sm text-muted">Scenario not found.</div>
        <button onClick={() => setActiveScreen("future-models")} className="py-1.75 px-3 rounded-btn bg-transparent text-muted border-none text-xs cursor-pointer font-[inherit] mt-3">
          ← Future Models
        </button>
      </div>
    );
  }

  const projectClusters = clusters.filter((cl) => cl.project_id === activeProjectId);
  const clusterById     = (id) => projectClusters.find((cl) => cl.id === id);
  const diffs           = Array.isArray(scenario.key_differences) ? scenario.key_differences.filter(Boolean) : [];
  const driving         = Array.isArray(scenario.driving_forces)  ? scenario.driving_forces  : [];
  const suppressed      = Array.isArray(scenario.suppressed_forces) ? scenario.suppressed_forces : [];

  // "Appears in" — preferred futures and strategic options referencing this scenario
  const appearingPFs = (preferredFutures || []).filter(
    (pf) => pf.project_id === activeProjectId && Array.isArray(pf.scenario_ids) && pf.scenario_ids.includes(activeScenarioId)
  );
  const appearingOpts = (strategicOptions || []).filter(
    (o) => o.project_id === activeProjectId && Array.isArray(o.scenario_ids) && o.scenario_ids.includes(activeScenarioId)
  );

  return (
    <div className="bg-bg min-h-full">

      {/* Top bar */}
      <div className="flex items-center justify-between py-3 px-6 bg-white border-b border-border sticky top-0 z-10">
        <button
          onClick={() => setActiveScreen("future-models")}
          className="py-1.25 px-0 rounded-btn bg-transparent text-muted border-none text-xs cursor-pointer font-[inherit]"
        >
          ← Future Models
        </button>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => openScenarioEdit(activeScenarioId)}
            className="py-1.5 px-4 rounded-container bg-transparent text-muted border border-border-strong text-xs cursor-pointer font-[inherit]"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-[1fr_280px] max-w-[1000px] mx-auto pb-20">

        {/* ── Main content ──────────────────────────────────── */}
        <div className="pt-9 px-9">

          {/* Eyebrow */}
          <div className="flex items-center gap-2 text-[11px] font-medium text-hint tracking-[0.02em] mb-2.5">
            Scenario
            {scenario.horizon && <HorizTag h={scenario.horizon} />}
            {scenario.archetype && <ArchTag arch={scenario.archetype} />}
          </div>

          {/* Title */}
          <div className="text-[26px] font-medium text-ink leading-[1.2] mb-3 tracking-[-0.01em]">
            {scenario.name}
          </div>

          {/* Description */}
          {(!docIsEmpty(scenario.description_doc) || scenario.description) && (
            <div className="text-sm text-muted leading-[1.7] mb-7 max-w-[560px]">
              <RichTextField value={scenario.description_doc ?? textToDoc(scenario.description)} editable={false} />
            </div>
          )}

          {/* Key differences */}
          {diffs.length > 0 && (
            <div className="mb-7">
              <div className="text-[11px] font-medium text-hint tracking-[0.02em] mb-2.5 pb-2 border-b border-border">
                Key differences from today
              </div>
              <div className="flex flex-col gap-1.5">
                {diffs.map((diff, i) => (
                  <div key={i} className="flex gap-3 items-start py-2.25 px-3 bg-field-bg border border-border rounded-btn">
                    <span className="text-[10px] font-medium text-hint min-w-4 pt-px">
                      {i + 1}
                    </span>
                    <span className="text-ui text-muted leading-[1.5]">
                      {diff}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Narrative */}
          {(!docIsEmpty(scenario.narrative_doc) || scenario.narrative) && (
            <div className="mb-7">
              <div className="text-[11px] font-medium text-hint tracking-[0.02em] mb-2.5 pb-2 border-b border-border">
                Narrative
              </div>
              <div className="text-ui text-muted leading-[1.75]">
                <RichTextField
                  value={scenario.narrative_doc ?? textToDoc(scenario.narrative)}
                  editable={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className="pt-9 px-5 border-l border-border flex flex-col gap-5">

          {/* Driving forces */}
          {driving.length > 0 && (
            <div>
              <div className={sideLabel}>Driving forces</div>
              <div className="flex flex-col gap-1">
                {driving.map((id) => {
                  const cl = clusterById(id);
                  return (
                    <div
                      key={id}
                      onClick={() => cl && openClusterDetail(id)}
                      className={clsx(forcesRow, cl ? "text-muted cursor-pointer" : "text-hint cursor-default")}
                    >
                      <span className="w-1.25 h-1.25 rounded-full bg-green-700 shrink-0" />
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {cl?.name || id}
                      </span>
                      {cl && <span className="text-hint text-[11px]">→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suppressed forces */}
          {suppressed.length > 0 && (
            <div>
              <div className={sideLabel}>Suppressed forces</div>
              <div className="flex flex-col gap-1">
                {suppressed.map((id) => {
                  const cl = clusterById(id);
                  return (
                    <div
                      key={id}
                      onClick={() => cl && openClusterDetail(id)}
                      className={clsx(forcesRow, cl ? "text-muted cursor-pointer" : "text-hint cursor-default")}
                    >
                      <span className="w-1.25 h-1.25 rounded-full bg-hint shrink-0" />
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {cl?.name || id}
                      </span>
                      {cl && <span className="text-hint text-[11px]">→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Appears in */}
          {(appearingPFs.length > 0 || appearingOpts.length > 0) && (
            <div>
              <div className={sideLabel}>Appears in</div>
              <div className="flex flex-col gap-1">
                {appearingPFs.map((pf) => (
                  <div
                    key={pf.id}
                    onClick={() => openPreferredFuture(pf.id)}
                    className="flex items-center gap-1.75 py-1.5 px-2 bg-field-bg border border-border rounded-[6px] text-[11px] text-muted cursor-pointer"
                  >
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {pf.name}
                    </span>
                    <span className="text-[10px] text-hint shrink-0">Preferred future →</span>
                  </div>
                ))}
                {appearingOpts.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => openStrategicOption(opt.id)}
                    className="flex items-center gap-1.75 py-1.5 px-2 bg-field-bg border border-border rounded-[6px] text-[11px] text-muted cursor-pointer"
                  >
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {opt.name}
                    </span>
                    <span className="text-[10px] text-hint shrink-0">Option →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div>
            <div className={sideLabel}>Details</div>
            <div className="flex flex-col gap-1.5">
              {scenario.horizon && (
                <div className="flex gap-1.5 items-center">
                  <span className="text-[11px] text-hint min-w-16">Horizon</span>
                  <HorizTag h={scenario.horizon} />
                </div>
              )}
              {scenario.archetype && (
                <div className="flex gap-1.5 items-center">
                  <span className="text-[11px] text-hint min-w-16">Archetype</span>
                  <ArchTag arch={scenario.archetype} />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/**
 * PreferredFutureRead — read view for a single preferred future.
 * Two-column layout: main content + metadata sidebar.
 *
 * Read-only: no destructive action lives here. Delete moved to
 * PreferredFutureForm's edit-mode Danger Zone — see
 * docs/edit-view-mode-consistency-audit-prompt.md.
 */
import { HorizTag } from "../shared/Tag.jsx";
import { RichTextField } from "../shared/RichTextField.jsx";
import { textToDoc, docIsEmpty } from "../../lib/richtextDoc.js";

const sideLabel = "text-[11px] font-medium text-hint tracking-[0.02em] mb-2";
const sectionHeading = "text-[11px] font-medium text-hint tracking-[0.02em] mb-2.5 pb-2 border-b border-border";

export default function PreferredFutureRead({ appState }) {
  const {
    preferredFutures, scenarios, strategicOptions,
    activePFId, activeProjectId,
    openPreferredFutureEdit,
    openScenario, openStrategicOption, setActiveScreen,
  } = appState;

  const pf = preferredFutures.find((p) => p.id === activePFId);

  if (!pf) {
    return (
      <div className="py-7 px-8 bg-bg">
        <div className="text-sm text-muted">Preferred future not found.</div>
        <button onClick={() => setActiveScreen("future-models")} className="py-1.75 px-3 rounded-btn bg-transparent text-muted border-none text-xs cursor-pointer font-[inherit] mt-3">
          ← Future Models
        </button>
      </div>
    );
  }

  const projectScenarios = scenarios.filter((s) => s.project_id === activeProjectId);
  const scenarioById = (id) => projectScenarios.find((s) => s.id === id);

  const principles  = Array.isArray(pf.guiding_principles)   ? pf.guiding_principles.filter(Boolean)   : [];
  const priorities  = Array.isArray(pf.strategic_priorities)  ? pf.strategic_priorities.filter(Boolean)  : [];
  const inds        = Array.isArray(pf.indicators)            ? pf.indicators.filter(Boolean)            : [];
  const scenarioIds = Array.isArray(pf.scenario_ids)          ? pf.scenario_ids                          : [];

  // Connected options: strategic_options whose scenario_ids overlap with this PF's scenario_ids
  const pfScenarioSet = new Set(scenarioIds);
  const connectedOptions = (strategicOptions || []).filter(
    (o) => o.project_id === activeProjectId &&
      Array.isArray(o.scenario_ids) &&
      o.scenario_ids.some((id) => pfScenarioSet.has(id))
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
            onClick={() => openPreferredFutureEdit(activePFId)}
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

          {/* Gradient accent bar */}
          <div
            className="h-[3px] rounded mb-6"
            style={{ background: "linear-gradient(to right, rgba(59,109,17,0.3), rgba(24,95,165,0.3), rgba(133,79,11,0.3))" }}
          />

          {/* Eyebrow */}
          <div className="flex items-center gap-2 text-[11px] font-medium text-hint tracking-[0.02em] mb-2.5">
            Preferred Future
            {pf.horizon && <HorizTag h={pf.horizon} />}
          </div>

          {/* Title */}
          <div className="text-[26px] font-medium text-ink leading-[1.2] mb-3 tracking-[-0.01em]">
            {pf.name}
          </div>

          {/* Description */}
          {(!docIsEmpty(pf.description_doc) || pf.description) && (
            <div className="text-sm text-muted leading-[1.7] mb-7 max-w-[560px]">
              <RichTextField value={pf.description_doc ?? textToDoc(pf.description)} editable={false} />
            </div>
          )}

          {/* Desired outcomes */}
          {(!docIsEmpty(pf.desired_outcomes_doc) || pf.desired_outcomes) && (
            <div className="mb-7">
              <div className={sectionHeading}>Desired outcomes</div>
              <div className="text-ui text-muted leading-[1.75]">
                <RichTextField value={pf.desired_outcomes_doc ?? textToDoc(pf.desired_outcomes)} editable={false} />
              </div>
            </div>
          )}

          {/* Guiding principles */}
          {principles.length > 0 && (
            <div className="mb-7">
              <div className={sectionHeading}>Guiding principles</div>
              <div className="flex flex-col gap-1.5">
                {principles.map((p, i) => (
                  <div key={i} className="py-2.25 px-3.5 bg-field-bg border border-border border-l-[3px] border-l-green-700 rounded-btn text-ui text-muted leading-[1.5]">
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategic priorities */}
          {priorities.length > 0 && (
            <div className="mb-7">
              <div className={sectionHeading}>Strategic priorities</div>
              <ol className="m-0 pl-5 flex flex-col gap-2">
                {priorities.map((p, i) => (
                  <li key={i} className="text-ui text-muted leading-[1.5]">
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Indicators of progress */}
          {inds.length > 0 && (
            <div className="mb-7">
              <div className={sectionHeading}>Indicators of progress</div>
              <div className="flex flex-col gap-1.5">
                {inds.map((ind, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-ui text-muted leading-[1.5]">
                    <span className="w-1.75 h-1.75 rounded-full bg-green-700 shrink-0 mt-1" />
                    {ind}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className="pt-9 px-5 border-l border-border flex flex-col gap-5">

          {/* Informed by scenarios */}
          {scenarioIds.length > 0 && (
            <div>
              <div className={sideLabel}>Informed by</div>
              <div className="flex flex-col gap-1">
                {scenarioIds.map((id) => {
                  const sc = scenarioById(id);
                  return (
                    <div
                      key={id}
                      onClick={() => sc && openScenario(id)}
                      className={
                        `flex items-center gap-1.75 py-1.5 px-2 bg-field-bg border border-border rounded-[6px] text-[11px] ${sc ? "text-muted cursor-pointer" : "text-hint cursor-default"}`
                      }
                    >
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {sc?.name || id}
                      </span>
                      {sc && <span className="text-hint text-[11px]">→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Connected options */}
          {connectedOptions.length > 0 && (
            <div>
              <div className={sideLabel}>Connected options</div>
              <div className="flex flex-col gap-1">
                {connectedOptions.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => openStrategicOption(opt.id)}
                    className="flex items-center gap-1.75 py-1.5 px-2 bg-field-bg border border-border rounded-[6px] text-[11px] text-muted cursor-pointer"
                  >
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {opt.name}
                    </span>
                    <span className="text-hint text-[11px]">→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Horizon */}
          {pf.horizon && (
            <div>
              <div className={sideLabel}>Horizon</div>
              <div className="flex flex-col gap-1">
                <HorizTag h={pf.horizon} />
                <div className="text-[11px] text-hint mt-1 leading-[1.5]">
                  {pf.horizon === "H1" && "Near-term: likely within 1–3 years"}
                  {pf.horizon === "H2" && "Mid-term: likely within 4–7 years"}
                  {pf.horizon === "H3" && "Long-term: 8+ years out"}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

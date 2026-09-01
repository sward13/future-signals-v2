/**
 * StrategicOptionRead — read view for a single strategic option.
 * Two-column layout: main content + metadata sidebar.
 *
 * Read-only: no destructive action lives here. Delete moved to
 * StrategicOptionForm's edit-mode Danger Zone — see
 * docs/edit-view-mode-consistency-audit-prompt.md.
 */
import clsx from "clsx";
import { HorizTag } from "../shared/Tag.jsx";
import { RichTextField } from "../shared/RichTextField.jsx";
import { textToDoc, docIsEmpty } from "../../lib/richtextDoc.js";

/** Show a rich-text field if it has a doc or legacy text; render read-only. */
function hasField(o, key) { return !docIsEmpty(o[`${key}_doc`]) || o[key]; }
function fieldDoc(o, key) { return o[`${key}_doc`] ?? textToDoc(o[key]); }

const sideLabel = "text-[11px] font-medium text-hint tracking-[0.02em] mb-2";
const sectionHeading = "text-[11px] font-medium text-hint tracking-[0.02em] mb-2.5 pb-2 border-b border-border";
const prose = "text-ui text-muted leading-[1.75] whitespace-pre-wrap";

// ─── Feasibility badge ────────────────────────────────────────────────────────

const FEASIBILITY_CLASSES = {
  high:   "text-green-700 bg-green-50 border-green-border",
  medium: "text-amber-700 bg-amber-50 border-amber-border",
  low:    "text-red-800 bg-red-50 border-red-border",
};

function FeasibilityBadge({ value }) {
  if (!value) return null;
  const key = value.toLowerCase();
  const label = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return (
    <span className={clsx(
      "text-[10px] font-medium py-0.5 px-1.75 rounded-pill border",
      FEASIBILITY_CLASSES[key] || "text-hint bg-surface-alt border-border",
    )}>
      {label}
    </span>
  );
}

// ─── Resource Intensity badge (High = costly/red, Low = lightweight/green) ───

const RESOURCE_INTENSITY_CLASSES = {
  high:   "text-red-800 bg-red-50 border-red-border",
  medium: "text-amber-700 bg-amber-50 border-amber-border",
  low:    "text-green-700 bg-green-50 border-green-border",
};

function ResourceIntensityBadge({ value }) {
  if (!value) return null;
  const key = value.toLowerCase();
  const label = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return (
    <span className={clsx(
      "text-[10px] font-medium py-0.5 px-1.75 rounded-pill border",
      RESOURCE_INTENSITY_CLASSES[key] || "text-hint bg-surface-alt border-border",
    )}>
      {label}
    </span>
  );
}

// ─── Main read view ───────────────────────────────────────────────────────────

export default function StrategicOptionRead({ appState }) {
  const {
    strategicOptions, scenarios, preferredFutures,
    activeSOId, activeProjectId,
    openStrategicOptionEdit,
    openScenario, openPreferredFuture,
    setActiveScreen,
  } = appState;

  const opt = strategicOptions.find((o) => o.id === activeSOId);

  if (!opt) {
    return (
      <div className="py-7 px-8 bg-bg">
        <div className="text-sm text-muted">Strategic option not found.</div>
        <button onClick={() => setActiveScreen("future-models")} className="py-1.75 px-3 rounded-btn bg-transparent text-muted border-none text-xs cursor-pointer font-[inherit] mt-3">
          ← Future Models
        </button>
      </div>
    );
  }

  const projectScenarios = scenarios.filter((s) => s.project_id === activeProjectId);
  const scenarioById = (id) => projectScenarios.find((s) => s.id === id);

  const scenarioIds = Array.isArray(opt.scenario_ids) ? opt.scenario_ids : [];

  // Supported preferred futures: PFs whose scenario_ids overlap with this option's scenario_ids
  const optScenarioSet = new Set(scenarioIds);
  const supportedPFs = (preferredFutures || []).filter(
    (pf) => pf.project_id === activeProjectId &&
      Array.isArray(pf.scenario_ids) &&
      pf.scenario_ids.some((id) => optScenarioSet.has(id))
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
            onClick={() => openStrategicOptionEdit(activeSOId)}
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
            Strategic Option
            {opt.horizon && <HorizTag h={opt.horizon} />}
            {opt.feasibility && <FeasibilityBadge value={opt.feasibility} />}
          </div>

          {/* Title */}
          <div className="text-[22px] font-medium text-ink leading-[1.25] mb-3 tracking-[-0.01em] font-heading">
            {opt.name}
          </div>

          {/* Description */}
          {hasField(opt, "description") && (
            <div className="text-sm text-muted leading-[1.7] mb-7 max-w-[560px]">
              <RichTextField value={fieldDoc(opt, "description")} editable={false} />
            </div>
          )}

          {/* What this involves */}
          {hasField(opt, "actions") && (
            <div className="mb-7">
              <div className={sectionHeading}>What this involves</div>
              <div className={prose}><RichTextField value={fieldDoc(opt, "actions")} editable={false} /></div>
            </div>
          )}

          {/* Intended outcome */}
          {hasField(opt, "intended_outcome") && (
            <div className="mb-7">
              <div className={sectionHeading}>Intended outcome</div>
              <div className={prose}><RichTextField value={fieldDoc(opt, "intended_outcome")} editable={false} /></div>
            </div>
          )}

          {/* Implications — amber left border to signal trade-off */}
          {hasField(opt, "implications") && (
            <div className="mb-7">
              <div className={sectionHeading}>Implications</div>
              <div className={clsx(prose, "pl-3.5 border-l-[3px] border-l-amber-border")}>
                <RichTextField value={fieldDoc(opt, "implications")} editable={false} />
              </div>
            </div>
          )}

          {/* Dependencies */}
          {hasField(opt, "dependencies") && (
            <div className="mb-7">
              <div className={sectionHeading}>Dependencies</div>
              <div className={prose}><RichTextField value={fieldDoc(opt, "dependencies")} editable={false} /></div>
            </div>
          )}

          {/* Risks */}
          {hasField(opt, "risks") && (
            <div className="mb-7">
              <div className={sectionHeading}>Risks</div>
              <div className={prose}><RichTextField value={fieldDoc(opt, "risks")} editable={false} /></div>
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className="pt-9 px-5 border-l border-border flex flex-col gap-5">

          {/* Responds to */}
          {scenarioIds.length > 0 && (
            <div>
              <div className={sideLabel}>Responds to</div>
              <div className="flex flex-col gap-1">
                {scenarioIds.map((id) => {
                  const sc = scenarioById(id);
                  return (
                    <div
                      key={id}
                      onClick={() => sc && openScenario(id)}
                      className={clsx(
                        "flex items-center gap-1.75 py-1.5 px-2 bg-field-bg border border-border rounded-[6px] text-[11px]",
                        sc ? "text-muted cursor-pointer" : "text-hint cursor-default",
                      )}
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

          {/* Supports (preferred futures) */}
          {supportedPFs.length > 0 && (
            <div>
              <div className={sideLabel}>Supports</div>
              <div className="flex flex-col gap-1">
                {supportedPFs.map((pf) => (
                  <div
                    key={pf.id}
                    onClick={() => openPreferredFuture(pf.id)}
                    className="flex items-center gap-1.75 py-1.5 px-2 bg-field-bg border border-border rounded-[6px] text-[11px] text-muted cursor-pointer"
                  >
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {pf.name}
                    </span>
                    <span className="text-hint text-[11px]">→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Character */}
          <div>
            <div className={sideLabel}>Character</div>
            <div className="flex flex-col gap-2">
              {opt.horizon && (
                <div>
                  <div className="text-[10px] text-hint mb-0.75">Horizon</div>
                  <div className="flex items-center gap-1.5">
                    <HorizTag h={opt.horizon} />
                    <span className="text-[11px] text-hint">
                      {opt.horizon === "H1" && "Near-term"}
                      {opt.horizon === "H2" && "Mid-term"}
                      {opt.horizon === "H3" && "Long-term"}
                    </span>
                  </div>
                </div>
              )}
              {opt.feasibility && (
                <div>
                  <div className="text-[10px] text-hint mb-0.75">Feasibility</div>
                  <div className="flex items-center gap-1.5">
                    <FeasibilityBadge value={opt.feasibility} />
                    <span className="text-[11px] text-hint">
                      {opt.feasibility.toLowerCase() === "high"   && "Readily achievable now"}
                      {opt.feasibility.toLowerCase() === "medium" && "Achievable with effort"}
                      {opt.feasibility.toLowerCase() === "low"    && "Significant barriers exist"}
                    </span>
                  </div>
                </div>
              )}
              {opt.reversibility && (
                <div>
                  <div className="text-[10px] text-hint mb-0.75">Reversibility</div>
                  <div className="flex items-center gap-1.5">
                    <FeasibilityBadge value={opt.reversibility} />
                  </div>
                </div>
              )}
              {opt.resource_intensity && (
                <div>
                  <div className="text-[10px] text-hint mb-0.75">Resource Intensity</div>
                  <div className="flex items-center gap-1.5">
                    <ResourceIntensityBadge value={opt.resource_intensity} />
                  </div>
                </div>
              )}
              {!opt.horizon && !opt.feasibility && !opt.reversibility && !opt.resource_intensity && (
                <div className="text-[11px] text-hint">No structured fields set.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

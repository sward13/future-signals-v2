/**
 * StrategicOptionRead — read view for a single strategic option.
 * Two-column layout: main content + metadata sidebar.
 */
import { useState } from "react";
import { c, btnSec, btnG } from "../../styles/tokens.js";
import { HorizTag } from "../shared/Tag.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

// ─── Feasibility badge ────────────────────────────────────────────────────────

function FeasibilityBadge({ value }) {
  if (!value) return null;
  const map = {
    high:   [c.green700,  c.green50,  c.greenBorder],
    medium: [c.amber700,  c.amber50,  c.amberBorder],
    low:    [c.red800,    c.red50,    c.redBorder],
  };
  const key = value.toLowerCase();
  const [col, bg, brd] = map[key] || [c.hint, c.surfaceAlt, c.border];
  const label = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 10,
      background: bg, color: col, border: `1px solid ${brd}`,
    }}>
      {label}
    </span>
  );
}

// ─── Main read view ───────────────────────────────────────────────────────────

export default function StrategicOptionRead({ appState }) {
  const {
    strategicOptions, scenarios, preferredFutures,
    activeSOId, activeProjectId,
    openStrategicOptionEdit, deleteStrategicOption,
    openScenario, openPreferredFuture,
    setActiveScreen, showToast,
  } = appState;

  const [confirmDelete, setConfirmDelete] = useState(false);

  const opt = strategicOptions.find((o) => o.id === activeSOId);

  if (!opt) {
    return (
      <div style={{ padding: "28px 32px", background: c.bg }}>
        <div style={{ fontSize: 14, color: c.muted }}>Strategic option not found.</div>
        <button onClick={() => setActiveScreen("future-models")} style={{ ...btnG, marginTop: 12 }}>
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

  const handleDelete = () => {
    deleteStrategicOption(activeSOId);
    showToast("Strategic option deleted");
    setActiveScreen("future-models");
  };

  const sideLabel = {
    fontSize: 10, fontWeight: 500, color: c.hint,
    letterSpacing: "0.07em", textTransform: "uppercase",
    marginBottom: 8,
  };

  const sectionHeading = {
    fontSize: 10, fontWeight: 500, color: c.hint,
    letterSpacing: "0.07em", textTransform: "uppercase",
    marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${c.border}`,
  };

  const prose = { fontSize: 13, color: c.muted, lineHeight: 1.75, whiteSpace: "pre-wrap" };

  return (
    <>
      <div style={{ background: c.bg, minHeight: "100%" }}>

        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 24px",
          background: c.white, borderBottom: `1px solid ${c.border}`,
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <button
            onClick={() => setActiveScreen("future-models")}
            style={{ ...btnG, fontSize: 12, padding: "5px 0", color: c.muted }}
          >
            ← Future Models
          </button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ ...btnG, fontSize: 12, color: c.hint }}
            >
              Delete
            </button>
            <button
              onClick={() => openStrategicOptionEdit(activeSOId)}
              style={{ ...btnSec, fontSize: 12, padding: "6px 16px" }}
            >
              Edit
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 280px",
          maxWidth: 1000, margin: "0 auto", padding: "0 0 80px",
        }}>

          {/* ── Main content ──────────────────────────────────── */}
          <div style={{ padding: "36px 36px 0" }}>

            {/* Eyebrow */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 10, fontWeight: 500, color: c.hint,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 10,
            }}>
              Strategic Option
              {opt.horizon && <HorizTag h={opt.horizon} />}
              {opt.feasibility && <FeasibilityBadge value={opt.feasibility} />}
            </div>

            {/* Title */}
            <div style={{
              fontSize: 22, fontWeight: 500, color: c.ink,
              lineHeight: 1.25, marginBottom: 12, letterSpacing: "-0.01em",
            }}>
              {opt.name}
            </div>

            {/* Description */}
            {opt.description && (
              <div style={{
                fontSize: 14, color: c.muted, lineHeight: 1.7,
                marginBottom: 28, maxWidth: 560,
              }}>
                {opt.description}
              </div>
            )}

            {/* What this involves */}
            {opt.actions && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>What this involves</div>
                <div style={prose}>{opt.actions}</div>
              </div>
            )}

            {/* Intended outcome */}
            {opt.intended_outcome && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>Intended outcome</div>
                <div style={prose}>{opt.intended_outcome}</div>
              </div>
            )}

            {/* Implications — amber left border to signal trade-off */}
            {opt.implications && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>Implications</div>
                <div style={{
                  ...prose,
                  paddingLeft: 14,
                  borderLeft: `3px solid ${c.amberBorder}`,
                }}>
                  {opt.implications}
                </div>
              </div>
            )}

            {/* Dependencies */}
            {opt.dependencies && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>Dependencies</div>
                <div style={prose}>{opt.dependencies}</div>
              </div>
            )}

            {/* Risks */}
            {opt.risks && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>Risks</div>
                <div style={prose}>{opt.risks}</div>
              </div>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────── */}
          <div style={{
            padding: "36px 20px 0",
            borderLeft: `1px solid ${c.border}`,
            display: "flex", flexDirection: "column", gap: 20,
          }}>

            {/* Responds to */}
            {scenarioIds.length > 0 && (
              <div>
                <div style={sideLabel}>Responds to</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {scenarioIds.map((id) => {
                    const sc = scenarioById(id);
                    return (
                      <div
                        key={id}
                        onClick={() => sc && openScenario(id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "6px 8px", background: c.fieldBg,
                          border: `1px solid ${c.border}`, borderRadius: 6,
                          fontSize: 11, color: sc ? c.muted : c.hint,
                          cursor: sc ? "pointer" : "default",
                        }}
                      >
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sc?.name || id}
                        </span>
                        {sc && <span style={{ color: c.hint, fontSize: 11 }}>→</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Supports (preferred futures) */}
            {supportedPFs.length > 0 && (
              <div>
                <div style={sideLabel}>Supports</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {supportedPFs.map((pf) => (
                    <div
                      key={pf.id}
                      onClick={() => openPreferredFuture(pf.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "6px 8px", background: c.fieldBg,
                        border: `1px solid ${c.border}`, borderRadius: 6,
                        fontSize: 11, color: c.muted, cursor: "pointer",
                      }}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pf.name}
                      </span>
                      <span style={{ color: c.hint, fontSize: 11 }}>→</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Character */}
            <div>
              <div style={sideLabel}>Character</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {opt.horizon && (
                  <div>
                    <div style={{ fontSize: 10, color: c.hint, marginBottom: 3 }}>Horizon</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <HorizTag h={opt.horizon} />
                      <span style={{ fontSize: 11, color: c.hint }}>
                        {opt.horizon === "H1" && "Near-term"}
                        {opt.horizon === "H2" && "Mid-term"}
                        {opt.horizon === "H3" && "Long-term"}
                      </span>
                    </div>
                  </div>
                )}
                {opt.feasibility && (
                  <div>
                    <div style={{ fontSize: 10, color: c.hint, marginBottom: 3 }}>Feasibility</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <FeasibilityBadge value={opt.feasibility} />
                      <span style={{ fontSize: 11, color: c.hint }}>
                        {opt.feasibility.toLowerCase() === "high"   && "Readily achievable now"}
                        {opt.feasibility.toLowerCase() === "medium" && "Achievable with effort"}
                        {opt.feasibility.toLowerCase() === "low"    && "Significant barriers exist"}
                      </span>
                    </div>
                  </div>
                )}
                {!opt.horizon && !opt.feasibility && (
                  <div style={{ fontSize: 11, color: c.hint }}>No structured fields set.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete strategic option"
          message={`"${opt.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete option"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

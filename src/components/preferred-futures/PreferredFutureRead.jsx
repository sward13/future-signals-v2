/**
 * PreferredFutureRead — read view for a single preferred future.
 * Two-column layout: main content + metadata sidebar.
 */
import { useState } from "react";
import { c, btnSec, btnG } from "../../styles/tokens.js";
import { HorizTag } from "../shared/Tag.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

export default function PreferredFutureRead({ appState }) {
  const {
    preferredFutures, scenarios, strategicOptions,
    activePFId, activeProjectId,
    openPreferredFutureEdit, deletePreferredFuture,
    openScenario, setActiveScreen, showToast,
  } = appState;

  const [confirmDelete, setConfirmDelete] = useState(false);

  const pf = preferredFutures.find((p) => p.id === activePFId);

  if (!pf) {
    return (
      <div style={{ padding: "28px 32px", background: c.bg }}>
        <div style={{ fontSize: 14, color: c.muted }}>Preferred future not found.</div>
        <button onClick={() => setActiveScreen("future-models")} style={{ ...btnG, marginTop: 12 }}>
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

  const handleDelete = () => {
    deletePreferredFuture(activePFId);
    showToast("Preferred future deleted");
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
              onClick={() => openPreferredFutureEdit(activePFId)}
              style={{ ...btnSec, fontSize: 12, padding: "6px 16px" }}
            >
              Edit
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", maxWidth: 1000, margin: "0 auto", padding: "0 0 80px" }}>

          {/* ── Main content ──────────────────────────────────── */}
          <div style={{ padding: "36px 36px 0" }}>

            {/* Gradient accent bar */}
            <div style={{
              height: 3, borderRadius: 2, marginBottom: 24,
              background: "linear-gradient(to right, rgba(59,109,17,0.3), rgba(24,95,165,0.3), rgba(133,79,11,0.3))",
            }} />

            {/* Eyebrow */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 10, fontWeight: 500, color: c.hint,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 10,
            }}>
              Preferred Future
              {pf.horizon && <HorizTag h={pf.horizon} />}
            </div>

            {/* Title */}
            <div style={{
              fontSize: 26, fontWeight: 500, color: c.ink,
              lineHeight: 1.2, marginBottom: 12, letterSpacing: "-0.01em",
            }}>
              {pf.name}
            </div>

            {/* Description */}
            {pf.description && (
              <div style={{
                fontSize: 14, color: c.muted, lineHeight: 1.7,
                marginBottom: 28, maxWidth: 560,
              }}>
                {pf.description}
              </div>
            )}

            {/* Desired outcomes */}
            {pf.desired_outcomes && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>Desired outcomes</div>
                <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                  {pf.desired_outcomes}
                </div>
              </div>
            )}

            {/* Guiding principles */}
            {principles.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>Guiding principles</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {principles.map((p, i) => (
                    <div key={i} style={{
                      padding: "9px 14px",
                      background: c.fieldBg,
                      border: `1px solid ${c.border}`,
                      borderLeft: `3px solid ${c.green700}`,
                      borderRadius: 7,
                      fontSize: 13, color: c.muted, lineHeight: 1.5,
                    }}>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategic priorities */}
            {priorities.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>Strategic priorities</div>
                <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  {priorities.map((p, i) => (
                    <li key={i} style={{ fontSize: 13, color: c.muted, lineHeight: 1.5 }}>
                      {p}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Indicators of progress */}
            {inds.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeading}>Indicators of progress</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {inds.map((ind, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      fontSize: 13, color: c.muted, lineHeight: 1.5,
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: c.green700, flexShrink: 0, marginTop: 4,
                      }} />
                      {ind}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────── */}
          <div style={{
            padding: "36px 20px 0",
            borderLeft: `1px solid ${c.border}`,
            display: "flex", flexDirection: "column", gap: 20,
          }}>

            {/* Informed by scenarios */}
            {scenarioIds.length > 0 && (
              <div>
                <div style={sideLabel}>Informed by</div>
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

            {/* Connected options */}
            {connectedOptions.length > 0 && (
              <div>
                <div style={sideLabel}>Connected options</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {connectedOptions.map((opt) => (
                    <div key={opt.id} style={{
                      padding: "6px 8px", background: c.fieldBg,
                      border: `1px solid ${c.border}`, borderRadius: 6,
                      fontSize: 11, color: c.muted,
                    }}>
                      {opt.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Horizon */}
            {pf.horizon && (
              <div>
                <div style={sideLabel}>Horizon</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <HorizTag h={pf.horizon} />
                  <div style={{ fontSize: 11, color: c.hint, marginTop: 4, lineHeight: 1.5 }}>
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

      {confirmDelete && (
        <ConfirmDialog
          title="Delete preferred future"
          message={`"${pf.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete preferred future"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

/**
 * ScenarioRead — read view for a single scenario.
 * Two-column layout: main content + metadata sidebar.
 */
import { useState } from "react";
import { c, btnSec, btnG } from "../../styles/tokens.js";
import { HorizTag, ArchTag } from "../shared/Tag.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

export default function ScenarioRead({ appState }) {
  const {
    scenarios, clusters, preferredFutures, strategicOptions,
    activeScenarioId, activeProjectId,
    openScenarioEdit, openClusterDetail, deleteScenario,
    openPreferredFuture, openStrategicOption,
    setActiveScreen, showToast,
  } = appState;

  const [confirmDelete, setConfirmDelete] = useState(false);

  const scenario = scenarios.find((s) => s.id === activeScenarioId);

  if (!scenario) {
    return (
      <div style={{ padding: "28px 32px", background: c.bg }}>
        <div style={{ fontSize: 14, color: c.muted }}>Scenario not found.</div>
        <button onClick={() => setActiveScreen("future-models")} style={{ ...btnG, marginTop: 12 }}>
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

  const handleDelete = () => {
    deleteScenario(activeScenarioId);
    showToast("Scenario deleted");
    setActiveScreen("future-models");
  };

  const sideLabel = {
    fontSize: 10, fontWeight: 500, color: c.hint,
    letterSpacing: "0.07em", textTransform: "uppercase",
    marginBottom: 8,
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
              onClick={() => openScenarioEdit(activeScenarioId)}
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

            {/* Eyebrow */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 10, fontWeight: 500, color: c.hint,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 10,
            }}>
              Scenario
              {scenario.horizon && <HorizTag h={scenario.horizon} />}
              {scenario.archetype && <ArchTag arch={scenario.archetype} />}
            </div>

            {/* Title */}
            <div style={{
              fontSize: 26, fontWeight: 500, color: c.ink,
              lineHeight: 1.2, marginBottom: 12, letterSpacing: "-0.01em",
            }}>
              {scenario.name}
            </div>

            {/* Description */}
            {scenario.description && (
              <div style={{
                fontSize: 14, color: c.muted, lineHeight: 1.7,
                marginBottom: 28, maxWidth: 560,
              }}>
                {scenario.description}
              </div>
            )}

            {/* Key differences */}
            {diffs.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 10, fontWeight: 500, color: c.hint,
                  letterSpacing: "0.07em", textTransform: "uppercase",
                  marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${c.border}`,
                }}>
                  Key differences from today
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {diffs.map((diff, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                      padding: "9px 12px",
                      background: c.fieldBg, border: `1px solid ${c.border}`,
                      borderRadius: 7,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: c.hint, minWidth: 16, paddingTop: 1 }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, color: c.muted, lineHeight: 1.5 }}>
                        {diff}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Narrative */}
            {scenario.narrative && (
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 10, fontWeight: 500, color: c.hint,
                  letterSpacing: "0.07em", textTransform: "uppercase",
                  marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${c.border}`,
                }}>
                  Narrative
                </div>
                <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                  {scenario.narrative}
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

            {/* Driving forces */}
            {driving.length > 0 && (
              <div>
                <div style={sideLabel}>Driving forces</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {driving.map((id) => {
                    const cl = clusterById(id);
                    return (
                      <div
                        key={id}
                        onClick={() => cl && openClusterDetail(id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "6px 8px", background: c.fieldBg,
                          border: `1px solid ${c.border}`, borderRadius: 6,
                          fontSize: 11, color: cl ? c.muted : c.hint,
                          cursor: cl ? "pointer" : "default",
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.green700, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cl?.name || id}
                        </span>
                        {cl && <span style={{ color: c.hint, fontSize: 11 }}>→</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suppressed forces */}
            {suppressed.length > 0 && (
              <div>
                <div style={sideLabel}>Suppressed forces</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {suppressed.map((id) => {
                    const cl = clusterById(id);
                    return (
                      <div
                        key={id}
                        onClick={() => cl && openClusterDetail(id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "6px 8px", background: c.fieldBg,
                          border: `1px solid ${c.border}`, borderRadius: 6,
                          fontSize: 11, color: cl ? c.muted : c.hint,
                          cursor: cl ? "pointer" : "default",
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.hint, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cl?.name || id}
                        </span>
                        {cl && <span style={{ color: c.hint, fontSize: 11 }}>→</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Appears in */}
            {(appearingPFs.length > 0 || appearingOpts.length > 0) && (
              <div>
                <div style={sideLabel}>Appears in</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {appearingPFs.map((pf) => (
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
                      <span style={{ fontSize: 10, color: c.hint, flexShrink: 0 }}>Preferred future →</span>
                    </div>
                  ))}
                  {appearingOpts.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => openStrategicOption(opt.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "6px 8px", background: c.fieldBg,
                        border: `1px solid ${c.border}`, borderRadius: 6,
                        fontSize: 11, color: c.muted, cursor: "pointer",
                      }}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opt.name}
                      </span>
                      <span style={{ fontSize: 10, color: c.hint, flexShrink: 0 }}>Option →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div>
              <div style={sideLabel}>Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {scenario.horizon && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: c.hint, minWidth: 64 }}>Horizon</span>
                    <HorizTag h={scenario.horizon} />
                  </div>
                )}
                {scenario.archetype && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: c.hint, minWidth: 64 }}>Archetype</span>
                    <ArchTag arch={scenario.archetype} />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete scenario"
          message={`"${scenario.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete scenario"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

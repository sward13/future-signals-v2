import { useState } from "react";
import { c } from "../../styles/tokens.js";

/**
 * ClustersPanel — right-hand panel of the Inputs workspace.
 * Hosts Manual/Suggested mode toggle, list/card view toggle, and
 * (in later steps) the cluster list, drop zone, detail panel, and
 * suggestion cards.
 *
 * @param {{ onNewCluster: () => void }} props
 */
export function ClustersPanel({ onNewCluster }) {
  const [mode, setMode] = useState("manual"); // "manual" | "suggested"
  const [view, setView] = useState("list");   // "list" | "card"

  return (
    <div style={{
      width: 320,
      minWidth: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: c.surfaceAlt,
      borderLeft: `1px solid ${c.border}`,
    }}>

      {/* ── Panel header ─────────────────────────────────── */}
      <div style={{ background: c.white, borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>

        {/* Row 1: label + new cluster button */}
        <div style={{ display: "flex", alignItems: "center", padding: "11px 14px 8px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.ink }}>Clusters</span>
          <button
            onClick={onNewCluster}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 500,
              padding: "5px 11px",
              borderRadius: 6,
              border: "1px solid #BFDBFE",
              background: "#EFF6FF",
              color: c.brand,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            + New cluster
          </button>
        </div>

        {/* Row 2: mode toggle (left) + view toggle (right, hidden in Suggested) */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px 10px" }}>

          {/* Mode toggle */}
          <div style={{
            display: "flex",
            border: `1px solid ${c.border}`,
            borderRadius: 6,
            overflow: "hidden",
          }}>
            {[
              { key: "manual",    label: "Manual" },
              { key: "suggested", label: "Suggested" },
            ].map(({ key, label }, i) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                style={{
                  padding: "4px 11px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  border: "none",
                  borderRight: i === 0 ? `1px solid ${c.border}` : "none",
                  background: mode === key ? c.brand : c.white,
                  color: mode === key ? c.white : c.muted,
                  transition: "background 0.1s, color 0.1s",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle — hidden in Suggested mode */}
          {mode === "manual" && (
            <div style={{
              marginLeft: "auto",
              display: "flex",
              border: `1px solid ${c.border}`,
              borderRadius: 6,
              overflow: "hidden",
            }}>
              {[
                { key: "list", icon: "☰" },
                { key: "card", icon: "⊞" },
              ].map(({ key, icon }, i) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  style={{
                    width: 28,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    border: "none",
                    borderRight: i === 0 ? `1px solid ${c.border}` : "none",
                    background: view === key ? c.brand : c.white,
                    color: view === key ? c.white : c.muted,
                    transition: "background 0.1s, color 0.1s",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel body — placeholder until step 4/7 ──────── */}
      <div style={{ flex: 1, padding: 16 }}>
        {mode === "manual" ? (
          <div style={{ fontSize: 12, color: c.hint }}>Cluster list coming in step 4</div>
        ) : (
          <div style={{ fontSize: 12, color: c.hint }}>Suggested mode coming in step 7</div>
        )}
      </div>

    </div>
  );
}

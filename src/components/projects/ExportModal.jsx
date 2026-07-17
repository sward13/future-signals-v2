/**
 * ExportModal — project-level export with four options:
 *   1. Future Models & Clusters → Markdown file
 *   2. Inputs → CSV file
 *   3. System Map (SVG) → vector canvas export
 *   4. System Map (PNG) → raster canvas export
 *
 * Text exports are generated client-side via Blob + URL.createObjectURL.
 * The Markdown builder lives in ./buildMarkdown.js (pure, testable). Canvas
 * exports delegate to capture functions registered by CanvasArea via
 * appState.systemMapExportRef.
 */
import { useState } from "react";
import { c, btnSec, btnG } from "../../styles/tokens.js";
import { buildMarkdown } from "./buildMarkdown.js";

// ─── CSV builder ─────────────────────────────────────────────────────────────

function buildCSV(inputs, project) {
  const projectInputs = inputs.filter((i) => i.project_id === project.id);

  const esc = (val) => {
    if (val == null || val === "") return "";
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  // Externally-sourced free text (scanner RSS titles, user-entered fields) can
  // start with =, +, -, or @, which Excel/Sheets execute as a formula. Prefix
  // those with a leading apostrophe so they're treated as text, then escape as
  // usual. Enum/date columns can't begin with these characters and use esc().
  const escText = (val) => {
    if (val == null || val === "") return "";
    const s = String(val);
    return esc(/^[=+\-@]/.test(s) ? `'${s}` : s);
  };

  const headers = ["Name", "Subtype", "Description", "Source URL", "STEEPLED", "Horizon", "Signal Strength", "Source Confidence", "Date Added"];

  const rows = projectInputs.map((inp) => [
    escText(inp.name),
    esc(inp.subtype),
    escText(inp.description),
    escText(inp.source_url),
    esc(Array.isArray(inp.steepled) ? inp.steepled.join(", ") : ""),
    esc(inp.horizon),
    esc(inp.signal_strength),
    esc(inp.source_confidence),
    esc(inp.created_at ? new Date(inp.created_at).toLocaleDateString() : ""),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// ─── Download helper ──────────────────────────────────────────────────────────

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Option card ─────────────────────────────────────────────────────────────

function OptionCard({ title, subtitle, checked, disabled, onClick }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      title={disabled ? "Open the System Map to export" : undefined}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "14px 16px",
        border: `1px solid ${checked && !disabled ? c.ink : c.border}`,
        borderRadius: 8,
        background: checked && !disabled ? "rgba(0,0,0,0.02)" : c.white,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "border-color 0.12s, opacity 0.12s",
      }}
    >
      {/* Checkbox */}
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
        border: `2px solid ${checked && !disabled ? c.ink : c.hint}`,
        background: checked && !disabled ? c.ink : "transparent",
        transition: "background 0.1s, border-color 0.1s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {checked && !disabled && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 3 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.45 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ExportModal({ appState, onClose }) {
  const { projects, activeProjectId, activeScreen, inputs, clusters, scenarios, preferredFutures, strategicOptions, relationships, systemMapExportRef } = appState;
  const [checked, setChecked] = useState({ md: true, csv: false, png: false });
  const [exporting, setExporting] = useState(false);

  const project = projects.find((p) => p.id === activeProjectId);
  const onSystemMap = activeScreen === "scenarios";
  const anyChecked = checked.md || checked.csv || (onSystemMap && checked.png);

  const toggle = (key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleExport = async () => {
    if (!project || !anyChecked || exporting) return;
    setExporting(true);

    try {
      if (checked.md) {
        const content  = buildMarkdown(project, clusters, inputs, scenarios, preferredFutures, strategicOptions, relationships);
        const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}.md`;
        downloadBlob(content, filename, "text/markdown;charset=utf-8");
      }
      if (checked.csv) {
        const content  = buildCSV(inputs, project);
        const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}_inputs.csv`;
        downloadBlob(content, filename, "text/csv;charset=utf-8");
      }
      if (onSystemMap && checked.png) {
        await systemMapExportRef?.current?.exportAsPng();
      }
      onClose();
    } catch (err) {
      console.error("[ExportModal] export failed:", err);
      setExporting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: c.white,
          borderRadius: 12,
          width: 440,
          boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 20px 16px",
          borderBottom: `1px solid ${c.border}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: c.ink }}>Export project</div>
          {project && (
            <div style={{ fontSize: 11, color: c.hint, marginTop: 3 }}>{project.name}</div>
          )}
        </div>

        {/* Options */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <OptionCard
            title="Future Models & Clusters"
            subtitle="Markdown file with clusters, scenarios, preferred future, and strategic options"
            checked={checked.md}
            onClick={() => toggle("md")}
          />
          <OptionCard
            title="Inputs"
            subtitle="CSV of all project inputs with metadata"
            checked={checked.csv}
            onClick={() => toggle("csv")}
          />
          <OptionCard
            title="System Map (PNG)"
            subtitle="Raster export of the system map canvas"
            checked={checked.png}
            disabled={!onSystemMap}
            onClick={() => toggle("png")}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px 16px",
          borderTop: `1px solid ${c.border}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={{ ...btnG, fontSize: 12 }}>Cancel</button>
          <button
            onClick={handleExport}
            disabled={!project || !anyChecked || exporting}
            style={{
              ...btnSec, fontSize: 12, padding: "7px 18px",
              opacity: (!project || !anyChecked || exporting) ? 0.5 : 1,
              cursor: (!project || !anyChecked || exporting) ? "not-allowed" : "pointer",
            }}
          >
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

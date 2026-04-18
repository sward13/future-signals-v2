/**
 * ExportModal — project-level export with two options:
 *   1. Future Models & Clusters → Markdown file
 *   2. Inputs → CSV file
 *
 * Generates files entirely client-side via Blob + URL.createObjectURL.
 * Uses data already loaded in appState — no additional fetches needed.
 */
import { useState } from "react";
import { c, btnSec, btnG } from "../../styles/tokens.js";

// ─── Markdown builder ─────────────────────────────────────────────────────────

function buildMarkdown(project, clusters, inputs, scenarios, preferredFutures, strategicOptions) {
  const lines = [];
  const nl = () => lines.push("");

  const projectClusters  = clusters.filter((cl) => cl.project_id === project.id);
  const projectScenarios = scenarios.filter((s)  => s.project_id  === project.id);
  const projectPFs       = (preferredFutures  || []).filter((pf) => pf.project_id === project.id);
  const projectOptions   = (strategicOptions  || []).filter((o)  => o.project_id  === project.id);

  const clusterName = (id) => projectClusters.find((cl) => cl.id === id)?.name || null;

  // Title
  lines.push(`# ${project.name}`);
  if (project.question?.trim()) lines.push(project.question.trim());
  nl();

  // ── Clusters ────────────────────────────────────────────────────────────────
  if (projectClusters.length > 0) {
    lines.push("## Clusters");
    nl();
    for (const cl of projectClusters) {
      lines.push(`### ${cl.name}`);
      const meta = [
        cl.subtype  ? `**Type:** ${cl.subtype}`   : null,
        cl.horizon  ? `**Horizon:** ${cl.horizon}` : null,
      ].filter(Boolean);
      if (meta.length) lines.push(meta.join(" | "));
      if (cl.description?.trim()) lines.push(cl.description.trim());
      const clusterInputs = inputs.filter(
        (i) => Array.isArray(cl.input_ids) && cl.input_ids.includes(i.id)
      );
      if (clusterInputs.length > 0) {
        lines.push(`**Inputs:** ${clusterInputs.map((i) => i.name).join(", ")}`);
      }
      nl();
    }
  }

  // ── Scenarios ────────────────────────────────────────────────────────────────
  if (projectScenarios.length > 0) {
    lines.push("## Scenarios");
    nl();
    for (const sc of projectScenarios) {
      lines.push(`### ${sc.name}`);
      const meta = [
        sc.horizon   ? `**Horizon:** ${sc.horizon}`     : null,
        sc.archetype ? `**Archetype:** ${sc.archetype}` : null,
      ].filter(Boolean);
      if (meta.length) lines.push(meta.join(" | "));
      if (sc.description?.trim()) lines.push(sc.description.trim());
      const diffs = (Array.isArray(sc.key_differences) ? sc.key_differences : []).filter(Boolean);
      if (diffs.length > 0) {
        lines.push("**Key differences:**");
        diffs.forEach((d) => lines.push(`- ${d}`));
      }
      if (sc.narrative?.trim()) lines.push(sc.narrative.trim());
      const drivingNames = (Array.isArray(sc.driving_forces) ? sc.driving_forces : [])
        .map(clusterName).filter(Boolean);
      if (drivingNames.length > 0) {
        lines.push(`**Driving forces:** ${drivingNames.join(", ")}`);
      }
      nl();
    }
  }

  // ── Preferred Future ─────────────────────────────────────────────────────────
  if (projectPFs.length > 0) {
    lines.push("## Preferred Future");
    nl();
    for (const pf of projectPFs) {
      lines.push(`### ${pf.name}`);
      if (pf.horizon) lines.push(`**Horizon:** ${pf.horizon}`);
      if (pf.description?.trim()) lines.push(pf.description.trim());
      if (pf.desired_outcomes?.trim()) lines.push(`**Desired outcomes:** ${pf.desired_outcomes.trim()}`);
      const principles = (Array.isArray(pf.guiding_principles) ? pf.guiding_principles : []).filter(Boolean);
      if (principles.length > 0) {
        lines.push("**Guiding principles:**");
        principles.forEach((p) => lines.push(`- ${p}`));
      }
      const priorities = (Array.isArray(pf.strategic_priorities) ? pf.strategic_priorities : []).filter(Boolean);
      if (priorities.length > 0) {
        lines.push("**Strategic priorities:**");
        priorities.forEach((p) => lines.push(`- ${p}`));
      }
      const inds = (Array.isArray(pf.indicators) ? pf.indicators : []).filter(Boolean);
      if (inds.length > 0) {
        lines.push("**Indicators of progress:**");
        inds.forEach((ind) => lines.push(`- ${ind}`));
      }
      nl();
    }
  }

  // ── Strategic Options ─────────────────────────────────────────────────────────
  if (projectOptions.length > 0) {
    lines.push("## Strategic Options");
    nl();
    for (const opt of projectOptions) {
      lines.push(`### ${opt.name}`);
      const meta = [
        opt.horizon     ? `**Horizon:** ${opt.horizon}`         : null,
        opt.feasibility ? `**Feasibility:** ${opt.feasibility}` : null,
      ].filter(Boolean);
      if (meta.length) lines.push(meta.join(" | "));
      if (opt.description?.trim())      lines.push(opt.description.trim());
      if (opt.intended_outcome?.trim()) lines.push(`**Intended outcome:** ${opt.intended_outcome.trim()}`);
      if (opt.actions?.trim())          lines.push(`**What this involves:** ${opt.actions.trim()}`);
      if (opt.implications?.trim())     lines.push(`**Implications:** ${opt.implications.trim()}`);
      nl();
    }
  }

  return lines.join("\n");
}

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

  const headers = ["Name", "Subtype", "Description", "Source URL", "STEEPLED", "Horizon", "Signal Quality", "Date Added"];

  const rows = projectInputs.map((inp) => [
    esc(inp.name),
    esc(inp.subtype),
    esc(inp.description),
    esc(inp.source_url),
    esc(Array.isArray(inp.steepled) ? inp.steepled.join(", ") : ""),
    esc(inp.horizon),
    esc(inp.signal_quality),
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

function OptionCard({ title, subtitle, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "14px 16px",
        border: `1px solid ${selected ? c.ink : c.border}`,
        borderRadius: 8,
        background: selected ? "rgba(0,0,0,0.02)" : c.white,
        cursor: "pointer",
        transition: "border-color 0.12s",
      }}
    >
      {/* Radio circle */}
      <div style={{
        width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
        border: `2px solid ${selected ? c.ink : c.hint}`,
        background: selected ? c.ink : "transparent",
        transition: "background 0.1s, border-color 0.1s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && (
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.white }} />
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
  const { projects, activeProjectId, inputs, clusters, scenarios, preferredFutures, strategicOptions } = appState;
  const [selected, setSelected] = useState("md");

  const project = projects.find((p) => p.id === activeProjectId);

  const handleExport = () => {
    if (!project) return;

    if (selected === "md") {
      const content  = buildMarkdown(project, clusters, inputs, scenarios, preferredFutures, strategicOptions);
      const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}.md`;
      downloadBlob(content, filename, "text/markdown;charset=utf-8");
    } else {
      const content  = buildCSV(inputs, project);
      const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}_inputs.csv`;
      downloadBlob(content, filename, "text/csv;charset=utf-8");
    }

    onClose();
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
            selected={selected === "md"}
            onClick={() => setSelected("md")}
          />
          <OptionCard
            title="Inputs"
            subtitle="CSV of all project inputs with metadata"
            selected={selected === "csv"}
            onClick={() => setSelected("csv")}
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
            disabled={!project}
            style={{ ...btnSec, fontSize: 12, padding: "7px 18px", opacity: project ? 1 : 0.5 }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

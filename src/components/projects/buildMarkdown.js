// Markdown builder for project Report Export.
//
// Pure string assembly — no React, no DOM, no side effects — so it can be unit
// tested directly and reused server-side later. Consumed by ExportModal.jsx.
//
// ID → name resolution is delegated to the shared reference-resolution layer
// (server-lib/resolve-references.js) rather than a local helper, so Report
// Export and a future Publish pipeline resolve references identically.
//
// Note on shapes: this builder is fed already-mapped app-state rows. Clusters
// and scenarios carry snake_case fields (cl.project_id, sc.driving_forces), but
// relationships are mapped to camelCase in useAppState (rel.projectId,
// rel.fromClusterId, rel.toClusterId). resolveRelationship expects DB column
// names, so relationship rows are adapted to that shape at the call site below.

import {
  buildClusterLookup,
  resolveRelationship,
  resolveDrivingForces,
} from "../../../server-lib/resolve-references.js";
import { docToMarkdown, docIsEmpty } from "../../lib/richtextDoc.js";

export function buildMarkdown(
  project,
  clusters,
  inputs,
  scenarios,
  preferredFutures,
  strategicOptions,
  relationships,
) {
  const lines = [];
  const nl = () => lines.push("");

  const projectClusters  = clusters.filter((cl) => cl.project_id === project.id);
  const projectScenarios = scenarios.filter((s)  => s.project_id  === project.id);
  const projectPFs       = (preferredFutures  || []).filter((pf) => pf.project_id === project.id);
  const projectOptions   = (strategicOptions  || []).filter((o)  => o.project_id  === project.id);
  const projectRels      = (relationships     || []).filter((r)  => r.projectId   === project.id);

  const clusterLookup = buildClusterLookup(projectClusters);

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

  // ── Relationships ─────────────────────────────────────────────────────────────
  // Placed after Clusters and before Scenarios, matching the methodology's build
  // order: Clusters → System Map relationships → Future Models.
  if (projectRels.length > 0) {
    lines.push("## Relationships");
    nl();
    for (const rel of projectRels) {
      const { sentence } = resolveRelationship(
        {
          from_cluster_id: rel.fromClusterId,
          to_cluster_id: rel.toClusterId,
          type: rel.type,
        },
        clusterLookup,
      );
      lines.push(`- ${sentence}`);
    }
    nl();
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
      // Narrative is the rich-text PoC field: JSON doc → Markdown, else legacy text.
      if (!docIsEmpty(sc.narrative_doc)) lines.push(docToMarkdown(sc.narrative_doc));
      else if (sc.narrative?.trim()) lines.push(sc.narrative.trim());
      const drivingNames = resolveDrivingForces(sc, clusterLookup);
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

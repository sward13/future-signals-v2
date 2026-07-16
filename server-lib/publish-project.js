// Publish pipeline — turn a project into a live, hosted static page.
//
// Fetches a project's full data server-side (service-role, DB/snake_case shapes),
// assembles one static HTML document from the shared publish renderers, uploads
// it to the `published-projects` Storage bucket at `{slug}/index.html`, and only
// then marks the project_publications row `published`.
//
// Convention mirrors server-lib/clone-project.js: service-role, no client
// session. The Supabase client is injectable (`opts.supabase`) so this is unit
// testable; it defaults to an env-configured service client for the script path.
//
// No section-picker UI exists yet — this is whole-project publish. sections_included
// records a fixed "everything" descriptor so the column isn't dead, but no
// curation logic reads it yet.

import { createClient } from "@supabase/supabase-js";

import {
  buildClusterLookup,
  buildScenarioLookup,
} from "./resolve-references.js";
import {
  renderHero,
  renderOverview,
  renderSystemAnalysis,
  renderScenario,
  renderPreferredFuture,
  renderStrategicOption,
  renderAppendix,
  esc,
} from "../src/publish/sections.js";
import { renderSystemMap } from "../src/publish/systemMap.js";

const BUCKET = "published-projects";

// The fixed "everything" selection stored on the publication row. Shape is
// self-describing so a future section-picker can diff against it.
export const ALL_SECTIONS = [
  "hero",
  "overview",
  "system_map",
  "system_analysis",
  "scenarios",
  "preferred_futures",
  "strategic_options",
  "appendix",
];
const SECTIONS_INCLUDED = { mode: "all", sections: ALL_SECTIONS };

// ─── Slug ───────────────────────────────────────────────────────────────────────

function slugify(name) {
  const base = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "project";
}

/** A slug not already taken by another publication row (slug is globally unique). */
async function uniqueSlug(supabase, name) {
  const base = slugify(name);
  let candidate = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("project_publications")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw new Error(`Slug lookup failed: ${error.message}`);
    if (!data) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ─── Data fetch ─────────────────────────────────────────────────────────────────

async function selectByProject(supabase, table, projectId) {
  const { data, error } = await supabase.from(table).select("*").eq("project_id", projectId);
  if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
  return data || [];
}

async function fetchProjectData(supabase, projectId) {
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (projectErr || !project) {
    throw new Error(`Project ${projectId} not found${projectErr ? `: ${projectErr.message}` : ""}`);
  }

  const [
    clusters,
    inputs,
    relationships,
    canvasNodes,
    canvasTextNodes,
    scenarios,
    preferredFutures,
    strategicOptions,
    analyses,
  ] = await Promise.all([
    selectByProject(supabase, "clusters", projectId),
    selectByProject(supabase, "inputs", projectId),
    selectByProject(supabase, "relationships", projectId),
    selectByProject(supabase, "canvas_nodes", projectId),
    selectByProject(supabase, "canvas_text_nodes", projectId),
    selectByProject(supabase, "scenarios", projectId),
    selectByProject(supabase, "preferred_futures", projectId),
    selectByProject(supabase, "strategic_options", projectId),
    selectByProject(supabase, "analyses", projectId),
  ]);

  // cluster_inputs is NOT project-scoped (columns: cluster_id, input_id,
  // workspace_id) — fetch it by this project's cluster ids, like clone-project.js.
  let clusterInputs = [];
  const clusterIds = clusters.map((cl) => cl.id);
  if (clusterIds.length > 0) {
    const { data, error } = await supabase
      .from("cluster_inputs")
      .select("*")
      .in("cluster_id", clusterIds);
    if (error) throw new Error(`Failed to load cluster_inputs: ${error.message}`);
    clusterInputs = data || [];
  }

  // clusters carry no input_ids column — derive it from the cluster_inputs join
  // so the Appendix renderer can list each cluster's linked inputs.
  const byCluster = new Map();
  for (const ci of clusterInputs) {
    if (!byCluster.has(ci.cluster_id)) byCluster.set(ci.cluster_id, []);
    byCluster.get(ci.cluster_id).push(ci.input_id);
  }
  for (const cl of clusters) cl.input_ids = byCluster.get(cl.id) || [];

  return {
    project,
    clusters,
    inputs,
    relationships,
    canvasNodes,
    canvasTextNodes,
    scenarios,
    preferredFutures,
    strategicOptions,
    analysis: analyses[0] || null,
  };
}

// ─── HTML assembly ──────────────────────────────────────────────────────────────

export function assembleHtml(data, { publishedAt } = {}) {
  const {
    project,
    clusters,
    inputs,
    relationships,
    canvasNodes,
    canvasTextNodes,
    scenarios,
    preferredFutures,
    strategicOptions,
    analysis,
  } = data;

  const clusterLookup = buildClusterLookup(clusters);
  const scenarioLookup = buildScenarioLookup(scenarios);

  const body = [
    renderHero(project, { publishedAt }),
    renderOverview(project),
    renderSystemMap(canvasNodes, canvasTextNodes, relationships, clusterLookup),
    renderSystemAnalysis(analysis),
    ...scenarios.map((s) => renderScenario(s, clusterLookup)),
    ...preferredFutures.map((pf) => renderPreferredFuture(pf, scenarioLookup)),
    ...strategicOptions.map((o) => renderStrategicOption(o, scenarioLookup)),
    renderAppendix(clusters, inputs),
    `<div style="padding:24px 32px 48px; text-align:center; border-top:1px solid #E0DED7;">
      <span style="font-size:12px; color:#9A988F;">Powered by Future Signals</span>
    </div>`,
  ]
    .filter(Boolean)
    .join("\n");

  const title = esc(project?.name || "Future Signals project");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Future Signals</title>
</head>
<body style="margin:0; padding:0; background:#EDEBE6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#17171A;">
  <div style="border:1px solid #E0DED7; border-radius:12px; overflow:hidden; max-width:900px; margin:24px auto; background:#FFFFFF;">
${body}
  </div>
</body>
</html>`;
}

// ─── Publish ────────────────────────────────────────────────────────────────────

function defaultClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to publish");
  }
  return createClient(url, key);
}

/**
 * Publish (or republish) a project to a hosted static page.
 *
 * @param {string} projectId
 * @param {{ supabase?: object, now?: string }} [opts]
 * @returns {Promise<{ slug, storagePath, publicUrl, status, isRepublish }>}
 */
export async function publishProject(projectId, opts = {}) {
  if (!projectId) throw new Error("projectId is required");
  const supabase = opts.supabase || defaultClient();
  const now = opts.now || new Date().toISOString();

  const data = await fetchProjectData(supabase, projectId);

  // Reuse the existing publication row's slug (stable link across republishes),
  // or mint a new unique one and insert an unpublished row.
  const { data: existing, error: existingErr } = await supabase
    .from("project_publications")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existingErr) throw new Error(`Publication lookup failed: ${existingErr.message}`);

  const isRepublish = Boolean(existing);
  const slug = existing?.slug || (await uniqueSlug(supabase, data.project.name));
  const storagePath = `${slug}/index.html`;

  if (!existing) {
    const { error: insertErr } = await supabase.from("project_publications").insert({
      workspace_id: data.project.workspace_id,
      project_id: projectId,
      slug,
      sections_included: SECTIONS_INCLUDED,
      status: "unpublished", // stays unpublished until the file actually exists
    });
    if (insertErr) throw new Error(`Failed to create publication row: ${insertErr.message}`);
  }

  // Assemble and upload. The public link never changes across republishes because
  // the slug (and therefore the path) is stable; upsert overwrites in place.
  const html = assembleHtml(data, { publishedAt: now });
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, html, { contentType: "text/html; charset=utf-8", upsert: true });
  if (uploadErr) {
    // Do NOT mark published — the file may not exist. The row stays in whatever
    // state it was (unpublished on first attempt; previously-published content,
    // if any, is still live and untouched on a failed republish).
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  // Upload succeeded → mark published. First successful publish sets published_at;
  // subsequent ones set republished_at (keyed on whether published_at is already
  // set, so a prior failed first-publish that left an unpublished row still counts
  // as the first real publish).
  const patch = {
    status: "published",
    storage_path: storagePath,
    sections_included: SECTIONS_INCLUDED,
  };
  if (existing?.published_at) patch.republished_at = now;
  else patch.published_at = now;

  const { error: updateErr } = await supabase
    .from("project_publications")
    .update(patch)
    .eq("project_id", projectId);
  if (updateErr) throw new Error(`Failed to finalize publication: ${updateErr.message}`);

  // The public link points at the app's serving route (/p/{slug}), NOT the raw
  // Supabase Storage URL: Supabase serves user-uploaded HTML as text/plain (an
  // anti-abuse measure), so the object must be served through the app to render.
  const appBase = (process.env.APP_URL || "").replace(/\/$/, "");
  const publicUrl = appBase ? `${appBase}/p/${slug}` : `/p/${slug}`;

  return { slug, storagePath, publicUrl, status: "published", isRepublish };
}

/**
 * Take a published project offline.
 *
 * The bucket is fully public, so the object is reachable by anyone with the link
 * regardless of the DB flag — flipping status alone would NOT take the page down.
 * So this removes the storage object FIRST, then sets status = 'unpublished'. The
 * row and its slug are kept so a later republish produces the same link.
 *
 * @param {string} projectId
 * @param {{ supabase?: object }} [opts]
 * @returns {Promise<{ status: 'unpublished', slug: string|null }>}
 */
export async function unpublishProject(projectId, opts = {}) {
  if (!projectId) throw new Error("projectId is required");
  const supabase = opts.supabase || defaultClient();

  const { data: row, error: rowErr } = await supabase
    .from("project_publications")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (rowErr) throw new Error(`Publication lookup failed: ${rowErr.message}`);
  if (!row) return { status: "unpublished", slug: null }; // never published — nothing to do

  // Take it offline first: remove the public object before touching the flag.
  const { error: rmErr } = await supabase.storage
    .from(BUCKET)
    .remove([`${row.slug}/index.html`]);
  if (rmErr) throw new Error(`Failed to remove published file: ${rmErr.message}`);

  const { error: upErr } = await supabase
    .from("project_publications")
    .update({ status: "unpublished" })
    .eq("project_id", projectId);
  if (upErr) throw new Error(`Failed to update publication status: ${upErr.message}`);

  return { status: "unpublished", slug: row.slug };
}

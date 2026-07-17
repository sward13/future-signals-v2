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

// ─── Section selection ────────────────────────────────────────────────────────
// Canonical shape persisted to `sections_included`, consumed by the pipeline on
// republish, and read back by the UI to pre-populate a picker. Overview + Appendix
// are never optional (always assembled). For each Future Models sub-type,
// `ids: null` means "all of that type"; an array means exactly those items.
const ALL_SELECTION = {
  version: 1,
  overview: true,
  systemMap: true,
  systemAnalysis: true,
  futureModels: {
    enabled: true,
    scenarios: { enabled: true, ids: null },
    preferredFutures: { enabled: true, ids: null },
    strategicOptions: { enabled: true, ids: null },
  },
  appendix: true,
};

function normalizeSubType(x) {
  const s = x || {};
  return { enabled: !!s.enabled, ids: Array.isArray(s.ids) ? [...s.ids] : null };
}

/**
 * Normalize a caller-supplied selection into the canonical stored shape.
 * `null`/`undefined` → include everything (the one-click whole-project path;
 * keeps `scripts/publish-project.js` a full publish). Idempotent, so the stored
 * value round-trips through GET → picker → republish unchanged.
 * @param {object|null|undefined} selection
 * @returns {object}
 */
export function normalizeSelection(selection) {
  if (selection == null) return structuredClone(ALL_SELECTION);
  const fm = selection.futureModels || {};
  return {
    version: 1,
    overview: true,
    systemMap: !!selection.systemMap,
    systemAnalysis: !!selection.systemAnalysis,
    futureModels: {
      enabled: !!fm.enabled,
      scenarios: normalizeSubType(fm.scenarios),
      preferredFutures: normalizeSubType(fm.preferredFutures),
      strategicOptions: normalizeSubType(fm.strategicOptions),
    },
    appendix: true,
  };
}

// Scenarios must be fetched whenever the Scenarios section is on OR a Preferred
// Future / Strategic Option is on (their driving-force / "responds to" refs
// resolve against the scenario lookup).
function needsScenarios(sel) {
  const fm = sel.futureModels;
  return fm.enabled && (fm.scenarios.enabled || fm.preferredFutures.enabled || fm.strategicOptions.enabled);
}

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

async function fetchProjectData(supabase, projectId, sel) {
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (projectErr || !project) {
    throw new Error(`Project ${projectId} not found${projectErr ? `: ${projectErr.message}` : ""}`);
  }

  const fm = sel.futureModels;
  const wantScenarios = needsScenarios(sel);

  // Only fetch what's selected — excluded sections do no fetching or resolution.
  // clusters/inputs are always fetched: they power the always-on Appendix and the
  // clusterLookup that System Map + Scenarios reuse. Overview needs only `project`.
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
    sel.systemMap ? selectByProject(supabase, "relationships", projectId) : [],
    sel.systemMap ? selectByProject(supabase, "canvas_nodes", projectId) : [],
    sel.systemMap ? selectByProject(supabase, "canvas_text_nodes", projectId) : [],
    wantScenarios ? selectByProject(supabase, "scenarios", projectId) : [],
    fm.enabled && fm.preferredFutures.enabled ? selectByProject(supabase, "preferred_futures", projectId) : [],
    fm.enabled && fm.strategicOptions.enabled ? selectByProject(supabase, "strategic_options", projectId) : [],
    sel.systemAnalysis ? selectByProject(supabase, "analyses", projectId) : [],
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

function truncate(value, max) {
  const t = String(value || "").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const FUTURE_MODELS_HEADING = `<div style="padding:48px 32px 16px; text-align:center;">
      <p style="font-size:11px; letter-spacing:0.14em; color:#9A988F; text-transform:uppercase; margin:0;">Future Models</p>
    </div>`;
const FOOTER = `<div style="padding:24px 32px 48px; text-align:center; border-top:1px solid #E0DED7;">
      <span style="font-size:12px; color:#9A988F;">Powered by Future Signals</span>
    </div>`;

// ids null → all items; array → only those (by id).
function pickByIds(items, ids) {
  if (!Array.isArray(items)) return [];
  if (ids == null) return items;
  const set = new Set(ids);
  return items.filter((i) => set.has(i.id));
}

export function assembleHtml(data, { publishedAt, publicUrl, selection } = {}) {
  const sel = normalizeSelection(selection); // undefined → everything
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
  const scenarioLookup = buildScenarioLookup(scenarios); // scenarios may be [] when not selected

  // Hero + Overview always; then the optional sections in reading order.
  const parts = [
    renderHero(project, { publishedAt }),
    renderOverview(project),
    sel.systemMap ? renderSystemMap(canvasNodes, canvasTextNodes, relationships, clusterLookup) : "",
    sel.systemAnalysis ? renderSystemAnalysis(analysis) : "",
  ];

  // Future Models group: heading whenever the group is on (even if its
  // sub-sections end up empty — a valid state), then each selected sub-type.
  const fm = sel.futureModels;
  if (fm.enabled) {
    parts.push(FUTURE_MODELS_HEADING);
    if (fm.scenarios.enabled) {
      for (const s of pickByIds(scenarios, fm.scenarios.ids)) parts.push(renderScenario(s, clusterLookup));
    }
    if (fm.preferredFutures.enabled) {
      for (const pf of pickByIds(preferredFutures, fm.preferredFutures.ids)) parts.push(renderPreferredFuture(pf, scenarioLookup));
    }
    if (fm.strategicOptions.enabled) {
      for (const o of pickByIds(strategicOptions, fm.strategicOptions.ids)) parts.push(renderStrategicOption(o, scenarioLookup));
    }
  }

  parts.push(renderAppendix(clusters, inputs)); // always
  parts.push(FOOTER);

  const body = parts.filter(Boolean).join("\n");

  const title = esc(project?.name || "Future Signals project");

  // Open Graph tags so a shared /p/{slug} link renders a preview card on social
  // platforms (a stated purpose of Publish). No og:image this pass — that would
  // mean generating/choosing an image; the other tags must not block on it.
  const ogTitle = esc(project?.name || "Future Signals project");
  const ogDescription = esc(truncate(project?.question || project?.focus || "", 200));
  const og = [
    `<meta property="og:title" content="${ogTitle}">`,
    ogDescription ? `<meta property="og:description" content="${ogDescription}">` : "",
    `<meta property="og:type" content="website">`,
    publicUrl ? `<meta property="og:url" content="${esc(publicUrl)}">` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Future Signals</title>
${og}
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
 * @param {{ supabase?: object, now?: string, selection?: object|null }} [opts]
 *   selection: which sections to include (see normalizeSelection). Omitted/null
 *   publishes the whole project.
 * @returns {Promise<{ slug, storagePath, publicUrl, status, isRepublish, sectionsIncluded }>}
 */
export async function publishProject(projectId, opts = {}) {
  if (!projectId) throw new Error("projectId is required");
  const supabase = opts.supabase || defaultClient();
  const now = opts.now || new Date().toISOString();
  const sel = normalizeSelection(opts.selection);

  const data = await fetchProjectData(supabase, projectId, sel);

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

  // The public link points at the app's serving route (/p/{slug}), NOT the raw
  // Supabase Storage URL: Supabase serves user-uploaded HTML as text/plain (an
  // anti-abuse measure), so the object must be served through the app to render.
  // Built here so it can also feed the page's og:url meta tag.
  const appBase = (process.env.APP_URL || "").replace(/\/$/, "");
  const publicUrl = appBase ? `${appBase}/p/${slug}` : `/p/${slug}`;

  if (!existing) {
    const { error: insertErr } = await supabase.from("project_publications").insert({
      workspace_id: data.project.workspace_id,
      project_id: projectId,
      slug,
      sections_included: sel,
      status: "unpublished", // stays unpublished until the file actually exists
    });
    if (insertErr) throw new Error(`Failed to create publication row: ${insertErr.message}`);
  }

  // Assemble and upload. The public link never changes across republishes because
  // the slug (and therefore the path) is stable; upsert overwrites in place.
  const html = assembleHtml(data, { publishedAt: now, publicUrl, selection: sel });
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
    sections_included: sel,
  };
  if (existing?.published_at) patch.republished_at = now;
  else patch.published_at = now;

  const { error: updateErr } = await supabase
    .from("project_publications")
    .update(patch)
    .eq("project_id", projectId);
  if (updateErr) throw new Error(`Failed to finalize publication: ${updateErr.message}`);

  return { slug, storagePath, publicUrl, status: "published", isRepublish, sectionsIncluded: sel };
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

// Request handler for the Publish/Unpublish API endpoint.
//
// Lives in server-lib (not api/) so it can be unit tested without the test file
// itself being counted as a Vercel serverless function. api/publish.js is a thin
// wrapper that injects a real service-role client into createPublishHandler().
//
// One route, both actions (to stay under the Vercel function cap):
//   GET  /api/publish?projectId=…            → current publish status
//   POST /api/publish { projectId, action }  → action = 'publish' | 'unpublish'
//
// Auth follows the existing client-callable convention (api/seed-onboarding.js):
// Bearer token → auth.getUser → derive the caller's workspace → confirm the
// project belongs to it (existence + ownership in one query; 404 otherwise).

import { createHash } from "node:crypto";

import { publishProject, unpublishProject } from "./publish-project.js";

const BUCKET = "published-projects";

// Storage origin for the CSP img-src exception below (see serveView) —
// derived from SUPABASE_URL so it's scoped to whichever Supabase project
// this deployment actually talks to (staging vs. production each have their
// own). Read lazily per-call, not at module load — matching the existing
// convention in publish-project.js — since ESM import hoisting means a
// module-top-level read can run before a caller (e.g. a test file) has set
// the env var. Falls back to omitting img-src entirely if SUPABASE_URL is
// unset — nothing served through serveView() should reach that state in
// practice (publishing itself requires SUPABASE_URL), so this is a safety
// net, not an expected path.
function storageOrigin() {
  try { return new URL(process.env.SUPABASE_URL).origin; } catch { return null; }
}

// Weak content validator for conditional requests on the served page.
function weakEtag(html) {
  return `W/"${createHash("sha1").update(html).digest("base64url").slice(0, 24)}"`;
}

// Absolute /p/{slug} link, built from the request host so it's correct for the
// exact deployment the caller is on (preview vs. production).
function viewUrl(req, slug) {
  if (!slug) return null;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? `${proto}://${host}/p/${slug}` : `/p/${slug}`;
}

// Public, unauthenticated page serving (reached via the /p/:slug rewrite →
// /api/publish?view={slug}). Uses the injected service-role client to bypass
// project_publications' RLS (workspace_id = get_workspace_id()): the published
// page is public by design, and an anonymous viewer has no workspace, so the
// policy would otherwise return zero rows. Supabase serves the stored HTML as
// text/plain, so we fetch it server-side and re-serve it as text/html.
async function serveView(supabase, req, res) {
  // HEAD returns the same status + headers as GET with no body — link-unfurlers
  // (Slack/X/LinkedIn/iMessage) often probe with HEAD before or instead of GET.
  const isHead = req.method === "HEAD";
  const slug = req.query.view;
  const notFound = () =>
    isHead ? res.status(404).end() : res.status(404).send("This page isn’t available.");

  try {
    const { data: row, error } = await supabase
      .from("project_publications")
      .select("slug, storage_path, status")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.status !== "published") return notFound();

    const path = row.storage_path || `${row.slug}/index.html`;
    const { data: file, error: dlError } = await supabase.storage.from(BUCKET).download(path);
    if (dlError || !file) return notFound();
    const html = typeof file.text === "function" ? await file.text() : String(file);

    const etag = weakEtag(html);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Content-Security-Policy: the published page executes NO script and loads
    // NO external resources beyond the one exception below (audited: no
    // <script>, no analytics/embeds, no external CSS/fonts — system font
    // stack, inline SVG, and inline style attributes only). So default-src
    // 'none' denies everything by default and script can never run — a hard
    // backstop behind docToHtml's render-time filtering. The one
    // deliberately-loose directive is style-src 'unsafe-inline', required
    // because the page styles entirely via inline style="…" attributes; it
    // does not weaken script/XSS protection. img-src is scoped to this
    // deployment's Supabase Storage origin only — the System Map background
    // template layer (src/publish/systemMap.js) renders a real <image> tag
    // pointing at a public system-map-templates object, which default-src
    // 'none' would otherwise silently block. If any other external resource
    // (e.g. analytics) is ever added to the published page, this policy must
    // be revisited rather than silently widened further.
    const origin = storageOrigin();
    const imgSrc = origin ? ` img-src ${origin};` : "";
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; style-src 'unsafe-inline';${imgSrc} base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    // ALWAYS revalidate. A republish overwrites the object in place under the same
    // stable slug, so any edge/browser cache with a max-age would keep serving the
    // old page until it expired (the reported "republish doesn't show up" bug).
    // The ETag keeps unchanged repeat views cheap (a 304, no body).
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    if (isHead) {
      res.setHeader("Content-Length", String(new TextEncoder().encode(html).length));
      return res.status(200).end();
    }
    return res.status(200).send(html);
  } catch (err) {
    console.error("[publish view]", err);
    return isHead ? res.status(500).end() : res.status(500).send("Error loading page.");
  }
}

export function createPublishHandler({ supabase }) {
  return async function handler(req, res) {
    // Public serving branch — must run BEFORE the auth check (anonymous access).
    // Handles GET (full page) and HEAD (headers only) for the /p/{slug} route.
    if ((req.method === "GET" || req.method === "HEAD") && req.query?.view) {
      return serveView(supabase, req, res);
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorised" });
    }
    const token = authHeader.slice(7);

    const projectId = req.method === "GET" ? req.query?.projectId : req.body?.projectId;
    if (!projectId) return res.status(400).json({ error: "projectId is required" });

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      const user = authData?.user;
      if (authError || !user) return res.status(401).json({ error: "Unauthorised" });

      const { data: workspace, error: wsError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (wsError || !workspace) return res.status(401).json({ error: "Workspace not found" });

      // Existence + ownership in one query — a non-owner (or missing) project
      // yields no row and a 404, revealing nothing (matches seed-onboarding.js).
      const { data: project, error: projError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("workspace_id", workspace.id)
        .single();
      if (projError || !project) return res.status(404).json({ error: "Project not found" });

      if (req.method === "GET") {
        const { data: row, error: rowErr } = await supabase
          .from("project_publications")
          .select("*")
          .eq("project_id", projectId)
          .maybeSingle();
        if (rowErr) throw new Error(rowErr.message);
        const status = row?.status || "unpublished";
        return res.status(200).json({
          status,
          slug: row?.slug || null,
          publicUrl: status === "published" ? viewUrl(req, row?.slug) : null,
          publishedAt: row?.published_at || null,
          republishedAt: row?.republished_at || null,
          // The selection persisted at last publish, so a picker can pre-populate
          // without a second round-trip. null before the first publish.
          sectionsIncluded: row?.sections_included ?? null,
        });
      }

      const action = req.body?.action;
      if (action === "publish") {
        // `selection` is optional — omitted publishes the whole project.
        const result = await publishProject(projectId, { supabase, selection: req.body?.selection });
        return res.status(200).json({
          status: "published",
          slug: result.slug,
          publicUrl: viewUrl(req, result.slug),
          sectionsIncluded: result.sectionsIncluded,
        });
      }
      if (action === "unpublish") {
        const result = await unpublishProject(projectId, { supabase });
        return res.status(200).json({ status: "unpublished", slug: result.slug, publicUrl: null });
      }
      return res.status(400).json({ error: "Invalid action" });
    } catch (error) {
      console.error("[publish]", error);
      return res.status(500).json({ error: error.message });
    }
  };
}

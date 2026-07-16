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

import { publishProject, unpublishProject } from "./publish-project.js";

const BUCKET = "published-projects";

function publicUrlFor(slug) {
  const base = process.env.SUPABASE_URL;
  return base && slug ? `${base}/storage/v1/object/public/${BUCKET}/${slug}/index.html` : null;
}

export function createPublishHandler({ supabase }) {
  return async function handler(req, res) {
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
          publicUrl: status === "published" ? publicUrlFor(row?.slug) : null,
          publishedAt: row?.published_at || null,
          republishedAt: row?.republished_at || null,
        });
      }

      const action = req.body?.action;
      if (action === "publish") {
        const result = await publishProject(projectId, { supabase });
        return res.status(200).json({
          status: "published",
          slug: result.slug,
          publicUrl: result.publicUrl || publicUrlFor(result.slug),
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

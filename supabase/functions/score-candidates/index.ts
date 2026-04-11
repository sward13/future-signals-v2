/**
 * score-candidates — scores and promotes signal candidates to the Inbox.
 *
 * Before processing any project, checks:
 *   1. workspace_settings.scanning_enabled — if false, skip all projects in that workspace.
 *   2. projects.scanning_enabled           — if false, skip that specific project.
 *
 * Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── Fetch all projects with their workspace scanning flag ──────────────────
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        workspace_id,
        scanning_enabled,
        workspace_settings!inner ( scanning_enabled )
      `);

    if (projectsError) throw projectsError;
    if (!projects || projects.length === 0) {
      return respond({ processed: 0, skipped: 0 });
    }

    let processed = 0;
    let skipped = 0;

    for (const project of projects) {
      // Check workspace-level flag first
      const wsScanningEnabled = (project.workspace_settings as { scanning_enabled: boolean } | null)
        ?.scanning_enabled ?? true;

      if (!wsScanningEnabled) {
        skipped++;
        continue;
      }

      // Check project-level flag
      if (!project.scanning_enabled) {
        skipped++;
        continue;
      }

      // TODO: score and promote candidates for project.id
      // await scoreAndPromote(supabase, project.id, project.workspace_id);
      processed++;
    }

    return respond({ processed, skipped });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return respond({ error: message }, 500);
  }
});

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

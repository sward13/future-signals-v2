/**
 * embed-input — generates and stores an OpenAI embedding for a single input.
 * Also supports a batch mode (pass `batch: true` plus `project_id`) that
 * processes up to 50 of that project's inputs with null embeddings — used for
 * backfilling existing inputs. Both modes require a caller JWT and verify the
 * target belongs to the caller's workspace.
 *
 * Required env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Caller-ownership guard ───────────────────────────────────────────────────
// Invoked with the caller's session JWT (supabase.functions.invoke). Resolves
// the caller's workspace so the handler can verify the target resource belongs
// to it before running any service-role query. Returns null when the JWT is
// missing or invalid.
async function getCallerWorkspaceId(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return (workspace?.id as string | undefined) ?? null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

  try {
    const callerWorkspaceId = await getCallerWorkspaceId(req, supabase);
    if (!callerWorkspaceId) {
      return respond({ error: "Unauthorised" }, 401);
    }

    const body = await req.json();
    const { input_id, batch, project_id } = body;

    // ── Batch / backfill mode ──────────────────────────────────────────────────
    if (batch) {
      if (!project_id) {
        return respond({ error: "project_id required for batch mode" }, 400);
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, workspace_id")
        .eq("id", project_id)
        .single();

      if (projectError || !project) {
        return respond({ error: "Project not found" }, 404);
      }
      if (project.workspace_id !== callerWorkspaceId) {
        return respond({ error: "Forbidden" }, 403);
      }

      const { data: inputs, error } = await supabase
        .from("inputs")
        .select("id, name, description")
        .eq("project_id", project_id)
        .is("embedding", null)
        .limit(50);

      if (error) throw error;
      if (!inputs || inputs.length === 0) {
        return respond({ processed: 0 });
      }

      let processed = 0;
      for (const input of inputs) {
        await embedAndStore(supabase, openai, input);
        processed++;
      }
      return respond({ processed });
    }

    // ── Single input mode ──────────────────────────────────────────────────────
    if (!input_id) {
      return respond({ error: "input_id required" }, 400);
    }

    const { data: input, error } = await supabase
      .from("inputs")
      .select("id, name, description, workspace_id")
      .eq("id", input_id)
      .single();

    if (error || !input) {
      return respond({ error: "Input not found" }, 404);
    }
    if (input.workspace_id !== callerWorkspaceId) {
      return respond({ error: "Forbidden" }, 403);
    }

    await embedAndStore(supabase, openai, input);
    return respond({ ok: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return respond({ error: message }, 500);
  }
});

async function embedAndStore(
  supabase: ReturnType<typeof createClient>,
  openai: OpenAI,
  input: { id: string; name: string; description: string | null },
) {
  const text = [input.name, input.description].filter(Boolean).join(". ");
  if (!text.trim()) return;

  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  const embedding = res.data[0].embedding;

  const { error } = await supabase
    .from("inputs")
    .update({ embedding })
    .eq("id", input.id);

  if (error) throw error;
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

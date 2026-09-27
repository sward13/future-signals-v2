/**
 * detect-cluster-overlaps — "Find duplicates" for existing clusters (v2 Phase B).
 *
 * Embeds every cluster's name+description in a project and returns the most-similar
 * pairs, ranked, for the practitioner to review and merge/dismiss. Session-authed
 * (invoked with the caller's JWT); verifies the project belongs to the caller's
 * workspace before running any service-role query.
 *
 * Required env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// Pure ranking logic — shared with node:test (server-lib/clusterOverlap.test.js).
import { rankClusterOverlaps } from "../../../server-lib/clusterOverlap.js";

const OPENAI_EMBED_URL   = "https://api.openai.com/v1/embeddings";
const OPENAI_EMBED_MODEL = "text-embedding-3-small";
const FLOOR = 0.55;   // modest — surface candidates; the human is the real filter
const LIMIT = 20;     // ranked, capped

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getCallerWorkspaceId(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  const { data: workspace } = await supabase
    .from("workspaces").select("id").eq("user_id", user.id).single();
  return (workspace?.id as string | undefined) ?? null;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.data as Array<{ index: number; embedding: number[] }>)
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const callerWorkspaceId = await getCallerWorkspaceId(req, supabase);
    if (!callerWorkspaceId) return respond({ error: "Unauthorised" }, 401);

    const { project_id } = await req.json() as { project_id?: string };
    if (!project_id) return respond({ error: "project_id required" }, 400);

    const { data: project, error: projectError } = await supabase
      .from("projects").select("id, workspace_id").eq("id", project_id).single();
    if (projectError) throw projectError;
    if (!project) return respond({ error: "Project not found" }, 404);
    if (project.workspace_id !== callerWorkspaceId) return respond({ error: "Forbidden" }, 403);

    const { data: clusters, error: clustersError } = await supabase
      .from("clusters")
      .select("id, name, description, subtype, horizon")
      .eq("project_id", project_id);
    if (clustersError) throw clustersError;

    if (!clusters || clusters.length < 2) return respond({ pairs: [] });

    const texts = clusters.map((c) => `${c.name ?? ""}. ${c.description ?? ""}`.trim());
    const embeddings = await embedTexts(texts);

    const ranked = rankClusterOverlaps(embeddings, { floor: FLOOR, limit: LIMIT });
    const pairs = ranked.map(({ i, j, similarity }) => ({
      similarity: Number(similarity.toFixed(3)),
      a: { id: clusters[i].id, name: clusters[i].name, subtype: clusters[i].subtype, horizon: clusters[i].horizon },
      b: { id: clusters[j].id, name: clusters[j].name, subtype: clusters[j].subtype, horizon: clusters[j].horizon },
    }));

    return respond({ pairs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[detect-cluster-overlaps] 500:", message);
    return respond({ error: message }, 500);
  }
});

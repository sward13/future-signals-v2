/**
 * generate-cluster-suggestions — clusters a project's inputs using pgvector
 * similarity (computed in Postgres) then names each group with GPT-4o-mini.
 *
 * Algorithm: agglomerative single-linkage clustering via union-find.
 * Similarity pairs are found by the find_similar_input_pairs() Postgres RPC,
 * which uses the ivfflat index — no vector math runs in this function.
 * Threshold: cosine similarity >= 0.72 (SIMILARITY_THRESHOLD).
 * Minimum group size: 2 inputs (OQ-CLUS-02).
 *
 * Required env vars:
 *   OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const SIMILARITY_THRESHOLD = 0.72;

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
  const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

  try {
    const { project_id, workspace_id } = await req.json();
    if (!project_id || !workspace_id) {
      return respond({ error: "project_id and workspace_id required" }, 400);
    }

    // ── Step 1: Fetch project inputs (text only — no embeddings) ──────────────
    const { data: inputs, error: fetchError } = await supabase
      .from("inputs")
      .select("id, name, description")
      .eq("project_id", project_id)
      .not("embedding", "is", null);

    if (fetchError) throw fetchError;

    if (!inputs || inputs.length < 3) {
      return respond({ suggestions: [], reason: "not_enough_inputs" });
    }

    // ── Step 2: Find similar pairs via pgvector in Postgres ───────────────────
    const { data: pairs, error: pairsError } = await supabase.rpc(
      "find_similar_input_pairs",
      { p_project_id: project_id, p_threshold: SIMILARITY_THRESHOLD },
    );

    if (pairsError) throw pairsError;

    // ── Step 3: Union-find clustering on the pairs ────────────────────────────
    const groups = clusterFromPairs(
      inputs.map((i) => i.id),
      (pairs ?? []) as { id_a: string; id_b: string }[],
    );

    if (groups.length === 0) {
      await deletePendingSuggestions(supabase, project_id);
      return respond({ suggestions: [], reason: "no_clusters" });
    }

    // ── Step 4: Name each cluster with GPT-4o-mini ────────────────────────────
    const namedGroups = await Promise.all(
      groups.map(async (inputIds) => {
        const groupInputs = inputs.filter((i) => inputIds.includes(i.id));
        const { name, rationale } = await nameCluster(openai, groupInputs);
        return { name, rationale, input_ids: inputIds };
      }),
    );

    // ── Step 5: Replace pending suggestions ───────────────────────────────────
    await deletePendingSuggestions(supabase, project_id);

    const rows = namedGroups.map((g) => ({
      project_id,
      workspace_id,
      name: g.name,
      rationale: g.rationale,
      input_ids: g.input_ids,
      status: "pending",
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("cluster_suggestions")
      .insert(rows)
      .select();

    if (insertError) throw insertError;

    return respond({ suggestions: inserted ?? [] });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return respond({ error: message }, 500);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function deletePendingSuggestions(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
) {
  const { error } = await supabase
    .from("cluster_suggestions")
    .delete()
    .eq("project_id", projectId)
    .eq("status", "pending");
  if (error) throw error;
}

/**
 * Union-find clustering from a pre-computed list of similar pairs.
 * Returns arrays of input IDs per group (minimum 2 members).
 */
function clusterFromPairs(
  allIds: string[],
  pairs: { id_a: string; id_b: string }[],
): string[][] {
  const index = new Map(allIds.map((id, i) => [id, i]));
  const parent = Array.from({ length: allIds.length }, (_, i) => i);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  for (const { id_a, id_b } of pairs) {
    const a = index.get(id_a);
    const b = index.get(id_b);
    if (a !== undefined && b !== undefined) {
      parent[find(a)] = find(b);
    }
  }

  const groups = new Map<number, string[]>();
  for (let i = 0; i < allIds.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(allIds[i]);
  }

  // Minimum 2 inputs per group (OQ-CLUS-02)
  return Array.from(groups.values()).filter((g) => g.length >= 2);
}

async function nameCluster(
  openai: OpenAI,
  inputs: { name: string; description: string | null }[],
): Promise<{ name: string; rationale: string }> {
  const inputList = inputs
    .map((i) => `- ${i.name}${i.description ? ": " + i.description : ""}`)
    .join("\n");

  const msg = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `You are a strategic foresight analyst helping to organise research inputs into thematic clusters.

The following inputs have been grouped together based on semantic similarity:

${inputList}

Propose a concise cluster name (4–7 words) and a one-sentence rationale explaining what these inputs have in common and why they belong together as a strategic cluster.

Respond in JSON only:
{"name": "...", "rationale": "..."}`,
      },
    ],
  });

  try {
    const text = msg.choices[0].message.content?.trim() ?? "";
    return JSON.parse(text);
  } catch {
    return { name: "Thematic Cluster", rationale: "These inputs share a common strategic theme." };
  }
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * find-related-inputs — finds project inputs related to a cluster and classifies
 * each as 'likely', 'possible', or 'challenges' via OpenAI gpt-4o-mini.
 *
 * Accepts: { cluster_id: string, project_id: string }
 * Returns: { likely: Result[], possible: Result[], challenges: Result[] }
 *   where Result = { input_id, title, category, rationale }
 *
 * Required env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SIMILARITY_THRESHOLD = 0.55;
const MAX_PER_CATEGORY     = 5;
const OPENAI_API_URL       = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL         = "gpt-4o-mini";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EmbeddedInput = {
  id: string;
  name: string;
  description: string | null;
  embedding: number[];
};

type Result = {
  input_id: string;
  title: string;
  category: "likely" | "possible" | "challenges";
  rationale: string;
};

type Grouped = { likely: Result[]; possible: Result[]; challenges: Result[] };

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { cluster_id, project_id } = await req.json() as {
      cluster_id: string;
      project_id: string;
    };

    if (!cluster_id) return respond({ error: "cluster_id required" }, 400);
    if (!project_id) return respond({ error: "project_id required" }, 400);

    // ── 1. Verify cluster belongs to the project ───────────────────────────────
    const { data: cluster, error: clusterError } = await supabase
      .from("clusters")
      .select("id, name, description")
      .eq("id", cluster_id)
      .eq("project_id", project_id)
      .single();

    if (clusterError || !cluster) return respond({ error: "Cluster not found" }, 404);

    // ── 2. Fetch cluster member input IDs via cluster_inputs ───────────────────
    const { data: memberRows, error: memberError } = await supabase
      .from("cluster_inputs")
      .select("input_id")
      .eq("cluster_id", cluster_id);

    if (memberError) throw memberError;

    const linkedInputIds = new Set((memberRows ?? []).map((r) => r.input_id));

    // ── 3. Fetch all project inputs (filter embeddings in TS) ──────────────────
    const { data: rawInputs, error: inputsError } = await supabase
      .from("inputs")
      .select("id, name, description, embedding")
      .eq("project_id", project_id);

    if (inputsError) throw inputsError;

    const allInputs: EmbeddedInput[] = (rawInputs ?? [])
      .filter((i) => i.embedding !== null && i.embedding !== undefined)
      .map((i) => ({
        id:          i.id,
        name:        i.name,
        description: i.description,
        embedding:   typeof i.embedding === "string"
          ? JSON.parse(i.embedding)
          : (i.embedding as number[]),
      }));

    if (allInputs.length === 0) {
      return respond({ error: "No inputs with embeddings found in this project." }, 400);
    }

    // ── 4. Split into members and candidates ───────────────────────────────────
    const memberInputs    = allInputs.filter((i) =>  linkedInputIds.has(i.id));
    const candidateInputs = allInputs.filter((i) => !linkedInputIds.has(i.id));

    if (memberInputs.length === 0) {
      return respond({ error: "No linked inputs with embeddings — add inputs to this cluster first." }, 400);
    }
    if (candidateInputs.length === 0) {
      return respond<Grouped>({ likely: [], possible: [], challenges: [] });
    }

    // ── 5. Compute cluster centroid ────────────────────────────────────────────
    const centroid = computeCentroid(memberInputs.map((i) => i.embedding));

    // ── 6. Score and filter candidates ────────────────────────────────────────
    const scored = candidateInputs
      .map((i) => ({ ...i, similarity: cosineSim(i.embedding, centroid) }))
      .filter((i) => i.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);

    if (scored.length === 0) {
      return respond<Grouped>({ likely: [], possible: [], challenges: [] });
    }

    // ── 7. Single OpenAI call for all candidates ───────────────────────────────
    const memberNameList = memberInputs.map((i) => `- ${i.name}`).join("\n");
    const candidateBlock = scored
      .map((i) => `ID: ${i.id}\nTitle: ${i.name}\nDescription: ${i.description ?? "No description"}`)
      .join("\n\n");

    const prompt =
`You are helping a strategic foresight practitioner explore a cluster of signals.

CLUSTER: ${cluster.name}
CLUSTER DESCRIPTION: ${cluster.description ?? "No description"}
CLUSTER INPUTS:
${memberNameList}

CANDIDATE INPUTS (evaluate each one):
${candidateBlock}

For each candidate, classify its relationship to this cluster as exactly one of:
- 'likely': strongly supports or directly extends the cluster's pattern
- 'possible': partially aligns, is ambiguous, or extends the cluster in a new direction
- 'challenges': pushes against, complicates, or introduces tension into the pattern

Important: Be permissive with 'challenges' classifications. A false positive challenge (something that turns out to fit) is less costly than a missed challenge (a genuine blind spot). Include challenges even at moderate confidence.

Return JSON only with no preamble:
{
  "results": [
    {
      "input_id": "uuid",
      "category": "likely" | "possible" | "challenges",
      "rationale": "one sentence explaining why this input has this relationship to the cluster"
    }
  ]
}`;

    const aiResult = await callOpenAI(prompt) as {
      results: Array<{ input_id: string; category: string; rationale: string }>;
    };

    // ── 8. Group results by category, cap at MAX_PER_CATEGORY ─────────────────
    const grouped: Grouped = { likely: [], possible: [], challenges: [] };
    const inputById = new Map(scored.map((i) => [i.id, i]));

    for (const r of (aiResult.results ?? [])) {
      const cat = r.category as keyof Grouped;
      if (!grouped[cat]) continue;
      if (grouped[cat].length >= MAX_PER_CATEGORY) continue;
      const input = inputById.get(r.input_id);
      if (!input) continue;
      grouped[cat].push({
        input_id: r.input_id,
        title:    input.name,
        category: cat,
        rationale: r.rationale ?? "",
      });
    }

    return respond(grouped);

  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : String(err);
    return respond({ error: message }, 500);
  }
});

// ─── OpenAI helper ────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string): Promise<unknown> {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model:      OPENAI_MODEL,
      max_tokens: 2048,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const raw  = (data.choices[0].message.content as string).trim();
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(json);
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function computeCentroid(embeddings: number[][]): number[] {
  const dim      = embeddings[0].length;
  const centroid = new Array<number>(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) centroid[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= embeddings.length;
  return centroid;
}

// ─── Respond helper ───────────────────────────────────────────────────────────

function respond<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * generate-cluster-suggestions — AI-powered clustering for project inputs.
 *
 * Steps:
 *   1. Fetch project context + inputs with embeddings
 *   2. Average-linkage agglomerative clustering (Deno/TS — no external libs)
 *   3. LLM interpretation via Anthropic claude-haiku (main clusters)
 *   4. Weak signal review for unassigned inputs (second Anthropic call)
 *   5. Write results to cluster_suggestions table
 *
 * Required env vars: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SIMILARITY_THRESHOLD = 0.72;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Input = {
  id: string;
  name: string;
  description: string | null;
  embedding: number[];
};

type ClusterGroup = {
  ids: string[];
  avgSim: number;
};

type Suggestion = {
  name: string;
  description: string;
  subtype: "trend" | "driver" | "tension";
  input_ids: string[];
  generative_note: string;
  avg_similarity: number | null;
  is_weak_signal: boolean;
};

type Project = {
  workspace_id: string;
  question: string | null;
  focus: string | null;
  h1_start: string | null;
  h1_end: string | null;
  h2_start: string | null;
  h2_end: string | null;
  h3_start: string | null;
  h3_end: string | null;
};

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
    const { project_id, threshold: thresholdParam, min_cluster_size: minSizeParam } = await req.json();
    if (!project_id) {
      return respond({ error: "project_id required" }, 400);
    }
    const threshold = typeof thresholdParam === "number" ? thresholdParam : SIMILARITY_THRESHOLD;
    const minClusterSize = typeof minSizeParam === "number" ? minSizeParam : 2;

    // ── Step 1: Fetch project context and inputs ───────────────────────────────
    const [{ data: project, error: projectError }, { data: rawInputs, error: inputsError }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("workspace_id, question, focus, h1_start, h1_end, h2_start, h2_end, h3_start, h3_end")
          .eq("id", project_id)
          .single(),
        supabase
          .from("inputs")
          .select("id, name, description, embedding")
          .eq("project_id", project_id)
          .not("embedding", "is", null),
      ]);

    if (projectError) throw projectError;
    if (inputsError) throw inputsError;
    if (!project) return respond({ error: "Project not found" }, 404);

    // Normalise embeddings — Supabase may return them as JSON strings or arrays
    const inputs: Input[] = (rawInputs ?? []).map((inp) => ({
      id: inp.id,
      name: inp.name,
      description: inp.description,
      embedding: typeof inp.embedding === "string"
        ? JSON.parse(inp.embedding)
        : (inp.embedding as number[]),
    }));

    if (inputs.length < 3) {
      return respond({
        suggestions: [],
        message: "Add more inputs to generate cluster suggestions.",
      });
    }

    // ── Step 2: Average-linkage agglomerative clustering ──────────────────────
    const { groups, simMatrix } = averageLinkageClustering(inputs, threshold, minClusterSize);
    const assignedIds = new Set(groups.flatMap((g) => g.ids));
    const horizons = formatHorizons(project as Project);
    const errors: string[] = [];
    const suggestions: Suggestion[] = [];

    // ── Step 3: LLM interpretation of main clusters ───────────────────────────
    for (const group of groups) {
      try {
        const groupInputs = inputs.filter((i) => group.ids.includes(i.id));
        const results = await interpretCluster(
          groupInputs,
          project as Project,
          horizons,
          group.avgSim,
          inputs,
          simMatrix,
        );
        suggestions.push(...results);
      } catch (err) {
        errors.push(
          `Cluster interpretation failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // ── Step 4: Weak signal review ────────────────────────────────────────────
    const unassigned = inputs.filter((i) => !assignedIds.has(i.id));
    if (unassigned.length >= 2) {
      try {
        const weakSignals = await reviewWeakSignals(
          unassigned,
          project as Project,
          horizons,
          suggestions.map((s) => s.name),
        );
        suggestions.push(...weakSignals);
      } catch (err) {
        errors.push(
          `Weak signal review failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // ── Step 5: Write to database ─────────────────────────────────────────────
    await deletePendingSuggestions(supabase, project_id);

    if (suggestions.length === 0) {
      return respond({ suggestions: [], errors });
    }

    const rows = suggestions.map((s) => ({
      project_id,
      workspace_id: (project as Project).workspace_id,
      name: s.name,
      description: s.description,
      subtype: s.subtype,
      generative_note: s.generative_note,
      input_ids: s.input_ids,
      avg_similarity: s.avg_similarity,
      is_weak_signal: s.is_weak_signal,
      status: "pending",
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("cluster_suggestions")
      .insert(rows)
      .select();

    if (insertError) throw insertError;

    return respond({ suggestions: inserted ?? [], errors });

  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : (typeof err === "object" && err !== null)
        ? JSON.stringify(err)
        : String(err);
    return respond({ error: message }, 500);
  }
});

// ─── Clustering ───────────────────────────────────────────────────────────────

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

/** Average similarity between all pairs across two clusters. */
function avgInterSim(a: number[], b: number[], sim: number[][]): number {
  let sum = 0;
  for (const i of a) for (const j of b) sum += sim[i][j];
  return sum / (a.length * b.length);
}

/** Average similarity across all unique pairs within one cluster. */
function avgIntraSim(indices: number[], sim: number[][]): number {
  if (indices.length < 2) return 1;
  let sum = 0, count = 0;
  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      sum += sim[indices[i]][indices[j]];
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Average-linkage agglomerative clustering.
 * Merges the pair of clusters with the highest average inter-cluster
 * cosine similarity as long as it exceeds the threshold.
 */
function averageLinkageClustering(
  inputs: Input[],
  threshold: number,
  minClusterSize = 2,
): { groups: ClusterGroup[]; simMatrix: number[][] } {
  const n = inputs.length;

  // Precompute full pairwise similarity matrix
  const simMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = cosineSim(inputs[i].embedding, inputs[j].embedding);
      simMatrix[i][j] = s;
      simMatrix[j][i] = s;
    }
  }

  // Each cluster starts as a singleton (array of input indices)
  let clusters: number[][] = inputs.map((_, i) => [i]);

  while (true) {
    let maxSim = -1;
    let mergeA = -1, mergeB = -1;

    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const s = avgInterSim(clusters[a], clusters[b], simMatrix);
        if (s > maxSim) {
          maxSim = s;
          mergeA = a;
          mergeB = b;
        }
      }
    }

    if (maxSim < threshold) break;

    const merged = [...clusters[mergeA], ...clusters[mergeB]];
    clusters = clusters.filter((_, i) => i !== mergeA && i !== mergeB);
    clusters.push(merged);
  }

  const groups: ClusterGroup[] = clusters
    .filter((c) => c.length >= minClusterSize)
    .map((c) => ({
      ids: c.map((i) => inputs[i].id),
      avgSim: avgIntraSim(c, simMatrix),
    }));

  return { groups, simMatrix };
}

// ─── LLM helpers ─────────────────────────────────────────────────────────────

/** Call OpenAI and parse the JSON response, stripping any markdown fences. */
async function claudeJSON(prompt: string): Promise<unknown> {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const raw = (data.choices[0].message.content as string).trim();
  // Strip optional markdown fences before parsing
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(json);
}

function formatHorizons(project: Project): string {
  const parts: string[] = [];
  if (project.h1_start || project.h1_end) {
    parts.push(`H1: ${project.h1_start ?? ""}–${project.h1_end ?? ""}`);
  }
  if (project.h2_start || project.h2_end) {
    parts.push(`H2: ${project.h2_start ?? ""}–${project.h2_end ?? ""}`);
  }
  if (project.h3_start || project.h3_end) {
    parts.push(`H3: ${project.h3_start ?? ""}–${project.h3_end ?? ""}`);
  }
  return parts.join(", ") || "Not specified";
}

/** Interpret one cluster group via Anthropic, allowing the model to split it. */
async function interpretCluster(
  groupInputs: Input[],
  project: Project,
  horizons: string,
  groupAvgSim: number,
  allInputs: Input[],
  simMatrix: number[][],
): Promise<Suggestion[]> {
  const inputIndexMap = new Map(allInputs.map((inp, idx) => [inp.id, idx]));
  const validIds = new Set(groupInputs.map((i) => i.id));

  const inputList = groupInputs
    .map((i) => `- **${i.name}** (id: ${i.id}): ${i.description ?? "No description"}`)
    .join("\n");

  const prompt =
`You are a strategic foresight analyst interpreting patterns of change.

## Context

This is for a foresight project investigating the following question:

"${project.question ?? "Not specified"}"

The project's focus is: ${project.focus ?? "Not specified"}
Time horizons: ${horizons}

## Your Task

The following inputs have been grouped together based on semantic similarity. Your job is to interpret what this grouping means as an emerging dynamic — a force, tension, or shift that is taking shape in the world.

### Grouped Inputs

${inputList}

### Instructions

1. **Name the cluster as a dynamic, not a subject.** Instead of "AI and relationships," try "Synthetic intimacy becomes a mainstream coping mechanism." The name should imply direction and change. Aim for 5–10 words.
2. **Describe the pattern as a force in the world.** Don't summarize the inputs. In 2–3 sentences, describe what is happening, why it matters, and what makes this cluster distinct.
3. **Check for divergent futures.** If these inputs contain signals pointing toward competing trajectories, propose splitting them into separate clusters.
4. **Classify the cluster type:** Trend (directional pattern with momentum), Driver (underlying force enabling multiple trends), or Tension (competing forces pulling in different directions).
5. **Assess generative value.** One sentence on what makes this cluster useful for scenario development.

### Response Format

Respond in JSON only. No preamble, no markdown fences.

If one cluster:
{"clusters": [{"name": "...", "description": "...", "subtype": "trend|driver|tension", "input_ids": ["..."], "generative_note": "..."}]}

If splitting:
{"clusters": [{"name": "...", "description": "...", "subtype": "...", "input_ids": ["..."], "generative_note": "..."}, ...]}`;

  const result = await claudeJSON(prompt) as {
    clusters: Array<{
      name: string;
      description: string;
      subtype: string;
      input_ids: string[];
      generative_note: string;
    }>;
  };

  return result.clusters.map((c) => {
    // Validate — only allow IDs from this group
    const validatedIds = c.input_ids.filter((id) => validIds.has(id));
    const ids = validatedIds.length >= 2 ? validatedIds : [...validIds];

    // Compute avg_similarity for this sub-cluster
    const indices = ids
      .map((id) => inputIndexMap.get(id))
      .filter((i): i is number => i !== undefined);
    const avgSim = indices.length >= 2 ? avgIntraSim(indices, simMatrix) : groupAvgSim;

    return {
      name: c.name,
      description: c.description ?? "",
      subtype: (["trend", "driver", "tension"].includes(c.subtype)
        ? c.subtype
        : "trend") as "trend" | "driver" | "tension",
      input_ids: ids,
      generative_note: c.generative_note ?? "",
      avg_similarity: avgSim,
      is_weak_signal: false,
    };
  });
}

/** Review unassigned inputs for nascent patterns (weak signals). */
async function reviewWeakSignals(
  unassigned: Input[],
  project: Project,
  horizons: string,
  existingClusterNames: string[],
): Promise<Suggestion[]> {
  const validIds = new Set(unassigned.map((i) => i.id));

  const inputList = unassigned
    .map((i) => `- **${i.name}** (id: ${i.id}): ${i.description ?? "No description"}`)
    .join("\n");

  const clusterContext = existingClusterNames.length > 0
    ? `\n\nAlready identified clusters (these inputs are NOT in any of them):\n${existingClusterNames.map((n) => `- ${n}`).join("\n")}`
    : "";

  const prompt =
`You are a strategic foresight analyst reviewing inputs that did not fit into any major cluster.

## Context

This is for a foresight project investigating: "${project.question ?? "Not specified"}"
Focus: ${project.focus ?? "Not specified"}
Time horizons: ${horizons}${clusterContext}

## Your Task

Review the following inputs that were not assigned to any cluster. Look for nascent patterns, weak signals, or emerging dynamics — even if the connection is loose or speculative. These are early signals that may not yet have enough momentum to form strong clusters.

### Unassigned Inputs

${inputList}

### Instructions

1. Identify any groups of 2+ inputs that share a nascent pattern or direction. Looser connections are acceptable for weak signals.
2. Use the same naming and classification approach as main clusters, but acknowledge the speculative nature.
3. Only return groups you are reasonably confident represent a nascent pattern. Do not force groupings.
4. Return is_weak_signal as true for all results.

### Response Format

Respond in JSON only. No preamble, no markdown fences.

{"clusters": [{"name": "...", "description": "...", "subtype": "trend|driver|tension", "input_ids": ["..."], "generative_note": "...", "is_weak_signal": true}]}

If no meaningful patterns found:
{"clusters": []}`;

  const result = await claudeJSON(prompt) as {
    clusters: Array<{
      name: string;
      description: string;
      subtype: string;
      input_ids: string[];
      generative_note: string;
    }>;
  };

  return result.clusters
    .map((c) => {
      const ids = c.input_ids.filter((id) => validIds.has(id));
      if (ids.length < 2) return null;
      return {
        name: c.name,
        description: c.description ?? "",
        subtype: (["trend", "driver", "tension"].includes(c.subtype)
          ? c.subtype
          : "trend") as "trend" | "driver" | "tension",
        input_ids: ids,
        generative_note: c.generative_note ?? "",
        avg_similarity: null,
        is_weak_signal: true,
      };
    })
    .filter((c): c is Suggestion => c !== null);
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

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

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

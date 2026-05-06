/**
 * compute-cluster-suggestions — two-pass AI clustering for project inputs.
 *
 * mode 'assignments':  finds unassigned inputs semantically close to existing
 *                      cluster centroids and writes assignment suggestions.
 * mode 'new_clusters': excludes inputs matched by the assignment pass, then
 *                      runs agglomerative clustering on the remainder and names
 *                      each group via OpenAI gpt-4o-mini.
 *
 * Required env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSIGNMENT_THRESHOLD = 0.72;
const HIGH_CONFIDENCE_THRESHOLD = 0.80;

// Cosine similarity thresholds derived from the specified distance thresholds
// (similarity = 1 - distance)
const SENSITIVITY_THRESHOLDS: Record<string, number> = {
  tight:       0.75,   // distance 0.25 — tighter groups, more clusters
  balanced:    0.65,   // distance 0.35
  exploratory: 0.50,   // distance 0.50 — looser groups, fewer clusters
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL   = "gpt-4o-mini";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type EmbeddedInput = {
  id: string;
  name: string;
  description: string | null;
  embedding: number[];
};

type ClusterWithCentroid = {
  id: string;
  name: string;
  centroid: number[];
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
    const body = await req.json();
    const {
      project_id,
      mode,
      clustering_sensitivity = "balanced",
    } = body as {
      project_id: string;
      mode: "assignments" | "new_clusters";
      clustering_sensitivity?: string;
    };

    if (!project_id) return respond({ error: "project_id required" }, 400);
    if (mode !== "assignments" && mode !== "new_clusters") {
      return respond({ error: "mode must be 'assignments' or 'new_clusters'" }, 400);
    }

    // ── 1. Fetch project ───────────────────────────────────────────────────────
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", project_id)
      .single();

    if (projectError) throw projectError;
    if (!project) return respond({ error: "Project not found" }, 404);

    // ── 2. Fetch all project inputs (filter embeddings in TS — pgvector/PostgREST
    //       does not reliably support .not('embedding', 'is', null)) ────────────
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
      return respond({ message: "No inputs with embeddings found." });
    }

    // ── 3. Fetch clusters for the project ──────────────────────────────────────
    const { data: clusterRows, error: clustersError } = await supabase
      .from("clusters")
      .select("id, name")
      .eq("project_id", project_id);

    if (clustersError) throw clustersError;
    const clusters = clusterRows ?? [];

    // ── 4. Fetch cluster_inputs for these clusters ─────────────────────────────
    const clusterIds = clusters.map((c) => c.id);

    let assignedInputIds = new Set<string>();
    const clusterMemberMap = new Map<string, string[]>(); // cluster_id -> input_ids

    if (clusterIds.length > 0) {
      const { data: ciRows, error: ciError } = await supabase
        .from("cluster_inputs")
        .select("input_id, cluster_id")
        .in("cluster_id", clusterIds);

      if (ciError) throw ciError;

      for (const row of (ciRows ?? [])) {
        assignedInputIds.add(row.input_id);
        if (!clusterMemberMap.has(row.cluster_id)) {
          clusterMemberMap.set(row.cluster_id, []);
        }
        clusterMemberMap.get(row.cluster_id)!.push(row.input_id);
      }
    }

    // ── 5. Build unassigned input list ─────────────────────────────────────────
    const unassignedInputs = allInputs.filter((i) => !assignedInputIds.has(i.id));

    if (unassignedInputs.length === 0) {
      return respond({ message: "All inputs are already assigned to clusters." });
    }

    // ── 6. Compute cluster centroids ───────────────────────────────────────────
    const embeddingById = new Map<string, number[]>(
      allInputs.map((i) => [i.id, i.embedding]),
    );

    const clustersWithCentroids: ClusterWithCentroid[] = clusters
      .map((cluster) => {
        const memberIds  = clusterMemberMap.get(cluster.id) ?? [];
        const embeddings = memberIds
          .map((id) => embeddingById.get(id))
          .filter((e): e is number[] => e !== undefined);
        if (embeddings.length === 0) return null;
        return { id: cluster.id, name: cluster.name, centroid: computeCentroid(embeddings) };
      })
      .filter((c): c is ClusterWithCentroid => c !== null);

    // ─────────────────────────────────────────────────────────────────────────
    // ASSIGNMENT MODE
    // ─────────────────────────────────────────────────────────────────────────

    if (mode === "assignments") {
      if (clustersWithCentroids.length === 0) {
        return respond({ assignments: 0, message: "No clusters with embeddings found." });
      }

      // ── DEBUG: score every unassigned input against every cluster centroid ───
      const debugScores = unassignedInputs.map((input) => {
        const scores = clustersWithCentroids.map((cluster) => ({
          cluster_id:   cluster.id,
          cluster_name: cluster.name,
          similarity:   Math.round(cosineSim(input.embedding, cluster.centroid) * 10000) / 10000,
        }));
        const best = scores.reduce((a, b) => (a.similarity > b.similarity ? a : b));
        console.log(
          `[debug] "${input.name}" → best match "${best.cluster_name}" @ ${best.similarity}` +
          (best.similarity >= ASSIGNMENT_THRESHOLD ? " ✓ ABOVE threshold" : " ✗ below threshold"),
        );
        return {
          input_id:    input.id,
          input_name:  input.name,
          best_similarity: best.similarity,
          best_cluster:    best.cluster_name,
          all_scores:  scores,
          would_match: best.similarity >= ASSIGNMENT_THRESHOLD,
        };
      });
      // ────────────────────────────────────────────────────────────────────────

      const rows = buildAssignmentRows(
        unassignedInputs,
        clustersWithCentroids,
        project_id,
        project.workspace_id,
      );

      if (rows.length === 0) {
        return respond({ assignments: 0, debug: debugScores });
      }

      await supabase
        .from("cluster_suggestions")
        .delete()
        .eq("project_id", project_id)
        .eq("status", "pending")
        .eq("type", "assignment");

      const { error: insertError } = await supabase
        .from("cluster_suggestions")
        .insert(rows);

      if (insertError) throw insertError;

      return respond({ assignments: rows.length, debug: debugScores });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NEW CLUSTERS MODE
    // ─────────────────────────────────────────────────────────────────────────

    // Exclude any unassigned input already matched to an existing cluster
    let candidateInputs = unassignedInputs;
    if (clustersWithCentroids.length > 0) {
      candidateInputs = unassignedInputs.filter((input) => {
        let maxSim = 0;
        for (const cluster of clustersWithCentroids) {
          const sim = cosineSim(input.embedding, cluster.centroid);
          if (sim > maxSim) maxSim = sim;
        }
        return maxSim < ASSIGNMENT_THRESHOLD;
      });
    }

    if (candidateInputs.length < 2) {
      return respond({
        suggestions: 0,
        message: "Not enough inputs outside existing clusters to form new ones.",
      });
    }

    const threshold = SENSITIVITY_THRESHOLDS[clustering_sensitivity] ??
      SENSITIVITY_THRESHOLDS.balanced;

    const groups = averageLinkageClustering(candidateInputs, threshold);

    if (groups.length === 0) {
      return respond({
        suggestions: 0,
        message: "No clusters found at this sensitivity level.",
      });
    }

    const existingClusterNames = clusters.map((c) => c.name);
    const suggestionRows: object[] = [];
    const errors: string[] = [];

    for (const group of groups) {
      try {
        const groupInputs = candidateInputs.filter((i) => group.includes(i.id));
        const named = await nameCluster(groupInputs, existingClusterNames);

        suggestionRows.push({
          project_id,
          workspace_id: project.workspace_id,
          type:         "new_cluster",
          name:         named.name,
          description:  named.description,
          subtype:      named.subtype,
          input_ids:    group,
          status:       "pending",
        });

        // Track the new name so subsequent groups avoid colliding with it
        existingClusterNames.push(named.name);
      } catch (err) {
        errors.push(
          `Naming failed for group of ${group.length} inputs: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (suggestionRows.length === 0) {
      return respond({ suggestions: 0, errors });
    }

    await supabase
      .from("cluster_suggestions")
      .delete()
      .eq("project_id", project_id)
      .eq("status", "pending")
      .eq("type", "new_cluster");

    const { error: insertError } = await supabase
      .from("cluster_suggestions")
      .insert(suggestionRows);

    if (insertError) throw insertError;

    return respond({ suggestions: suggestionRows.length, errors });

  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : String(err);
    return respond({ error: message }, 500);
  }
});

// ─── Assignment helpers ───────────────────────────────────────────────────────

function buildAssignmentRows(
  inputs: EmbeddedInput[],
  clusters: ClusterWithCentroid[],
  projectId: string,
  workspaceId: string,
): object[] {
  const rows: object[] = [];

  for (const input of inputs) {
    let bestSim = -1;
    let bestCluster: ClusterWithCentroid | null = null;

    for (const cluster of clusters) {
      const sim = cosineSim(input.embedding, cluster.centroid);
      if (sim > bestSim) {
        bestSim    = sim;
        bestCluster = cluster;
      }
    }

    if (bestSim >= ASSIGNMENT_THRESHOLD && bestCluster) {
      rows.push({
        project_id:         projectId,
        workspace_id:       workspaceId,
        type:               "assignment",
        name:               bestCluster.name,  // required NOT NULL — use cluster name
        target_cluster_id:  bestCluster.id,
        input_ids:          [input.id],
        confidence:         bestSim >= HIGH_CONFIDENCE_THRESHOLD ? "high" : "moderate",
        status:             "pending",
      });
    }
  }

  return rows;
}

// ─── OpenAI naming ────────────────────────────────────────────────────────────

async function nameCluster(
  inputs: EmbeddedInput[],
  existingClusterNames: string[],
): Promise<{ name: string; description: string; subtype: string }> {
  const inputList = inputs
    .map((i) => `- ${i.name}${i.description ? `: ${i.description}` : ""}`)
    .join("\n");

  const existingNames = existingClusterNames.length > 0
    ? existingClusterNames.join("\n")
    : "(none)";

  const prompt =
`You are helping a strategic foresight practitioner name and describe a cluster of signals.
The following inputs have been grouped together by semantic similarity.

Inputs:
${inputList}

Existing cluster names in this project (do NOT suggest names similar to these):
${existingNames}

Return JSON only with no preamble:
{
  "name": "a concise, evocative cluster name (max 8 words)",
  "description": "one sentence describing the pattern these inputs share",
  "subtype": "trend" | "driver" | "tension"
}

Rules:
- name must be clearly distinct from the existing cluster names listed above
- subtype 'trend' = an emerging pattern or direction of change
- subtype 'driver' = a structural force shaping the future
- subtype 'tension' = competing dynamics creating uncertainty or friction`;

  const res = await fetch(OPENAI_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model:      OPENAI_MODEL,
      max_tokens: 256,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${text}`);
  }

  const data   = await res.json();
  const raw    = (data.choices[0].message.content as string).trim();
  const json   = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(json);

  const VALID_SUBTYPES = ["trend", "driver", "tension"];
  return {
    name:        String(parsed.name        ?? "Unnamed cluster"),
    description: String(parsed.description ?? ""),
    subtype:     VALID_SUBTYPES.includes(parsed.subtype) ? parsed.subtype : "trend",
  };
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

function avgInterSim(a: number[], b: number[], sim: number[][]): number {
  let sum = 0;
  for (const i of a) for (const j of b) sum += sim[i][j];
  return sum / (a.length * b.length);
}

/**
 * Average-linkage agglomerative clustering.
 * Returns groups of input IDs with 2+ members whose average inter-cluster
 * cosine similarity exceeds the threshold.
 */
function averageLinkageClustering(
  inputs: EmbeddedInput[],
  threshold: number,
  minSize = 2,
): string[][] {
  const n = inputs.length;

  // Precompute pairwise similarity matrix
  const simMatrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = cosineSim(inputs[i].embedding, inputs[j].embedding);
      simMatrix[i][j] = s;
      simMatrix[j][i] = s;
    }
  }

  let clusters: number[][] = inputs.map((_, i) => [i]);

  while (true) {
    let maxSim = -1, mergeA = -1, mergeB = -1;

    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const s = avgInterSim(clusters[a], clusters[b], simMatrix);
        if (s > maxSim) { maxSim = s; mergeA = a; mergeB = b; }
      }
    }

    if (maxSim < threshold) break;

    const merged = [...clusters[mergeA], ...clusters[mergeB]];
    clusters = clusters.filter((_, i) => i !== mergeA && i !== mergeB);
    clusters.push(merged);
  }

  return clusters
    .filter((c) => c.length >= minSize)
    .map((c) => c.map((i) => inputs[i].id));
}

// ─── Respond helper ───────────────────────────────────────────────────────────

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * compute-cluster-suggestions — AI clustering for project inputs.
 *
 * mode 'assignments':  finds unassigned inputs semantically close to existing
 *                      cluster centroids and writes assignment suggestions.
 * mode 'new_clusters': excludes inputs matched by the assignment pass, then
 *                      runs agglomerative clustering on the remainder and names
 *                      each group via OpenAI gpt-4o-mini (existing-cluster aware).
 * mode 'combined':     runs the assignment pass, then the new-clusters pass on
 *                      whatever remains unmatched, and returns both result sets
 *                      in one response.
 *
 * Required env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSIGNMENT_HIGH_CONFIDENCE = 0.65;
const ASSIGNMENT_MODERATE_CONFIDENCE = 0.55;
// Minimum gap between the best and second-best cluster similarity score.
// Prevents all inputs routing to one dominant cluster in narrow-domain projects.
const ASSIGNMENT_MARGIN = 0.05;

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

// ─── Types ────────────────────────────────────────────────────────────────────

type EmbeddedInput = {
  id: string;
  name: string;
  description: string | null;
  embedding: number[];
};

type ClusterMeta = {
  id: string;
  name: string;
  description: string | null;
};

type ClusterWithCentroid = {
  id: string;
  name: string;
  description: string | null;
  centroid: number[];
};

type AssignmentMatch = {
  input: EmbeddedInput;
  cluster: ClusterWithCentroid;
  similarity: number;
  confidence: "high" | "moderate";
  rationale: string | null;
};

type NamingResult =
  | { action: "create_new"; name: string; description: string; subtype: string; rationale: string }
  | { action: "assign_to_existing"; cluster_name: string };

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
    const callerWorkspaceId = await getCallerWorkspaceId(req, supabase);
    if (!callerWorkspaceId) return respond({ error: "Unauthorised" }, 401);

    const body = await req.json();
    const {
      project_id,
      mode,
      clustering_sensitivity = "balanced",
    } = body as {
      project_id: string;
      mode: "assignments" | "new_clusters" | "combined";
      clustering_sensitivity?: string;
    };

    if (!project_id) return respond({ error: "project_id required" }, 400);
    if (mode !== "assignments" && mode !== "new_clusters" && mode !== "combined") {
      return respond({ error: "mode must be 'assignments', 'new_clusters', or 'combined'" }, 400);
    }

    // ── 1. Fetch project ───────────────────────────────────────────────────────
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", project_id)
      .single();

    if (projectError) throw projectError;
    if (!project) return respond({ error: "Project not found" }, 404);
    if (project.workspace_id !== callerWorkspaceId) return respond({ error: "Forbidden" }, 403);

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
      .select("id, name, description")
      .eq("project_id", project_id);

    if (clustersError) throw clustersError;
    const clusters: ClusterMeta[] = clusterRows ?? [];

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
        return { id: cluster.id, name: cluster.name, description: cluster.description ?? null, centroid: computeCentroid(embeddings) };
      })
      .filter((c): c is ClusterWithCentroid => c !== null);

    // ─────────────────────────────────────────────────────────────────────────
    // ASSIGNMENT MODE
    // ─────────────────────────────────────────────────────────────────────────

    if (mode === "assignments") {
      if (clustersWithCentroids.length === 0) {
        return respond({ assignments: 0, message: "No clusters with embeddings found." });
      }

      const rawMatches = computeAssignmentMatches(unassignedInputs, clustersWithCentroids);

      if (rawMatches.length === 0) {
        return respond({ assignments: 0 });
      }

      const matches = await enrichAssignmentsWithRationale(rawMatches);
      const rows = assignmentMatchesToRows(matches, project_id, project.workspace_id);

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

      return respond({ assignments: rows.length });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NEW CLUSTERS / COMBINED — shared assignment pass + new-cluster pass
    // ─────────────────────────────────────────────────────────────────────────

    // Run the assignment pass first so its matches can be excluded from the
    // new-cluster candidate pool (Fix 2, Step 1).
    const assignmentMatches = clustersWithCentroids.length > 0
      ? computeAssignmentMatches(unassignedInputs, clustersWithCentroids)
      : [];
    const matchedInputIds = new Set(assignmentMatches.map((m) => m.input.id));
    const candidateInputs = unassignedInputs.filter((i) => !matchedInputIds.has(i.id));

    const pass = await runNewClusterPass(
      candidateInputs,
      clusters,
      clustering_sensitivity,
      project_id,
      project.workspace_id,
    );

    if (mode === "new_clusters") {
      const allRows = [...pass.newClusterRows, ...pass.assignmentRows];

      if (allRows.length === 0) {
        return respond({ suggestions: 0, message: pass.message, errors: pass.errors });
      }

      await supabase
        .from("cluster_suggestions")
        .delete()
        .eq("project_id", project_id)
        .eq("status", "pending")
        .eq("type", "new_cluster");

      const { error: insertError } = await supabase
        .from("cluster_suggestions")
        .insert(allRows);

      if (insertError) throw insertError;

      return respond({ suggestions: pass.newClusterRows.length, errors: pass.errors });
    }

    // mode === "combined"
    const enrichedAssignmentMatches = await enrichAssignmentsWithRationale(assignmentMatches);
    const assignmentRows = assignmentMatchesToRows(enrichedAssignmentMatches, project_id, project.workspace_id);
    const allAssignmentRows = [...assignmentRows, ...pass.assignmentRows];
    const allRows = [...allAssignmentRows, ...pass.newClusterRows];

    // Clear previous pending suggestions of both types before writing the fresh set.
    await supabase
      .from("cluster_suggestions")
      .delete()
      .eq("project_id", project_id)
      .eq("status", "pending")
      .in("type", ["assignment", "new_cluster"]);

    let inserted: Record<string, unknown>[] = [];
    if (allRows.length > 0) {
      const { data, error: insertError } = await supabase
        .from("cluster_suggestions")
        .insert(allRows)
        .select();

      if (insertError) throw insertError;
      inserted = data ?? [];
    }

    return respond({
      assignments:  inserted.filter((r) => r.type === "assignment"),
      new_clusters: inserted.filter((r) => r.type === "new_cluster"),
      errors:       pass.errors,
    });

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

/**
 * For each input, finds its best-matching cluster centroid and keeps it as a
 * match if similarity clears ASSIGNMENT_MODERATE_CONFIDENCE, the margin
 * requirement, and the per-cluster cap.
 */
function computeAssignmentMatches(
  inputs: EmbeddedInput[],
  clusters: ClusterWithCentroid[],
): AssignmentMatch[] {
  // Fix 2: Per-cluster cap — no single cluster may absorb more than 2× its
  // "fair share" of unassigned inputs in one run. Without this, the largest /
  // most-central cluster in a narrow-domain project can receive every
  // suggestion, leaving the practitioner with no meaningful distribution.
  const perClusterCap = Math.ceil((inputs.length / clusters.length) * 2);
  const clusterCounts = new Map<string, number>();

  const matches: AssignmentMatch[] = [];

  for (const input of inputs) {
    // Score against every cluster centroid and sort descending.
    const scored = clusters
      .map((cluster) => ({ cluster, sim: cosineSim(input.embedding, cluster.centroid) }))
      .sort((a, b) => b.sim - a.sim);

    if (scored.length === 0) continue;

    const { cluster: bestCluster, sim: bestSim } = scored[0];

    // Fix 1: Margin requirement — only assign when the best cluster clearly
    // leads the second-best. In narrow-domain projects all clusters sit close
    // together in embedding space; without a minimum margin every input picks
    // the same dominant cluster by a tiny, semantically meaningless gap.
    if (scored.length >= 2) {
      const margin = bestSim - scored[1].sim;
      if (margin < ASSIGNMENT_MARGIN) {
        console.log(
          `[assign] "${input.name}" → margin ${margin.toFixed(4)} < ${ASSIGNMENT_MARGIN} ✗ insufficient margin`,
        );
        continue;
      }
    }

    const matched = bestSim >= ASSIGNMENT_MODERATE_CONFIDENCE;
    console.log(
      `[assign] "${input.name}" → best "${bestCluster.name}" @ ${bestSim.toFixed(4)}` +
      (matched ? ` ✓ ${bestSim >= ASSIGNMENT_HIGH_CONFIDENCE ? "high" : "moderate"}` : " ✗ below threshold"),
    );

    if (!matched) continue;

    // Fix 2 (enforcement): skip if this cluster has already hit its cap.
    const count = clusterCounts.get(bestCluster.id) ?? 0;
    if (count >= perClusterCap) {
      console.log(
        `[assign] "${input.name}" → "${bestCluster.name}" ✗ cluster cap reached (${perClusterCap})`,
      );
      continue;
    }

    clusterCounts.set(bestCluster.id, count + 1);
    matches.push({
      input,
      cluster:    bestCluster,
      similarity: bestSim,
      confidence: bestSim >= ASSIGNMENT_HIGH_CONFIDENCE ? "high" : "moderate",
      rationale:  null,
    });
  }

  return matches;
}

function assignmentMatchesToRows(
  matches: AssignmentMatch[],
  projectId: string,
  workspaceId: string,
): object[] {
  return matches.map((m) => ({
    project_id:         projectId,
    workspace_id:       workspaceId,
    type:               "assignment",
    name:               m.cluster.name,  // required NOT NULL — use cluster name
    target_cluster_id:  m.cluster.id,
    input_ids:          [m.input.id],
    confidence:         m.confidence,
    rationale:          m.rationale,
    status:             "pending",
  }));
}

// ─── New-cluster pass ─────────────────────────────────────────────────────────

/**
 * Groups candidate inputs via agglomerative clustering, then names each group
 * with gpt-4o-mini. The model is shown existing cluster names and may respond
 * with 'assign_to_existing' instead of proposing a new cluster — those groups
 * become per-input assignment rows targeting the named existing cluster.
 */
async function runNewClusterPass(
  candidateInputs: EmbeddedInput[],
  allClusters: ClusterMeta[],
  sensitivity: string,
  projectId: string,
  workspaceId: string,
): Promise<{ assignmentRows: object[]; newClusterRows: object[]; errors: string[]; message?: string }> {
  const errors: string[] = [];

  if (candidateInputs.length < 2) {
    return {
      assignmentRows: [],
      newClusterRows: [],
      errors,
      message: "Not enough inputs outside existing clusters to form new ones.",
    };
  }

  const threshold = SENSITIVITY_THRESHOLDS[sensitivity] ?? SENSITIVITY_THRESHOLDS.balanced;
  const groups = averageLinkageClustering(candidateInputs, threshold);

  if (groups.length === 0) {
    return {
      assignmentRows: [],
      newClusterRows: [],
      errors,
      message: "No clusters found at this sensitivity level.",
    };
  }

  const existingClusterNames = allClusters.map((c) => c.name);
  const assignmentRows: object[] = [];
  const newClusterRows: object[] = [];

  for (const group of groups) {
    try {
      const groupInputs = candidateInputs.filter((i) => group.includes(i.id));
      const named = await nameCluster(groupInputs, existingClusterNames);

      if (named.action === "assign_to_existing") {
        const target = allClusters.find(
          (c) => c.name.trim().toLowerCase() === named.cluster_name.trim().toLowerCase(),
        );

        if (!target) {
          errors.push(
            `LLM suggested assigning a group to "${named.cluster_name}" but no matching cluster was found.`,
          );
          continue;
        }

        for (const inputId of group) {
          const inputObj = groupInputs.find((i) => i.id === inputId) ?? groupInputs[0];
          const rationale = await generateAssignmentRationale(inputObj, target.name, target.description);
          assignmentRows.push({
            project_id:        projectId,
            workspace_id:      workspaceId,
            type:              "assignment",
            name:              target.name,
            target_cluster_id: target.id,
            input_ids:         [inputId],
            confidence:        null,
            rationale,
            status:            "pending",
          });
        }
        continue;
      }

      newClusterRows.push({
        project_id:   projectId,
        workspace_id: workspaceId,
        type:         "new_cluster",
        name:         named.name,
        description:  named.description,
        subtype:      named.subtype,
        input_ids:    group,
        rationale:    named.rationale,
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

  return { assignmentRows, newClusterRows, errors };
}

// ─── OpenAI naming ────────────────────────────────────────────────────────────

async function nameCluster(
  inputs: EmbeddedInput[],
  existingClusterNames: string[],
): Promise<NamingResult> {
  const inputList = inputs
    .map((i) => `- ${i.name}${i.description ? `: ${i.description}` : ""}`)
    .join("\n");

  const existingNames = existingClusterNames.length > 0
    ? existingClusterNames.join("\n")
    : "(none)";

  const prompt =
`You are helping a strategic foresight practitioner identify patterns in a group of signals.
The following inputs have been grouped together by semantic similarity.

Inputs:
${inputList}

Existing clusters in this project — your suggested name must be clearly and meaningfully distinct from all of these:
${existingNames}

If the inputs you've been given are better described as belonging to one of the existing clusters above rather than forming a genuinely new pattern, respond with:
{ "action": "assign_to_existing", "cluster_name": "<name of the existing cluster>" }

Otherwise, suggest a new cluster:
{ "action": "create_new", "name": "...", "description": "...", "subtype": "trend" | "driver" | "tension", "rationale": "..." }

Return JSON only with no preamble.

Rules for "create_new":
- subtype 'trend' = an emerging pattern or direction of change
- subtype 'driver' = a structural force shaping the future
- subtype 'tension' = competing dynamics creating uncertainty or friction

For "rationale" (1–3 sentences):
- Explain what these inputs have in common thematically
- Describe what pattern or dynamic they point to together
- Explain why they form a meaningful cluster rather than a coincidental grouping
- Write in the voice of a strategic foresight analyst. Reference the content of the inputs, not statistical similarity. Do not mention embeddings, cosine similarity, or any mathematical concepts.

Naming rules — this is the most important part:
- Names must describe what the force is DOING, not just what it IS
- Use the format "[Subject] is/are [verb phrase]" or "[Subject] [verb]s [object]"
- Avoid flat category labels, noun phrases, and abstract titles

Good examples (use this style):
- "Regulatory pressure is constraining AI deployment timelines"
- "Consumer demand is accelerating EV infrastructure buildout"
- "Tactile interfaces are converging toward standardised interaction norms"
- "Institutional trust is eroding faster than alternatives emerge"
- "Remote work norms are fragmenting urban commercial real estate demand"

Bad examples (never use this style):
- "AI Regulation" (noun label — says nothing about what is happening)
- "EV Market Trends" (vague category with no direction or force)
- "Fluid dynamics of tactile interaction" (abstract and passive)
- "Digital Transformation" (cliché with no specificity)`;

  const res = await fetch(OPENAI_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model:      OPENAI_MODEL,
      max_tokens: 512,
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

  if (parsed.action === "assign_to_existing" && parsed.cluster_name) {
    return { action: "assign_to_existing", cluster_name: String(parsed.cluster_name) };
  }

  const VALID_SUBTYPES = ["trend", "driver", "tension"];
  return {
    action:      "create_new",
    name:        String(parsed.name        ?? "Unnamed cluster"),
    description: String(parsed.description ?? ""),
    subtype:     VALID_SUBTYPES.includes(parsed.subtype) ? parsed.subtype : "trend",
    rationale:   String(parsed.rationale   ?? ""),
  };
}

// ─── Assignment rationale helpers ─────────────────────────────────────────────

/**
 * Calls gpt-4o-mini to produce a one-sentence rationale explaining why an
 * input belongs in a given cluster. Returns null on failure so the caller can
 * still insert the row without a rationale.
 */
async function generateAssignmentRationale(
  input: EmbeddedInput,
  clusterName: string,
  clusterDescription: string | null,
): Promise<string | null> {
  const clusterLine = clusterDescription
    ? `Cluster: ${clusterName} — ${clusterDescription}`
    : `Cluster: ${clusterName}`;

  const prompt =
`You are a strategic foresight analyst. In one sentence, explain why the following input belongs in the given cluster.

Reference the content and theme of both — what they share, what dynamic connects them. Do not mention embeddings, similarity scores, or any mathematical concepts. Write as if explaining a judgment call to a colleague.

Input: ${input.name}${input.description ? ` — ${input.description}` : ""}
${clusterLine}

Respond with a single sentence of no more than 20 words. No preamble.`;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model:      OPENAI_MODEL,
        max_tokens: 128,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const sentence = (data.choices[0].message.content as string).trim();
    return sentence || null;
  } catch {
    return null;
  }
}

/**
 * Enriches an array of AssignmentMatch objects with per-match rationales.
 * Failures are silenced — a failed match keeps rationale: null.
 */
async function enrichAssignmentsWithRationale(
  matches: AssignmentMatch[],
): Promise<AssignmentMatch[]> {
  return Promise.all(
    matches.map(async (m) => ({
      ...m,
      rationale: await generateAssignmentRationale(m.input, m.cluster.name, m.cluster.description),
    })),
  );
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

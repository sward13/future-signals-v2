# pgvector Clustering Recommendations Spec

**Feature:** AI Suggested clusters in the Clustering screen  
**Depends on:** pgvector extension already enabled on Supabase project  
**Embedding model:** OpenAI `text-embedding-3-small` (1536 dimensions)  
**Related spec:** `signal-scanner-spec.md` — shares embedding infrastructure; candidates table already defines the pattern

---

## Overview

When a user opens the Clustering screen and switches to Suggested mode, the AI proposes two kinds of action:

1. **Assignment suggestions (Tier 1):** unassigned inputs that semantically match an existing cluster centroid — presented under "Add to existing clusters."
2. **New cluster suggestions (Tier 2):** unassigned inputs (excluding those matched by Tier 1) that form coherent new groups — presented under "New cluster suggestions."

Both tiers are produced by a single `compute-cluster-suggestions` Edge Function call with `mode: "combined"`. Results are stored in `cluster_suggestions` and distinguished by a `type` column (`"assignment"` | `"new_cluster"`).

This is scaffold, not automation. The AI proposes; the practitioner decides.

> **Audit note (2026-07-05):** Original spec described only Tier 2 (new cluster grouping). Tier 1 (assignment to existing clusters) has since been fully implemented in `compute-cluster-suggestions`. This section updated to reflect reality.

---

## Schema Changes

### Add embedding column to `inputs` table

```sql
ALTER TABLE inputs ADD COLUMN embedding vector(1536);

CREATE INDEX inputs_embedding_idx 
  ON inputs 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### New table: `cluster_suggestions`

Stores proposed clusters and assignment suggestions scoped to a project. Regenerated on demand. The live table includes additional columns beyond the original spec: `type` (text, `"assignment"` | `"new_cluster"`), `target_cluster_id` (uuid, for assignment rows), `description` (text), `subtype` (text), `confidence` (text, `"high"` | `"moderate"` | null), and `generated_at` (timestamptz).

```sql
CREATE TABLE cluster_suggestions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type              text NOT NULL DEFAULT 'new_cluster',
  -- 'assignment' | 'new_cluster'
  name              text NOT NULL,
  description       text,
  subtype           text,
  rationale         text,
  target_cluster_id uuid REFERENCES clusters(id) ON DELETE CASCADE,
  -- set for type='assignment' rows
  input_ids         uuid[] NOT NULL,
  confidence        text,
  -- 'high' | 'moderate' | null (assignment rows only)
  status            text NOT NULL DEFAULT 'pending',
  -- pending · accepted · dismissed
  generated_at      timestamptz DEFAULT now(),
  acted_on_at       timestamptz
);

-- RLS
ALTER TABLE cluster_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own workspace suggestions"
  ON cluster_suggestions
  FOR ALL
  USING (workspace_id = get_workspace_id());
```

Accepted and dismissed suggestions are never deleted — preserved for audit and future training signal use.

---

## Embedding Generation

### Trigger: Supabase Edge Function — `embed-input`

Called whenever an input is created or updated with a non-null title or description. Generates an embedding and writes it back to the `inputs` row.

**Text to embed:**
```
{input.name}. {input.description}
```
Name and description concatenated with a period separator. If description is null, embed name only.

**When to call:**
- On `INSERT` to `inputs`
- On `UPDATE` to `inputs` where `name` or `description` has changed

Implement as a Postgres trigger that calls the Edge Function asynchronously, or as a direct call from the frontend after a successful input save. Async trigger is preferred so embedding generation doesn't block the UI.

**Edge Function pseudocode:**
```javascript
const text = [input.name, input.description].filter(Boolean).join('. ')
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text
})
await supabase
  .from('inputs')
  .update({ embedding: embedding.data[0].embedding })
  .eq('id', input.id)
```

**Cost profile:** One embedding call per input create/update. At ~$0.00002 per 1K tokens, a 100-word input costs < $0.000005. Negligible.

**Null handling:** Inputs without embeddings (created before this feature ships) are backfilled by a one-time cron job that processes all inputs with `embedding IS NULL` in batches of 100.

---

## Clustering Algorithm

Active Edge Function: `compute-cluster-suggestions`. The older `generate-cluster-suggestions` function is legacy dead code (marked `// LEGACY` in its source) — do not call or deploy it.

Runs on demand when the user clicks "✦ Suggest clustering" in Suggested mode.

### Step 1 — Fetch all project inputs

> **Audit note (2026-07-05):** The original spec described fetching only inputs with embeddings via a SQL filter. The active implementation fetches all inputs (`project_id = :project_id`) and filters out null embeddings in TypeScript. This is a deliberate workaround for pgvector's incompatibility with PostgREST's `.not('embedding', 'is', null)` filter (documented in CLAUDE.md Known database gotchas).

```typescript
// Fetch all project inputs; filter embeddings in TS
const { data: rawInputs } = await supabase
  .from("inputs")
  .select("id, name, description, embedding")
  .eq("project_id", project_id);

const allInputs = (rawInputs ?? [])
  .filter((i) => i.embedding !== null && i.embedding !== undefined)
  .map((i) => ({
    ...i,
    embedding: typeof i.embedding === "string"
      ? JSON.parse(i.embedding)
      : i.embedding,
  }));
```

If zero inputs have embeddings, the function returns early with `{ message: "No inputs with embeddings found." }`.

The function then fetches existing clusters and their `cluster_inputs` memberships, derives the `assignedInputIds` set, and computes `unassignedInputs` from the difference. All subsequent passes operate on `unassignedInputs` only.

### Step 2 — Tier 1: Assignment pass (existing cluster matching)

> **Audit note (2026-07-05):** This tier did not exist in the original spec. It is fully implemented.

For each project cluster that has at least one embedded member, the function computes a centroid (mean of member embeddings). It then scores each unassigned input against every centroid via cosine similarity and applies three gate conditions before creating an assignment suggestion:

1. **Minimum confidence:** best similarity ≥ `ASSIGNMENT_MODERATE_CONFIDENCE` (0.55).
2. **Margin requirement:** best similarity must exceed second-best by ≥ `ASSIGNMENT_MARGIN` (0.05). Prevents all inputs routing to one dominant cluster in narrow-domain projects.
3. **Per-cluster cap:** no cluster may absorb more than `ceil((unassigned.length / clusters.length) × 2)` inputs in a single run.

Matches meeting all three conditions are classified as `"high"` confidence (≥ 0.65) or `"moderate"` confidence (0.55–0.65). Each match is enriched with a one-sentence rationale from `gpt-4o-mini` before being written to `cluster_suggestions` as a `type: "assignment"` row with `target_cluster_id` set.

**Constants (as deployed):**
```typescript
const ASSIGNMENT_HIGH_CONFIDENCE     = 0.65;
const ASSIGNMENT_MODERATE_CONFIDENCE = 0.55;
const ASSIGNMENT_MARGIN              = 0.05;
```

### Step 3 — Tier 2: New cluster pass (agglomerative grouping)

Inputs matched by the Tier 1 assignment pass are excluded from this pass. The remaining unassigned inputs are clustered using average-linkage agglomerative clustering.

**Sensitivity threshold mapping** — the user selects Tight / Balanced / Exploratory; the UI passes `clustering_sensitivity` to the Edge Function:

> **Audit note (2026-07-05):** Original spec described a single 0.72 threshold. The active implementation uses three per-mode values. 0.72 appears only in the legacy `generate-cluster-suggestions` function, which is no longer called.

```typescript
const SENSITIVITY_THRESHOLDS: Record<string, number> = {
  tight:       0.75,   // tighter groups, more clusters
  balanced:    0.65,   // default
  exploratory: 0.50,   // looser groups, fewer clusters
};
```

**Minimum group size:** Groups of fewer than 2 inputs are discarded before the naming step. This is enforced in `averageLinkageClustering` via a `minSize = 2` parameter on the filter step — single-input "clusters" never reach the LLM.

> **Audit note (2026-07-05):** This resolves OQ-CLUS-02. See Open Questions.

**New-cluster naming (LLM call):** For each group, `gpt-4o-mini` is given the group's inputs and the names of all existing clusters. The model may either propose a new cluster name or indicate that the group belongs in an existing cluster (`action: "assign_to_existing"`). In the latter case, a `type: "assignment"` row is written for each input in the group.

**Model:** `gpt-4o-mini` (not Claude Haiku — the original spec was written before the model stack was finalised)

The naming prompt instructs the model to name clusters as active dynamics rather than noun labels (e.g., "Regulatory pressure is constraining AI deployment timelines" rather than "AI Regulation"), assign a subtype (`trend | driver | tension`), and write a 1–3 sentence rationale in the voice of a strategic foresight analyst, without referencing embeddings or similarity scores.

### Step 4 — Write to `cluster_suggestions`

In `combined` mode (the only mode called from the UI), existing `pending` rows of both types are deleted before the new set is inserted:

```sql
DELETE FROM cluster_suggestions
WHERE project_id = :project_id
  AND status = 'pending'
  AND type IN ('assignment', 'new_cluster');
```

The new set — assignment rows from Tier 1 and new-cluster rows from Tier 2 — is then inserted in a single batch.

---

## AI Suggestions Tab UI

Implemented in `ClusterSuggestions.jsx`. Accessed via the Manual/Suggested mode toggle in `ClustersPanel.jsx`. The Suggestions panel is distinct from the page header — the "✦ Suggested" button in the Cluster screen header switches `clusterMode` to `"suggested"` in `ClusterScreen.jsx`, which causes `ClustersPanel` to render `ClusterSuggestions`.

### States

> **Audit note (2026-07-05):** The original spec described two empty states tied to input count and clustering outcome. Neither matches what is rendered. The actual states are listed below.

**Loading:** Full-panel spinner with "Finding suggestions…" while the edge function runs.

**Pre-run (no suggestions loaded):**
> "No suggestions yet"  
> "Click '✦ Suggest clustering' to get AI recommendations for grouping your inputs."

The edge function is not called on panel mount — the component loads any existing `pending` suggestions from `cluster_suggestions` on mount, and updates `hasRun` to true if any are found. The "No suggestions yet" state shows only when no pending rows exist and the user has not run a suggestion pass in this session.

**All resolved (suggestions exist but all acted on):**
> "All suggestions resolved"  
> "Run '✦ Suggest clustering' again for fresh recommendations."

**Suggestions list:** Two sections, each with its own label:
- **"Add to existing clusters"** — one card per target cluster, listing the inputs suggested for assignment with High/Moderate confidence badges. Per-row Dismiss (✕). Card-level Accept and Dismiss buttons.
- **"New cluster suggestions"** — one card per proposed cluster showing name, description, subtype badge, rationale (expandable via "· Why this cluster?"), input list with per-row remove, and Create cluster / Edit / Dismiss actions.

### Suggest clustering button

Label: **✦ Suggest clustering**. Disabled only while `running === true` or `projectId` is null. No time-based cooldown is implemented.

> **Audit note (2026-07-05):** The original spec described a 60-second post-run cooldown. This is not implemented.

The button calls `compute-cluster-suggestions` with `mode: "combined"` and the current `clustering_sensitivity` value (Tight / Balanced / Exploratory — default `"balanced"`).

### Cluster screen header button

A separate **"✦ Suggested"** button in the Cluster screen page header switches the panel to Suggested mode. This button previously showed a numeric badge displaying the count of unassigned inputs. The badge has been removed — it was bound to `unassigned.length` (inputs with no cluster), not to any suggestion count, and was therefore misleading.

### Actions

**Accept (assignment card)**  
Calls `onAssignInput(inputId, targetClusterId)` for each input in the group. Marks each suggestion `accepted`. Removes the card from the panel.

**Create cluster (new cluster card)**  
Calls `onCreateCluster` with suggested name, subtype, description, and input IDs. Marks suggestion `accepted`. No navigation away from the panel.

**Edit**  
Opens an inline edit state on the card — name and description editable; inputs removable. On confirm, same flow as Create cluster with edited values.

**Dismiss**  
Marks the suggestion `dismissed`. Removes it from the panel with a fade. Dismissed suggestions do not reappear on the next run (the Edge Function deletes all `pending` rows before writing fresh results, so dismissed rows are never overwritten).

---

## Regeneration Triggers

Suggestions are **not** regenerated automatically as inputs are added — this avoids suggestions shifting underneath active work. Regeneration is always an explicit user action via the "✦ Suggest clustering" button.

> **Audit note (2026-07-05):** The original spec called for a nudge: "You've added 4 inputs since your last suggestions were generated. Regenerate?" This nudge is **not implemented**. No tracking of input count at last-run time exists in the codebase.

---

## Open Questions

- **OQ-CLUS-01: Threshold tuning.** The per-mode thresholds (0.75 / 0.65 / 0.50) are starting estimates. Should be validated against real project data once practitioners have populated several projects with 10+ inputs each. The `compute-cluster-suggestions` function logs per-input assignment scores to console — these can be reviewed in Supabase Edge Function logs.
- **OQ-CLUS-02: ~~Minimum cluster size.~~** **Resolved.** The active implementation enforces `minSize = 2` in `averageLinkageClustering`. Single-input groups are filtered before any LLM naming call. No further action required.
- **OQ-CLUS-03: Backfill job.** A one-time backfill of embeddings for existing inputs is required before this feature can produce useful suggestions. Confirm timing — run as part of the feature deploy.
- **OQ-CLUS-04: Shared embedding infrastructure.** When the signal scanner ships, scanner candidates also need embeddings (already defined in `signal-scanner-spec.md` as `vector(1536)` on the `candidates` table). The `embed-input` Edge Function established here is the pattern to reuse — scanner embedding should use the same function, not a separate implementation.

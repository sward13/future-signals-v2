# pgvector Clustering Recommendations Spec

**Feature:** AI Suggested clusters in the Clustering screen  
**Depends on:** pgvector extension already enabled on Supabase project  
**Embedding model:** OpenAI `text-embedding-3-small` (1536 dimensions)  
**Related spec:** `signal-scanner-spec.md` — shares embedding infrastructure; candidates table already defines the pattern

---

## Overview

When a user opens the Clustering screen, the AI Suggestions tab proposes candidate clusters derived from semantic groupings of the project's inputs. The system embeds each input, runs cosine similarity clustering, and uses a lightweight LLM call to name and describe each proposed cluster. The user can accept, edit, or dismiss each suggestion.

This is scaffold, not automation. The AI proposes; the practitioner decides.

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

Stores proposed clusters scoped to a project. Regenerated on demand.

```sql
CREATE TABLE cluster_suggestions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name              text NOT NULL,
  rationale         text,
  input_ids         uuid[] NOT NULL,
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
  USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));
```

---

## Embedding Generation

### Trigger: Supabase Edge Function — `embed-input`

Called whenever an input is created or updated with a non-null title or description. Generates an embedding and writes it back to the `inputs` row.

**Text to embed:**
```
{input.title}. {input.description}
```
Title and description concatenated with a period separator. If description is null, embed title only.

**When to call:**
- On `INSERT` to `inputs`
- On `UPDATE` to `inputs` where `title` or `description` has changed

Implement as a Postgres trigger that calls the Edge Function asynchronously, or as a direct call from the frontend after a successful input save. Async trigger is preferred so embedding generation doesn't block the UI.

**Edge Function pseudocode:**
```javascript
const text = [input.title, input.description].filter(Boolean).join('. ')
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

Runs on demand when the user opens the AI Suggestions tab or clicks "Regenerate suggestions."

### Step 1 — Fetch project inputs with embeddings

```sql
SELECT id, title, description, embedding
FROM inputs
WHERE project_id = :project_id
  AND embedding IS NOT NULL
```

If fewer than 3 inputs have embeddings, return an empty suggestions list with a message: "Add more inputs to generate cluster suggestions."

### Step 2 — Cosine similarity grouping

Run agglomerative clustering on the embedding vectors using a cosine distance threshold. 

**Implementation options (in order of preference):**
1. **Supabase Edge Function with pgvector** — compute pairwise cosine similarity in SQL, group in application logic
2. **Simple k-means via pgvector** — if input count is known, use pgvector's `<=>` operator to assign each input to its nearest centroid

**Recommended approach for v2:** Application-side agglomerative clustering in the Edge Function. Fetch all embeddings, compute pairwise similarities, group inputs where cosine similarity ≥ 0.72 (tunable threshold). This avoids needing to pre-specify k.

**Threshold guidance:**
- 0.85+ → very tight, near-duplicate topics
- 0.72–0.85 → thematically related (recommended default)
- 0.60–0.72 → loosely related, may produce overly broad clusters

Store threshold as a configurable constant; do not expose to users in v2.

### Step 3 — Name and describe each cluster (LLM call)

For each semantic group produced in Step 2, make a single Claude Haiku call to generate a cluster name and rationale.

**Prompt:**
```
You are a strategic foresight analyst helping to organise research inputs into thematic clusters.

The following inputs have been grouped together based on semantic similarity:

{inputs.map(i => `- ${i.title}: ${i.description}`).join('\n')}

Propose a concise cluster name (4–7 words) and a one-sentence rationale explaining what these inputs have in common and why they belong together as a strategic cluster.

Respond in JSON only:
{"name": "...", "rationale": "..."}
```

**Model:** `claude-haiku-4-5-20251001`  
**One call per cluster group.** For a project with 20 inputs producing 4 clusters, this is 4 Haiku calls — negligible cost.

### Step 4 — Write to `cluster_suggestions`

Delete existing `pending` suggestions for the project, then insert the new set.

```sql
DELETE FROM cluster_suggestions
WHERE project_id = :project_id AND status = 'pending';

INSERT INTO cluster_suggestions (project_id, workspace_id, name, rationale, input_ids)
VALUES ...
```

Accepted and dismissed suggestions are never deleted — preserved for audit and future training signal use.

---

## AI Suggestions Tab UI

The Clustering screen already has an AI Suggestions tab scaffolded. Wire it to the `cluster_suggestions` table.

### States

**Loading:** Spinner while the clustering Edge Function runs. Expected time: 2–5 seconds for a project with < 50 inputs.

**Empty — not enough inputs:**
> "Add at least 3 inputs with descriptions to generate cluster suggestions."

**Empty — no suggestions after clustering:**
> "Your inputs are too varied to suggest clear clusters yet. Try adding more inputs on a focused topic."

**Suggestions list:** One card per suggested cluster showing:
- Cluster name (prominent)
- Rationale (one sentence, muted)
- Input pills — show up to 5 input titles as chips; "+ N more" if more than 5
- Three actions: **Create cluster →** · **Edit** · **Dismiss**

**Regenerate:** A "Regenerate suggestions" button at the top of the tab. Triggers a fresh clustering run. Disabled for 60 seconds after the last run to prevent abuse.

### Actions

**Create cluster →**  
Creates a new cluster from the suggestion with the suggested name and all linked inputs pre-assigned. Marks the suggestion `accepted`. Navigates the user to the new cluster in the Clusters tab.

**Edit**  
Opens the suggestion in an inline edit state — name and input selection editable before creating. On confirm, same flow as Create cluster.

**Dismiss**  
Marks the suggestion `dismissed`. Removes it from the list. Dismissed suggestions do not reappear on regeneration.

---

## Regeneration Triggers

Suggestions are **not** regenerated automatically as inputs are added — this avoids suggestions shifting underneath active work. Regeneration is always an explicit user action.

Surface a subtle nudge when new inputs have been added since the last generation:
> "You've added 4 inputs since your last suggestions were generated. Regenerate?"

---

## Open Questions

- **OQ-CLUS-01: Threshold tuning.** The 0.72 cosine similarity threshold is a starting estimate. Should be validated against real project data once John has populated several projects with 10+ inputs each. Add a mechanism to log per-cluster average similarity so this can be reviewed empirically.
- **OQ-CLUS-02: Minimum cluster size.** Should a cluster require a minimum of 2 inputs? A single-input "cluster" is not useful — filter these out before the LLM naming step.
- **OQ-CLUS-03: Backfill job.** A one-time backfill of embeddings for existing inputs is required before this feature can produce useful suggestions. Confirm timing — run as part of the feature deploy.
- **OQ-CLUS-04: Shared embedding infrastructure.** When the signal scanner ships, scanner candidates also need embeddings (already defined in `signal-scanner-spec.md` as `vector(1536)` on the `candidates` table). The `embed-input` Edge Function established here is the pattern to reuse — scanner embedding should use the same function, not a separate implementation.

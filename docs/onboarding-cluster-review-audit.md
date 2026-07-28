# Audit — Onboarding cluster review screen ("Here are the patterns in your signals")

Prepared ahead of adding a per-cluster **dismiss** action to this screen. Scope: current implementation only; no code changes. Open questions are flagged inline with **⚠**.

---

## 1. Where the screen lives & the data flow

**Component:** `src/components/onboarding/ClusteringResultsStep.tsx` — the entire screen (loading, results, and two fallback states) lives in this one file.

**Rendered by:** `src/components/onboarding/OnboardingShell.tsx` as step 5 (the final onboarding step, `STEP_DOT = 4`), immediately after `ScannerInboxStep` (step 4). `OnboardingShell` passes it: `projectId`, `projectName`, `workspaceId`, `promotedInputIds`, `onComplete`, `onBack`.

**End-to-end flow (signal capture → cluster display):**

1. **Step 4 — `ScannerInboxStep.jsx`** (signal triage). User selects seeded scanner candidates. `handleAdd()` inserts each selected candidate as a real **`inputs`** row (`subtype: "Signal"`, `is_seeded: true`, `project_id` set, `metadata.source: "onboarding_scanner"`). It collects the new input ids into `promotedIds`, fires `embed-input` per input **non-blocking**, and calls `onComplete(promotedIds)`.
   - **Key consequence:** by the time the cluster screen mounts, the signals already exist as persisted project inputs. Clustering does not create signals; it only groups pre-existing ones.

2. **Step 5 — `ClusteringResultsStep`** mounts. A single `useEffect` (empty dep array, runs once) does:
   - `waitForEmbeddings(promotedInputIds, 20_000)` — polls `inputs.embedding` every 1.5s until all promoted inputs are embedded, or a 20s timeout (embeddings were fired non-blocking in step 4).
   - Invokes edge function **`compute-cluster-suggestions`** with `{ project_id, mode: "new_clusters", clustering_sensitivity: "balanced" }`.
   - Reads back the written rows from **`cluster_suggestions`** where `project_id` matches and `status = "pending"`, ordered by `generated_at desc`.
   - Fetches input `name`s for the ids referenced, into `inputNameMap`.
   - Sets `clusters` state and flips `phase` to `"done"`.

3. **Render** — `ResultsState` maps each suggestion to a `ClusterCard`.

**State machine (render branches in the root component):**

| Condition | Rendered |
|---|---|
| `promotedInputIds.length === 0` | `ZeroInputsState` — "Your project is ready" |
| `phase === "loading"` | `LoadingState` — spinner, "Finding patterns…" |
| `clusters.length === 0` (done) | `NoClustersState` — "Your signals are ready" |
| otherwise | `ResultsState` — the cluster cards |

**Important:** the objects rendered here are **`cluster_suggestions` rows, not real `clusters`**. They become real clusters only on confirm (§3).

---

## 2. How a cluster is structured & its relation to signals

**On-screen type (`ClusterSuggestion`):**
```ts
{ id: string; name: string; description: string | null; subtype: string | null; input_ids: string[] }
```

**Backing table `cluster_suggestions`** (`supabase/migrations/20260407_cluster_suggestions.sql` + `20260414_cluster_suggestions_v2.sql` + `20260429_cluster_suggestions_add_type.sql`):

| Column | Notes |
|---|---|
| `id`, `project_id`, `workspace_id` | keys; RLS `workspace_id = get_workspace_id()` |
| `name` | NOT NULL |
| `description`, `rationale`, `generative_note` | text |
| `subtype` | CHECK `trend \| driver \| tension` (lowercase in DB) |
| `input_ids` | `uuid[]` — **the signal membership, denormalized on the row** |
| `status` | CHECK `pending \| accepted \| dismissed`, default `pending` |
| `type` | `new_cluster \| assignment` (onboarding only uses `new_cluster`) |
| `avg_similarity`, `is_weak_signal` | scoring metadata |
| `generated_at`, `acted_on_at` | timestamps |

**Cluster → signal relationship at this stage:** the suggestion carries its signal membership as the `input_ids` **array on the row**. This is *not* the `cluster_inputs` junction table yet — that is written only at promotion. The signals themselves are ordinary `inputs` rows that already exist independently of the suggestion.

**What the card shows** (`ClusterCard`): `SubtypeTag` (subtype), a signal count, the cluster name, the AI description, and a bulleted list of member signal names (resolved via `inputNameMap`, falling back to raw id).

---

## 3. What happens on "Open my project" — is there already an approval step?

**No selection/approval step exists today. Every suggestion shown is promoted automatically.**

`handleConfirm()` → `promoteClusters(clusters, projectId, workspaceId)` iterates **the entire local `clusters` array** and, per suggestion:
1. Inserts a real **`clusters`** row (`name`, `subtype` capitalized, `horizon: "H1"`, `likelihood: "Plausible"`, `description`).
2. Inserts **`cluster_inputs`** junction rows for every `input_id`.
3. Marks the `cluster_suggestions` row `status: "accepted"`, `acted_on_at` (fire-and-forget).

Then `onComplete()` hands off to the app. The user's only current controls are **"Open my project →"** (take all) and **"← Back"** (return to signal selection). There is no way to keep a subset.

**Consequence for the dismiss feature:** because `promoteClusters` walks the local `clusters` state, *removing a dismissed suggestion from that array is sufficient to prevent its promotion* — no special-casing in the promote loop is required.

---

## 4. Existing dismiss patterns — and which is reusable

There are **two** distinct dismiss flows in the app. Neither is on this onboarding screen today, but one is a near-exact analog.

### (a) Signal-level dismiss — `useAppState.js`
- `dismissInput(id)` (line 711) — purely local: filters the input out of `inputs` state.
- `dismissSuggestedInput(input)` (line 715) — the real in-app "not relevant" action for scanner suggestions: optimistically sets `metadata.dismissed`, then persists `inputs.metadata.dismissed/dismissed_at`, updates `project_candidates.user_action = 'dismissed'`, and stamps `projects.last_reviewed_at`. This operates on **signals**, and its scanner-specific writes (`project_candidates`) are **not** relevant to clusters.

### (b) Cluster-suggestion dismiss — `src/components/clusters/ClusterSuggestions.jsx` ← **the pattern to reuse**
`handleDismissNewCluster(id)` (line 415):
- Adds the suggestion to a local `dismissed` array (tracked by `input_ids`), triggers a 280ms fade, then removes it from `newSugs` local state.
- Persists `cluster_suggestions.status = "dismissed"`, `acted_on_at` (fire-and-forget).
- **Does not touch the underlying inputs at all** — the signals simply remain unclustered.
- The local `dismissed` array is additionally used to suppress near-duplicate re-suggestions in the same session (`overlapRatio(input_ids) > 0.8`).

**Reusability:** the onboarding dismiss should mirror (b): drop the suggestion from local `clusters` state (so it isn't rendered or promoted) **and** persist `status = "dismissed"`. The onboarding screen's own `promoteClusters` already sets `status = "accepted"` on the kept ones, so the two paths are symmetrical.

---

## 5. Constraints & edge cases — what happens to a dismissed cluster's signals

**The central point: at this screen the signals already exist as real project `inputs`.** The clusters are only suggestions. So "dismiss a cluster" here is fundamentally *"don't turn this grouping into a cluster"* — it does **not** imply deleting or removing any signal.

**Implied default behavior (and it's effectively free):** a dismissed suggestion is not promoted → no `clusters` row, no `cluster_inputs` rows → its `input_ids` **remain in the project as unclustered inputs**, surfacing on the Scan screen as unassigned. This is the "returned to an unclustered pool" option, and it matches the in-app `ClusterSuggestions` behavior exactly (which leaves inputs untouched on dismiss). No extra work is needed to "return" the signals — they were never in a cluster.

**So the design decision in the prompt (dismiss-with-signals vs return-to-pool) is already implied by existing logic: return-to-pool, because signal existence and cluster membership are separate concerns and the in-app analog never deletes signals on cluster dismiss.** Deleting the underlying signals on cluster-dismiss would be a *new* behavior with no precedent and would silently discard user-selected scanner signals — recommend against unless explicitly desired.

**Edge cases / open questions:**

- **⚠ Persisting the dismissal is not optional — it prevents a leak into the in-app panel.** `ClusterSuggestions.jsx` `loadSuggestions()` runs **on mount** (not only after "Suggest clustering") and loads all `status = "pending"` rows for the project. Today onboarding promotes *every* suggestion (all become `accepted`), so nothing pending is left behind. If the new dismiss only removes a card from local state **without** writing `status = "dismissed"`, that row stays `pending` and will **reappear as a "new cluster" suggestion the first time the user opens the in-app Cluster screen's Suggested mode.** Persisting `status = "dismissed"` on dismiss keeps the "no pending rows survive onboarding" invariant.

- **⚠ Overlapping `input_ids` across suggestions.** No DB constraint guarantees an input appears in only one suggestion. In practice the `new_clusters` pass draws from a disjoint `candidateInputs` pool (unassigned inputs minus assignment matches), so overlap within a single onboarding run is unlikely — but it isn't guaranteed. If an input *could* be in two suggestions, dismissing one shouldn't be assumed to fully "free" that input. Worth a quick confirmation before relying on 1-input-1-suggestion.

- **Dismiss-all → zero kept clusters.** If the user dismisses every card, `handleConfirm` would promote nothing and hand off with no clusters (functionally the `NoClustersState` outcome, but reached from `ResultsState`). Decide the desired UX: collapse to an empty/"open my project" state, disable/relabel the confirm button, or just let it proceed silently. No current handling exists for "all dismissed."

- **Dismissal here is not permanent suppression.** Nothing feeds dismissed suggestions into a negative pool for future clustering. `project_negative_pool` is **scanner-relevance only** (`centroid_embedding`, `count`, `recomputed_at`; one row per project) and is **not referenced by `compute-cluster-suggestions`**. The re-clustering candidate pool excludes inputs already in `cluster_inputs` — but a dismissed suggestion's inputs are *not* in `cluster_inputs`, so a later in-app "Suggest clustering" run can propose the same grouping again. This matches in-app behavior and is probably acceptable, but note that dismissal ≠ "never suggest this again."

- **Local re-render vs promote timing.** Because promotion reads local `clusters` state at confirm time, ensure the dismiss handler updates that same state array (not a separate filtered view) so the dismissed cluster is genuinely excluded from `promoteClusters`.

---

## Summary / recommendation for the dismiss feature

- Mirror `ClusterSuggestions.handleDismissNewCluster`: **remove from local `clusters` state + persist `cluster_suggestions.status = "dismissed"`.** Do not delete or modify the underlying `inputs`.
- Dismissed clusters' signals naturally remain as **unclustered project inputs** — this is the existing implied contract, requires no extra logic, and is consistent with the in-app cluster-suggestion dismiss.
- **Must-do:** write `status = "dismissed"` (not local-only), or the row leaks into the in-app Suggested panel as a lingering `pending` suggestion.
- **Decide:** the "all cards dismissed" UX.
- **Confirm:** whether an input can appear in more than one onboarding suggestion (affects any "free the signals" assumptions).

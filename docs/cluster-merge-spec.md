# Feature Spec: Cluster Merge

**Status:** Draft — for review with Sam. No open blocking decisions; scope levers and open questions flagged inline.
**PRD section:** Cluster workspace — cluster lifecycle (create / edit / delete → **merge**)
**Last updated:** 26 September 2026

---

## Overview

There is currently **no way to merge two clusters** in the app. Once two clusters exist that cover the same underlying pattern, a practitioner's only options are to manually unlink every input from one and relink it to the other, then delete the emptied cluster — a tedious, error-prone manual dance — or to leave the duplication in place. Neither is acceptable, and the need is not hypothetical: it arises organically whenever a practitioner runs "Suggest clustering" more than once, or accepts a batch of AI suggestions that overlap.

This was surfaced concretely by an audit of the *Future of data centers* project, where a single suggestion run (2026-09-10) proposed 24 new clusters and 18 were accepted, producing several near-identical clusters ("Community activism is disrupting data center expansion" / "Community voices are challenging data center expansion" / "Public opposition is shaping data center siting decisions"). A cross-project sweep found the same pattern elsewhere — including **literal duplicates** (byte-for-byte identical input membership) in *EV Adoption* and *Haptics*.

There are two distinct duplication modes, and this spec's feature addresses the **cleanup** side of both:

1. **Cross-run duplication** — re-running suggestions later re-clusters inputs that were already clustered. *Current code already guards the generation side* (`compute-cluster-suggestions` excludes already-assigned inputs), so this is mostly legacy residue.
2. **Intra-run duplication** — a single run emits multiple near-identical *new* clusters, because naming was parallelized (2026-09-08, commit `a77c7b6`) and groups no longer see each other's proposed names. *This generation-side regression is unguarded* and is scoped as **v2** here (see "Convergence with the dedup fix").

**Merge is the primitive both the manual workflow and the future AI "Merge?" nudge call.** This spec covers the merge operation itself and the Phase 1 manual (drag-to-merge) UI, then lays out the v2 plan for AI-suggested merges and richer interactions.

### Guiding design principles

From `design-principles.md`:

- **Destructive, irreversible actions must confirm.** Merge deletes a cluster and discards its name/type/description. A `ConfirmDialog` is mandatory, and must name exactly what is lost.
- **AI suggests; the practitioner acts** (principle 4). The v2 overlap detector *proposes* merges — it never auto-merges. The human always makes the final merge call.
- **Terminology is locked.** UI copy uses **"inputs"** (matching the existing drop-zone hint "Drop inputs here to create a new cluster"), **"cluster"**, and the verb **"Merge."**

---

## Non-goals

- **Splitting a cluster** (the inverse operation) is not covered here.
- **Editing cluster fields** (name/subtype/horizon/likelihood/description) — unchanged; merge only *reads* them to decide the survivor's identity.
- **System Map layout/aesthetics** — merge preserves the *data* (edges), not visual node placement. The merged cluster keeps the target's canvas node (if any); the source's node is removed.
- **Cross-project merge** — clusters belong to a project; merging across projects is disallowed (guarded in the RPC).
- **The generation-side dedup fix** (stopping `compute-cluster-suggestions` from *emitting* near-duplicates) is referenced as v2 convergence but specified only at a high level here; it warrants its own implementation pass.

---

## Data model — the merge operation

### Why a server-side RPC (not client calls)

Every foreign key referencing `clusters(id)` is `ON DELETE CASCADE` (verified: `cluster_inputs`, `canvas_nodes`, `relationships.from_cluster_id`, `relationships.to_cluster_id`, `scenario_clusters`, `cluster_suggestions.target_cluster_id`). This means **anything not explicitly moved to the target before the source is deleted is silently destroyed by the cascade.** A merge is therefore a *move-then-delete* sequence that must be **atomic** — a partial failure (inputs moved but source undeleted, or edges half-repointed) leaves the graph corrupt.

The merge is implemented as a single `SECURITY DEFINER` Postgres function, `merge_clusters(p_source, p_target)`, run in one transaction — mirroring the existing `duplicate_input_to_cluster` RPC pattern (including its caller-ownership check).

### Confirmed schema facts (as of 2026-09-26)

| Table | Relevant key | Merge implication |
|---|---|---|
| `cluster_inputs` | `UNIQUE (cluster_id, input_id)`, `id default uuid_generate_v4()` | Move inputs with `ON CONFLICT (cluster_id, input_id) DO NOTHING` — dedupes shared inputs |
| `scenario_clusters` | `UNIQUE (scenario_id, cluster_id)`, `id default gen_random_uuid()` | Move memberships with `ON CONFLICT (scenario_id, cluster_id) DO NOTHING` |
| `relationships` | `from_cluster_id`, `to_cluster_id`, `type` — **no unique constraint** | Dedup and self-loop avoidance must be done manually |
| `canvas_nodes` | `cluster_id` (cascade) | Source's node is dropped; target keeps its own |
| `scenarios.cluster_ids` | legacy `uuid[]` array, **not** an FK, **not** source of truth | Defensively scrub source id → target (dedup) so stale references don't linger |

### `merge_clusters(p_source uuid, p_target uuid)` — logic

**Guards (raise / no-op on violation):**
1. `p_source <> p_target` (no self-merge).
2. Both clusters exist and share the same `project_id` (no cross-project merge).
3. Caller owns the workspace: both clusters' `workspace_id = get_workspace_id()`. (SECURITY DEFINER bypasses RLS, so this check is explicit — same as `duplicate_input_to_cluster`.)

**Transaction body (order matters):**
1. **Inputs** → `insert into cluster_inputs (cluster_id, input_id, workspace_id) select p_target, input_id, workspace_id from cluster_inputs where cluster_id = p_source on conflict (cluster_id, input_id) do nothing;`
2. **Scenario memberships** → same pattern into `scenario_clusters` with `on conflict (scenario_id, cluster_id) do nothing`.
3. **Relationships (edges)** — repoint only the edges worth keeping; let the rest fall to the cascade:
   - `update relationships set from_cluster_id = p_target where from_cluster_id = p_source and to_cluster_id <> p_target and not exists (select 1 from relationships r2 where r2.from_cluster_id = p_target and r2.to_cluster_id = relationships.to_cluster_id and r2.type = relationships.type);`
   - symmetric `update` for `to_cluster_id = p_source` (guard `from_cluster_id <> p_target` + duplicate check).
   - Any edge still touching `p_source` after this (self-loops where the other end is the target; duplicates of an existing target edge) is left to be removed by the cascade in step 6. This is self-consistent even when two source edges would collapse onto the same target edge — the first repoints, the second's `not exists` check then sees it and declines, so it stays on the source and is cascade-dropped.
4. **Legacy array** → `update scenarios set cluster_ids = <source replaced by target, de-duplicated> where p_source = any(cluster_ids);` (defensive; the app derives from `scenario_clusters`, so this only prevents stale array cruft).
5. **Canvas node** → no action needed; the source's `canvas_nodes` row cascade-deletes in step 6. (Target keeps its own node. If the source was on the map but the target was not, the merged cluster is simply not on the map — acceptable for v1; see Open Questions.)
6. **Delete** `p_source` → cascade sweeps its remaining `cluster_inputs`, `canvas_nodes`, self-loop/duplicate `relationships`, `scenario_clusters`, and `cluster_suggestions`.
7. **Return** the target id and a small summary (e.g. count of inputs moved) for the toast.

**Field reconciliation (Phase 1):** the **target wins** entirely — its name, subtype, horizon, likelihood, and description are retained; the source's are discarded. The confirm dialog states this explicitly. (v2: optional field-level reconciliation / description append.)

**Grants & migration:** new migration, full-timestamp filename (`YYYYMMDDHHMMSS_merge_clusters.sql`) to avoid the bare-date `db push` collision gotcha. `grant execute on function public.merge_clusters(uuid, uuid) to authenticated;` (per the Oct-2026 explicit-grant requirement). Apply to **staging first**, regenerate types, then production on merge to `master`.

### Client state — `useAppState.mergeClusters(sourceId, targetId)`

- Optimistic update: remove `source` from `clusters`; union `source.input_ids` into `target.input_ids`; in any local `scenario.cluster_ids` containing `source`, swap → `target` (dedup).
- Call the RPC (`supabase.rpc('merge_clusters', { p_source, p_target })`).
- On error: roll back optimistic state (or refetch the project's clusters + scenarios) and show an error toast.
- `touchProjectLocal(projectId)` so the Overview "last activity" reflects it.
- Success toast: `Merged "<source name>" into "<target name>"`.

---

## Phase 1 — manual drag-to-merge

### Interaction model

The drop-target half already exists: every cluster card and list row in `ClustersPanel.jsx` is wired for `onDragOver` / `onDrop` / drop highlighting (today the payload is *inputs*, handled by `ClusterScreen`'s `handleDrop(clusterId, isAlt)`). Phase 1 adds the **source** side and a **payload-kind discriminator**.

**Making clusters draggable:**
- Cluster cards (card view) and rows (list view) become `draggable`.
- `ClusterScreen` gains a drag-kind discriminator. Minimal shape: keep `dragIds` for inputs and add `draggedClusterId: string | null`; a drop handler checks which is set. (Cleaner alternative: unify into `drag: { kind: 'inputs', ids } | { kind: 'cluster', id }`. Either is fine; the unified shape is tidier if we expect more drag types later.)

**Dropping a cluster onto another cluster:**
- If the drag payload is a **cluster** and the drop target is a **different** cluster → open the **merge confirm dialog** (do **not** merge on drop; confirm first).
- If the drag payload is **inputs** → existing assign/copy behavior, unchanged.
- Dropping a cluster onto **itself** → no-op.
- Dropping a cluster onto the **drop-to-create zone** or empty space → no-op (Phase 1). (v2 could interpret drop-on-rail as "merge into the viewed cluster.")

**Affordance / drop hint:** reuse the existing Move/Copy pill mechanism. While dragging a cluster over a valid target, the pill reads **"Merge into «Target»"** in `c.brand`. The target highlights with the same `isDropTarget` treatment already used for input drops.

**Confirm dialog (reuse `ConfirmDialog`):**
- Title: `Merge clusters?`
- Body: `"«Source»" will be merged into "«Target»". Its N inputs move to "«Target»", and "«Source»" — including its name, type, and description — will be deleted. This can't be undone.`
- Primary action: **Merge** (destructive styling). Secondary: **Cancel**.
- **Survivor swap (recommended):** a small "↔ Swap" affordance in the dialog to flip which cluster survives, so a practitioner who dragged them in the "wrong" direction doesn't have to cancel and re-drag. (Open Question OQ-1 — include in Phase 1 or defer.)

**Accessibility fallback (recommended for Phase 1):** drag-and-drop alone is not keyboard- or touch-accessible. Add a non-DnD entry point — a **"Merge into…"** action in the cluster's overflow/row menu that opens a cluster picker (reusing `ClusterAssignMenu`'s portal pattern) → same confirm dialog. Without this, merge is unreachable for keyboard/touch users. (Open Question OQ-2 — Phase 1 or v2.)

### Phase 1 scope (build list)

1. `merge_clusters` RPC migration (inputs + scenario_clusters + relationships repoint + legacy-array scrub + delete), applied to staging.
2. `useAppState.mergeClusters()` with optimistic update, rollback, toast.
3. Cluster cards/rows made draggable; drag-kind discriminator in `ClusterScreen`.
4. Cluster-on-cluster drop routes to the confirm dialog; "Merge into X" hint pill.
5. `ConfirmDialog` wiring (with survivor-swap if OQ-1 = yes).
6. Menu fallback "Merge into…" (if OQ-2 = yes).
7. Tests (see Testing).

**Scope lever:** the riskiest RPC logic is the `relationships` repoint/dedup. If we want to ship Phase 1 faster, a **lossy v1 RPC** (move inputs + scenario_clusters, let edges cascade-drop) is an option — acceptable given real users rarely have both a duplicate *and* map edges early on, and the audited test projects don't care about the map. Recommendation: **do the edge repoint in Phase 1** (it's write-once server-side and avoids shipping silent data loss), but treat it as the part that most needs tests.

---

## v2 and later

### 1. AI-suggested merges — the overlap detector (convergence with the dedup fix)

This is the higher-value half and the reason merge is worth building as a shared primitive. Investigation established the detector design with real data:

- **Relative, not absolute, thresholds.** Per-project centroid-cosine baselines vary enormously (median 0.39–0.66 across the corpus), so a fixed cutoff is meaningless. Score each pair against its *own* project's distribution (z-score / percentile).
- **Two complementary signals.** Member-**centroid** cosine catches most dups, but misses "same concept, different source articles" (the data-centers community pair scored only 0.758 on centroids and would have been missed). **Name + description embedding** similarity catches those. Flag if *either* is a relative outlier.
- **Over-broad catch-all detection** (a separate pathology): a cluster whose centroid sits unusually close to the *project* centroid is too generic ("Forces shaping the data center fight") — flag differently from a pairwise dup.

**Surfaces:**
- On **suggestion cards** (`ClusterSuggestions.jsx`): a "⚠ Similar to «X»" note with **Keep both / Merge** — the practitioner decides (principle 4).
- On the **cluster list**: a passive "possible duplicate" affordance that opens the same Merge flow.

**Generation-side dedup** (`compute-cluster-suggestions`): after the parallel naming pass, embed each proposed cluster's name+description, compare pairwise **and** against existing clusters, and either collapse or flag intra-batch duplicates *before returning them* — so a single run can't dump 24 suggestions with three twins inside. This closes the 2026-09-08 regression.

The detector's scoring logic should be extracted as a **pure, unit-tested module** (mirroring `src/publish/*.js`), consumed by both the edge function and any client-side "possible duplicate" hinting.

### 2. Multi-select merge

Card view already supports multi-select (`selectedClusterIds`). Natural extensions:
- Drag several selected clusters onto one target → merge all into it (one confirm, N sources).
- A **"Merge selected"** bulk action in the existing selection action bar, opening a picker for the survivor.

### 3. Undo

No undo infrastructure exists today; the Phase 1 safety net is the confirm dialog. v2: a **"Merged. Undo"** toast backed by a pre-merge snapshot (the source cluster's row + its `cluster_inputs` / `scenario_clusters` / `relationships`), restorable within the toast window. Non-trivial because the source id is gone — undo would recreate it (or the snapshot must be captured before delete and replayed).

### 4. Richer reconciliation & preview

- **Field-level reconciliation:** choose per-field which cluster's value survives (name from A, description from B), or append descriptions rather than discard.
- **Merge preview:** before confirming, show the combined input list and any edge changes.

### 5. Merge from the ClusterRail

Drop a cluster onto the currently-viewed cluster in `ClusterRail` → merge into it, consistent with the rail's existing drop-to-assign behavior.

---

## Open questions

- **OQ-1 — Survivor swap in Phase 1?** Include the "↔ Swap" control in the confirm dialog so drag direction isn't binding? *Recommendation: yes — cheap, prevents a re-drag.*
- **OQ-2 — Accessibility fallback in Phase 1?** Ship the non-DnD "Merge into…" menu action in Phase 1, or defer to v2? *Recommendation: Phase 1 — DnD-only leaves the feature unreachable for keyboard/touch.*
- **OQ-3 — Cross-subtype merge.** Merging a Tension into a Trend: target's subtype silently wins. Warn, or accept silently? *Recommendation: accept silently — the survivor's identity is the survivor's; the dialog already names what's discarded.*
- **OQ-4 — Source-on-map, target-off-map.** When only the source has a canvas node, the merged cluster ends up off the map. Acceptable for v1, or should the target inherit the source's node position? *Recommendation: accept for v1; revisit if users notice.*
- **OQ-5 — Edge repoint in Phase 1 vs lossy v1?** See scope lever above. *Recommendation: full repoint in Phase 1, well-tested.*

---

## Testing

Per the repo convention (`node:test` over pure modules; React not unit-tested):

- **RPC** — cannot be `node:test`ed directly. Verify on **staging** with hand-built fixtures covering: input dedup on overlap; scenario membership move; edge repoint with (a) a self-loop case, (b) a duplicate-edge case, (c) two source edges collapsing onto one target edge; legacy-array scrub; ownership rejection (foreign workspace); cross-project rejection.
- **`useAppState.mergeClusters` optimistic/rollback logic** — extract the state transformation (remove source, union input_ids, swap scenario refs) into a pure helper and unit-test it.
- **v2 detector** — extract overlap scoring (relative threshold, centroid + name/description signals) as a pure module and unit-test against fixture distributions, mirroring `src/publish/*.js`.

---

## Convergence summary

One primitive, three consumers:

1. **Phase 1 drag-to-merge** — the manual workflow this spec centers on.
2. **v2 AI "Merge?" nudge** — the dedup fix surfaces suggestions; the *action* is `merge_clusters`.
3. **One-off cleanup** — the outstanding duplicate clusters found in the audit (data-centers community trio, etc.) can be resolved through the UI once merge ships, instead of hand-written SQL.

Recommended sequence: **build the `merge_clusters` RPC + Phase 1 UI first**, then layer v2 overlap *detection* on top of the now-existing merge action.

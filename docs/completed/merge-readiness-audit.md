# Merge-Readiness Audit — `workspace-refactor` → `master`

**Date:** 2026-07-13
**Scope:** Read-only diagnostic ahead of the `workspace-refactor` → production merge, before Alpha user onboarding. No code changes made in this pass.
**Base:** `git merge-base master workspace-refactor` = `5e1c9a6`; **138 commits** on branch not in master.
**Method:** static analysis + `npm run build` (exit **0**) + `npm run lint` (exit **1**). Prod database state was **not** queried in this pass — items requiring live-DB confirmation are marked as such.

---

## BLOCKERS — must fix / confirm before merge

### B1. Two schema migrations must be applied to production as part of the merge
`ProjectOverview.jsx` (the default project landing screen) reads columns that, **per the migrations' own comments, did not exist in production as of 2026-07-09**:

- `projects.last_visited_at` — read at `src/components/screens/ProjectOverview.jsx:119` (`priorVisitedAt`) to compute "N new signals since your last visit."
- `analyses.updated_at` — read at `ProjectOverview.jsx:177` (`latestAnalysisTs`) to attribute the "Continue here" / most-recently-active phase card, and kept current by a trigger.
- `projects.is_sample_template` — required by the sample-project clone path (`server-lib/clone-project.js`); migration comment says "does not exist on either database yet" as of 2026-07-09.

Migrations that provide these:
- `supabase/migrations/20260709_backfill_overview_columns.sql` (adds `last_visited_at`, `analyses.updated_at`, and the `set_analyses_updated_at` trigger)
- `supabase/migrations/20260709130000_add_is_sample_template.sql`

**Impact if merged without applying to prod:** no crash (columns simply read as `undefined`), but Overview's "new signals" count, phase-card recency highlighting, and `[Sample]` project labeling all silently no-op in production. The `20260709_backfill_overview_columns.sql` header states this explicitly: *"it must land before that merge, or both columns silently no-op in production."*

**Action:** confirm these two migrations are applied to prod (`tbxjudpxzovbasuomekq`) at merge time. All migrations here are idempotent (`IF NOT EXISTS`), so re-running is safe if they were already applied since 2026-07-09.

### B2. `db push` version-string hazard on the July migrations
Two branch migrations still carry **bare-date** version strings that coexist with timestamped siblings on the same day:
- `20260705_ai_usage_log_insert_service_role.sql` (alongside `20260705090000`, `20260705100000`, `20260705110000`)
- `20260709_backfill_overview_columns.sql` (alongside `20260709130000`, `20260709140000`, `20260709150000`)

The version strings are now distinct, so the primary-key collision described in `CLAUDE.md` is resolved. **However**, `CLAUDE.md` documents a recurring secondary symptom: once one same-day migration is applied, `supabase db push` can start failing with *"Remote migration versions not found in local migrations directory"* even for correctly-versioned files. This is the exact scenario that will run at merge (B1). Have the documented fix ready: `supabase migration repair --linked --status reverted <bare-date-version>`, then retry `db push --dry-run` (possibly with `--include-all`). Not a code defect — an execution risk that can block the B1 migration push.

---

## SHOULD-FIX — can follow shortly after merge

### S1. `rules-of-hooks` violation in the System Map canvas node (latent crash)
`src/components/screens/ScenarioCanvas.jsx:71-80` — `ClusterNodeComponent` calls `useState` + `useUpdateNodeInternals`, then hits `if (!cluster) return null;` at **line 75**, then calls `useEffect` at **line 78**. When `data.cluster` is falsy the component runs 2 hooks; when truthy it runs 3. If a node's `cluster` prop ever transitions falsy↔truthy across renders (e.g. a cluster deleted while its node is on the canvas), React throws "rendered more/fewer hooks than during the previous render" and the System Map screen white-screens. This is the screen behind the **"System Map"** sidebar item (`Sidebar.jsx:45` maps System Map → screen `"scenarios"` → `ScenarioCanvas.jsx`). Currently latent (nodes are built from live clusters), but Alpha users deleting clusters make the toggle path reachable. Flagged by eslint (`react-hooks/rules-of-hooks`). Fix: move the early return below the `useEffect`.

### S2. eslint config gaps make `lint` unusable as a gate (279 errors, ~90% noise)
`npm run lint` exits 1 with **279 errors / 13 warnings**, but the signal is buried:
- **161 errors** are in `extension/dist/*` — **built, untracked artifacts**. `eslint.config.js:8` has `globalIgnores(['dist'])`, which does not match `extension/dist`. Add `extension/dist` (or `**/dist`) to the ignore list.
- **49 errors** are false-positive `no-undef` on `process` / `Buffer` in server-side files (`api/*.js`, `server-lib/*.js`, `scripts/*.js`). These run on the Vercel Node runtime; the flat config just doesn't declare Node globals for those paths. Add a Node `languageOptions.globals` block for server dirs.
- **23 errors** are in prototype/scratch/dead files (`master-prototype.jsx`, `narrative-canvas-variants.jsx`, `prototypes/`, `screens/Clustering.jsx`).

After those config fixes, real shipped-code lint drops to ~30 `no-unused-vars` (cosmetic), 8 `react-hooks/exhaustive-deps`, and S1. Until then, lint can't be wired into CI meaningfully.

### S3. Delete dead `src/components/screens/Clustering.jsx`
Confirmed unimported (only reachable via the `case "clustering"` legacy redirect at `App.jsx:43`, which renders `ClusterScreen`, not `Clustering`). Contributes 12 lint errors. `CLAUDE.md` already flags it as "dead code, safe to delete later." Safe to remove.

### S4. `master-prototype.jsx` contains real defects but is scratch
`no-dupe-keys` (duplicate `borderBottom` at line 990) and unused vars. It's a prototype file, not shipped, but if it's kept in the tree it should be lint-excluded (see S2) or deleted so it doesn't mask real regressions.

### S5. Decide testing posture before Alpha (see Area 6)
`playwright@^1.61.1` is installed but has **no config, no specs, no e2e dir, and is invoked nowhere** — dead weight. There is no Vitest, no pgTAP, and no CI workflow. Either wire up at least a smoke test for the core workflow before Alpha, or explicitly accept manual-only QA and drop the unused Playwright dependency.

---

## CHECKED — AND CLEAR

### Area 1 — Migration reversibility (informational; no down-scripts by design)
Supabase migrations are forward-only here (no `-- down` sections — consistent with the CLI convention). Reversibility by category:
- **Reversible by re-apply** (function/policy `CREATE OR REPLACE` + `GRANT`): `20260705090000_duplicate_input_dest_cluster_check`, `20260705100000_get_seeding_candidates_restrict`, `20260705_ai_usage_log_insert_service_role`. Prior definitions are recoverable from earlier migrations (`20260623`, `20260504`).
- **Column adds** (`is_sample_template`, `source_template_id`, `last_visited_at`, `analyses.updated_at`): mechanically reversible via `DROP COLUMN`, but destructive of any data written after apply. Standard.
- **⚠ Not cleanly reversible — do not attempt a DROP-style rollback:**
  - `20260705110000_scanner_tables_schema.sql` recreates `sources`/`candidates`/`project_sources`/`project_candidates`, which hold live production data (confirmed populated: ~24k candidates, ~146k project_candidates). It's a **documentation** migration (`CREATE TABLE IF NOT EXISTS` — a no-op in prod). A rollback should mean "remove the row from `schema_migrations`," never `DROP TABLE`.
  - `20260709140000_document_auto_populate_project_sources.sql` documents a **pre-existing live trigger**; reversing it would drop behavior other code implicitly relies on.
  - `20260709_backfill_overview_columns.sql` performs a **one-way cleanup** — it `DROP`s the undocumented `analyses_set_updated_at` trigger and installs `set_analyses_updated_at`. No reverse path restores the dropped trigger; reversing would not return the DB to its prior state.

These are expected for documentation/cleanup migrations and are noted for rollback-planning awareness, not as defects.

### Area 2 — RLS & GRANT coverage — CLEAR
The only new tables introduced on the branch are the four scanner tables in `20260705110000_scanner_tables_schema.sql` (`canvas_text_nodes` predates the branch; it's already on master). All four have:
- explicit `GRANT SELECT` to `anon` + `GRANT SELECT,INSERT,UPDATE,DELETE` to `authenticated` and `service_role` (verified: 4× each),
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (4/4),
- SELECT/INSERT/UPDATE policies scoped through workspace/project ownership.

`project_candidates` intentionally has **no DELETE policy** (documented: rows are removed only via FK cascade or the service role) — a deliberate design choice, not a gap. No other `CREATE TABLE` exists in any branch-added migration (the one flagged match in `20260709_backfill_overview_columns.sql:34` is a comment).

### Area 3 — Broken references from the design-system sprint — CLEAR
- **0 genuinely broken relative imports** across 98 files in `src/` and `extension/src/` (the 26 initial `extension/*` hits were `.js`→`.ts` TS-ESM specifiers that resolve correctly under `moduleResolution: "bundler"`).
- `src/App.css` was deleted on the branch and is **imported nowhere** — clean deletion.
- No dangling `tokens.js` references: every `c.<key>` in a token-importing file maps to a real key in the 70-key `c{}` object (the 4 apparent misses — `c.id`, `c.width` — are local `.map((c) => …)` loop variables shadowing the token import).
- The three components `CLAUDE.md` marks as migrated (`shared/HorizonBar.jsx`, `clusters/ClustersPanel.jsx`, `screens/ProjectOverview.jsx`) correctly **do not** import `tokens.js`.
- **`vite build` succeeds (exit 0).**

### Area 4 — Environment parity — CLEAR
- **No** hardcoded staging (`kptatqipjwihkdxdxlvh`) or prod (`tbxjudpxzovbasuomekq`) project IDs anywhere in shippable code (`src/`, `api/`, `server-lib/`, `extension/src/`). All matches live only in migration/doc comments.
- Web client (`src/lib/supabase.js:9-10`) and extension (`extension/src/env.ts`) both build the Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars.
- `SAMPLE_TEMPLATE_PROJECT_ID` is read from `process.env` only (`api/clone-sample-project.js:30`), never hardcoded.
- Note: `.env.local` currently points at **staging** — expected for this branch per `CLAUDE.md` (preview deployments use staging creds). Production Vercel env must have `SAMPLE_TEMPLATE_PROJECT_ID` set to the prod template id (`566911c6-…` per `CLAUDE.md`) — verify at merge.

### Area 5 — Core workflow trace — CLEAR (except S1)
All five stages route to real, existing components (`App.jsx:37-60`):

| Stage | Sidebar label | Screen key | Component |
|---|---|---|---|
| Inputs | Scan | `project` | `ProjectDetail.jsx` |
| Clusters | Cluster | `cluster` | `ClusterScreen.jsx` |
| System Map | System Map | `scenarios` | `ScenarioCanvas.jsx` |
| System Analysis | System Analysis | `analysis` | `SystemAnalysisCanvas.jsx` |
| Future Models | Future Models | `future-models` | `FutureModels.jsx` |

- The data layer (`useAppState.js`) loads all relevant tables: `inputs`, `clusters`, `scenarios`, `canvas_nodes`, `canvas_text_nodes`, `relationships`, `analyses`, `preferred_futures`, `strategic_options`.
- **System Map → System Analysis parent-child:** `SystemAnalysisCanvas.jsx:238` resolves a single analysis per project (`analyses.find(a => a.project_id === activeProjectId)`), consumes `clusters` + `relationships` from `appState`, and persists via `upsertAnalysis` / `deleteAnalysis`. The relationship is wired; the only dependency is `analyses.updated_at` existing in prod (→ B1).
- Terminology drift between internal keys and display labels (`scenarios`=System Map, etc.) is intentional per `CLAUDE.md` and not a defect.
- The one real defect on this path is **S1** (ClusterNodeComponent hooks ordering on the System Map canvas).

### Area 6 — Testing infrastructure status
| Tool | Status | Runs? |
|---|---|---|
| `npm run build` (Vite) | wired | **Yes — passes (exit 0)** |
| `npm run lint` (ESLint) | wired | Runs, **exits 1** (279 errors, ~90% config noise — see S2) |
| Playwright | dep installed (`^1.61.1`), **no config / specs / e2e dir** | **No — not wired in** |
| Vitest | not installed | No |
| pgTAP | no `supabase/tests/`, no `.pgtap.sql` | No |
| CI (`.github/workflows`) | absent | — |

**Currently runnable & green:** `build`. **Runnable & red (non-gating):** `lint`. **Not wired / nothing to run:** Playwright, Vitest, pgTAP. There is no CI, and lint is not part of the build, so the lint failures do not block deploy — but they also mean no automated regression safety net exists for Alpha (→ S5).

---

## Summary

| Severity | Count | Items |
|---|---|---|
| **Blocker** | 2 | B1 (apply overview/is_sample_template migrations to prod), B2 (db-push version hazard at merge) |
| **Should-fix** | 5 | S1 (System Map hooks crash), S2 (eslint config), S3 (delete Clustering.jsx), S4 (prototype lint), S5 (testing posture) |
| **Clear** | Areas 2, 3, 4, 5 (bar S1), + build green | RLS/GRANT complete; no broken refs; env-parity clean; workflow routes intact |

The branch **builds cleanly** and has **no broken references, no RLS/GRANT gaps, and no hardcoded-environment leaks**. The one true gate is **B1** — the two July-9 schema migrations must be confirmed applied to production, or Overview and sample-project features silently degrade. S1 is the only functional bug on the core workflow and is latent; everything else is hygiene.

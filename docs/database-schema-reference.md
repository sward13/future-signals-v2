# Database Schema Reference

A plain-language guide to what's actually stored in the Future Signals database, organized by the five-stage methodology rather than alphabetically. This is generated from `src/types/database.types.ts` (regenerated against the staging project on 2026-07-02), which in turn reflects `supabase/migrations/`. If the codebase's types file is regenerated again, this document should be regenerated alongside it — treat it as a snapshot, not a living view.

Each table below lists its columns with: the column name, a plain-language type, whether it can be empty (nullable), and a note where the column's purpose isn't obvious from its name alone. Relationships between tables are described in prose rather than as raw key lists.

A note on two tables you'll see repeated across every section: **`workspaces`** (the account) and **`projects`** (a single body of foresight work) sit underneath almost everything else in the product. Every table below belongs to exactly one project (directly or via a join table) and, ultimately, one workspace.

---

## 1. Scan

### `inputs`
The individual signals, issues, projections, plans, or obstacles a practitioner captures. An input starts in the Inbox (unassigned) and is later moved into a project, where it becomes raw material for Clusters.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | yes | Null means the input is sitting in the Inbox, not yet assigned to any project |
| name | text | no | The title — the one required field |
| description | text | yes | |
| source_url | text | yes | |
| subtype | text | no | Signal / Issue / Projection / Plan / Obstacle |
| steepled | text[] | no | STEEPLED category tags (Social, Technological, Economic, etc.) |
| signal_strength | text | yes | Practitioner-set: Weak / Moderate / Strong |
| source_confidence | text | yes | Practitioner-set: Low / Medium / High |
| signal_quality | text | yes | Legacy field — retained in the database but no longer shown or edited anywhere in the product |
| horizon | text | yes | H1 / H2 / H3 |
| metadata | jsonb | no | Freeform bucket — holds scanner-promotion data (which projects it was suggested for, its relevance score, whether it's been dismissed) alongside other input-specific detail |
| embedding | vector | yes | Used internally for similarity scoring; not meaningful to view directly |
| is_seeded | boolean | no | True for inputs that arrived via onboarding seeding or the scanner rather than being typed in by hand |
| created_at | timestamp | no | |

---

## 2. Cluster

### `clusters`
The thematic groupings — Trend, Driver, or Tension — that a practitioner sorts inputs into during the Cluster stage.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | |
| name | text | no | |
| subtype | text | no | Trend / Driver / Tension |
| horizon | text | yes | H1 / H2 / H3 |
| likelihood | text | yes | Possible / Plausible / Probable |
| description | text | yes | |
| created_at | timestamp | no | |

### `cluster_inputs`
The record of which inputs belong to which clusters. An input can sit inside more than one cluster — this join table, not an array on either side, is the actual source of truth for that membership.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| cluster_id | uuid | no | |
| input_id | uuid | no | |
| created_at | timestamp | no | |

### `cluster_suggestions`
An AI-generated clustering suggestion, produced by "Suggested mode" in the Cluster workspace. Each row is either a suggestion to add inputs to an existing cluster, or a proposal for a brand-new cluster — the practitioner accepts or dismisses each one individually.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | |
| name | text | no | Proposed cluster name |
| subtype | text | yes | Proposed Trend / Driver / Tension |
| type | text | yes | Distinct from `subtype` — appears to classify the suggestion itself rather than the proposed cluster; its exact use isn't evident from the schema alone |
| description | text | yes | |
| rationale | text | yes | The AI's explanation for the suggestion, shown under "Why this cluster?" |
| generative_note | text | yes | |
| input_ids | uuid[] | no | The inputs this suggestion proposes grouping |
| target_cluster_id | uuid | yes | Set when this is a suggestion to add inputs to an existing cluster; null when it's proposing a wholly new cluster |
| avg_similarity | number | yes | |
| confidence | text | yes | |
| is_weak_signal | boolean | no | |
| relevance | text | no | `'core'` (default) or `'low'`. Set by `compute-cluster-suggestions`' naming prompt when a `new_cluster` suggestion's only tie to the project is generic domain overlap (or it matches a `scope_out` exclusion) rather than the project's actual question/`scope_in`. `ClusterSuggestions.jsx` renders `'low'` rows in a collapsed "Lower-relevance suggestions" section instead of alongside normal suggestions. Added 2026-09-01 (migration `20260901120000_cluster_suggestions_relevance.sql`). |
| status | text | no | Tracks whether the practitioner has accepted, dismissed, or not yet acted on the suggestion |
| generated_at | timestamp | yes | |
| acted_on_at | timestamp | yes | |

---

## 3. System Map

### `canvas_nodes`
The saved position of a cluster on a project's System Map canvas. One row per cluster that has been placed on the map — a cluster with no row here simply hasn't been dragged onto the canvas yet.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | |
| cluster_id | uuid | no | |
| x | number | no | Canvas x-position |
| y | number | no | Canvas y-position |
| created_at | timestamp | no | |

### `canvas_text_nodes`
A free-floating text annotation placed directly on the System Map — not attached to any cluster. Used for labels, callouts, or notes on the map itself.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | |
| text | text | no | |
| x | number | no | |
| y | number | no | |
| font_family | text | no | |
| font_size | number | no | |
| bold | boolean | no | |
| italic | boolean | no | |
| color | text | no | Hex color |
| created_at | timestamp | no | |

### `relationships`
A directed connection drawn between two clusters on the System Map — the "drives / inhibits / accelerates / feedback" links that describe how one cluster influences another.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | |
| from_cluster_id | uuid | no | The cluster the relationship originates from |
| to_cluster_id | uuid | no | The cluster the relationship points to |
| type | text | no | Drives / Inhibits / Accelerates / Feedback |
| confidence | text | yes | |
| evidence | text | yes | Supporting rationale for the relationship |
| source_handle | text | yes | Which side of the origin node the connecting line attaches to on the canvas — a rendering detail, not methodology content |
| target_handle | text | yes | Same, for the destination node |
| created_at | timestamp | no | |

**Relationship note:** each System Map relationship connects exactly two clusters within the same project (`from_cluster_id` → `to_cluster_id`), and both `canvas_nodes` and `canvas_text_nodes` belong to exactly one project — there is one System Map per project, matching the product's "built or not built" framing.

---

## 4. System Analysis

### `analyses`
The single System Analysis record for a project — the synthesis of key dynamics, critical uncertainties, and implications drawn from the System Map. Every project has exactly one of these (the underlying relationship is one-to-one).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | One analysis per project |
| key_dynamics | text | yes | |
| critical_uncertainties | text[] | no | |
| implications | text | yes | |
| description | text | yes | |
| confidence | text | yes | |
| created_at | timestamp | no | |
| updated_at | timestamp | yes | |

---

## 5. Future Models

### `scenarios`
A single narrative future scenario — one plausible way the project's system could evolve, built to one of the four archetypes.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | |
| name | text | no | |
| archetype | text | yes | Continuation / Collapse / Constraint / Transformation |
| horizon | text | yes | |
| narrative | text | yes | Free-text narrative |
| description | text | yes | |
| geographic_scope | text | yes | |
| confidence | text | yes | |
| driving_forces | jsonb | no | |
| suppressed_forces | jsonb | no | |
| key_differences | jsonb | no | |
| cluster_ids | uuid[] | no | Legacy column — still present on the table but not read anywhere in the app. The `scenario_clusters` join table below is the real source of truth for which clusters inform a scenario. |
| created_at | timestamp | no | |
| updated_at | timestamp | no | |

### `scenario_clusters`
The record of which clusters inform which scenarios. As with clusters and inputs, this join table — not the legacy `cluster_ids` column on `scenarios` — is authoritative.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| scenario_id | uuid | no | |
| cluster_id | uuid | no | |
| created_at | timestamp | no | |

### `preferred_futures`
A practitioner-authored vision of a desired future state for the project.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | |
| name | text | no | |
| description | text | yes | |
| desired_outcomes | text | yes | |
| guiding_principles | jsonb | no | |
| strategic_priorities | jsonb | no | |
| indicators | jsonb | no | |
| horizon | text | yes | |
| scenario_ids | jsonb | no | A plain JSON array of scenario IDs this preferred future draws on or responds to. This is a real relationship — it's just stored as a JSON array rather than a foreign key or join table, so the database can't enforce that the IDs actually exist. |
| created_at | timestamp | no | |
| updated_at | timestamp | no | |

### `strategic_options`
A candidate strategic response or action a practitioner is weighing.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| project_id | uuid | no | |
| name | text | no | |
| description | text | yes | |
| intended_outcome | text | yes | |
| actions | text | yes | |
| dependencies | text | yes | |
| risks | text | yes | |
| implications | text | yes | |
| feasibility | text | yes | |
| resource_intensity | text | yes | |
| reversibility | text | yes | |
| horizon | text | yes | |
| scenario_ids | jsonb | no | Same pattern as `preferred_futures.scenario_ids` above: a JSON array of the scenarios this option responds to or was stress-tested against, not a formal foreign key relationship. |
| created_at | timestamp | no | |
| updated_at | timestamp | no | |

---

## 6. Cross-cutting infrastructure

Tables that support the product as a whole rather than belonging to one stage of the methodology: the account layer, the project container itself, and the signal scanner's backing tables.

### `workspaces`
The account-level container that owns everything else. One workspace per user account in this version of the product — there's no team or organization layer yet.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| user_id | uuid | no | Links to the Supabase auth user |
| experience_level | text | yes | Null is treated as "regular" throughout the product |
| onboarding_completed | boolean | no | |
| created_at | timestamp | no | |

### `workspace_settings`
Account-wide configuration — one row per workspace.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | One settings row per workspace |
| plan_tier | text | no | |
| ai_cap_monthly | number | no | |
| feature_flags | jsonb | no | |
| preferences | jsonb | no | |
| scanning_enabled | boolean | no | The workspace-wide scanner override — takes precedence over the per-project `projects.scanning_enabled` toggle |
| onboarding_complete | boolean | no | |
| created_at | timestamp | no | |

### `user_preferences`
Per-user notification preferences. This is the one table in the schema keyed directly to the auth user rather than to a workspace, and not every user is guaranteed to have a row — no row means default preferences apply.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| user_id | uuid | no | |
| digest_unsubscribed | boolean | no | Weekly digest email opt-out |
| updated_at | timestamp | no | |

### `projects`
The container for one body of foresight work — everything from Scan through Future Models happens inside a project.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| workspace_id | uuid | no | |
| name | text | no | The one required field |
| domain | text | yes | |
| question | text | yes | The key inquiry question |
| focus | text | yes | |
| geo | text | yes | |
| audience | text | yes | |
| stakeholders | text | yes | |
| assumptions | text | yes | |
| scope_in | text[] | no | In-scope topics; used as a positive weight in scanner relevance scoring |
| scope_out | text[] | no | Explicitly out-of-scope topics; used as a penalty in scanner relevance scoring |
| h1_start / h1_end | text | yes | Horizon 1 date range |
| h2_start / h2_end | text | yes | Horizon 2 date range |
| h3_start / h3_end | text | yes | Horizon 3 date range |
| scanning_enabled | boolean | no | Per-project scanner toggle |
| last_reviewed_at | timestamp | yes | Used for Inbox inactivity detection |
| last_visited_at | timestamp | yes | Used to compute "N new signals since your last visit" on the Overview screen |
| key_question_embedding | vector | yes | Cached embedding of `question` alone, used internally for scanner scoring |
| source_template_id | uuid | yes | References another row in this same `projects` table — set when a project was created by cloning an existing one as a template. Not referenced anywhere else in this document; it doesn't appear in the CLAUDE.md data model notes, so treat it as a newer addition. |
| created_at | timestamp | no | |

### `sources`
A feed or publication the scanner monitors for new material — for example an RSS feed or a named outlet.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| owner_id | uuid | yes | Links to a workspace for a private/custom source added by that workspace; null means it's a shared source available across all workspaces |
| name | text | no | |
| url | text | no | |
| domain | text | no | |
| source_type | text | no | |
| credibility | text | no | |
| active | boolean | no | |
| last_fetched_at | timestamp | yes | |
| created_at | timestamp | no | |

### `source_health`
A monitoring snapshot for one source — one row per source, refreshed on each health check.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| source_id | uuid | no | One health row per source |
| status | text | no | |
| consecutive_failures | number | no | |
| last_successful_fetch | timestamp | yes | |
| items_last_fetch | number | yes | |
| avg_summary_length | number | yes | |
| dedup_rate | number | yes | |
| promotion_rate | number | yes | Share of this source's candidates that get promoted into a project's Inbox, across all projects |
| avg_score_across_projects | number | yes | |
| top_dismissal_reason | text | yes | |
| checked_at | timestamp | no | |

### `candidates`
A raw item the scanner has pulled in from a source — before any practitioner has seen it. Candidates are scored per-project (see `project_candidates` below); the ones that score highly enough get promoted into a project's Inbox as an `inputs` row.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| source_id | uuid | no | |
| title | text | no | |
| url | text | no | |
| summary_raw | text | yes | Raw scraped summary |
| summary_ai | text | yes | AI-generated summary; display code should prefer this over `summary_raw` when both are present |
| steepled | text[] | no | |
| status | text | no | |
| embedding | vector | yes | |
| published_at | timestamp | yes | |
| ingested_at | timestamp | no | When the scanner pulled this item in — use this for "recency," not `created_at` (there is no `created_at` column on this table) |
| last_digest_at | timestamp | yes | |
| expires_at | timestamp | no | |

### `project_sources`
Records which scanner sources a given project has opted into or out of.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| project_id | uuid | no | |
| source_id | uuid | no | |
| opted_in | boolean | no | |
| created_at | timestamp | no | |

### `project_candidates`
The scanner's scoring record of one candidate against one specific project — the data behind whether and how a candidate is surfaced as an AI-suggested input for that project.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| project_id | uuid | no | |
| candidate_id | uuid | no | |
| key_question_sim | number | yes | Similarity to the project's primary embedding text (question + focus only — see note below on why scope_in isn't folded in) |
| corpus_sim | number | yes | Similarity to the project's existing accepted inputs (positive pool). Weighted only 10% as of 2026-09-01 — real data showed this signal runs *backwards* (negatively correlated with actual topical relevance) for projects whose promoted-input history is itself topically broad; see the note on `api/score.js`'s weights below |
| negative_pool_sim | number | yes | Decay-weighted (90-day half-life) similarity to this project's dismissed candidates, computed live per scoring run by `api/score.js`. Column existed since the Level 3 design but was always `NULL` until 2026-09-01 — `project_negative_pool` (below) is not the source; see its note. Feeds a small, capped penalty (`applyNegativePoolPenalty` in `server-lib/scoring.js`), not a full-weight scoring term — real data showed it's ~93% correlated with `corpus_sim` (both pools draw from the same distribution), so it can only meaningfully penalize a candidate that clears `corpus_sim` by a real margin, not serve as an independent positive/negative signal. |
| scope_in_sim | number | yes | Added 2026-09-01. A genuine, separately-weighted scoring input (30% as of the same date) — *not* folded into `key_question_sim`. Real production data (833 candidates, "Future of data centers" project) showed folding scope_in into one combined embedding measurably *reduced* its ability to separate on-topic from off-topic candidates versus scoring it as its own term — it's actually the single strongest individual signal measured, stronger than `key_question_sim` itself. `NULL` when the project has no `scope_in` set (weight is omitted and the rest renormalized, not silently dropped). |
| scope_out_sim | number | yes | Added 2026-09-01. Candidate similarity to `scope_out` text; drives the scope_out penalty. `NULL` when the project has no `scope_out` set. |
| scope_out_penalty | text | yes | Added 2026-09-01. `'hard'`, `'soft'`, or `NULL` (no penalty applied) |
| focus_used | boolean | no | Added 2026-09-01, default `false`. Whether `focus` was non-empty and included in the primary embedding for this scoring run |
| score | number | yes | Combined relevance score as of 2026-09-01 — `blendRelevanceScore` (primary 40% / scope_in 30% / credibility 20% / corpus 10%, renormalized when scope_in is absent) in `server-lib/scoring.js`, then `applyScopeOutPenalty`, then `applyNegativePoolPenalty`. Weights were revised twice in one sitting (first pass kept corpus at 20% and folded scope_in into the primary embedding; both were reverted after real-data verification showed they underperformed — see `server-lib/scoring.js` comments for the actual measured effect sizes) |
| classification | text | yes | E.g. emerging vs. reinforcing — still driven by plain `key_question_sim`/`corpus_sim` thresholds, unaffected by the 2026-09-01 reweighting |
| scored_at | timestamp | yes | Populated by `api/score.js` as of 2026-09-01; `NULL` on rows scored before that date (decay calculations fall back to `created_at` for those) |
| surfaced | boolean | no | Whether this candidate was actually shown to the practitioner as a suggestion |
| user_action | text | yes | What the practitioner did with it (accept / dismiss), if anything |
| dismissal_reason | text | yes | |
| created_at | timestamp | no | |

### `project_negative_pool`
A per-project cache of what this project's practitioner has already rejected, intended to down-rank similar candidates in the future. One row per project. **Not read or written by the live scoring path** — `api/score.js` computes `negative_pool_sim` live each run directly against individual dismissed-candidates' embeddings (mirroring how `corpus_sim` already works against individual promoted-input embeddings), rather than maintaining this centroid. Referenced only by `clone-project.js` (walked/copied like any other project-scoped table). The spec's own design treats the centroid as an optional performance optimization for projects with 200+ dismissals — worth revisiting if per-item computation ever becomes a bottleneck, but not needed at current volumes.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | no | |
| project_id | uuid | no | One row per project |
| centroid_embedding | vector | yes | The averaged embedding of dismissed candidates for this project |
| count | number | no | How many dismissed candidates fed into the centroid |
| recomputed_at | timestamp | no | |

---

## Omitted from this reference

- **`ai_usage_log`** — a per-call log of AI token usage and cost, keyed to workspace. This is operational/billing bookkeeping rather than methodology content, so it's left out here. Flag if cost visibility would be useful and it can be added.

No other tables or columns in `database.types.ts` were left out. If a table looks like it's mid-migration or has an inconsistency worth knowing about, it's called out inline above rather than smoothed over — see in particular the `cluster_suggestions.type` vs `subtype` note, the legacy `scenarios.cluster_ids` column, and the unexplained `projects.source_template_id` column.

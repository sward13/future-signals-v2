# Feature Spec: AI Signal Scanner

**Status:** Layers 1–3 (Source Corpus, Ingestion, Scoring) core implemented, including Level 3 (negative embedding pool) refinement, live since 2026-09-01. Level 1 (heuristic reweighting) and Level 2 (few-shot contextual scoring) remain post-launch — corrected from a prior version of this line that mislabeled Level 1 as "Layer 1" and claimed Level 3 hadn't shipped.
**PRD section:** Addendum (slots after Input Creation, before Clustering)  
**Last updated:** 4 September 2026 — reconciled against the live implementation as part of the source-confidence-unification work (see the new callout below)

---

> **Doc-drift note (2026-09-04):** This spec had fallen behind the live implementation in several ways caught during this week's source-confidence-unification work — weights, model vendor, and the Layer 1/Add-as-signal behavior below are corrected in place. A few further discrepancies were found but are flagged rather than fully reconciled here, since fixing them properly means rewriting the affected sections rather than a line-level correction:
> - **Recency is not actually part of ongoing scanning's score.** `recencyScore()` in `server-lib/scoring.js` is only called by the onboarding composite (`scoreCandidate()`); `blendRelevanceScore()` — the function `api/score.js` uses for every ongoing digest score — has no recency term. The "Recency" bullet under Layer 3 Scoring inputs describes a signal that doesn't apply outside onboarding.
> - **Diversity bonus is onboarding-only.** A "diversity cap" exists in `api/seed-onboarding.js`; there is no equivalent in `api/score.js`'s ongoing scoring path. The Layer 3 "Diversity bonus" bullet reads as if it applies generally.
> - **Level 1 (Heuristic Reweighting) has not shipped.** No `project_scoring_weights` table, source hit-rate downweighting, or STEEPLED-affinity reweighting exists anywhere in the codebase, despite the old Status line implying otherwise.
> - **Level 3's actual mechanics are more conservative than described.** The "incorporates the delta" language under Level 3 suggests `positive_pool_sim − negative_pool_sim` feeds the score directly. The live `applyNegativePoolPenalty` only penalizes once `negative_pool_sim` clears `corpus_sim` by a small margin (0.015), capped at 0.3, weighted 0.15 — added after real production data showed the two similarities are ~93% correlated, so an uncapped delta would mostly cancel shared noise rather than isolate a real signal.
> - **`candidates.status` enum is wrong.** The spec lists `pending · scored · promoted · dismissed · expired`. The real enum is `pending · scored · promoted · rejected · expired` — there is no `dismissed` status on `candidates` (dismissal lives on `project_candidates.user_action`), and `rejected` (set when the classification call judges a candidate not relevant) is missing from the spec entirely.
> - **Layer 2's "Dedup" step overclaims.** Only URL-based dedup is implemented (`api/scan.js`). The described title-similarity/cosine cross-outlet dedup doesn't exist.
> - **Layer 2 undersells the real pipeline.** A synchronous commercial-URL-pattern filter and a real `gpt-4o-mini` relevance-gate call (`checkRelevance` in `api/scan.js`, before a candidate is even inserted) both run ahead of the Fetch → Dedup → Classify → Embed steps described below, and aren't mentioned there.
> - **`project_negative_pool` exists but is dormant.** The real table (referenced in `server-lib/clone-project.js`, documented in `docs/database-schema-reference.md`) matches this spec's proposed centroid-summary table (called `project_negative_pool_summary` below), but the live scoring path never reads or writes it — `api/score.js` computes the negative pool per-item, live, every run instead.

## Overview

The AI Signal Scanner continuously monitors curated and user-defined sources to surface candidate signals relevant to a user's active projects. It serves two use cases through a shared architecture:

1. **Onboarding seeding** — helps new users populate their first project with real signals during setup, reducing the cold-start problem.
2. **Ongoing scanning** — delivers a periodic digest of candidate signals scoped to each project's key question, domain, and existing corpus.

The feature ranked highly in user survey results as a desired capability. The design philosophy follows the platform's core principle: AI as scaffold. The scanner surfaces and pre-enriches candidates; the practitioner decides what constitutes a signal.

---

## Architecture: Three Layers

### Layer 1 — Source Corpus

A **Source** is a first-class entity representing a monitored information feed.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | e.g. "MIT Technology Review" |
| `url` | text | RSS/Atom feed URL |
| `domain` | text | STEEPLED-adjacent domain category |
| `source_type` | enum | `curated` · `user_added` |
| `credibility` | enum | `institutional` · `specialist` · `general` · `unvetted` — **internal-only as of 2026-09**, see below |
| `source_confidence` | enum | `low` · `medium` · `high` — **user-facing field, added 2026-09** |
| `owner_id` | uuid | null for curated (platform-wide); user id for user-added |
| `active` | boolean | soft-disable without deletion |
| `last_fetched_at` | timestamptz | tracks cron state |
| `created_at` | timestamptz | |

**Curated sources** are maintained by A+W per domain. They ship as seed data and are shared across all users. These are the editorial differentiator — quality-controlled, regularly reviewed, and versioned. Target: 15–25 curated sources per domain at launch.

**User-added sources** are private to the user who added them. A user can add an RSS feed URL, assign it a domain, and now (as of the 2026-09 source-confidence-unification pass) **edit** a source's name, URL, and domain after creation, not just add or delete it — Sources previously had no edit path. User-added sources default to `credibility: unvetted` and `source_confidence: low`.

**Two separate confidence scales, deliberately decoupled (as of 2026-09):**
- `credibility` (institutional/specialist/general/unvetted) is retained purely as an **internal scoring-weight input** — it feeds `CREDIBILITY_SCORES` in `server-lib/scoring.js` (see Layer 3) and is otherwise invisible to users. It is no longer shown anywhere in the UI.
- `source_confidence` (Low/Medium/High) is the **user-facing field** — set on Add/Edit Source, shown as a badge on the Sources list, and propagated to signals promoted from that source via the shared `deriveSourceConfidence()` function in `server-lib/scoring.js` (prefers the source's own `source_confidence`; falls back to deriving it from `credibility` for a source that predates the column). This is the same Low/Medium/High field that already existed on signals as "Source Confidence" — the two are now backed by one taxonomy instead of two disconnected ones.
- The mapping used to backfill every existing source's `source_confidence` from its prior `credibility` value: `institutional → high`, `specialist → medium`, `general → low`, `unvetted → low`.

Sources attach to domains, not projects. A project inherits all sources matching its domain (both curated and user-added), plus any sources the user has explicitly linked to that project regardless of domain.

**Junction table: `project_sources`** — allows users to opt specific sources in or out of a project's scanning scope. By default all domain-matched sources are included.

### Layer 2 — Ingestion & Pre-processing

A server-side cron job (initially nightly; configurable to 2×/day for higher tiers) performs:

1. **Fetch** — pull new items from all active source feeds. Standard RSS/Atom parsing. Store raw items in a `candidates` table.
2. **Dedup** — URL-based deduplication, plus title similarity check (cosine on embeddings) to catch the same story from multiple outlets.
3. **Classify** — `gpt-4o-mini` call per candidate:
   - STEEPLED category assignment (may be multi-label)
   - Brief summary (2–3 sentences, used for digest display)
   - Domain relevance tag
4. **Embed** — generate pgvector embedding for the candidate's title + summary. This embedding is reused in Layer 3 scoring and later in clustering if the candidate is promoted to a signal.

**Candidates table:**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `source_id` | uuid | FK → sources |
| `title` | text | from feed |
| `url` | text | original article URL |
| `published_at` | timestamptz | from feed |
| `summary_raw` | text | feed description/snippet |
| `summary_ai` | text | AI-generated summary (`gpt-4o-mini`) |
| `steepled` | text[] | AI-assigned categories |
| `embedding` | vector(1536) | pgvector |
| `ingested_at` | timestamptz | |
| `status` | enum | `pending` · `scored` · `promoted` · `dismissed` · `expired` |

Candidates are ephemeral by design. Unpromoted candidates expire after 30 days and are soft-deleted (or hard-deleted on a cleanup cron). This keeps the candidates table lean.

**Cost profile:** Layer 2 is the high-volume, low-cost layer. `gpt-4o-mini` classification + `text-embedding-3-small` embedding generation — both OpenAI (the platform's only model vendor; no Anthropic/Claude calls anywhere in this pipeline). For a user with 3 projects spanning 2 domains, pulling from ~40 sources, expect ~50–150 new candidates/day. At `gpt-4o-mini`/embedding pricing this is negligible per-user.

### Layer 3 — Relevance Scoring

This is where the scanner stops being an RSS reader and starts being a foresight tool.

For each active project, a scoring job runs after ingestion completes. It evaluates every new candidate against the project's context:

**Scoring inputs:**

- **Combined project context (question + focus)** — the primary relevance signal. At scoring time, `projects.question` and `projects.focus` are concatenated (with a newline separator) and embedded using `text-embedding-3-small`. Cosine similarity between this combined embedding and the candidate embedding drives 40% of the score. If `focus` is null or empty, the embedding falls back to `question` alone. The combined embedding is computed once per project batch and reused across all candidates; it is never written back to the database.
- **Scope In similarity** — if `projects.scope_in` (a `text[]` array) is non-empty, its elements are joined and embedded. Cosine similarity between this embedding and the candidate embedding contributes a 30% positive signal — as of the 2026-09-01 rebalance below, this is the single strongest individual signal measured, stronger than the primary question+focus similarity itself. If `scope_in` is empty, this term is skipped and its weight is not redistributed (the remaining weights are renormalized to sum to 1.0, not left capped below it).
- **Scope Out penalty** — if `projects.scope_out` (a `text[]` array) is non-empty, its elements are joined and embedded. Cosine similarity between this embedding and the candidate is computed after the weighted sum and applied as a penalty: similarity above 0.75 applies a hard penalty (score × 0.25); similarity between 0.5 and 0.75 applies a soft penalty (subtract `(scope_out_sim − 0.5) × 0.4`). The scope_out embedding is computed once per project batch. If `scope_out` is empty, no penalty is applied.
- **Positive pool (existing corpus)** — average cosine similarity from the candidate to all existing signal embeddings in the project (i.e. signals the user has created or promoted). This produces two distinct signals:
  - **High similarity** → candidate reinforces existing clusters. Label: `reinforcing`.
  - **Low similarity but domain-relevant** → candidate is topically adjacent but doesn't fit existing patterns. Label: `emerging`. These are potential weak signals and are the highest-value output of the scanner.
- **Negative pool (dismissed candidates)** — average cosine similarity from the candidate to embeddings of previously dismissed candidates in the project. High similarity to the negative pool penalises the candidate's score. This carves out regions of the vector space that the user has signalled as "relevant-looking but not what I care about" — capturing the *boundaries* of the user's interest, not just the centre. See **Graduated Scoring Refinement § Level 3** for full mechanics.
- **Source credibility** — curated/institutional sources get a score boost; unvetted sources get a penalty. This isn't a filter — low-credibility sources can still surface if relevance is high — but it affects ranking.
- **Recency** — a decay function that favours newer items but doesn't hard-filter. A 3-week-old article that's highly relevant still surfaces; it just ranks below an equally relevant article from yesterday.
- **Diversity bonus** — if the top N candidates are all from the same source or same STEEPLED category, inject variety. This prevents the digest from becoming a single-source echo chamber.

**Base weight distribution (before scope_out penalty), as of the 2026-09-01 rebalance — pulled directly from `PRIMARY_WEIGHT`/`SCOPE_IN_WEIGHT`/`CREDIBILITY_WEIGHT`/`CORPUS_WEIGHT` in `server-lib/scoring.js`:**

| Signal | Weight | Notes |
|---|---|---|
| Combined question + focus similarity | 40% | Falls back to question-only if focus is null. Was 50% before the rebalance. |
| Scope In similarity | 30% | Skipped, and the remaining weights renormalized, if scope_in is empty. Was 10% (folded into the primary embedding, not a separate term) before the rebalance. |
| Source credibility | 20% | Unchanged. Keys off the retained internal `credibility` field, not the user-facing `source_confidence` — see Layer 1. |
| Corpus similarity (positive pool) | 10% | Was 20% before the rebalance. |

Both changes came from the same real-data check (833 surfaced candidates, "Future of data centers" project, 2026-09-01): folding `scope_in` into the primary embedding measurably *reduced* its ability to separate on-topic from off-topic candidates versus scoring it as its own weighted term, and `corpus_sim` was found to be *backwards* for a project with a topically contaminated positive pool (on-topic candidates scored lower than off-topic ones) — halved rather than zeroed, since this formula runs for every project and a contaminated pool isn't assumed to be the default case. Weights are always renormalized to whatever's actually used (fixing a pre-existing bug where an absent `scope_in` term left weights summing to 0.9, not 1.0, structurally capping the max achievable score for projects without `scope_in`).

The scope_out penalty is applied after the weighted sum as a post-processing step, not as a weight term.

**Critical design constraint:** The negative pool and scope_out penalty must not suppress novelty. Candidates that are distant from both the positive and negative pools — truly novel items in the domain — still surface via the `emerging` classification. The scope_out penalty targets known exclusions explicitly declared by the practitioner; it does not penalise unknown territory. This is essential for a horizon scanning tool.

**Scoring output:**

Each candidate receives a per-project score (0–100) and a classification (`reinforcing` | `emerging` | `noise`). Only candidates scoring above a configurable threshold are surfaced in the digest. The threshold should be set aggressively toward precision initially — better to surface 5 strong candidates than 30 mediocre ones.

**Scored candidates table (`project_candidates`):**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → projects |
| `candidate_id` | uuid | FK → candidates |
| `score` | integer | 0–100 |
| `classification` | enum | `reinforcing` · `emerging` · `noise` |
| `key_question_sim` | float | raw cosine similarity to combined question+focus embedding |
| `corpus_sim` | float | avg similarity to promoted signals (positive pool) |
| `negative_pool_sim` | float | avg similarity to dismissed candidates (negative pool) |
| `scope_in_sim` | float | cosine similarity to scope_in embedding; null if scope_in empty |
| `scope_out_sim` | float | cosine similarity to scope_out embedding; null if scope_out empty |
| `scope_out_penalty` | text | `"hard"` · `"soft"` · null |
| `focus_used` | boolean | whether focus was non-empty and included in primary embedding |
| `surfaced` | boolean | above threshold? |
| `user_action` | enum | null · `promoted` · `dismissed` |
| `dismissal_reason` | text | null · `not_relevant` · `already_captured` · `too_speculative` · `wrong_domain` |
| `scored_at` | timestamptz | |

**Cost profile:** Layer 3 is lightweight compute — it's vector math, not LLM calls. The embeddings already exist from Layer 2. The only cost driver is the number of active projects × candidates, which is manageable.

---

## Graduated Scoring Refinement

The scanner's intelligence improves over time without requiring custom model training or proprietary inference infrastructure. All refinement runs through API calls to foundation models — OpenAI (`gpt-4o-mini`), matching the rest of the platform's AI stack; there is no Anthropic/Claude usage anywhere in this pipeline — and vector operations on pgvector. The "training" is not model weight updates — it's progressive enrichment of the prompt context and scoring inputs derived from the user's accumulated promote/dismiss decisions.

Three levels ship incrementally. Each builds on the previous level's data.

### Level 1 — Heuristic Reweighting (launch)

No ML. No API calls beyond what Layer 2 already performs.

The system aggregates promote/dismiss patterns across the `project_candidates` table to compute simple reweighting factors:

- **Source hit rate** — per source, per domain: what percentage of surfaced candidates get promoted vs dismissed? Sources with consistently high dismissal rates get downweighted in scoring. Sources with high promotion rates get a boost.
- **STEEPLED category affinity** — per project: if a user promotes 80% of `Technological` candidates but dismisses 70% of `Political` ones, adjust category weights for that project's scoring.
- **Dismissal reason patterns** — if `wrong_domain` is the most common dismissal reason for a source, that source may be miscategorised; flag for review.

These heuristics are recomputed weekly (or on-demand when a threshold of new decisions accumulates). They're stored as simple JSON on the project record or in a `project_scoring_weights` table.

**Data requirement:** ~20–30 user decisions (promotes + dismisses) before heuristics become meaningful. Below that threshold, default weights apply.

### Level 2 — Few-shot Contextual Scoring (post-launch iteration)

Augments the vector similarity scoring with a `gpt-4o-mini` call that incorporates the user's decision history as few-shot examples.

For each scoring batch, the system constructs a prompt that includes:

- The project's key question
- The project's domain and time horizons
- 3–5 recently promoted signals (title + summary) as positive examples
- 2–3 recently dismissed candidates with reasons as negative examples
- The candidate to be scored

The model returns a relevance score (0–100) and a one-sentence rationale explaining why the candidate is or isn't relevant to the project. The rationale is stored and optionally displayed in the digest UI as a "why this was surfaced" tooltip.

The LLM score is blended with the vector similarity score — not a replacement. Suggested weighting: 60% vector math, 40% LLM score. This ensures the system degrades gracefully if the LLM call fails or times out.

**Cost profile:** One `gpt-4o-mini` call per candidate per project. For a user with 3 projects and 100 new candidates/day, that's ~300 `gpt-4o-mini` calls/day — well within typical API budgets. The calls are batched and run asynchronously as part of the scoring cron.

**Data requirement:** ~10 promoted signals and ~10 dismissed candidates in the project before few-shot context becomes useful. Below that, the system runs Level 1 + vector scoring only.

### Level 3 — Negative Embedding Pool (post-launch iteration)

Adds a dedicated negative example pool to the vector scoring layer, capturing the geometric *boundaries* of the user's interest in embedding space.

**Mechanics:**

When a user dismisses a candidate, that candidate's embedding (already stored in the `candidates` table from Layer 2) is tagged as a negative example for that project. At scoring time, the engine computes two similarity measures for each new candidate:

- `positive_pool_sim` — average cosine similarity to all promoted signal embeddings in the project
- `negative_pool_sim` — average cosine similarity to all dismissed candidate embeddings in the project

The scoring formula incorporates the *delta* between these two values. A candidate that's close to promoted signals and far from dismissed ones scores highest. A candidate that's close to dismissed items gets penalised. A candidate that's far from both pools is unaffected by this factor — preserving the ability to surface genuinely novel emerging signals.

**Decay function:**

Dismissed candidates' influence on the negative pool decays over time. A 90-day half-life is the starting default: a dismissal from yesterday has full weight; a dismissal from 3 months ago has half weight; a dismissal from 6 months ago has quarter weight.

The decay is applied at query time, not by modifying stored data. Each dismissed candidate's contribution to the negative pool similarity score is multiplied by:

```
weight = 0.5 ^ (days_since_dismissal / 90)
```

This ensures the negative pool stays fresh as projects evolve without requiring the user to manage or prune it. The decay period is configurable per project (stored in project settings) for users who want a longer or shorter memory.

**Rationale for decay:** Projects evolve. A user investigating alternative proteins might dismiss lab-grown meat regulation articles early on because their focus is supply chains. Six months later, their project may have expanded to include regulatory landscape. Without decay, those early dismissals would continue suppressing relevant candidates long after the user's interests have shifted.

**Why this doesn't suppress weak signals:**

The negative pool only penalises candidates with high similarity to previously dismissed items. A truly novel weak signal — something unlike anything in either pool — receives no penalty because its `negative_pool_sim` score is low. The `emerging` classification specifically looks for items with low similarity to the positive corpus AND low similarity to the negative pool AND high relevance to the project key question. The negative pool sharpens the boundary between "novel and interesting" and "familiar and rejected."

**Data storage:**

No new table required. The negative pool is derived from existing data:
- `project_candidates` where `user_action = 'dismissed'` provides the list of negative examples
- `candidates.embedding` provides the vectors
- `project_candidates.scored_at` provides the timestamp for decay calculation

A materialised view or nightly summary table may be useful at scale to avoid recomputing the weighted negative centroid on every scoring run:

```
project_negative_pool_summary
├── project_id
├── centroid_embedding (vector) — weighted average of dismissed candidate embeddings
├── count — number of dismissed candidates in pool
├── recomputed_at (timestamptz)
```

The centroid approach trades per-item granularity for computational efficiency. At small scale (< 200 dismissals per project), compute against individual embeddings. At larger scale, switch to the centroid approximation.

### Refinement levels summary

| Level | Mechanism | Cost | Data threshold | Ships |
|---|---|---|---|---|
| 1 — Heuristics | SQL aggregation on decisions | Zero | ~20–30 decisions | Launch |
| 2 — Few-shot | `gpt-4o-mini` API call with context | Low (batched) | ~10 promotes + 10 dismisses | Post-launch |
| 3 — Negative pool | pgvector similarity with decay | Near-zero (vector math) | ~15+ dismissals | **Shipped 2026-09-01** (mechanics are more conservative than described above — see the doc-drift note near the top) |

All three levels stack. At maturity, a single candidate's score incorporates vector similarity to positive and negative pools, heuristic source/category reweighting, and an LLM-generated relevance assessment — all without a single custom-trained model or any proprietary inference infrastructure.

---

## Digest UX

### Ongoing scanning (returning users)

The digest is accessible from two places:

1. **Project-scoped digest** — within a project, a "Scanner" or "Inbox" tab shows candidates scored for that project. This is the primary interaction surface.
2. **Cross-project digest** — from the Dashboard, a summary card shows total new candidates across all projects with a badge count.

Within the project digest, candidates are grouped into two sections:

- **Emerging** (shown first) — candidates that are domain-relevant but distant from existing corpus. These represent potential new directions. Displayed with a subtle visual distinction (e.g. amber/amber-50 tint to signal novelty).
- **Reinforcing** — candidates that align closely with existing signals or clusters. Displayed with the cluster name they're closest to, giving the user immediate context for why the scanner thinks it's relevant.

Each candidate card shows:
- Title (linked to source)
- AI summary (2–3 sentences)
- Source name + source confidence indicator (Low/Medium/High — `credibility` is internal-only as of 2026-09, see Layer 1)
- STEEPLED category pills
- Published date
- Relevance score (as a subtle meter or just "Strong match" / "Possible match")
- Two action buttons: **Add as signal** (promotes to full signal, pre-populated) and **Dismiss** (with optional reason)

**"Add as signal" flow:** One-click promotion opens the standard signal creation form, pre-populated with:
- Name ← candidate title
- Description ← AI summary
- Source URL ← candidate URL
- STEEPLED ← AI-assigned categories
- Source Confidence ← pre-filled from the source's `source_confidence` value (via the shared `deriveSourceConfidence()` function — see Layer 1), editable by the user before saving. Scanner promotion never touches `signal_quality` — writing scanner-derived values into that legacy field was live behavior until the 2026-09 source-confidence-unification pass, and was removed because `design-principles.md` explicitly forbids it (the terminology table lists `Emerging`/`Established`/`Confirmed` as values to never use for Signal Strength).

The user can edit any field before saving. This is the scaffold principle in action: AI does the heavy lifting of metadata population, the user makes the judgment call.

**Dismiss flow:** Clicking dismiss removes the candidate from the digest. Optionally, the user can tag the reason: `not relevant` · `already captured` · `too speculative` · `wrong domain`. Dismissal reasons feed back into the scoring model over time (future iteration — see Open Questions).

### Onboarding seeding (new users)

During the onboarding flow, after a user creates their first project (with name, domain, and optionally a key question), the scanner runs in a simplified mode:

1. Pull recent candidates from curated sources matching the project's domain.
2. If a key question was provided, run Layer 3 scoring against it. If not, fall back to domain relevance + recency as primary ranking.
3. Present the top 10–15 candidates in a "seed your project" step.
4. The user selects which ones to import. Selected candidates are promoted to signals with pre-populated metadata.

The code path is identical to ongoing scanning — same ingestion, same scoring, same promotion flow. The only differences are:
- No existing corpus to compare against (corpus distance score is zeroed out).
- Key question similarity and recency are weighted more heavily.
- The UI wrapper is an onboarding step rather than a digest tab.

This is clean code reuse. The onboarding step is a view over the same scanning infrastructure.

---

## AI Usage & Cost Management

Signal scanning plugs into the existing tiered AI caps model via `ai_usage_log`.

**Operation types to track:**
- `scan_classify` — `gpt-4o-mini` classification per candidate (Layer 2)
- `scan_embed` — embedding generation per candidate (Layer 2)
- `scan_score` — relevance scoring per project (Layer 3, negligible cost but track for visibility)
- `scan_promote` — signal creation from candidate (counts as standard signal enrichment)

**Tier implications:**

| Tier | Scanning frequency | Sources per project | Candidates surfaced/week |
|---|---|---|---|
| Free | Weekly | Curated only | Up to 10 |
| Pro | Daily | Curated + user-added (up to 20) | Up to 30 |
| Team | 2×/day | Curated + user-added (unlimited) | Up to 50 |

These limits are soft caps on *surfacing*, not on ingestion. All candidates are ingested and scored; the cap controls how many are shown in the digest. This means upgrading a tier immediately surfaces more candidates without re-running ingestion.

---

## Source Curation Strategy

The curated source list is a key differentiator and editorial responsibility.

**Launch target:** 15–25 sources per domain across the 9 predefined domains. ~150–200 sources total.

**Selection criteria for curated sources:**
- Established editorial reputation or institutional authority
- Publishes at a frequency useful for horizon scanning (at least weekly)
- RSS/Atom feed available and well-structured
- Covers forward-looking content (not purely retrospective reporting)
- Geographic and perspective diversity within each domain

**Maintenance cadence:** Quarterly review of curated source list. Track per-source metrics: feed uptime, candidate promotion rate (what % of candidates from this source get promoted by users), dismissal rate. Sources with consistently high dismissal rates get flagged for review.

**Future iteration (v3+):** Community-contributed sources with moderation. Users can nominate sources; A+W reviews and elevates high-quality nominations to curated status. This scales the editorial function without losing quality control.

---

## Data Model Summary

New tables introduced by this feature:

```
sources
├── id, name, url, domain, source_type, credibility (internal scoring-only), source_confidence (user-facing, added 2026-09), owner_id, active, last_fetched_at

project_sources (junction)
├── project_id, source_id, opted_in (boolean, default true)

candidates
├── id, source_id, title, url, published_at, summary_raw, summary_ai, steepled[], embedding, status

project_candidates (scoring results)
├── id, project_id, candidate_id, score, classification, corpus_sim, negative_pool_sim,
│   scope_in_sim, scope_out_sim, scope_out_penalty, focus_used,
│   user_action, dismissal_reason, surfaced, scored_at

project_negative_pool_summary (materialised view, scale optimisation)
├── project_id, centroid_embedding (vector), count, recomputed_at
```

**Indexes:**
- `candidates.embedding` — pgvector ivfflat index for similarity search
- `candidates.url` — unique, for dedup
- `candidates.status` — partial index on `pending` and `scored` for cron job queries
- `project_candidates(project_id, surfaced, user_action)` — for digest queries

**RLS policies:**
- `sources`: curated sources visible to all; user-added sources visible to owner only
- `candidates`: visible to users whose projects include the candidate's source
- `project_candidates`: visible to project members only

---

## Open Questions

**OQ-SCAN-01: Feedback loop sophistication.** ✅ Resolved.  
Specified as a graduated three-level approach in the **Graduated Scoring Refinement** section. Level 1 (heuristic reweighting) ships at launch. Level 2 (few-shot contextual scoring) and Level 3 (negative embedding pool with 90-day decay) ship as post-launch iterations. No custom model training required; all refinement runs through API calls and vector operations.

**OQ-SCAN-02: Full-text ingestion.**  
Layer 2 currently works with RSS title + description only. For richer scoring, we could fetch and parse the full article text. This adds complexity (paywall handling, parsing quality, storage) and cost (longer text → more expensive embeddings). Recommendation: ship with RSS metadata only; add optional full-text fetch as a per-source toggle in a later iteration.

**OQ-SCAN-03: Non-RSS sources.**  
Some valuable sources don't have RSS feeds (e.g. LinkedIn newsletters, Substack without RSS, Twitter/X). Supporting these requires custom scrapers or third-party APIs. Defer to v3; the RSS-first approach covers the majority of institutional and specialist sources.

**OQ-SCAN-04: Scanner as shared project feature.**  
In v2, projects don't have real-time collaboration (deferred to v3). But the scanner produces project-scoped candidates. When collaboration ships, should all project members see the same digest? Should one member's dismissal affect another's view? Flag for v3 design.

**OQ-SCAN-05: Chrome extension integration.**  
The Chrome extension is a manual signal capture tool. Could it also serve as a lightweight "add this site as a source" mechanism? User right-clicks on an article → "Monitor this site for signals." This would extract the site's RSS feed URL (if available) and add it as a user source. Low-effort, high-delight integration point. Needs UX design.

---

## Implementation Sequence

This feature has natural dependency ordering:

1. **Source entity + curated seed data** — table, RLS, seed CSVs for ≥3 domains to start
2. **Candidates table + ingestion cron** — RSS fetch, dedup, `gpt-4o-mini` classification, embedding
3. **Scoring engine** — Layer 3 relevance scoring against project context
4. **Digest UI** — project-scoped candidate list with promote/dismiss actions
5. **Onboarding integration** — wire the "seed your project" step into the onboarding flow
6. **Dashboard summary card** — cross-project candidate count badge
7. **User-added sources UI** — settings panel for adding custom RSS feeds
8. **Tier caps integration** — wire scanning operations into ai_usage_log

Steps 1–4 form the MVP. Steps 5–8 can follow incrementally.

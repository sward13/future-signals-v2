-- Rich-text rollout — Batch 2: Preferred Futures (preferred_futures table).
-- Parallel jsonb `_doc` columns for the two narrative fields (standard variant,
-- has Markdown export). Dual-write + read-time fallback; existing rows
-- backfilled via scripts/backfill-richtext-docs.js. See Batch 1 migration notes.
--
-- Applied to staging (kptatqipjwihkdxdxlvh); production on merge.

alter table preferred_futures
  add column if not exists description_doc      jsonb,
  add column if not exists desired_outcomes_doc jsonb;

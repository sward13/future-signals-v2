-- Rich-text rollout — Batch 4: Strategic Options (strategic_options table).
-- Parallel jsonb `_doc` columns for the six narrative fields. Standard variant.
-- Markdown export covers description/intended_outcome/actions/implications only
-- (dependencies/risks are not in buildMarkdown today — unchanged). Dual-write +
-- read-time fallback; backfill via scripts/backfill-richtext-docs.js.
-- Applied to staging; production on merge.

alter table strategic_options
  add column if not exists description_doc      jsonb,
  add column if not exists intended_outcome_doc jsonb,
  add column if not exists actions_doc          jsonb,
  add column if not exists implications_doc     jsonb,
  add column if not exists dependencies_doc     jsonb,
  add column if not exists risks_doc            jsonb;

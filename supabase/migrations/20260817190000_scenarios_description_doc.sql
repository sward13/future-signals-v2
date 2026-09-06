-- Rich-text rollout — Batch 3: Scenarios description (narrative_doc already
-- exists from the PoC). Standard variant, has Markdown export. Dual-write +
-- read-time fallback; existing rows backfilled via
-- scripts/backfill-richtext-docs.js. Applied to staging; production on merge.

alter table scenarios
  add column if not exists description_doc jsonb;

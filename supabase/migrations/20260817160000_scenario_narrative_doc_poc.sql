-- Rich-text editing — proof-of-concept storage column (Scenario Narrative).
--
-- Parallel-column, dual-write approach (pending review before the full rollout):
--   * scenarios.narrative_doc jsonb  — Tiptap JSON document (source of truth)
--   * scenarios.narrative     text   — RETAINED, kept in sync as a plain-text
--                                      flattening for export/rollback/fallback.
--
-- Reads prefer narrative_doc and fall back to wrapping the legacy `narrative`
-- text on the fly (no destructive migration of existing rows for the PoC).
--
-- This is deliberately ONE column for the one proof-of-concept field. The
-- storage strategy for the remaining 12 fields (parallel column vs. in-place
-- convert, and whether to keep the dual-write text column) is a decision to
-- confirm at PoC review before rollout.
--
-- Applied to staging (kptatqipjwihkdxdxlvh) for the preview; production on merge.

alter table scenarios
  add column if not exists narrative_doc jsonb;

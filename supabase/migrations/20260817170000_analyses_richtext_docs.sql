-- Rich-text rollout — Batch 1: System Analysis (analyses table).
--
-- Parallel jsonb `_doc` columns for the three narrative fields, mirroring the
-- Scenario Narrative PoC. Dual-write: the app keeps the legacy text column in
-- sync (docToText flattening) for fallback/rollback; reads prefer the _doc.
-- Existing rows are backfilled out-of-band with textToDoc (JS) —
-- scripts/backfill-richtext-docs.js — which splits on blank lines into
-- multiple paragraph nodes; read paths fall back to wrapping the legacy text
-- for any not-yet-backfilled row.
--
-- System Analysis is publish-only (no Markdown export) — see Phase 0 audit.
--
-- Applied to staging (kptatqipjwihkdxdxlvh); production on merge.

alter table analyses
  add column if not exists description_doc  jsonb,
  add column if not exists key_dynamics_doc jsonb,
  add column if not exists implications_doc jsonb;

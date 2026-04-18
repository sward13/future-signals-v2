-- Source health tracking table for the scanner pipeline.
-- One row per source, upserted after each nightly health check.
-- Internal operations table — no RLS, not user-facing.

CREATE TABLE IF NOT EXISTS source_health (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                uuid         NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  last_successful_fetch    timestamptz,
  consecutive_failures     integer      NOT NULL DEFAULT 0,
  avg_summary_length       integer,
  dedup_rate               float,
  avg_score_across_projects float,
  promotion_rate           float,
  top_dismissal_reason     text,
  items_last_fetch         integer,
  status                   text         NOT NULL DEFAULT 'healthy',
  checked_at               timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(source_id)
);

-- Status values: 'healthy' | 'degraded' | 'dead' | 'noisy' | 'redundant'

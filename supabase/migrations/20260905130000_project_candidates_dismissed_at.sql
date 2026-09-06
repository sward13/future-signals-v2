-- P2 audit finding (2026-09-05): the Level 3 negative-pool decay
-- (server-lib/scoring.js's negativePoolDecayWeight, applied in api/score.js)
-- used `scored_at || created_at` as the dismissal timestamp, because there
-- was no column actually recording when a candidate was dismissed. Dismissing
-- an old, unreviewed inbox item today decayed as if the dismissal happened
-- back when the candidate was originally scored, instead of getting full
-- weight for today's real feedback.
--
-- No backfill: historical dismissals predating this column keep the old
-- (imprecise but working) scored_at/created_at fallback — api/score.js reads
-- `dismissed_at || scored_at || created_at`, consistent with this codebase's
-- existing precedent of not backfilling already-written rows when a default
-- changes.

ALTER TABLE project_candidates
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

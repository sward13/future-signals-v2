-- Backfills project_candidates.dismissed_at for dismissals that predate the
-- column (20260905130000_project_candidates_dismissed_at.sql), which added
-- the column but performed no backfill (audit finding, 2026-09-05).
--
-- dismissSuggestedInput (src/hooks/useAppState.js — the only code path that
-- ever sets project_candidates.user_action = 'dismissed') already wrote the
-- same timestamp into inputs.metadata.dismissed_at on the promoted input row
-- at the moment of dismissal, so historical dismissals are recoverable via
-- that join. Verified against production before writing this: 252 dismissed
-- rows, 221 recoverable this way (~88%) — the remainder have no matching
-- inputs row (e.g. the input was deleted since) or never recorded
-- metadata.dismissed_at, and simply keep dismissed_at NULL. api/score.js's
-- existing fallback chain (dismissed_at || scored_at || created_at) already
-- handles that gracefully — this is a best-effort recovery, not a guarantee
-- every row gets corrected.

update project_candidates pc
set dismissed_at = (i.metadata->>'dismissed_at')::timestamptz
from inputs i
where pc.user_action = 'dismissed'
  and pc.dismissed_at is null
  and i.metadata->>'candidate_id' = pc.candidate_id::text
  and i.metadata->>'dismissed_at' is not null;

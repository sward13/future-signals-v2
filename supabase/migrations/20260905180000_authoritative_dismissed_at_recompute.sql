-- Closes the remaining gap in 20260905160000_fix_project_candidates_dismissed_at_backfill.sql
-- (audit finding, 2026-09-05): that migration only OVERWROTE a row when the
-- corrected, ownership-scoped join found exactly one match. It never RESET
-- a row when the corrected logic found zero or multiple matches — so a row
-- that the original unscoped migration
-- (20260905150000_backfill_project_candidates_dismissed_at.sql) had already
-- written an unverifiable value for could silently keep that value forever,
-- even though the corrected logic can't confirm it.
--
-- This migration is authoritative rather than additive: for every currently
-- dismissed row, it sets dismissed_at to the safely-recovered value when
-- exactly one ownership-scoped match exists (same workspace AND the input's
-- own suggested_projects lists this project), and explicitly resets it to
-- NULL otherwise. No row can retain a value the corrected logic can't
-- verify, regardless of which of the two prior migrations wrote it or in
-- what order they ran.
--
-- Verified against production before writing this: dry-run recompute
-- changes 0 of 221 rows and would null out 0 rows — confirming today's data
-- happens to be fully consistent already. This migration closes the
-- structural gap (a future or differently-ordered run could otherwise
-- silently keep a bad value), not a live data problem on this dataset.
-- Rows reset to NULL here fall back to api/score.js's existing
-- (dismissed_at || scored_at || created_at) chain, same as any dismissal
-- this can't recover.

with candidate_matches as (
  select
    pc.id as pc_id,
    (i.metadata->>'dismissed_at')::timestamptz as dismissed_at_value,
    count(*) over (partition by pc.id) as match_count
  from project_candidates pc
  join projects p on p.id = pc.project_id
  join inputs i
    on i.workspace_id = p.workspace_id
   and i.metadata->>'candidate_id' = pc.candidate_id::text
  where pc.user_action = 'dismissed'
    and i.metadata->>'dismissed_at' is not null
    and exists (
      select 1
      from jsonb_array_elements(coalesce(i.metadata->'suggested_projects', '[]'::jsonb)) as sp
      where sp->>'id' = pc.project_id::text
    )
),
resolved as (
  select pc.id as pc_id, cm.dismissed_at_value as safe_value
  from project_candidates pc
  left join candidate_matches cm on cm.pc_id = pc.id and cm.match_count = 1
  where pc.user_action = 'dismissed'
)
update project_candidates pc
set dismissed_at = resolved.safe_value
from resolved
where pc.id = resolved.pc_id
  and pc.dismissed_at is distinct from resolved.safe_value;

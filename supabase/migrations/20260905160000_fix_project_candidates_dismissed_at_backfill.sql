-- Corrects 20260905150000_backfill_project_candidates_dismissed_at.sql's join
-- (audit finding, 2026-09-05): that migration matched inputs to
-- project_candidates by candidate_id alone. candidates are global, and
-- inputs.metadata (including candidate_id) is preserved verbatim by both the
-- sample-project clone path (server-lib/clone-project.js) and the
-- duplicate-input-to-cluster RPC, so multiple inputs rows — in different
-- workspaces, or the same workspace — can legitimately share one
-- candidate_id. An unscoped join can therefore pull an unrelated dismissal
-- timestamp onto a target row.
--
-- Verified against production before writing this: of 221 dismissed rows,
-- 3 had candidate_id matches spanning more than one workspace and 7 more had
-- multiple same-workspace matches — a real, not just theoretical, gap. None
-- of the 221 values already written happened to be wrong on this data (this
-- corrected query reproduces the same 221 values exactly), but the join
-- itself was unsound and would not be safe to re-run against different data.
--
-- This version requires both: (a) the input row is in the SAME workspace as
-- the project being backfilled, and (b) the input's own
-- metadata.suggested_projects actually lists that project_id — i.e. this
-- specific input's dismissal genuinely covered this specific project.
-- Applied only when exactly one input satisfies both, per row
-- (match_count = 1) — rows with remaining ambiguity are left NULL rather
-- than guessing; api/score.js's existing fallback chain
-- (dismissed_at || scored_at || created_at) already handles that gracefully.

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
)
update project_candidates pc
set dismissed_at = cm.dismissed_at_value
from candidate_matches cm
where pc.id = cm.pc_id
  and cm.match_count = 1
  and pc.dismissed_at is distinct from cm.dismissed_at_value;

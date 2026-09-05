-- P1 security fixes from the 2026-09-05 workspace-refactor→master diff audit.
-- Both issues are live on staging today (verified via pg_policies) but have
-- not yet reached production — this closes them before that merge happens.

-- ─── 1. system-map-templates Storage bucket: drop overly-broad write access ────
-- 20260820120002_system_map_templates_bucket.sql's authenticated insert/update/
-- delete policies checked only bucket_id, so any signed-in user could
-- overwrite or delete curated template assets shared platform-wide. There is
-- no legitimate authenticated write path today — user uploads are explicitly
-- out of scope per 20260820120000_system_map_templates.sql's own comment —
-- and the seed path runs as service_role, which bypasses RLS regardless.

drop policy if exists "system map templates authenticated insert" on storage.objects;
drop policy if exists "system map templates authenticated update" on storage.objects;
drop policy if exists "system map templates authenticated delete" on storage.objects;

-- Public read (curated template art is not sensitive) is untouched.

-- ─── 2. project_system_map_background: validate project ownership, not just workspace_id ─
-- 20260820120000_system_map_templates.sql's policy checked only that the
-- row's own workspace_id matched the caller — never that the referenced
-- project_id actually belongs to that workspace. Since project_id is the
-- primary key (one row per project), a caller could insert their own
-- workspace_id alongside another workspace's project_id, permanently
-- occupying that project's row before its real owner ever sets a
-- background, and injecting attacker-controlled background data into that
-- project's service-role-rendered published page.

drop policy if exists "workspace members manage their system map background" on public.project_system_map_background;
create policy "workspace members manage their system map background"
  on public.project_system_map_background for all
  using (
    workspace_id = get_workspace_id()
    and project_id in (select id from public.projects where workspace_id = get_workspace_id())
  )
  with check (
    workspace_id = get_workspace_id()
    and project_id in (select id from public.projects where workspace_id = get_workspace_id())
  );

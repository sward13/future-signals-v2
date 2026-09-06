-- P2 security hardening, batch 2 of the fix/rls-secondary-fk-validation
-- sweep: clusters. Single project_id, NOT NULL — same shape as batch 1,
-- given its own migration since it's the highest-call-site table in the app
-- (System Map / Cluster screen CRUD).
--
-- Empirically confirmed vulnerable before this fix using a real
-- authenticated (non-service-role) session: a forged insert with a correct
-- workspace_id but a project_id belonging to another workspace's project
-- succeeded. Preserves the existing get_user_workspace_id() pattern and
-- per-command policy structure — only the missing project_id check is
-- added. No prior tracked migration existed for this table's RLS policy.

drop policy if exists "clusters_delete" on public.clusters;
drop policy if exists "clusters_insert" on public.clusters;
drop policy if exists "clusters_select" on public.clusters;
drop policy if exists "clusters_update" on public.clusters;

create policy "clusters_delete" on public.clusters for delete
  using (
    workspace_id = get_user_workspace_id()
    and project_id in (select id from projects where workspace_id = get_user_workspace_id())
  );
create policy "clusters_insert" on public.clusters for insert
  with check (
    workspace_id = get_user_workspace_id()
    and project_id in (select id from projects where workspace_id = get_user_workspace_id())
  );
create policy "clusters_select" on public.clusters for select
  using (
    workspace_id = get_user_workspace_id()
    and project_id in (select id from projects where workspace_id = get_user_workspace_id())
  );
create policy "clusters_update" on public.clusters for update
  using (
    workspace_id = get_user_workspace_id()
    and project_id in (select id from projects where workspace_id = get_user_workspace_id())
  );

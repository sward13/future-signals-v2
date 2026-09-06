-- P2 security hardening, final batch of the fix/rls-secondary-fk-validation
-- sweep: relationships. Three FKs (project_id, from_cluster_id,
-- to_cluster_id), all NOT NULL — the most complex table in the sweep, done
-- last once the pattern was proven on everything simpler.
--
-- Empirically confirmed vulnerable before this fix using a real
-- authenticated (non-service-role) session: a forged insert with a correct
-- workspace_id but a project_id belonging to another workspace's project
-- succeeded (from_cluster_id/to_cluster_id forgery follow the identical
-- shape and are verified alongside project_id below). Preserves the
-- existing inline
-- `workspace_id in (select id from workspaces where user_id = auth.uid())`
-- pattern and per-command policy structure — only the missing project_id/
-- from_cluster_id/to_cluster_id checks are added. No prior tracked
-- migration existed for this table's RLS policy.

drop policy if exists "relationships_delete" on public.relationships;
drop policy if exists "relationships_insert" on public.relationships;
drop policy if exists "relationships_select" on public.relationships;
drop policy if exists "relationships_update" on public.relationships;

create policy "relationships_delete" on public.relationships for delete
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and from_cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and to_cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "relationships_insert" on public.relationships for insert
  with check (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and from_cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and to_cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "relationships_select" on public.relationships for select
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and from_cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and to_cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "relationships_update" on public.relationships for update
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and from_cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and to_cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );

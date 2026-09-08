-- P2 security hardening, batch 4 of the fix/rls-secondary-fk-validation
-- sweep: cluster_inputs and scenario_clusters. Junction tables with no
-- project_id of their own — validated through each referenced table
-- directly (clusters/inputs; scenarios/clusters) rather than through
-- projects.
--
-- Empirically confirmed vulnerable before this fix using a real
-- authenticated (non-service-role) session: a forged insert with a correct
-- workspace_id but a cluster_id/input_id (or scenario_id/cluster_id)
-- belonging to another workspace succeeded. Preserves each table's
-- existing workspace-lookup pattern and per-command policy structure
-- (both only ever had delete/insert/select policies — no update policy
-- existed for either, and none is added here) — only the missing FK checks
-- are added. No prior tracked migration existed for either table's RLS
-- policy.

-- ─── cluster_inputs ─────────────────────────────────────────────────────────
drop policy if exists "cluster_inputs_delete" on public.cluster_inputs;
drop policy if exists "cluster_inputs_insert" on public.cluster_inputs;
drop policy if exists "cluster_inputs_select" on public.cluster_inputs;

create policy "cluster_inputs_delete" on public.cluster_inputs for delete
  using (
    workspace_id = get_user_workspace_id()
    and cluster_id in (select id from clusters where workspace_id = get_user_workspace_id())
    and input_id in (select id from inputs where workspace_id = get_user_workspace_id())
  );
create policy "cluster_inputs_insert" on public.cluster_inputs for insert
  with check (
    workspace_id = get_user_workspace_id()
    and cluster_id in (select id from clusters where workspace_id = get_user_workspace_id())
    and input_id in (select id from inputs where workspace_id = get_user_workspace_id())
  );
create policy "cluster_inputs_select" on public.cluster_inputs for select
  using (
    workspace_id = get_user_workspace_id()
    and cluster_id in (select id from clusters where workspace_id = get_user_workspace_id())
    and input_id in (select id from inputs where workspace_id = get_user_workspace_id())
  );

-- ─── scenario_clusters ──────────────────────────────────────────────────────
drop policy if exists "scenario_clusters_delete" on public.scenario_clusters;
drop policy if exists "scenario_clusters_insert" on public.scenario_clusters;
drop policy if exists "scenario_clusters_select" on public.scenario_clusters;

create policy "scenario_clusters_delete" on public.scenario_clusters for delete
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and scenario_id in (select id from scenarios where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "scenario_clusters_insert" on public.scenario_clusters for insert
  with check (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and scenario_id in (select id from scenarios where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "scenario_clusters_select" on public.scenario_clusters for select
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and scenario_id in (select id from scenarios where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );

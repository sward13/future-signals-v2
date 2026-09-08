-- P2 security hardening, batch 5 of the fix/rls-secondary-fk-validation
-- sweep: canvas_nodes and cluster_suggestions. Two FKs each;
-- cluster_suggestions.target_cluster_id is nullable (null = "suggest a new
-- cluster" rather than "assign to an existing one" — a legitimate state).
--
-- Empirically confirmed vulnerable before this fix using a real
-- authenticated (non-service-role) session: forged inserts with a correct
-- workspace_id but project_id/cluster_id (or project_id/target_cluster_id)
-- belonging to another workspace succeeded on both tables. Preserves each
-- table's existing workspace-lookup pattern and policy structure (canvas_nodes
-- keeps its 4 separate policies and inline
-- `workspace_id in (select id from workspaces where user_id = auth.uid())`
-- form; cluster_suggestions keeps its single `for all` policy and
-- get_workspace_id()) — only the missing FK checks are added. No prior
-- tracked migration existed for either table's RLS policy.
--
-- Schema drift noted during verification (unrelated to this fix — the
-- policy references neither column): staging's cluster_suggestions has a
-- `relevance` (text, not null) column that production does not. Production
-- has no other row-shape difference for this table. Flagging since it's
-- undocumented in any tracked migration, matching this repo's recurring
-- undocumented-schema-change pattern — not fixing it here, out of scope.

-- ─── canvas_nodes ───────────────────────────────────────────────────────────
drop policy if exists "canvas_nodes_delete" on public.canvas_nodes;
drop policy if exists "canvas_nodes_insert" on public.canvas_nodes;
drop policy if exists "canvas_nodes_select" on public.canvas_nodes;
drop policy if exists "canvas_nodes_update" on public.canvas_nodes;

create policy "canvas_nodes_delete" on public.canvas_nodes for delete
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "canvas_nodes_insert" on public.canvas_nodes for insert
  with check (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "canvas_nodes_select" on public.canvas_nodes for select
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "canvas_nodes_update" on public.canvas_nodes for update
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
    and cluster_id in (select id from clusters where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );

-- ─── cluster_suggestions ────────────────────────────────────────────────────
drop policy if exists "cluster_suggestions_all" on public.cluster_suggestions;
create policy "cluster_suggestions_all" on public.cluster_suggestions for all
  using (
    workspace_id = get_workspace_id()
    and project_id in (select id from projects where workspace_id = get_workspace_id())
    and (target_cluster_id is null or target_cluster_id in (select id from clusters where workspace_id = get_workspace_id()))
  );

-- P2 security hardening: validate secondary foreign keys against the
-- caller's own workspace, not just workspace_id itself. Batch 1 of the
-- 12-table RLS sweep (fix/rls-secondary-fk-validation) — single project_id,
-- NOT NULL, no other FK: analyses, preferred_futures, scenarios,
-- strategic_options, canvas_text_nodes.
--
-- Previously, a caller could submit a write with their own correct
-- workspace_id but a project_id belonging to another workspace's project —
-- confirmed exploitable via useAppState.js's direct client-side writes
-- (RLS is the only server-side gate; the app's own UI behavior doesn't
-- change what a raw API call with a valid session can submit).
--
-- Preserves each table's existing workspace-lookup pattern exactly
-- (analyses/scenarios keep their per-command policy structure and inline
-- `workspace_id in (select id from workspaces where user_id = auth.uid())`
-- / `get_user_workspace_id()` forms; canvas_text_nodes/preferred_futures/
-- strategic_options keep their single `for all` policy and
-- `get_workspace_id()`) — only the missing project_id check is added.
--
-- canvas_text_nodes already had a tracked migration for its policy
-- (20260624_canvas_text_nodes.sql). For the other four, this is the first
-- tracked version of their RLS policy — none had a migration file before
-- this (confirmed via a repo-wide search); they were created directly
-- against the database with no prior documented baseline to diff against.

-- ─── analyses ───────────────────────────────────────────────────────────────
drop policy if exists "analyses_delete" on public.analyses;
drop policy if exists "analyses_insert" on public.analyses;
drop policy if exists "analyses_select" on public.analyses;
drop policy if exists "analyses_update" on public.analyses;

create policy "analyses_delete" on public.analyses for delete
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "analyses_insert" on public.analyses for insert
  with check (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "analyses_select" on public.analyses for select
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );
create policy "analyses_update" on public.analyses for update
  using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
    and project_id in (select id from projects where workspace_id in (select id from workspaces where user_id = auth.uid()))
  );

-- ─── canvas_text_nodes ──────────────────────────────────────────────────────
drop policy if exists "workspace members manage their text nodes" on public.canvas_text_nodes;
create policy "workspace members manage their text nodes" on public.canvas_text_nodes for all
  using (
    workspace_id = get_workspace_id()
    and project_id in (select id from projects where workspace_id = get_workspace_id())
  );

-- ─── preferred_futures ──────────────────────────────────────────────────────
drop policy if exists "preferred_futures_all" on public.preferred_futures;
create policy "preferred_futures_all" on public.preferred_futures for all
  using (
    workspace_id = get_workspace_id()
    and project_id in (select id from projects where workspace_id = get_workspace_id())
  );

-- ─── strategic_options ──────────────────────────────────────────────────────
drop policy if exists "strategic_options_all" on public.strategic_options;
create policy "strategic_options_all" on public.strategic_options for all
  using (
    workspace_id = get_workspace_id()
    and project_id in (select id from projects where workspace_id = get_workspace_id())
  );

-- ─── scenarios ──────────────────────────────────────────────────────────────
drop policy if exists "scenarios_delete" on public.scenarios;
drop policy if exists "scenarios_insert" on public.scenarios;
drop policy if exists "scenarios_select" on public.scenarios;
drop policy if exists "scenarios_update" on public.scenarios;

create policy "scenarios_delete" on public.scenarios for delete
  using (
    workspace_id = get_user_workspace_id()
    and project_id in (select id from projects where workspace_id = get_user_workspace_id())
  );
create policy "scenarios_insert" on public.scenarios for insert
  with check (
    workspace_id = get_user_workspace_id()
    and project_id in (select id from projects where workspace_id = get_user_workspace_id())
  );
create policy "scenarios_select" on public.scenarios for select
  using (
    workspace_id = get_user_workspace_id()
    and project_id in (select id from projects where workspace_id = get_user_workspace_id())
  );
create policy "scenarios_update" on public.scenarios for update
  using (
    workspace_id = get_user_workspace_id()
    and project_id in (select id from projects where workspace_id = get_user_workspace_id())
  );

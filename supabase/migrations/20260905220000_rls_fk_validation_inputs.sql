-- P2 security hardening, batch 3 of the fix/rls-secondary-fk-validation
-- sweep: inputs. Single project_id, but NULLABLE — null is a legitimate
-- state (an Inbox item not yet assigned to a project), so the fix must not
-- reject that case. This is the highest-traffic table in the app.
--
-- Empirically confirmed vulnerable before this fix using a real
-- authenticated (non-service-role) session: a forged insert with a correct
-- workspace_id but a project_id belonging to another workspace's project
-- succeeded. Preserves the existing get_user_workspace_id() pattern and
-- per-command policy structure — only the missing (null-tolerant)
-- project_id check is added. No prior tracked migration existed for this
-- table's RLS policy.

drop policy if exists "inputs_delete" on public.inputs;
drop policy if exists "inputs_insert" on public.inputs;
drop policy if exists "inputs_select" on public.inputs;
drop policy if exists "inputs_update" on public.inputs;

create policy "inputs_delete" on public.inputs for delete
  using (
    workspace_id = get_user_workspace_id()
    and (project_id is null or project_id in (select id from projects where workspace_id = get_user_workspace_id()))
  );
create policy "inputs_insert" on public.inputs for insert
  with check (
    workspace_id = get_user_workspace_id()
    and (project_id is null or project_id in (select id from projects where workspace_id = get_user_workspace_id()))
  );
create policy "inputs_select" on public.inputs for select
  using (
    workspace_id = get_user_workspace_id()
    and (project_id is null or project_id in (select id from projects where workspace_id = get_user_workspace_id()))
  );
create policy "inputs_update" on public.inputs for update
  using (
    workspace_id = get_user_workspace_id()
    and (project_id is null or project_id in (select id from projects where workspace_id = get_user_workspace_id()))
  );

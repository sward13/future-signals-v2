-- Restrict ai_usage_log inserts to the service role.
--
-- The existing ai_usage_log_insert policy allowed any authenticated user to
-- insert rows for their own workspace (WITH CHECK workspace_id = <caller's
-- workspace>). Since this table backs the AI-cap accounting, a user could
-- distort their own usage totals by inserting arbitrary rows.
--
-- Usage rows are written only by server code running as the service role
-- (api/classify.js). The service role bypasses RLS, so authenticated/anon
-- insert access can be removed entirely without breaking any code path — a
-- codebase search found no client-side inserts into this table.
--
-- Note: the live insert policy's WITH CHECK references get_user_workspace_id(),
-- while schema.sql records get_workspace_id() — a pre-existing drift. This
-- migration drops the policy by name, so that difference does not matter here.
--
-- The select policy (users read their own workspace's usage) is unchanged.

drop policy if exists "ai_usage_log_insert" on ai_usage_log;

-- Explicit service-role-only insert policy. The service role bypasses RLS, so
-- this documents intent; with the permissive policy removed, authenticated and
-- anon inserts are denied by RLS default (no applicable policy).
create policy "ai_usage_log_insert" on ai_usage_log
  for insert to service_role
  with check (true);

-- P2 security cleanup, same pattern as the Storage-bucket and
-- project_system_map_background fixes earlier this week: removes
-- authenticated-role RLS policies for two tables that are exclusively
-- written — and, on inspection, exclusively read — by service-role server
-- code. Confirmed via a repo-wide search of src/ finding zero client-side
-- references (SELECT or otherwise) to either table.
--
-- ai_usage_log_insert had `with_check: true` — completely unrestricted.
-- Any signed-in user could insert arbitrary rows, including into another
-- workspace's usage/billing log. Only api/classify.js writes here, via a
-- service-role client.
--
-- project_publications' `for all` policy checked workspace_id only — the
-- same unvalidated-FK pattern as project_system_map_background (fixed
-- 2026-09-05) — but since only server-lib/publish-project.js and
-- publish-handler.js (both service-role) ever touch this table, the
-- correct fix is removing the policy entirely rather than teaching it to
-- validate project_id, matching the Storage-bucket precedent: there is no
-- legitimate authenticated access pattern to preserve.

drop policy if exists "ai_usage_log_insert" on public.ai_usage_log;
drop policy if exists "workspace members manage their project publications" on public.project_publications;

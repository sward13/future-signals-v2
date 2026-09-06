-- P1 security fix, same pattern as 20260905120000_system_map_background_p1_security_fixes.sql.
-- Found while fixing that one: 20260715195707_project_publications.sql's
-- authenticated insert/update/delete policies on the published-projects
-- Storage bucket check only bucket_id, not caller identity or ownership.
-- Object paths are {slug}/index.html, and slugs are public by design (the
-- /p/{slug} URL itself) — so any signed-in user could overwrite or delete
-- ANY workspace's published page. Live on production since Web Publish
-- shipped (2026-07-16), not just staging.
--
-- There is no legitimate authenticated write path to preserve: publishProject/
-- unpublishProject (server-lib/publish-project.js) and the view-serving
-- handler (server-lib/publish-handler.js) both exclusively use a service-role
-- client, which bypasses RLS regardless. No client-side code references this
-- bucket at all (confirmed via repo-wide grep).

drop policy if exists "published snapshots authenticated insert" on storage.objects;
drop policy if exists "published snapshots authenticated update" on storage.objects;
drop policy if exists "published snapshots authenticated delete" on storage.objects;

-- Public read (published pages are public by design) is untouched.

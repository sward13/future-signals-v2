-- ─── System Map Background Templates: Storage bucket ───────────────────────────
-- Public bucket for template graphics (curated SVGs + thumbnails; user-uploaded
-- templates are out of scope for this pass — see OQ-BG-06). Modeled directly on
-- the `published-projects` bucket (20260715195707_project_publications.sql),
-- the only prior Storage bucket precedent in this app.
--   Read:  public — anyone with the object URL can GET it, no auth required
--          (template art is not sensitive; published pages that show it are
--          themselves public).
--   Write: authenticated only (service_role bypasses RLS for the seed path).
-- Object path convention: flat filenames matching system_map_templates.asset_url
-- / thumbnail_url exactly (e.g. 'three-horizons.svg') — see
-- 20260820120001_seed_system_map_templates.sql for the seeded rows awaiting
-- these objects.

insert into storage.buckets (id, name, public)
values ('system-map-templates', 'system-map-templates', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "system map templates public read" on storage.objects;
create policy "system map templates public read"
  on storage.objects for select
  using (bucket_id = 'system-map-templates');

drop policy if exists "system map templates authenticated insert" on storage.objects;
create policy "system map templates authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'system-map-templates');

drop policy if exists "system map templates authenticated update" on storage.objects;
create policy "system map templates authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'system-map-templates')
  with check (bucket_id = 'system-map-templates');

drop policy if exists "system map templates authenticated delete" on storage.objects;
create policy "system map templates authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'system-map-templates');

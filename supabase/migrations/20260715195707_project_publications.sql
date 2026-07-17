-- ─── Publish: project_publications table + storage bucket ─────────────────────
-- Backing schema and storage for the Publish feature (public, shareable project
-- snapshots). SCHEMA + STORAGE CONFIG ONLY — no pipeline logic here: nothing in
-- this migration populates the table or writes objects to the bucket.

-- ─── 1. project_publications table ────────────────────────────────────────────
-- Follows the standard project-scoped table shape used by preferred_futures,
-- strategic_options, canvas_text_nodes, etc.: carries BOTH workspace_id and
-- project_id. The feature spec's column list named only project_id, but every
-- project-scoped table in this schema also carries workspace_id because the
-- established ownership-RLS pattern keys on it (workspace_id = get_workspace_id())
-- and the app's insert helpers always set it. workspace_id is added here to stay
-- consistent with that pattern — the next (pipeline) prompt must set it on insert.

create table if not exists public.project_publications (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null references public.workspaces(id) on delete cascade,
  project_id        uuid        not null references public.projects(id)   on delete cascade,
  slug              text        not null unique,   -- stable across republishes; the public link is built from this
  storage_path      text,                          -- populated once a snapshot exists (e.g. '{slug}/index.html')
  sections_included jsonb,                          -- mirrors the section-picker selection
  status            text        not null default 'published'
                                check (status in ('published', 'unpublished')),
  published_at      timestamptz,
  republished_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

grant select                         on public.project_publications to anon;
grant select, insert, update, delete on public.project_publications to authenticated;
grant select, insert, update, delete on public.project_publications to service_role;

alter table public.project_publications enable row level security;

create policy "workspace members manage their project publications"
  on public.project_publications for all
  using (workspace_id = get_workspace_id());

drop trigger if exists set_project_publications_updated_at on public.project_publications;
create trigger set_project_publications_updated_at
  before update on public.project_publications
  for each row execute function handle_updated_at();

-- ─── 2. Storage bucket: published-projects ────────────────────────────────────
-- Public bucket for generated Publish snapshots.
--   Read:  public — anyone with the object URL can GET it, no auth required.
--   Write: authenticated only (service_role bypasses RLS for the pipeline).
-- Object path convention: '{slug}/index.html', derived from the stable slug, so
-- a republish overwrites the same object and the public link never changes.

insert into storage.buckets (id, name, public)
values ('published-projects', 'published-projects', true)
on conflict (id) do update set public = excluded.public;

-- Public read of objects in this bucket.
drop policy if exists "published snapshots public read" on storage.objects;
create policy "published snapshots public read"
  on storage.objects for select
  using (bucket_id = 'published-projects');

-- Authenticated insert / update / delete of objects in this bucket.
drop policy if exists "published snapshots authenticated insert" on storage.objects;
create policy "published snapshots authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'published-projects');

drop policy if exists "published snapshots authenticated update" on storage.objects;
create policy "published snapshots authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'published-projects')
  with check (bucket_id = 'published-projects');

drop policy if exists "published snapshots authenticated delete" on storage.objects;
create policy "published snapshots authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'published-projects');

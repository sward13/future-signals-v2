-- ─── System Map Background Templates: schema ───────────────────────────────────
-- Backing schema for the optional background-template layer on the System Map
-- canvas (docs/system-map-background-templates-spec.md). SCHEMA ONLY — seed data
-- is a separate migration (see 20260820120001_seed_system_map_templates.sql), and
-- the Storage bucket for template assets is a separate migration too (see
-- 20260820120002_system_map_templates_bucket.sql).

-- ─── 1. system_map_templates ───────────────────────────────────────────────────
-- A curated + optionally user-owned pool, same shape as `sources`: owner_id NULL
-- = curated/shared (library-wide, visible to everyone); owner_id set = a user's
-- private upload (source_type = 'user_uploaded', out of scope for this pass —
-- see the spec's OQ-BG-06 — but the column exists now so the shape doesn't need
-- a later migration to add it).

create table if not exists public.system_map_templates (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  description   text,
  category      text,
  asset_url     text        not null,
  thumbnail_url text        not null,
  source_type   text        not null default 'curated'
                              check (source_type in ('curated', 'user_uploaded')),
  owner_id      uuid        references public.workspaces(id) on delete cascade,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_system_map_templates_active on public.system_map_templates (active);
create index if not exists idx_system_map_templates_category on public.system_map_templates (category);

-- Names must be unique within the curated (owner_id null) library so admins
-- can't accidentally seed/create duplicates; user uploads are unconstrained —
-- two different users (or a user and the curated set) may reuse a name freely.
create unique index if not exists idx_system_map_templates_curated_name_unique
  on public.system_map_templates (name) where owner_id is null;

grant select                         on public.system_map_templates to anon;
grant select, insert, update, delete on public.system_map_templates to authenticated;
grant select, insert, update, delete on public.system_map_templates to service_role;

alter table public.system_map_templates enable row level security;

-- Curated rows (owner_id null) are readable by everyone; a user's own uploads
-- are readable only by that user's workspace. Matches `sources`' RLS shape.
drop policy if exists "system_map_templates_select" on public.system_map_templates;
create policy "system_map_templates_select"
  on public.system_map_templates for select
  using (
    owner_id is null
    or owner_id in (select id from public.workspaces where user_id = auth.uid())
  );

-- No insert/update/delete policy for authenticated on curated (owner_id null)
-- rows — those are written by service_role only (the seed migration / a future
-- admin path), matching `sources`. A user can manage their own uploads once
-- the upload path ships (not this pass); the insert/update/delete policies for
-- that are deliberately deferred rather than added speculatively now.
drop policy if exists "system_map_templates_owner_write" on public.system_map_templates;
create policy "system_map_templates_owner_write"
  on public.system_map_templates for all
  using (owner_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (owner_id in (select id from public.workspaces where user_id = auth.uid()));

-- ─── 2. project_system_map_background ──────────────────────────────────────────
-- One background per project's System Map. Carries BOTH workspace_id and
-- project_id, matching every other project-scoped table in this schema
-- (canvas_nodes, canvas_text_nodes, relationships, project_publications, etc.) —
-- the established ownership-RLS pattern keys on workspace_id = get_workspace_id().
--
-- Forward-compatibility note: this is keyed on project_id (not a map id) because
-- System Map state has no system_maps table today — confirmed in the Pass 1
-- audit (system_map_phase_plan.md is an unexecuted proposal, never migrated). If
-- that multi-map work ever ships, this table needs to migrate from project_id to
-- system_map_id as its primary key.

create table if not exists public.project_system_map_background (
  project_id   uuid        primary key references public.projects(id)   on delete cascade,
  workspace_id uuid        not null references public.workspaces(id)    on delete cascade,
  template_id  uuid        references public.system_map_templates(id)   on delete set null,
  opacity      numeric     not null default 0.35,
  position_x   numeric     not null default 0,
  position_y   numeric     not null default 0,
  scale        numeric     not null default 1,
  updated_at   timestamptz not null default now()
);

grant select                         on public.project_system_map_background to anon;
grant select, insert, update, delete on public.project_system_map_background to authenticated;
grant select, insert, update, delete on public.project_system_map_background to service_role;

alter table public.project_system_map_background enable row level security;

drop policy if exists "workspace members manage their system map background" on public.project_system_map_background;
create policy "workspace members manage their system map background"
  on public.project_system_map_background for all
  using (workspace_id = get_workspace_id());

drop trigger if exists set_project_system_map_background_updated_at on public.project_system_map_background;
create trigger set_project_system_map_background_updated_at
  before update on public.project_system_map_background
  for each row execute function handle_updated_at();

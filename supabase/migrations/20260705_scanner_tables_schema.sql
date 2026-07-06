-- ============================================================
-- Scanner tables — documentation migration
--
-- Captures the EXISTING live schema of the four scanner-pipeline tables
-- (sources, candidates, project_sources, project_candidates) as introspected
-- from the production database (tbxjudpxzovbasuomekq) on 2026-07-05.
-- Staging (kptatqipjwihkdxdxlvh) was verified identical on the same date.
--
-- These tables predate the migrations/ directory and were previously
-- invisible to anyone reading the repo. This migration introduces NO new
-- behavior: every statement is idempotent (IF NOT EXISTS / DROP-then-CREATE
-- recreating identical policy logic), so running it against a database that
-- already has these objects is a no-op in effect.
--
-- The GRANT block follows the repo's standard explicit-grant pattern (see
-- CLAUDE.md "Grants for new tables"). Live databases currently hold broader
-- Supabase-default grants (ALL PRIVILEGES to anon/authenticated/service_role);
-- these statements codify the subset the app needs so access survives the
-- October 2026 removal of default grants. GRANTs are additive — running them
-- changes nothing on a database that already has the defaults.
--
-- Requires: vector extension (created in schema.sql).
-- ============================================================

-- ─── sources ──────────────────────────────────────────────────────────────────
-- Feed registry. owner_id NULL = curated/shared source visible to everyone;
-- owner_id set = user-created custom source scoped to that workspace.

create table if not exists sources (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  url             text        not null unique,
  domain          text        not null,
  source_type     text        not null default 'curated',
  credibility     text        not null default 'specialist',
  owner_id        uuid        references workspaces(id) on delete cascade,
  active          boolean     not null default true,
  last_fetched_at timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_sources_active on sources (active);
create index if not exists idx_sources_domain on sources (domain);
create index if not exists idx_sources_type   on sources (source_type);

-- ─── candidates ───────────────────────────────────────────────────────────────
-- Raw scanner ingest: one row per fetched feed item, deduped by url.
-- status: 'pending' | 'scored' | 'promoted' | 'rejected' | 'expired'

create table if not exists candidates (
  id             uuid         primary key default gen_random_uuid(),
  source_id      uuid         not null references sources(id) on delete cascade,
  title          text         not null,
  url            text         not null unique,
  published_at   timestamptz,
  summary_raw    text,
  summary_ai     text,
  steepled       text[]       not null default '{}',
  embedding      vector(1536),
  ingested_at    timestamptz  not null default now(),
  status         text         not null default 'pending',
  expires_at     timestamptz  not null default (now() + interval '30 days'),
  last_digest_at timestamptz
);

create index if not exists idx_candidates_embedding
  on candidates using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_candidates_expires on candidates (expires_at);
create index if not exists idx_candidates_source  on candidates (source_id);
create index if not exists idx_candidates_status  on candidates (status);
-- Redundant with the unique constraint's implicit index, but exists live —
-- kept for fidelity with production.
create index if not exists idx_candidates_url     on candidates (url);

-- ─── project_sources ──────────────────────────────────────────────────────────
-- Per-project source opt-in. No workspace_id column — scoped through
-- project_id (see CLAUDE.md: projectSources must be fetched per project).

create table if not exists project_sources (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id) on delete cascade,
  source_id  uuid        not null references sources(id)  on delete cascade,
  opted_in   boolean     not null default true,
  created_at timestamptz not null default now(),
  unique(project_id, source_id)
);

create index if not exists idx_project_sources_project on project_sources (project_id);
create index if not exists idx_project_sources_source  on project_sources (source_id);

-- ─── project_candidates ───────────────────────────────────────────────────────
-- Layer 3 scoring results: one row per candidate × project pair, written by
-- api/score.js (service role); user_action/dismissal_reason updated by the
-- client when a suggestion is dismissed.

create table if not exists project_candidates (
  id                uuid        primary key default gen_random_uuid(),
  project_id        uuid        not null references projects(id)   on delete cascade,
  candidate_id      uuid        not null references candidates(id) on delete cascade,
  score             integer,
  classification    text,
  key_question_sim  double precision,
  corpus_sim        double precision,
  negative_pool_sim double precision,
  surfaced          boolean     not null default false,
  user_action       text,
  dismissal_reason  text,
  scored_at         timestamptz,
  created_at        timestamptz not null default now(),
  unique(project_id, candidate_id)
);

create index if not exists idx_project_candidates_action
  on project_candidates (project_id, user_action, surfaced);
create index if not exists idx_project_candidates_candidate
  on project_candidates (candidate_id);
create index if not exists idx_project_candidates_project
  on project_candidates (project_id);
create index if not exists idx_project_candidates_score
  on project_candidates (project_id, score desc);
create index if not exists idx_project_candidates_surfaced
  on project_candidates (project_id, surfaced, user_action);

-- ============================================================
-- GRANTS (standard explicit-grant pattern)
-- ============================================================

grant select on public.sources to anon;
grant select, insert, update, delete on public.sources to authenticated;
grant select, insert, update, delete on public.sources to service_role;

grant select on public.candidates to anon;
grant select, insert, update, delete on public.candidates to authenticated;
grant select, insert, update, delete on public.candidates to service_role;

grant select on public.project_sources to anon;
grant select, insert, update, delete on public.project_sources to authenticated;
grant select, insert, update, delete on public.project_sources to service_role;

grant select on public.project_candidates to anon;
grant select, insert, update, delete on public.project_candidates to authenticated;
grant select, insert, update, delete on public.project_candidates to service_role;

-- ============================================================
-- ROW LEVEL SECURITY
-- RLS is already enabled on all four tables live (verified 2026-07-05).
-- Policies below reproduce the live policy logic exactly — the
-- DROP-then-CREATE pairs make this file safe to (re)run without
-- changing behavior.
-- ============================================================

alter table sources            enable row level security;
alter table candidates         enable row level security;
alter table project_sources    enable row level security;
alter table project_candidates enable row level security;

-- ─── sources ──────────────────────────────────────────────────────────────────
-- Curated sources (owner_id null) are readable by everyone; write access is
-- limited to rows owned by the caller's workspace. There is no INSERT path
-- for curated rows via the client — those are seeded with the service role.
-- Note: the scanner writes last_fetched_at with the service role, which
-- bypasses RLS; candidates_insert-style service writes never depend on these.

drop policy if exists "sources_select" on sources;
create policy "sources_select" on sources
  for select using (
    owner_id is null
    or owner_id in (select id from workspaces where user_id = auth.uid())
  );

drop policy if exists "sources_insert" on sources;
create policy "sources_insert" on sources
  for insert with check (
    owner_id in (select id from workspaces where user_id = auth.uid())
  );

drop policy if exists "sources_update" on sources;
create policy "sources_update" on sources
  for update using (
    owner_id in (select id from workspaces where user_id = auth.uid())
  );

drop policy if exists "sources_delete" on sources;
create policy "sources_delete" on sources
  for delete using (
    owner_id in (select id from workspaces where user_id = auth.uid())
  );

-- ─── candidates ───────────────────────────────────────────────────────────────
-- SELECT only. A candidate is visible if it came from a source the caller's
-- workspace has opted into on some project, or from any curated source.
-- The former candidates_insert policy (WITH CHECK true) was dropped in
-- 20260620_drop_candidates_insert_policy.sql — all writes are service-role.

drop policy if exists "candidates_select" on candidates;
create policy "candidates_select" on candidates
  for select using (
    source_id in (
      select ps.source_id
      from project_sources ps
      join projects   p on p.id = ps.project_id
      join workspaces w on w.id = p.workspace_id
      where w.user_id = auth.uid()
        and ps.opted_in = true
    )
    or source_id in (select id from sources where owner_id is null)
  );

-- ─── project_sources ──────────────────────────────────────────────────────────
-- Scoped through project ownership (no workspace_id column on this table).

drop policy if exists "project_sources_select" on project_sources;
create policy "project_sources_select" on project_sources
  for select using (
    project_id in (
      select id from projects
      where workspace_id in (select id from workspaces where user_id = auth.uid())
    )
  );

drop policy if exists "project_sources_insert" on project_sources;
create policy "project_sources_insert" on project_sources
  for insert with check (
    project_id in (
      select id from projects
      where workspace_id in (select id from workspaces where user_id = auth.uid())
    )
  );

drop policy if exists "project_sources_update" on project_sources;
create policy "project_sources_update" on project_sources
  for update using (
    project_id in (
      select id from projects
      where workspace_id in (select id from workspaces where user_id = auth.uid())
    )
  );

drop policy if exists "project_sources_delete" on project_sources;
create policy "project_sources_delete" on project_sources
  for delete using (
    project_id in (
      select id from projects
      where workspace_id in (select id from workspaces where user_id = auth.uid())
    )
  );

-- ─── project_candidates ───────────────────────────────────────────────────────
-- Scoped through project ownership. No DELETE policy — rows are removed only
-- via FK cascade or the service role.

drop policy if exists "project_candidates_select" on project_candidates;
create policy "project_candidates_select" on project_candidates
  for select using (
    project_id in (
      select id from projects
      where workspace_id in (select id from workspaces where user_id = auth.uid())
    )
  );

drop policy if exists "project_candidates_insert" on project_candidates;
create policy "project_candidates_insert" on project_candidates
  for insert with check (
    project_id in (
      select id from projects
      where workspace_id in (select id from workspaces where user_id = auth.uid())
    )
  );

drop policy if exists "project_candidates_update" on project_candidates;
create policy "project_candidates_update" on project_candidates
  for update using (
    project_id in (
      select id from projects
      where workspace_id in (select id from workspaces where user_id = auth.uid())
    )
  );

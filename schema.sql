-- ============================================================
-- Future Signals v2 — Supabase schema
-- Apply in the Supabase SQL editor (Project → SQL Editor → New query).
-- Run once per environment. Safe to re-run: uses CREATE OR REPLACE
-- and IF NOT EXISTS where possible.
-- ============================================================

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists workspaces (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        references auth.users(id) on delete cascade,
  name       text        not null default 'My Workspace',
  created_at timestamptz not null default now()
);

create table if not exists workspace_settings (
  id                  uuid    primary key default gen_random_uuid(),
  workspace_id        uuid    references workspaces(id) on delete cascade unique not null,
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now()
);

create table if not exists projects (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        references workspaces(id) on delete cascade not null,
  name         text        not null,
  domain       text,
  question     text,
  unit         text,
  geo          text,
  mode         text        default 'quick_scan',
  h1_start     text,
  h1_end       text,
  h2_start     text,
  h2_end       text,
  h3_start     text,
  h3_end       text,
  assumptions  text,
  stakeholders text,
  created_at   timestamptz not null default now()
);

create table if not exists inputs (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        references workspaces(id) on delete cascade not null,
  project_id        uuid        references projects(id) on delete set null,
  name              text        not null,
  description       text,
  source_url        text,
  subtype           text        default 'signal',
  steepled          text[]      default '{}',
  strength          text,
  horizon           text,
  is_seeded         boolean     not null default false,
  source_confidence text,
  metadata          jsonb       default '{}',
  created_at        timestamptz not null default now()
);

create table if not exists clusters (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        references workspaces(id) on delete cascade not null,
  project_id   uuid        references projects(id) on delete cascade not null,
  name         text        not null,
  subtype      text        default 'Trend',
  horizon      text        default 'H1',
  likelihood   text,
  description  text,
  created_at   timestamptz not null default now()
);

-- Junction table: which inputs belong to which cluster
create table if not exists cluster_inputs (
  cluster_id uuid references clusters(id) on delete cascade,
  input_id   uuid references inputs(id)   on delete cascade,
  primary key (cluster_id, input_id)
);

create table if not exists scenarios (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        references workspaces(id) on delete cascade not null,
  project_id   uuid        references projects(id)   on delete cascade not null,
  name         text        not null,
  archetype    text        default 'Continuation',
  horizon      text        default 'H2',
  narrative    text,
  created_at   timestamptz not null default now()
);

-- Junction table: which clusters drive which scenario
create table if not exists scenario_clusters (
  scenario_id uuid references scenarios(id) on delete cascade,
  cluster_id  uuid references clusters(id)  on delete cascade,
  primary key (scenario_id, cluster_id)
);

-- One analysis record per project
create table if not exists analyses (
  id                     uuid        primary key default gen_random_uuid(),
  workspace_id           uuid        references workspaces(id) on delete cascade not null,
  project_id             uuid        references projects(id)   on delete cascade unique not null,
  key_dynamics           text,
  description            text,
  critical_uncertainties text[]      default '{}',
  implications           text,
  confidence             text,
  created_at             timestamptz not null default now()
);

-- ─── handle_new_user trigger ─────────────────────────────────────────────────
-- Fires after a new auth.users row is created. Auto-creates the workspace
-- and workspace_settings so the app never has to create these manually.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into workspaces (owner_id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  returning id into new_workspace_id;

  insert into workspace_settings (workspace_id)
  values (new_workspace_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table workspaces         enable row level security;
alter table workspace_settings enable row level security;
alter table projects           enable row level security;
alter table inputs             enable row level security;
alter table clusters           enable row level security;
alter table cluster_inputs     enable row level security;
alter table scenarios          enable row level security;
alter table scenario_clusters  enable row level security;
alter table analyses           enable row level security;

-- Helper: returns the workspace id owned by the currently authenticated user.
create or replace function get_workspace_id()
returns uuid
language sql stable
security definer set search_path = public
as $$
  select id from workspaces where owner_id = auth.uid() limit 1;
$$;

-- Workspaces
create policy "owner can select workspace"
  on workspaces for select
  using (owner_id = auth.uid());

create policy "owner can update workspace"
  on workspaces for update
  using (owner_id = auth.uid());

-- Workspace settings
create policy "owner can select workspace_settings"
  on workspace_settings for select
  using (workspace_id = get_workspace_id());

create policy "owner can update workspace_settings"
  on workspace_settings for update
  using (workspace_id = get_workspace_id());

-- Projects
create policy "workspace member can select projects"
  on projects for select
  using (workspace_id = get_workspace_id());

create policy "workspace member can insert projects"
  on projects for insert
  with check (workspace_id = get_workspace_id());

create policy "workspace member can update projects"
  on projects for update
  using (workspace_id = get_workspace_id());

create policy "workspace member can delete projects"
  on projects for delete
  using (workspace_id = get_workspace_id());

-- Inputs
create policy "workspace member can select inputs"
  on inputs for select
  using (workspace_id = get_workspace_id());

create policy "workspace member can insert inputs"
  on inputs for insert
  with check (workspace_id = get_workspace_id());

create policy "workspace member can update inputs"
  on inputs for update
  using (workspace_id = get_workspace_id());

create policy "workspace member can delete inputs"
  on inputs for delete
  using (workspace_id = get_workspace_id());

-- Clusters
create policy "workspace member can select clusters"
  on clusters for select
  using (workspace_id = get_workspace_id());

create policy "workspace member can insert clusters"
  on clusters for insert
  with check (workspace_id = get_workspace_id());

create policy "workspace member can update clusters"
  on clusters for update
  using (workspace_id = get_workspace_id());

create policy "workspace member can delete clusters"
  on clusters for delete
  using (workspace_id = get_workspace_id());

-- cluster_inputs (no workspace_id column — inherit via cluster)
create policy "workspace member can select cluster_inputs"
  on cluster_inputs for select
  using (cluster_id in (select id from clusters where workspace_id = get_workspace_id()));

create policy "workspace member can insert cluster_inputs"
  on cluster_inputs for insert
  with check (cluster_id in (select id from clusters where workspace_id = get_workspace_id()));

create policy "workspace member can delete cluster_inputs"
  on cluster_inputs for delete
  using (cluster_id in (select id from clusters where workspace_id = get_workspace_id()));

-- Scenarios
create policy "workspace member can select scenarios"
  on scenarios for select
  using (workspace_id = get_workspace_id());

create policy "workspace member can insert scenarios"
  on scenarios for insert
  with check (workspace_id = get_workspace_id());

create policy "workspace member can update scenarios"
  on scenarios for update
  using (workspace_id = get_workspace_id());

create policy "workspace member can delete scenarios"
  on scenarios for delete
  using (workspace_id = get_workspace_id());

-- scenario_clusters
create policy "workspace member can select scenario_clusters"
  on scenario_clusters for select
  using (scenario_id in (select id from scenarios where workspace_id = get_workspace_id()));

create policy "workspace member can insert scenario_clusters"
  on scenario_clusters for insert
  with check (scenario_id in (select id from scenarios where workspace_id = get_workspace_id()));

create policy "workspace member can delete scenario_clusters"
  on scenario_clusters for delete
  using (scenario_id in (select id from scenarios where workspace_id = get_workspace_id()));

-- Analyses
create policy "workspace member can select analyses"
  on analyses for select
  using (workspace_id = get_workspace_id());

create policy "workspace member can insert analyses"
  on analyses for insert
  with check (workspace_id = get_workspace_id());

create policy "workspace member can update analyses"
  on analyses for update
  using (workspace_id = get_workspace_id());

create policy "workspace member can delete analyses"
  on analyses for delete
  using (workspace_id = get_workspace_id());

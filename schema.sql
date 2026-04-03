-- ============================================================
-- Future Signals v2 — Supabase Schema
-- Canonical source of truth. Reflects actual database state.
-- Apply in Supabase SQL Editor — New query → paste → Run.
-- Last updated: April 2026
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================================
-- TABLES
-- ============================================================

-- Workspaces
-- 1:1 with auth.users in v2. Created automatically on signup via trigger.
create table if not exists workspaces (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id)
);

-- Workspace settings
-- Thin account-level record: plan tier, AI cap, feature flags.
create table if not exists workspace_settings (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references workspaces(id) on delete cascade,
  plan_tier      text        not null default 'individual',
  ai_cap_monthly int         not null default 100,
  feature_flags  jsonb       not null default '{}',
  created_at     timestamptz not null default now(),
  unique(workspace_id)
);

-- Projects
create table if not exists projects (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  name         text        not null,
  domain       text,
  question     text,
  focus        text,
  geo          text,
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

-- Inputs
-- Single table for all input subtypes. Subtype-specific fields live in metadata JSONB.
-- project_id null = lives in Inbox.
-- On project deletion, inputs return to Inbox (set null) rather than being deleted.
create table if not exists inputs (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references workspaces(id) on delete cascade,
  project_id     uuid        references projects(id) on delete set null,
  name           text        not null,
  description    text,
  source_url     text,
  subtype        text        not null default 'Signal',
  steepled       text[]      not null default '{}',
  signal_quality text,
  horizon        text,
  metadata       jsonb       not null default '{}',
  is_seeded      boolean     not null default false,
  created_at     timestamptz not null default now()
);

-- Clusters
create table if not exists clusters (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  project_id   uuid        not null references projects(id) on delete cascade,
  name         text        not null,
  subtype      text        not null default 'Trend',
  horizon      text,
  description  text,
  likelihood   text,
  created_at   timestamptz not null default now()
);

-- Cluster inputs (junction table)
-- Tracks which inputs belong to which cluster.
-- Inputs are preserved when a cluster is deleted (cascade removes junction rows only).
create table if not exists cluster_inputs (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  cluster_id   uuid        not null references clusters(id) on delete cascade,
  input_id     uuid        not null references inputs(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique(cluster_id, input_id)
);

-- Scenarios (stub — full implementation in v3)
create table if not exists scenarios (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  project_id   uuid        not null references projects(id) on delete cascade,
  name         text        not null,
  archetype    text,
  horizon      text,
  created_at   timestamptz not null default now()
);

-- Scenario clusters (junction table)
create table if not exists scenario_clusters (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  scenario_id  uuid        not null references scenarios(id) on delete cascade,
  cluster_id   uuid        not null references clusters(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique(scenario_id, cluster_id)
);

-- Canvas nodes: clusters placed on the system map
create table if not exists canvas_nodes (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  project_id   uuid        not null references projects(id) on delete cascade,
  cluster_id   uuid        not null references clusters(id) on delete cascade,
  x            float       not null default 120,
  y            float       not null default 120,
  created_at   timestamptz not null default now(),
  unique(project_id, cluster_id)
);

-- Relationships between clusters on the system map
create table if not exists relationships (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  project_id      uuid        not null references projects(id) on delete cascade,
  from_cluster_id uuid        not null references clusters(id) on delete cascade,
  to_cluster_id   uuid        not null references clusters(id) on delete cascade,
  type            text        not null default 'Drives',
  evidence        text,
  confidence      text,
  created_at      timestamptz not null default now(),
  unique(project_id, from_cluster_id, to_cluster_id)
);

-- AI usage log
-- Created from day one so the cap model works immediately.
create table if not exists ai_usage_log (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  model         text        not null,
  operation     text        not null,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_projects_workspace        on projects       (workspace_id);
create index if not exists idx_inputs_workspace          on inputs         (workspace_id);
create index if not exists idx_inputs_project            on inputs         (project_id);
create index if not exists idx_inputs_workspace_project  on inputs         (workspace_id, project_id);
create index if not exists idx_clusters_workspace        on clusters       (workspace_id);
create index if not exists idx_clusters_project          on clusters       (project_id);
create index if not exists idx_cluster_inputs_cluster    on cluster_inputs (cluster_id);
create index if not exists idx_cluster_inputs_input      on cluster_inputs (input_id);
create index if not exists idx_cluster_inputs_workspace  on cluster_inputs (workspace_id);
create index if not exists idx_scenarios_workspace       on scenarios      (workspace_id);
create index if not exists idx_scenarios_project         on scenarios      (project_id);
create index if not exists idx_canvas_nodes_workspace    on canvas_nodes   (workspace_id);
create index if not exists idx_canvas_nodes_project      on canvas_nodes   (project_id);
create index if not exists idx_relationships_workspace   on relationships  (workspace_id);
create index if not exists idx_relationships_project     on relationships  (project_id);
create index if not exists idx_ai_usage_workspace        on ai_usage_log   (workspace_id);
create index if not exists idx_ai_usage_workspace_date   on ai_usage_log   (workspace_id, created_at desc);

-- ============================================================
-- HANDLE NEW USER TRIGGER
-- ============================================================

-- Fires after a new auth.users row is created.
-- Auto-creates workspace and workspace_settings with defaults.
create or replace function handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces (user_id)
    values (new.id)
    returning id into new_workspace_id;

  insert into public.workspace_settings (workspace_id)
    values (new_workspace_id);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table workspaces         enable row level security;
alter table workspace_settings enable row level security;
alter table projects           enable row level security;
alter table inputs             enable row level security;
alter table clusters           enable row level security;
alter table cluster_inputs     enable row level security;
alter table scenarios          enable row level security;
alter table scenario_clusters  enable row level security;
alter table canvas_nodes       enable row level security;
alter table relationships      enable row level security;
alter table ai_usage_log       enable row level security;

-- Helper: returns the workspace id for the current authenticated user.
create or replace function get_workspace_id()
returns uuid as $$
  select id from public.workspaces where user_id = auth.uid() limit 1;
$$ language sql security definer stable set search_path = public;

-- Workspaces
create policy "workspace_select" on workspaces
  for select using (user_id = auth.uid());

create policy "workspace_update" on workspaces
  for update using (user_id = auth.uid());

-- Workspace settings
create policy "workspace_settings_select" on workspace_settings
  for select using (workspace_id = get_workspace_id());

create policy "workspace_settings_update" on workspace_settings
  for update using (workspace_id = get_workspace_id());

-- Projects
create policy "projects_select" on projects
  for select using (workspace_id = get_workspace_id());

create policy "projects_insert" on projects
  for insert with check (workspace_id = get_workspace_id());

create policy "projects_update" on projects
  for update using (workspace_id = get_workspace_id());

create policy "projects_delete" on projects
  for delete using (workspace_id = get_workspace_id());

-- Inputs
create policy "inputs_select" on inputs
  for select using (workspace_id = get_workspace_id());

create policy "inputs_insert" on inputs
  for insert with check (workspace_id = get_workspace_id());

create policy "inputs_update" on inputs
  for update using (workspace_id = get_workspace_id());

create policy "inputs_delete" on inputs
  for delete using (workspace_id = get_workspace_id());

-- Clusters
create policy "clusters_select" on clusters
  for select using (workspace_id = get_workspace_id());

create policy "clusters_insert" on clusters
  for insert with check (workspace_id = get_workspace_id());

create policy "clusters_update" on clusters
  for update using (workspace_id = get_workspace_id());

create policy "clusters_delete" on clusters
  for delete using (workspace_id = get_workspace_id());

-- Cluster inputs
create policy "cluster_inputs_select" on cluster_inputs
  for select using (workspace_id = get_workspace_id());

create policy "cluster_inputs_insert" on cluster_inputs
  for insert with check (workspace_id = get_workspace_id());

create policy "cluster_inputs_delete" on cluster_inputs
  for delete using (workspace_id = get_workspace_id());

-- Scenarios
create policy "scenarios_select" on scenarios
  for select using (workspace_id = get_workspace_id());

create policy "scenarios_insert" on scenarios
  for insert with check (workspace_id = get_workspace_id());

create policy "scenarios_update" on scenarios
  for update using (workspace_id = get_workspace_id());

create policy "scenarios_delete" on scenarios
  for delete using (workspace_id = get_workspace_id());

-- Scenario clusters
create policy "scenario_clusters_select" on scenario_clusters
  for select using (workspace_id = get_workspace_id());

create policy "scenario_clusters_insert" on scenario_clusters
  for insert with check (workspace_id = get_workspace_id());

create policy "scenario_clusters_delete" on scenario_clusters
  for delete using (workspace_id = get_workspace_id());

-- Canvas nodes
create policy "canvas_nodes_select" on canvas_nodes
  for select using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "canvas_nodes_insert" on canvas_nodes
  for insert with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "canvas_nodes_update" on canvas_nodes
  for update using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "canvas_nodes_delete" on canvas_nodes
  for delete using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- Relationships
create policy "relationships_select" on relationships
  for select using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "relationships_insert" on relationships
  for insert with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "relationships_update" on relationships
  for update using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "relationships_delete" on relationships
  for delete using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- AI usage log (insert + select only)
create policy "ai_usage_log_select" on ai_usage_log
  for select using (workspace_id = get_workspace_id());

create policy "ai_usage_log_insert" on ai_usage_log
  for insert with check (workspace_id = get_workspace_id());

  create table if not exists analyses (
  id                     uuid        primary key default gen_random_uuid(),
  workspace_id           uuid        not null references workspaces(id) on delete cascade,
  project_id             uuid        not null references projects(id) on delete cascade,
  key_dynamics           text,
  description            text,
  implications           text,
  critical_uncertainties text[]      not null default '{}',
  confidence             text,
  created_at             timestamptz not null default now(),
  unique(project_id)
);

alter table analyses enable row level security;

create policy "analyses_select" on analyses
  for select using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "analyses_insert" on analyses
  for insert with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "analyses_update" on analyses
  for update using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "analyses_delete" on analyses
  for delete using (workspace_id in (select id from workspaces where user_id = auth.uid()));
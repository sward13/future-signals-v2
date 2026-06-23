-- Text annotation nodes on the System Map canvas.
-- Each row represents one freeform text label placed on a project's canvas.

create table public.canvas_text_nodes (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  project_id   uuid        not null references public.projects(id)   on delete cascade,
  x            float       not null default 100,
  y            float       not null default 100,
  text         text        not null default '',
  font_family  text        not null default 'Open Sans, system-ui, sans-serif',
  font_size    int         not null default 16,
  bold         boolean     not null default false,
  italic       boolean     not null default false,
  color        text        not null default '#1A1A1A',
  created_at   timestamptz not null default now()
);

grant select                            on public.canvas_text_nodes to anon;
grant select, insert, update, delete    on public.canvas_text_nodes to authenticated;
grant select, insert, update, delete    on public.canvas_text_nodes to service_role;

alter table public.canvas_text_nodes enable row level security;

create policy "workspace members manage their text nodes"
  on public.canvas_text_nodes for all
  using (workspace_id = get_workspace_id());

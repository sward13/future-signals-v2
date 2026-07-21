-- ─── projects.updated_at: real "last activity" timestamp ──────────────────────
-- The dashboard project cards render `updated_at || created_at` but the column
-- never existed, so every card silently fell back to created_at and never moved.
-- This adds the column, backfills it from the most recent child activity, and
-- keeps it current via:
--   • a BEFORE UPDATE trigger on projects itself (direct edits), and
--   • AFTER INSERT/UPDATE/DELETE triggers on every project-scoped content table
--     that bump the parent project's updated_at.

-- 1. Column ────────────────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists updated_at timestamptz not null default now();

-- 2. Backfill existing rows to greatest(created_at, max child activity) so the
--    dashboard immediately shows a sensible last-activity date, not "now".
update public.projects p set updated_at = greatest(
  p.created_at,
  coalesce((select max(created_at) from public.inputs            where project_id = p.id), p.created_at),
  coalesce((select max(created_at) from public.clusters          where project_id = p.id), p.created_at),
  coalesce((select max(created_at) from public.scenarios         where project_id = p.id), p.created_at),
  coalesce((select max(created_at) from public.relationships     where project_id = p.id), p.created_at),
  coalesce((select max(created_at) from public.canvas_nodes      where project_id = p.id), p.created_at),
  coalesce((select max(created_at) from public.canvas_text_nodes where project_id = p.id), p.created_at),
  coalesce((select max(created_at) from public.analyses          where project_id = p.id), p.created_at),
  coalesce((select max(created_at) from public.preferred_futures where project_id = p.id), p.created_at),
  coalesce((select max(created_at) from public.strategic_options where project_id = p.id), p.created_at)
);

-- 3. handle_updated_at() already exists (from 20260417_future_models.sql), but
--    define it defensively in case this migration runs on a fresh DB.
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Direct edits to a project row bump its own updated_at.
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

-- 4. Child-activity trigger: bump the parent project when any project-scoped
--    content row is inserted, updated, or deleted. SECURITY DEFINER so it works
--    regardless of the caller's context (authenticated session, service-role
--    clone/cron). A null project_id (e.g. an input sitting in the Inbox) is a
--    no-op; a cascade delete of the project itself no-ops harmlessly (the parent
--    row is already gone, so the UPDATE matches zero rows).
create or replace function public.touch_project_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.project_id, old.project_id);
  if pid is not null then
    update public.projects set updated_at = now() where id = pid;
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'inputs','clusters','scenarios','relationships','canvas_nodes',
    'canvas_text_nodes','analyses','preferred_futures','strategic_options'
  ] loop
    execute format('drop trigger if exists touch_project_updated_at on public.%I', t);
    execute format(
      'create trigger touch_project_updated_at
         after insert or update or delete on public.%I
         for each row execute function public.touch_project_updated_at()', t);
  end loop;
end $$;

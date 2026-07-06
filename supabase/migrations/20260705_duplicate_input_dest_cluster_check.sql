-- Hardens duplicate_input_to_cluster (added 20260623) against attaching a
-- copied input to a cluster in another workspace.
--
-- The original SECURITY DEFINER function verified the caller owns the workspace
-- and only copies a source input scoped to that workspace, but never checked
-- that p_dest_cluster_id belongs to the same workspace. A caller who knows or
-- guesses a cluster UUID from another workspace could attach copies to it.
--
-- This adds an existence check on the destination cluster (id + workspace_id)
-- immediately after the workspace ownership check, before any insert. Nothing
-- else changes: the workspace check, the source-input scoping in the copy, and
-- the copy-on-promote logic are all preserved verbatim, as is the signature.

create or replace function public.duplicate_input_to_cluster(
  p_source_id        uuid,
  p_dest_cluster_id  uuid,
  p_workspace_id     uuid
)
returns table (
  id                uuid,
  workspace_id      uuid,
  name              text,
  description       text,
  source_url        text,
  subtype           text,
  steepled          text[],
  horizon           text,
  project_id        uuid,
  is_seeded         boolean,
  signal_quality    text,
  signal_strength   text,
  source_confidence text,
  metadata          jsonb,
  created_at        timestamptz
)
language plpgsql security definer
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  -- verify the caller owns this workspace
  if not exists (
    select 1 from public.workspaces
    where public.workspaces.id = p_workspace_id
      and public.workspaces.user_id = auth.uid()
  ) then
    raise exception 'unauthorized';
  end if;

  -- verify the destination cluster belongs to this workspace
  if not exists (
    select 1 from public.clusters
    where public.clusters.id = p_dest_cluster_id
      and public.clusters.workspace_id = p_workspace_id
  ) then
    raise exception 'destination cluster not found in workspace';
  end if;

  insert into public.inputs (
    id, workspace_id, name, description, source_url, subtype,
    steepled, horizon, project_id, is_seeded, signal_quality,
    signal_strength, source_confidence, metadata, embedding, created_at
  )
  select
    new_id,
    i.workspace_id, i.name, i.description, i.source_url, i.subtype,
    i.steepled, i.horizon, i.project_id, i.is_seeded, i.signal_quality,
    i.signal_strength, i.source_confidence, i.metadata, i.embedding,
    now()
  from public.inputs i
  where i.id = p_source_id
    and i.workspace_id = p_workspace_id;

  insert into public.cluster_inputs (workspace_id, cluster_id, input_id)
  values (p_workspace_id, p_dest_cluster_id, new_id);

  return query
    select
      i.id, i.workspace_id, i.name, i.description, i.source_url, i.subtype,
      i.steepled, i.horizon, i.project_id, i.is_seeded, i.signal_quality,
      i.signal_strength, i.source_confidence, i.metadata, i.created_at
    from public.inputs i
    where i.id = new_id;
end;
$$;

grant execute on function public.duplicate_input_to_cluster(uuid, uuid, uuid) to authenticated;

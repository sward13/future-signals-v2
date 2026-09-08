-- Make duplicate_input_to_cluster's destination cluster optional, and always
-- append " (Copy)" to the duplicated row's name.
--
-- Background: the menu-based "Duplicate to cluster" entry points (Scan row menu
-- + input detail drawer) are being replaced with a plain "Duplicate" action
-- that has no destination step — it just creates an unassigned copy in the same
-- project. The Option/Alt-drag path on the Cluster screen still passes a real
-- destination and keeps duplicating straight into the dropped-on cluster.
--
-- Changes vs. 20260705090000 (same signature, kept verbatim otherwise):
--   1. The destination-cluster existence/ownership check now only runs when
--      p_dest_cluster_id is non-null (a null destination is legitimate).
--   2. The cluster_inputs insert only runs when a destination is given; with no
--      destination the copy starts with no cluster membership (shows up in
--      Unassigned).
--   3. The new row's name is always the source name + " (Copy)", in every path
--      (including the Alt-drag path, which previously copied the name verbatim).

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

  -- verify the destination cluster belongs to this workspace — only when a
  -- destination was given. A null destination is a legitimate "plain duplicate"
  -- (no cluster membership).
  if p_dest_cluster_id is not null and not exists (
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
    i.workspace_id, coalesce(i.name, '') || ' (Copy)', i.description, i.source_url, i.subtype,
    i.steepled, i.horizon, i.project_id, i.is_seeded, i.signal_quality,
    i.signal_strength, i.source_confidence, i.metadata, i.embedding,
    now()
  from public.inputs i
  where i.id = p_source_id
    and i.workspace_id = p_workspace_id;

  -- link the copy to the destination cluster only when one was given
  if p_dest_cluster_id is not null then
    insert into public.cluster_inputs (workspace_id, cluster_id, input_id)
    values (p_workspace_id, p_dest_cluster_id, new_id);
  end if;

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

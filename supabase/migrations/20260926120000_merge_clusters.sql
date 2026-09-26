-- merge_clusters(p_source, p_target) — merge one cluster into another, atomically.
--
-- Merges the source cluster into the target: moves the source's input and
-- scenario memberships to the target (de-duplicating overlaps), repoints the
-- source's System Map edges onto the target (skipping self-loops and duplicate
-- edges), scrubs the legacy scenarios.cluster_ids array, then deletes the
-- source cluster. The target's own fields (name/subtype/horizon/likelihood/
-- description) are retained; the source's are discarded.
--
-- Why a single SECURITY DEFINER function rather than client-side calls: every
-- FK referencing clusters(id) is ON DELETE CASCADE (cluster_inputs, canvas_nodes,
-- relationships.from/to_cluster_id, scenario_clusters, cluster_suggestions.
-- target_cluster_id). Anything not explicitly moved to the target BEFORE the
-- source is deleted is silently destroyed by the cascade. The merge is therefore
-- a move-then-delete sequence that must be atomic — a partial failure would
-- corrupt the graph. Mirrors the duplicate_input_to_cluster RPC pattern,
-- including its explicit caller-ownership check (SECURITY DEFINER bypasses RLS).

create or replace function public.merge_clusters(
  p_source uuid,
  p_target uuid
)
returns void
language plpgsql security definer
as $$
declare
  v_ws          uuid;
  v_target_proj uuid;
  v_source_ws   uuid;
  v_source_proj uuid;
begin
  -- ── Guards ──────────────────────────────────────────────────────────────
  if p_source = p_target then
    raise exception 'cannot merge a cluster into itself';
  end if;

  select workspace_id, project_id into v_ws,        v_target_proj from public.clusters where id = p_target;
  select workspace_id, project_id into v_source_ws, v_source_proj from public.clusters where id = p_source;

  if v_ws is null or v_source_ws is null then
    raise exception 'cluster not found';
  end if;

  -- caller must own the (target) workspace
  if not exists (
    select 1 from public.workspaces w
    where w.id = v_ws and w.user_id = auth.uid()
  ) then
    raise exception 'unauthorized';
  end if;

  -- both clusters must live in the same workspace and project
  if v_source_ws <> v_ws then
    raise exception 'clusters belong to different workspaces';
  end if;
  if v_source_proj is distinct from v_target_proj then
    raise exception 'clusters belong to different projects';
  end if;

  -- ── 1. Move input memberships (dedupe overlaps) ─────────────────────────
  insert into public.cluster_inputs (cluster_id, input_id, workspace_id)
  select p_target, ci.input_id, ci.workspace_id
  from public.cluster_inputs ci
  where ci.cluster_id = p_source
  on conflict (cluster_id, input_id) do nothing;

  -- ── 2. Move scenario memberships (dedupe overlaps) ──────────────────────
  insert into public.scenario_clusters (scenario_id, cluster_id, workspace_id)
  select sc.scenario_id, p_target, sc.workspace_id
  from public.scenario_clusters sc
  where sc.cluster_id = p_source
  on conflict (scenario_id, cluster_id) do nothing;

  -- ── 3. Repoint System Map edges onto the target ─────────────────────────
  -- Only repoint edges worth keeping; edges that would become self-loops or
  -- would duplicate an existing target edge are left pointing at the source and
  -- swept by the cascade in step 6. (relationships has no unique constraint, so
  -- the dedupe is manual.) If two source edges would collapse onto the same
  -- target edge, the first repoints and the second's NOT EXISTS check then sees
  -- it and declines — self-consistent.
  update public.relationships r
  set from_cluster_id = p_target
  where r.from_cluster_id = p_source
    and r.to_cluster_id <> p_target
    and not exists (
      select 1 from public.relationships r2
      where r2.from_cluster_id = p_target
        and r2.to_cluster_id = r.to_cluster_id
        and r2.type = r.type
    );

  update public.relationships r
  set to_cluster_id = p_target
  where r.to_cluster_id = p_source
    and r.from_cluster_id <> p_target
    and not exists (
      select 1 from public.relationships r2
      where r2.to_cluster_id = p_target
        and r2.from_cluster_id = r.from_cluster_id
        and r2.type = r.type
    );

  -- ── 4. Scrub the legacy scenarios.cluster_ids array ─────────────────────
  -- Not the source of truth (the app derives from scenario_clusters) and not an
  -- FK, so it isn't cascade-cleaned; scrub defensively so no stale id lingers.
  update public.scenarios s
  set cluster_ids = (
    select array_agg(distinct cid)
    from unnest(array_replace(s.cluster_ids, p_source, p_target)) as cid
  )
  where p_source = any(s.cluster_ids);

  -- ── 5/6. Delete the source (cascade sweeps its remaining child rows:
  --         leftover cluster_inputs / scenario_clusters, its canvas_nodes,
  --         self-loop/duplicate relationships, and cluster_suggestions) ─────
  delete from public.clusters where id = p_source;
end;
$$;

grant execute on function public.merge_clusters(uuid, uuid) to authenticated;

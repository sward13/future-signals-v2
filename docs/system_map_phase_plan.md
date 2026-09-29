Below is the phased plan. Each phase is written as a standalone handoff prompt for a future Claude Code session with no memory of this conversation — exact file paths, function names, and line numbers come from the audit of this codebase (line numbers current as of branch workspace-refactor, commit b043134; re-verify with grep before editing if the files have since moved).

One sequencing risk that spans the whole plan, stated up front: Phase 1 adds NOT NULL system_map_id columns to four tables that the current, unmodified UI still writes to. Phase 2 absorbs this with a temporary backward-compatibility shim (callers that only know a projectId get resolved to that project's implicit single map). That shim is load-bearing until Phases 5–6 land — the prompts mark it explicitly so a future executor doesn't "clean it up" early.

---
Phase 1 — Schema migration

Depends on: nothing. Blocks: all later phases.

You are making a schema-only change to Future Signals v2. Read CLAUDE.md first and follow its migration workflow exactly: new migration file in supabase/migrations/, run against staging (project kptatqipjwihkdxdxlvh) via `supabase db push --db-url <staging-db-url>`, never against production (tbxjudpxzovbasuomekq). Follow the grant + RLS pattern from supabase/migrations/20260624_canvas_text_nodes.sql verbatim — it is the project's canonical example.

Context: System Maps are currently 1:1 with projects. The map has no table of its own — it is implicitly "whatever canvas_nodes / canvas_text_nodes / relationships rows exist for a project_id." System Analysis (analyses table) is 1:1 with project, enforced by a unique constraint on analyses.project_id (visible as `analyses_project_id_fkey` with `isOneToOne: true` in src/types/database.types.ts:92-99). We are moving to N maps per project, with System Analysis becoming a 1:1 child of a map, carrying its own title.

Create `supabase/migrations/20260707_system_maps.sql` with the following steps in order:

1. Create the system_maps table:

   create table public.system_maps (
     id           uuid        primary key default gen_random_uuid(),
     workspace_id uuid        not null references public.workspaces(id) on delete cascade,
     project_id   uuid        not null references public.projects(id)   on delete cascade,
     name         text        not null default 'System Map',
     created_at   timestamptz not null default now(),
     updated_at   timestamptz not null default now()
   );

   grant select                         on public.system_maps to anon;
   grant select, insert, update, delete on public.system_maps to authenticated;
   grant select, insert, update, delete on public.system_maps to service_role;

   alter table public.system_maps enable row level security;

   create policy "workspace members manage their system maps"
     on public.system_maps for all
     using (workspace_id = get_workspace_id());

2. Backfill one system_maps row per project that has ANY existing map/analysis data (projects with none stay at zero maps, preserving current "not started" semantics):

   insert into public.system_maps (workspace_id, project_id, name)
   select distinct p.workspace_id, p.id, 'System Map'
   from public.projects p
   where exists (select 1 from public.canvas_nodes n      where n.project_id = p.id)
      or exists (select 1 from public.canvas_text_nodes t where t.project_id = p.id)
      or exists (select 1 from public.relationships r     where r.project_id = p.id)
      or exists (select 1 from public.analyses a          where a.project_id = p.id);

3. Add system_map_id to the four child tables (nullable → backfill → not null), plus the new analyses.title column. Do NOT drop project_id from any of these tables — it stays as a retained denormalized column (same precedent as the retained-but-unused signal_quality column documented in CLAUDE.md "Known database gotchas"); dropping it would break all app code that hasn't been migrated yet.

   alter table public.canvas_nodes      add column system_map_id uuid references public.system_maps(id) on delete cascade;
   alter table public.canvas_text_nodes add column system_map_id uuid references public.system_maps(id) on delete cascade;
   alter table public.relationships     add column system_map_id uuid references public.system_maps(id) on delete cascade;
   alter table public.analyses          add column system_map_id uuid references public.system_maps(id) on delete cascade;
   alter table public.analyses          add column title text not null default 'System Analysis';

   update public.canvas_nodes n      set system_map_id = sm.id from public.system_maps sm where sm.project_id = n.project_id;
   update public.canvas_text_nodes t set system_map_id = sm.id from public.system_maps sm where sm.project_id = t.project_id;
   update public.relationships r     set system_map_id = sm.id from public.system_maps sm where sm.project_id = r.project_id;
   update public.analyses a          set system_map_id = sm.id from public.system_maps sm where sm.project_id = a.project_id;

   alter table public.canvas_nodes      alter column system_map_id set not null;
   alter table public.canvas_text_nodes alter column system_map_id set not null;
   alter table public.relationships     alter column system_map_id set not null;
   alter table public.analyses          alter column system_map_id set not null;

4. Re-home two unique constraints. Two constraints exist whose exact names are not visible in the repo and must be looked up on the live staging DB before writing this step (query pg_constraint or use the dashboard) — do not guess names:
   - canvas_nodes has a unique constraint on (project_id, cluster_id) — its existence is proven by the upsert `onConflict: "project_id,cluster_id"` at src/hooks/useAppState.js:1394. Drop it; add `unique (system_map_id, cluster_id)`.
   - analyses has a unique constraint on (project_id) — proven by `onConflict: "project_id"` at src/hooks/useAppState.js:1261 and the isOneToOne FK in database.types.ts. Drop it; add `unique (system_map_id)`.

5. Push to staging, then regenerate types per CLAUDE.md:
   supabase gen types typescript --project-id kptatqipjwihkdxdxlvh > src/types/database.types.ts

DO NOT TOUCH: any .js/.jsx application code except the regenerated database.types.ts; src/hooks/useAppState.js (that is Phase 2); production Supabase.

Verify: (a) system_maps has exactly one row per project that previously had canvas/analysis data; (b) system_map_id is populated and not-null on all rows of the four child tables; (c) the app still runs unchanged against staging — existing code ignores the new columns, and the old upsert onConflict targets will keep working only until Phase 2 updates them, which is why Phase 2 must follow promptly. If the canvas_nodes upsert errors after the constraint swap in step 4, that is expected breakage that Phase 2 fixes — note it in your handoff summary rather than reverting.

One flag on step 4: swapping the canvas_nodes unique constraint before Phase 2 updates the onConflict target creates a short window where adding a node to the map can error. If a gap between Phase 1 and Phase 2 deploys is expected, run Phases 1 and 2 as one deploy unit.

---
Phase 2 — State layer (useAppState.js)

Depends on: Phase 1 on staging, types regenerated. Blocks: Phases 3–6.

You are updating ONLY src/hooks/useAppState.js in Future Signals v2. Read CLAUDE.md first. Schema is done: a system_maps table exists (id, workspace_id, project_id, name, created_at, updated_at); canvas_nodes, canvas_text_nodes, relationships, and analyses each carry a NOT NULL system_map_id (project_id retained as legacy denormalized column); analyses also gained a title column; unique constraints moved to canvas_nodes(system_map_id, cluster_id) and analyses(system_map_id).

Constraint on this phase: no .jsx file changes. The shipped UI (ScenarioCanvas.jsx, SystemAnalysisCanvas.jsx, ProjectOverview.jsx, Dashboard.jsx, ExportModal.jsx) knows nothing about system_map_id and must keep working identically. Achieve this with the fallback shim described in step 3.

1. State + fetch. Add `const [systemMaps, setSystemMaps] = useState([]);` alongside the analyses state (line 61). Add a fetchSystemMaps function in the same workspace-fetch effect as fetchClusters (lines 201-217) and fetchAnalyses (lines 335-346), same pattern: .from("system_maps").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }), invoked wherever the sibling fetchers are invoked.

2. CRUD. Add three functions using the file's standard optimistic-update-then-async-supabase shape (addCanvasNode at lines 1370-1404 is the closest model):
   - addSystemMap(projectId, fields) — insert with name defaulting to "System Map"; return the new row.
   - updateSystemMap(id, fields) — rename; .update().eq("id", id).eq("workspace_id", workspaceId).
   - deleteSystemMapRecord(id) — one DELETE on system_maps (the DB cascades to all four child tables via the on-delete-cascade FKs), plus local filtering of setSystemMaps, setCanvasNodes, setCanvasTextNodes, setRelationships, setAnalyses by the map id, since local state doesn't see DB cascades.
   Do NOT name the delete function deleteSystemMap — that name is taken by the existing map-contents reset at lines 1620-1641, which stays (see step 5).

3. Rescope the four tables' functions. Everywhere below, ADD systemMapId alongside projectId — never remove projectId; unmigrated UI still reads it.

   Fetch mapping: fetchCanvasNodes (239-256), fetchCanvasTextNodes (258-281), fetchRelationships (283-305) — add `systemMapId: row.system_map_id` to the mapped object. fetchAnalyses (335-346) does setAnalyses(data) raw, so system_map_id and title already pass through — no change.

   Writes — each gets the TEMPORARY FALLBACK SHIM: if fields.systemMapId is absent, resolve it as systemMaps.find(m => m.project_id === fields.projectId)?.id; if no map exists yet for that project, create one via the addSystemMap path first and use its id. Mark each shim site with a comment naming it as temporary multi-map migration scaffolding, to be removed once the System Map UI passes systemMapId explicitly.
   - addCanvasNode (1370-1404): include system_map_id in the upsert payload and local object; change onConflict at line 1394 from "project_id,cluster_id" to "system_map_id,cluster_id".
   - addCanvasTextNode (1444-1483): include system_map_id in the insert payload and local object.
   - addRelationship (1533-1573): include system_map_id in the insert payload and local object.
   - upsertAnalysis (1247-1269): re-key from project to map. The local exists/map matching at 1250-1251 and the upsert at 1259-1262 switch to system_map_id with onConflict: "system_map_id". Accept either a map id or (fallback shim) a project id — every current caller (SystemAnalysisCanvas.jsx:265 passes activeProjectId) hits the fallback path until Phase 5.
   - deleteAnalysis (1272-1288): same fallback-aware re-keying to system_map_id.

4. Note for later phases, no code here: the cluster-removal cascade in ScenarioCanvas.jsx:1898-1907 (handleRemoveFromCanvas) deletes relationships from projectRels — already canvas-scoped, not pool-scoped, per the confirmed product decision. Once the canvas UI filters relationships by systemMapId (Phase 5/6), that cascade becomes correctly map-scoped for free; the only state-layer prerequisite is the systemMapId field this step already exposes on the relationships array.

5. deleteSystemMap (1620-1641, the contents-reset): change its parameter and all three supabase .eq("project_id", …) filters plus the three local setState filters to scope by system_map_id. Keep the name and export — ScenarioCanvas.jsx:2045 still calls it with activeProjectId; that call resolves wrongly-typed until Phase 5 updates it, so ALSO apply the same fallback shim inside this function (if the argument matches no systemMaps.id, resolve it as that project's single map).

6. deleteProject (1645+): existing project_id local filters still work (project_id retained) — leave them and the explicit child-table DB deletes alone. Add one line: setSystemMaps(prev => prev.filter(m => m.project_id !== id)).

7. Export systemMaps, addSystemMap, updateSystemMap, deleteSystemMapRecord from the returned object (~lines 1710-1810), near the analyses/canvasNodes exports (1757, 1784-1797).

DO NOT TOUCH: anything under src/components/. Do not remove the fallback shims. Do not rename the existing deleteSystemMap.

Verify: exercise the whole current app against staging — Scan, Cluster, System Map (add node, draw relationship, add text node, reset map), System Analysis (edit, save, delete), Dashboard, Export. Everything must behave exactly as before, with every write now carrying a populated system_map_id (confirm in the Supabase dashboard). Confirm a fresh project's first canvas interaction auto-creates its system_maps row via the shim.

---
Phase 3 — Navigation skeleton (list screen + routing)

Depends on: Phase 2. Blocks: Phase 4 (clone button lives here), Phase 5 (needs activeSystemMapId).

⛔ Blocking design decision flagged, not resolved: does the sidebar's "System Map" item (Sidebar.jsx:45, currently screen: "scenarios") always land on the maps list, or skip straight into the map when the project has exactly one and only interpose a list at 2+? Same question applies to the Overview phase card's onClick={() => setActiveScreen("scenarios")} (ProjectOverview.jsx:412). This is the list→detail→nested-detail navigation-pattern question — it needs a product answer before the permanent entry points can be wired. This phase therefore builds the screen and the nav state but deliberately leaves Sidebar.jsx and ProjectOverview.jsx untouched.

You are adding a System Maps list screen to Future Signals v2 without wiring it into permanent navigation. Read CLAUDE.md first — especially the Tailwind token tables, empty-state rule, and Terminology table. Prerequisites already shipped: system_maps table; useAppState.js exposes systemMaps, addSystemMap, updateSystemMap, deleteSystemMapRecord, and canvasNodes/relationships rows carry a systemMapId field.

1. Nav state. In src/hooks/useAppState.js add activeSystemMapId/setActiveSystemMapId (useState(null)), modeled on activeProjectId at line 83. Add openSystemMap(id) modeled on openProject (~line 381): set the id, then setActiveScreen("scenarios"). Export all three.

2. New screen: src/components/screens/SystemMapsList.jsx. Build it in Tailwind (new component — no tokens.js import, per CLAUDE.md migration rules; use rounded-container, text-ui, the named color tokens, clsx for conditional classes). Content:
   - Filter appState.systemMaps to m.project_id === activeProjectId.
   - Per map: name; node count (canvasNodes.filter(n => n.systemMapId === m.id).length); relationship count (same filter on relationships); created_at. Click → openSystemMap(m.id).
   - "+ New system map" → addSystemMap(activeProjectId, {}).
   - Per-map delete behind ConfirmDialog (import pattern: ScenarioCanvas.jsx:21, usage: ScenarioCanvas.jsx:2040-2046) → deleteSystemMapRecord(m.id).
   - Rename affordance → updateSystemMap(m.id, { name }).
   - Empty state per CLAUDE.md: one sentence, "+ New system map" as the CTA.
   - No Clone action — that is a later phase.
   - Header follows the minimal project-screen pattern: eyebrow project.name, title per the locked terminology ("System Map" is the locked term; if a plural page title is needed, flag the exact wording for review in your summary rather than inventing a new term).

3. Routing. In src/App.jsx add `case "system-maps-list": return <SystemMapsList appState={appState} />;` to the ActiveScreen switch (lines 36-60) and the import block (lines 17-33). Check whether the new screen needs adding to the scroll-exclusion list on App.jsx:329 — the list screen scrolls normally, so it should NOT be added there.

DO NOT TOUCH: src/components/layout/Sidebar.jsx (line 45 keeps routing "System Map" → "scenarios"); ProjectOverview.jsx (phase card at 407-425 keeps its current onClick); ScenarioCanvas.jsx; SystemAnalysisCanvas.jsx. The permanent entry point is blocked on an undecided product question (list-always vs. skip-to-map-when-single); state that in your final summary.

Verify: with a project active, drive appState.setActiveScreen("system-maps-list") from the browser console (or a throwaway dev button removed before finishing). Confirm the list shows the project's existing map (auto-created by the Phase 2 shim if the canvas was ever used), that create/rename/delete work and persist, and that clicking a map sets activeSystemMapId and lands on the canvas screen.

---
Phase 4 — Clone operation

Depends on: Phases 1–3. Copies rows; references clusters — per the audit, clusters are the project's shared pool (clusters has no map column; canvas_nodes is the placement join), so a clone copies placements/edges/annotations/analysis and points at the same cluster rows.

You are adding "clone a System Map" to Future Signals v2: one atomic SECURITY DEFINER RPC plus wiring. Read CLAUDE.md first (migration workflow, staging-first). The precedent to follow is duplicate_input_to_cluster: supabase/migrations/20260623_duplicate_input_to_cluster.sql, hardened by 20260705_duplicate_input_dest_cluster_check.sql — workspace-ownership check first, then source-scoping on every copied row, then grant execute to authenticated. Match that discipline exactly.

1. Migration supabase/migrations/20260710_clone_system_map.sql:

   create or replace function public.clone_system_map(
     p_source_map_id uuid,
     p_workspace_id  uuid,
     p_new_name      text default null
   )
   returns uuid
   language plpgsql security definer
   as $$
   declare
     new_map_id uuid := gen_random_uuid();
     src_project_id uuid;
     src_name text;
   begin
     -- caller owns the workspace (workspaces.user_id, NOT owner_id — see CLAUDE.md gotchas)
     if not exists (
       select 1 from public.workspaces
       where id = p_workspace_id and user_id = auth.uid()
     ) then
       raise exception 'unauthorized';
     end if;

     -- source map exists in this workspace
     select project_id, name into src_project_id, src_name
     from public.system_maps
     where id = p_source_map_id and workspace_id = p_workspace_id;
     if src_project_id is null then
       raise exception 'source system map not found in workspace';
     end if;

     insert into public.system_maps (id, workspace_id, project_id, name)
     values (new_map_id, p_workspace_id, src_project_id, coalesce(p_new_name, src_name || ' (copy)'));

     -- COPY placements; REFERENCE the same cluster rows (clusters are the project pool, never duplicated)
     insert into public.canvas_nodes (id, workspace_id, project_id, system_map_id, cluster_id, x, y)
     select gen_random_uuid(), workspace_id, project_id, new_map_id, cluster_id, x, y
     from public.canvas_nodes
     where system_map_id = p_source_map_id and workspace_id = p_workspace_id;

     insert into public.canvas_text_nodes (id, workspace_id, project_id, system_map_id, x, y, text, font_family, font_size, bold, italic, color)
     select gen_random_uuid(), workspace_id, project_id, new_map_id, x, y, text, font_family, font_size, bold, italic, color
     from public.canvas_text_nodes
     where system_map_id = p_source_map_id and workspace_id = p_workspace_id;

     insert into public.relationships (id, workspace_id, project_id, system_map_id, from_cluster_id, to_cluster_id, type, evidence, confidence, source_handle, target_handle)
     select gen_random_uuid(), workspace_id, project_id, new_map_id, from_cluster_id, to_cluster_id, type, evidence, confidence, source_handle, target_handle
     from public.relationships
     where system_map_id = p_source_map_id and workspace_id = p_workspace_id;

     insert into public.analyses (id, workspace_id, project_id, system_map_id, title, confidence, critical_uncertainties, description, implications, key_dynamics)
     select gen_random_uuid(), workspace_id, project_id, new_map_id, title, confidence, critical_uncertainties, description, implications, key_dynamics
     from public.analyses
     where system_map_id = p_source_map_id and workspace_id = p_workspace_id;

     return new_map_id;
   end;
   $$;

   grant execute on function public.clone_system_map(uuid, uuid, text) to authenticated;

   Default behavior: the map's System Analysis clones with it (title + content). "Clone with blank analysis" would be a new parameter later, not this phase. The whole function body is one transaction — no partial clones.

   Push to staging first per CLAUDE.md.

2. src/hooks/useAppState.js: add cloneSystemMap(sourceMapId, newName?) near the other system_maps functions. Call supabase.rpc("clone_system_map", { p_source_map_id: sourceMapId, p_workspace_id: workspaceId, p_new_name: newName ?? null }). On success, refetch rather than hand-splice: re-run the existing fetchers for system_maps, canvas_nodes, canvas_text_nodes, relationships, analyses (reuse them — do not duplicate their query logic). Toast on success/failure per the house convention. Export it.

3. src/components/screens/SystemMapsList.jsx (built in Phase 3): add a per-map "Clone" action calling cloneSystemMap(m.id).

DO NOT TOUCH: ScenarioCanvas.jsx, SystemAnalysisCanvas.jsx, Sidebar.jsx, ProjectOverview.jsx. Do not build any selective/partial copy UI (copying individual nodes or relationships between maps) — that is a separate undesigned feature, explicitly out of scope; this phase clones whole maps only.

Verify: clone a map that has nodes, edges, text annotations, and a filled analysis. Confirm (a) the clone is independent — moving a node or editing analysis text on one map does not affect the other; (b) both maps reference the SAME cluster rows — renaming a cluster shows the rename on both canvases; (c) deleting the clone leaves the source intact.

---
Phase 5 — System Analysis nesting

Depends on: Phases 1–3 (schema analyses.system_map_id + title; upsertAnalysis/deleteAnalysis map-keyed with shim; activeSystemMapId exists).

Scope note: this phase makes the data relationship real in the UI and adds an entry point from inside a specific map to its analysis. It deliberately does not touch System Analysis's global nav presence (Sidebar.jsx:46, ProjectOverview.jsx:428-449) — reconciling those with multi-map is the same blocked navigation decision from Phase 3.

You are making System Analysis a true 1:1 child of a specific System Map in Future Signals v2's UI. Read CLAUDE.md first. Already shipped: analyses.system_map_id (unique) and analyses.title in the schema; upsertAnalysis/deleteAnalysis in useAppState.js keyed on system_map_id with a temporary projectId-fallback shim; activeSystemMapId/openSystemMap nav state; a SystemMapsList screen.

1. src/components/screens/SystemAnalysisCanvas.jsx — switch from project-scoped to map-scoped:
   - Lines 229-234 (destructure): add activeSystemMapId, systemMaps, setActiveScreen if not present.
   - Line 238: `analyses.find(a => a.project_id === activeProjectId)` → `analyses.find(a => a.system_map_id === activeSystemMapId)`.
   - Line 247 (the reset effect keyed on [activeProjectId, analysis?.id]): re-key on activeSystemMapId so switching maps resets localFields.
   - Line 265: upsertAnalysis(activeProjectId, localFields) → upsertAnalysis(activeSystemMapId, localFields).
   - Line 337: deleteAnalysis(activeProjectId) → deleteAnalysis(activeSystemMapId).
   - Guard: if activeSystemMapId is null (screen reached via the legacy sidebar item without a map selected), fall back to the project's first map (systemMaps.find(m => m.project_id === activeProjectId)) and set it; if the project has no maps, render an empty state pointing the practitioner to the System Map screen. Do not crash on the find returning undefined.
   - Update the file's JSDoc header (lines 1-6), which still says "Single record per project".

2. Title field. The PANELS array at the top of SystemAnalysisCanvas.jsx defines the five content sections but no title — the analysis has never had its own name. Per the product decision it now does, independent of the parent map's name (do NOT derive or sync it from system_maps.name). Add an editable title input above the panel grid, initialized from analysis?.title (DB default 'System Analysis'), saved through the existing localFields/save path (lines 235, 251-265) as one more field on upsertAnalysis — do not invent a second save mechanism.

3. Entry points between a map and its analysis. In src/components/screens/ScenarioCanvas.jsx add a toolbar/header affordance on the open map that navigates to its analysis: setActiveScreen("analysis") (activeSystemMapId is already set by openSystemMap). Add the inverse on SystemAnalysisCanvas.jsx ("Back to map" → setActiveScreen("scenarios")). Label per the locked terminology: "System Analysis" / "System Map".

4. Map-scope the canvas screen's own lookups — required for the parent-child relationship to mean anything, and this also completes the cluster-removal scoping decision (removal was already canvas-only; it just needs the map dimension):
   - ScenarioCanvas.jsx:1825-1828: projectNodes / projectTextNodes / projectRels switch from filtering on projectId to systemMapId (activeSystemMapId).
   - ScenarioCanvas.jsx:1887-1896 (handleAddToCanvas): pass systemMapId: activeSystemMapId into addCanvasNode alongside projectId. Same for the text-node creation paths around lines 1329 and 1380 and the relationship save paths at 1914 and 2058.
   - ScenarioCanvas.jsx:1898-1907 (handleRemoveFromCanvas): no logic change needed — once projectRels is map-filtered, the relationship cascade is automatically scoped to this map only. Confirm this in testing rather than by reading.
   - ScenarioCanvas.jsx:2040-2046: the reset dialog's deleteSystemMap(activeProjectId) and deleteAnalysis(activeProjectId) both become activeSystemMapId, and the ConfirmDialog copy should name the map, not just the project.

5. Once every caller in steps 1-4 passes a real map id, remove the temporary projectId-fallback shims in useAppState.js (marked with comments at the addCanvasNode / addCanvasTextNode / addRelationship / upsertAnalysis / deleteAnalysis / deleteSystemMap sites) — UNLESS grep shows remaining callers still passing project ids, in which case leave the shims and list the holdout call sites in your summary.

DO NOT TOUCH: Sidebar.jsx line 46 (the "System Analysis" nav item stays pointing at "analysis") and ProjectOverview.jsx lines 428-449 (the phase card, including latestAnalysisTs at line 177) — with multiple maps these surfaces become ambiguous ("which analysis?"), and resolving that is the blocked navigation-pattern decision from the list-screen phase. Flag the ambiguity explicitly in your summary; do not silently pick a map for them beyond the null-guard in step 1.

Verify: create two maps on one project via SystemMapsList; give each analysis a distinct title and distinct content in at least two panels; switch between maps and confirm each shows only its own analysis, saves independently, and deleting one map's analysis leaves the other's intact. Also verify cluster removal scoping: place the same cluster on both maps, draw a relationship from it on each, remove the cluster from map A's canvas — map A's relationship goes, map B's node and relationship stay, and the cluster remains in the project pool (Cluster screen unchanged).

---
Phase 6 — Drawer / canvas UI

Split in two. Part A is unblocked pure refactor; Part B is blocked and gets no implementation prompt yet.

Part A — extract the resize mechanics (unblocked)

You are extracting a generic resizable-rail component from ClusterScreen.jsx in Future Signals v2. Pure refactor: zero behavior change, no new features, no new call sites. Read CLAUDE.md first.

The resize mechanics live inline in src/components/screens/ClusterScreen.jsx and are not reusable as-is: state (drawerHeight, resizing, resizeRef) at lines 105-111 (localStorage key "clusterDrawerHeight", default 240); the mousemove/mouseup effect at 113-128 (min 120, max window.innerHeight * 0.6, drag-up-to-grow); the persistence effect at 130-132; the drag-handle JSX at 355-380. Everything below the handle (lines 382+: the "Inputs" label, drop zone, FilterTabs, search, input list) is Scan/Cluster-specific content and STAYS in ClusterScreen.jsx — only the mechanics move.

Create src/components/shared/ResizableRail.jsx: props storageKey (independent persistence per call site), defaultHeight, minHeight, maxHeightRatio, children. It owns the height/resizing state, the window mouse listeners, the localStorage read/write, and renders the drag handle (reproduce the current handle's exact appearance: 7px strip, row-resize cursor, three 3px dots, c.bg background with borderMid top / border bottom) above a height-controlled container wrapping children. ClusterScreen.jsx is not yet a Tailwind-migrated component (it imports from tokens.js), so match its inline-style idiom rather than converting styles to Tailwind mid-refactor.

Refactor ClusterScreen.jsx to <ResizableRail storageKey="clusterDrawerHeight" defaultHeight={240} minHeight={120} maxHeightRatio={0.6}> wrapping the existing rail content, deleting the now-redundant local state, both effects, and the handle JSX.

DO NOT TOUCH: ScenarioCanvas.jsx, SystemAnalysisCanvas.jsx, or any other screen. Do not wire ResizableRail into the System Map view — that use is blocked on an open design decision (Part B). Do not change the localStorage key.

Verify: the Cluster screen's input rail is pixel-for-pixel and behavior-for-behavior identical — same default and persisted height (existing stored "clusterDrawerHeight" values must still be honored), same clamping, same drag feel, drag-and-drop into the rail's drop zone unaffected. Any visible difference means the refactor is wrong.

Part B — System Analysis presentation inside System Map, cross-map copy (⛔ blocked — no prompt yet)

Three unresolved questions block writing this prompt. Do not build placeholder UI that presumes an answer to any of them:

1. Presentation model for a map's analysis. With analysis now a child of the map (Phase 5 ships the minimal version: separate screen + jump links), the open question is whether it should instead live inside the map view — e.g. hosted in a ResizableRail from Part A, a split pane, or something else — or stay a sibling screen. The decision needed: where does a practitioner read/edit the analysis relative to the canvas, and does the five-panel PANELS layout from SystemAnalysisCanvas.jsx survive compression into a rail? This is a product/UX call, not an engineering default.
2. Cross-map exploratory copy/paste. Whether practitioners can copy individual nodes/relationships between maps (as opposed to Phase 4's whole-map clone) is undecided. Nothing in the codebase is precedent — duplicate_input_to_cluster is single-row, input→cluster, and doesn't generalize to graph fragments between canvases. Decision needed first: is this in scope at all; if yes, the interaction model (multi-select? drag between two open maps? clipboard metaphor?) needs design before any schema or RPC work.
3. John's canvas-vs-other-model question. Raised but its content isn't captured in the repo or this plan. Before scoping Part B, retrieve what alternative to the React Flow canvas John proposed and whether it's still live. If it changes what a System Map fundamentally is, it upstream-affects Phases 3–5's UI (though not Phase 1–2's schema/state work, which is representation-agnostic).
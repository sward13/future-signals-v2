# Pass 2 Implementation Prompt: System Map Background Templates

**Status:** Ready to execute. Written after Pass 1 audit (folded into `system-map-background-templates-spec.md`) resolved every open question.
**Scope for this pass:** curated templates only, fixed placement, fixed opacity, canvas rendering, PNG export, and a real seed script/migration for the launch template set. **Web Publish integration is explicitly out of scope for this pass — it's Pass 3**, per the spec's confirmed finding that PNG export and Web Publish share zero rendering code and are two independent build tracks. User uploads (the stretch goal) are out of scope entirely, deferred to a separate later spec.

This is written as a standalone handoff prompt for a Claude Code session with no memory of the audit conversation that produced it — exact file paths and line numbers below are current as of the Pass 1 audit (branch `workspace-refactor`); re-verify with grep before editing if files have moved since.

Read `docs/system-map-background-templates-spec.md` in full first — it has the full feature narrative, acceptance criteria, and the reasoning behind every decision below. This prompt is the "how to build it," not a restatement of the "why."

---

## Confirmed facts this prompt is built on (do not re-derive — verified in Pass 1 audit)

- **Canvas:** React Flow (`@xyflow/react` v12) is the sole renderer, entirely inside `src/components/screens/ScenarioCanvas.jsx`. No other screen imports it.
- **No `system_maps` table exists.** System Map state is keyed directly on `project_id` across `canvas_nodes`, `canvas_text_nodes`, `relationships`, and `analyses`. `project_system_map_background` (below) follows that same keying convention.
- **PNG export** (`ScenarioCanvas.jsx`, `runExport()`/`exportAsPng()`) is a client-side `html-to-image` `toPng()` snapshot of `document.querySelector(".react-flow__viewport")` specifically. Anything that is a genuine React Flow node (i.e. lives inside that viewport div) is captured automatically. Anything passed as a JSX child of `<ReactFlow>` (the way the existing dot-grid `<Background>` is) renders as a *sibling* of the viewport and is **not** captured. This is why the background must be built as a custom node, not a `<Background>`/`<Panel>`-style bolt-on.
- **No existing mechanism renders arbitrary world-space content today.** No node/edge anywhere in the codebase currently sets a `zIndex` field — this feature introduces that.
- **`selectable: false`** is the established, already-proven pattern for making canvas content present but non-interactive (used today on both cluster nodes and relationship edges, with selection handled as app-level state rather than React Flow's native selection).
- **No image-asset bucket exists.** The only Storage bucket in the app (`published-projects`) is unrelated (Web Publish HTML snapshots). A new bucket is required.
- **No reproducible curated-content seeding mechanism exists for `sources`** (the nearest precedent) — those rows come from undocumented manual writes. Per OQ-BG-07, this pass does **not** repeat that gap: templates get a real, version-controlled seed script or migration insert.

---

## Step 1 — Migration: `system_map_templates` + `project_system_map_background`

New file: `supabase/migrations/<timestamp>_system_map_templates.sql`. Follow the `sources` table's grant/RLS pattern exactly (curated = `owner_id IS NULL`, readable by everyone; only service role can write curated rows since no client insert policy permits `owner_id IS NULL`) — that schema shape was confirmed sound in the audit, only the seeding *workflow* recommendation changed.

```sql
create table if not exists system_map_templates (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  description    text,
  category       text,
  asset_url      text        not null,
  thumbnail_url  text        not null,
  source_type    text        not null default 'curated' check (source_type in ('curated', 'user_uploaded')),
  owner_id       uuid        references workspaces(id) on delete cascade,
  active         boolean     not null default true,
  created_at     timestamptz not null default now()
);

grant select on public.system_map_templates to anon;
grant select, insert, update, delete on public.system_map_templates to authenticated;
grant select, insert, update, delete on public.system_map_templates to service_role;

alter table public.system_map_templates enable row level security;

create policy "system_map_templates_select" on system_map_templates
  for select using (
    owner_id is null
    or owner_id in (select id from workspaces where user_id = auth.uid())
  );
-- No insert/update/delete policy for authenticated on curated (owner_id null) rows —
-- matches the `sources` pattern. User-upload policies are Pass 3+ scope; omit entirely
-- for this pass since OQ-BG-06 deferred user uploads.
```

```sql
create table if not exists project_system_map_background (
  project_id   uuid        primary key references projects(id) on delete cascade,
  -- Forward-compatibility note: this is keyed on project_id because System Map state
  -- has no system_maps table today (confirmed in Pass 1 audit — see
  -- system_map_phase_plan.md, an unexecuted proposal). If that multi-map work ever
  -- ships, this table needs to migrate from project_id to system_map_id.
  template_id  uuid        references system_map_templates(id) on delete set null,
  opacity      numeric     not null default 0.35,
  position_x   numeric     not null default 0,
  position_y   numeric     not null default 0,
  scale        numeric     not null default 1,
  updated_at   timestamptz not null default now()
);

grant select on public.project_system_map_background to anon;
grant select, insert, update, delete on public.project_system_map_background to authenticated;
grant select, insert, update, delete on public.project_system_map_background to service_role;

alter table public.project_system_map_background enable row level security;

create policy "workspace members manage their system map background"
  on public.project_system_map_background for all
  using (
    project_id in (
      select id from projects where workspace_id = get_workspace_id()
    )
  );
```

`opacity`/`position_x`/`position_y`/`scale` all get real defaults here (0.35 / 0 / 0 / 1) rather than the spec's draft "TBD" — Sam confirmed fixed opacity/placement for V1 (OQ-BG-02, OQ-BG-03), so there's no UI need for nullable/undefined defaults.

Push to staging first, per `CLAUDE.md`'s migration workflow. Do not touch production.

## Step 2 — Seed script/migration for the launch template set (OQ-BG-07)

Per Sam's resolution of OQ-BG-07, this needs to be real and version-controlled — not a manual write. Two viable shapes; pick one and be consistent with the rest of the migration:

- A second migration file with plain `insert into system_map_templates (...) values (...)` rows for the six launch candidates (Three Horizons, 2x2 Scenario Matrix, Futures Cone, STEEP/PESTLE Wheel, Causal Layered Analysis, Impact/Uncertainty Grid), **or**
- A `scripts/seed-system-map-templates.js` following the existing `scripts/` convention (see `scripts/clone-project.js` for the house style of a standalone, non-app-wired script), reading a small local manifest and upserting rows.

**Asset blocker to flag, not silently work around:** actual template artwork (SVG files for the six launch candidates) is called out in the spec as "a design task, not part of this spec." Do not invent placeholder SVGs that end up shipping as real content. Two acceptable ways to proceed without blocking on design: (a) seed the rows with `active = false` and placeholder `asset_url`/`thumbnail_url` values pointing at the new bucket, so the data layer and picker UI can be built and tested end-to-end, then flip `active = true` once real artwork lands in the bucket; or (b) stop after Step 3 (bucket) and Step 1 (migration) and get real artwork before writing seed rows. Flag this choice in your summary rather than deciding silently — it affects whether QA can see real templates in the picker or only a "coming soon" state.

## Step 3 — New Storage bucket

Model on `published-projects` (`supabase/migrations/20260715195707_project_publications.sql`) — public bucket, explicit RLS scoped by `bucket_id`, since that's the one real precedent in this repo for a Storage bucket. New migration:

```sql
insert into storage.buckets (id, name, public)
values ('system-map-templates', 'system-map-templates', true)
on conflict (id) do update set public = excluded.public;

create policy "system map templates public read"
  on storage.objects for select
  using (bucket_id = 'system-map-templates');

create policy "system map templates authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'system-map-templates' and auth.role() = 'authenticated');
```

Curated assets are trusted content (admin/A+W-authored), so this pass doesn't need the SVG-sanitization work the spec flags for the user-upload stretch goal — that requirement is explicitly scoped to Pass 3+/the upload path, not curated seeding.

## Step 4 — `useAppState.js`: state, fetch, CRUD

Follow the existing fetch/CRUD shape used for sibling per-project/per-workspace resources (e.g. `analyses`'s single-row-per-project pattern is the closer analog here than a list, since `project_system_map_background` is one row per project).

- `systemMapTemplates` (workspace-independent — curated rows are global): fetch once, `.from("system_map_templates").select("*").eq("active", true)`.
- `projectSystemMapBackground` (or fold into existing per-project state): fetch alongside other project-scoped fetchers, `.from("project_system_map_background").select("*").eq("project_id", activeProjectId).maybeSingle()` — `maybeSingle()` because a project may have no row yet (no background set).
- `setSystemMapBackground(projectId, templateId)` — upsert on `project_id` (the table's PK), following the `onConflict: "project_id"` pattern already used elsewhere in this file for `analyses` (see the audit's note on `upsertAnalysis`).
- `removeSystemMapBackground(projectId)` — set `template_id = null` on the existing row (or delete the row entirely — either satisfies "background persists across sessions... reload, background is still there" as long as null/absent both mean "no background").

Export all three from the hook's return object, near the other System-Map-adjacent exports.

## Step 5 — Canvas rendering: background as a custom React Flow node

This is the load-bearing piece — get it right here and PNG export (Step 6) needs no code changes at all.

In `ScenarioCanvas.jsx`:
- Add a new custom node type, e.g. `BackgroundTemplateNode`, alongside the existing `ClusterNodeComponent`/`TextNodeComponent`, registered in the `nodeTypes` map (`nodeTypes = { cluster: ..., textNode: ..., backgroundTemplate: BackgroundTemplateNode }`).
- The node object itself: `selectable: false` (matching the existing cluster/edge precedent — confirmed proven pattern for non-interactive canvas content), `draggable: false`, and an explicit low `zIndex` (e.g. `zIndex: -1` or similar — confirm React Flow's exact z-index semantics for negative/low values against nodes with no explicit zIndex before picking the number, since nothing in this codebase sets this today and there's no existing value to copy) so it paints behind cluster nodes regardless of array order.
- Position/size: read from `projectSystemMapBackground` (`position_x`, `position_y`, `scale`) — fixed for V1, not draggable (`draggable: false` handles the "non-interactive" requirement; there's no reposition UI to wire up since OQ-BG-02 confirmed fixed placement for V1).
- Rendering: an `<img>` (or inline `<svg>` if fetching+inlining the curated SVG) pointing at the template's `asset_url`, at `opacity` from the stored row.
- Only render this node at all when `projectSystemMapBackground?.template_id` is set — omit it from the `nodes` array entirely otherwise, don't render an empty/hidden node.
- Do not add this node to the Inspector's `selectedItem` handling — since it's `selectable: false` and never reachable via `onNodeClick`/`onEdgeClick` (which only fire for real selections), no Inspector changes should be needed. Confirm this holds once built rather than assuming.

## Step 6 — Template picker UI

New entry point on the Canvas toolbar, alongside Clear Map / Connect / Canvas-Table toggle (`ScenarioCanvas.jsx`, near lines ~2065-2090 per the audit — re-verify exact lines before editing).

- Thumbnail grid, optionally grouped by `category`, reading `systemMapTemplates` from `appState`.
- Selecting a template calls `setSystemMapBackground(activeProjectId, templateId)` immediately — no confirm step, matching the app's low-friction pattern (e.g. the cluster force picker's immediate-add behavior).
- Reopening while a background is set highlights the current selection (compare against `projectSystemMapBackground?.template_id`).
- Separate "Remove background" action calls `removeSystemMapBackground(activeProjectId)`.
- **Modal/panel shell — not confirmed in the Pass 1 audit, decide during this step:** this app has at least two floating-content conventions (a centered modal like `AddSourceModal.jsx`, and a portal-based floating panel like `ClusterAssignMenu.jsx`/the cluster force picker). A thumbnail grid with search/filter leans toward a centered modal given its likely size, but confirm against both before building rather than assuming one fits.
- Clear Map's handler (`ConfirmDialog` `onConfirm` in `ScenarioCanvas.jsx`, calling `deleteSystemMap`/`deleteAnalysis`) must **not** be touched to also clear the background — this is intentional per OQ-BG-01's resolution, not an oversight to "complete."

## Step 7 — PNG export verification (not new export code, if Step 5 is right)

`runExport()`/`exportAsPng()` in `ScenarioCanvas.jsx` should need **zero changes** if the background is a genuine node inside `.react-flow__viewport` per Step 5 — `toPng(viewport, ...)` captures the whole subtree already. Verify this by actually applying a background, exporting, and opening the resulting PNG file — not by code review alone. If the background doesn't appear in the exported file, the node isn't actually landing inside `.react-flow__viewport` and Step 5 needs revisiting before moving on.

## Step 8 — QA pass

Against the spec's acceptance criteria, **excluding** the Web Publish criterion (Pass 3 scope):
- Picker reachable from toolbar, shows active curated templates.
- Selecting sets background immediately; reopening shows current selection; replacing swaps it.
- Remove background clears without touching clusters/relationships/annotations/System Analysis.
- Clear Map does not clear the background.
- Background persists across reload, scoped per project.
- Background pans/zooms with canvas content.
- PNG export includes the background at stored opacity/position/scale — verified against a real exported file.
- New templates addable via the seed script/migration from Step 2, not a manual write.

---

## DO NOT TOUCH in this pass

- `src/publish/systemMap.js` and `server-lib/publish-project.js` — Web Publish integration is Pass 3, a separate, independent implementation track (confirmed zero shared rendering code with PNG export). Don't add background logic here yet.
- `src/components/projects/buildMarkdown.js` — confirmed untouched by System Map entirely; no change needed for this feature at all.
- Cluster/relationship data model, styling, or behavior (`clusters`, `canvas_nodes`, `relationships` tables and their existing columns) — this feature is purely additive, a new background layer underneath existing content.
- Any user-upload path, SVG sanitization, or upload UI — deferred (OQ-BG-06), not this pass.
- `analyses` / System Analysis logic beyond confirming Clear Map's existing (unchanged) behavior.

---

## Open decisions to flag in your summary, not resolve silently

- Whether Step 2's seed rows ship `active = true` with placeholder art or `active = false` pending real design assets (see Step 2).
- Which existing modal/panel convention the picker UI should follow (see Step 6).
- The exact `zIndex` value/semantics for the background node relative to React Flow's default node stacking (see Step 5) — there's no existing precedent in this codebase to copy, so this needs to be verified empirically, not assumed from React Flow's docs alone.

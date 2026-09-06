# Feature Spec: System Map Background Templates

**Status:** Pass 1 audit complete, all open questions resolved by Sam. Pass 2 (implementation) prompt written — see `system-map-background-templates-audit-prompt.md`. Scope for this pass: curated templates only, fixed placement, fixed opacity, canvas rendering + PNG export + a real seed script. Web Publish integration is a separate Pass 3. User uploads (OQ-BG-06) deferred to a later spec.
**PRD section:** System Map
**Last updated:** 20 August 2026 (OQ-BG-07 resolved; moving into implementation)

---

## Overview

The System Map is a canvas where users arrange Clusters (Trends and Tensions) and draw typed relationships between them. Today the canvas is blank space — the user supplies all of the organizing structure themselves. This feature adds an optional background layer of foresight-framework templates (Three Horizons, a 2x2 scenario matrix, a Futures Cone, and similar) that a user can drop behind their clusters to give the map a shape to build against, instead of a plain grid.

A user picks a template from a library, it renders behind their clusters on the canvas, and it travels with the map into any exported or published output. Administrators can add new templates to the shared library. As a stretch goal, users can upload their own template images and reuse them privately across projects.

## Non-goals

- No change to Cluster or relationship data, styling, or behavior. The background is purely a visual layer underneath the existing canvas content.
- No automatic placement of clusters onto a template (for example, auto-sorting clusters into Three Horizons bands by their `horizon` field). The template is a visual guide the user positions clusters against manually; this spec doesn't add any logic that reads template zones.
- No collaborative/multiplayer editing of the background (matches the rest of the app — v2 has no real-time collaboration).
- The Table view of the System Map is unaffected — backgrounds are a Canvas-view-only concept.

---

## User stories

1. As a user, I can select a template from a library and have it appear as a background on my System Map, so I can use it to organize my map.
2. As a user, I can replace the current background with a different template, or remove it entirely, whenever I want.
3. The background is included whenever I publish or export my System Map — it shouldn't disappear the moment my work leaves the canvas.
4. As an administrator, I can add new templates to the library without a heavy process, so the library can grow over time.
5. *(Stretch)* As a user, I can upload my own custom template image, save it to my personal library, and reuse it across projects without re-uploading it each time.

---

## Executive summary — what the Pass 1 audit changed

Four findings materially change this spec from its original draft:

1. **The original "background renders automatically in PNG export" assumption is wrong.** PNG export (`toPng()`) only rasterizes `.react-flow__viewport`. React Flow's `<Background>` component — already in use for the canvas's dot-grid — renders as a *sibling* of that viewport, not a child, so it's already invisible to today's PNG export. A background template only gets captured automatically if it's mounted **inside** the viewport, as a custom React Flow node — not if it's bolted on the way the dot-grid is. This is now a concrete implementation requirement, not a nice side effect. See **Canvas rendering** and **Export & publish integration**, below.
2. **Web Publish and PNG export share zero rendering code — confirmed fully independent.** This is the spec's "worst case" branch from the pre-audit draft, confirmed exactly. Two separate implementation tracks, not one.
3. **The curated-content precedent this spec originally recommended following doesn't actually exist.** There's no seed script or migration insert for curated Sources anywhere in the repo — those rows exist only from undocumented, out-of-repo, manual service-role SQL writes. Nothing reproducible to copy. See **Admin template management**, below.
4. **No image-asset-serving mechanism exists to reuse.** The only Storage bucket in the app (`published-projects`) is for Web Publish HTML snapshots and is unrelated. A new bucket is required. See **Asset pipeline**, below.

Everything else in the original draft — the two-table data model shape, the launch template candidates, the interaction model for applying/replacing/removing a background — held up and is confirmed correct or is only lightly corrected below.

---

## Template library & data model

A **Template** is a first-class entity, similar in shape to how Sources work in the Signal Scanner feature: a shared, curated pool plus an optional private pool per user.

```
system_map_templates
├── id                uuid, PK
├── name              text            e.g. "Three Horizons"
├── description       text            short blurb shown in the picker, nullable
├── category          text            optional grouping (e.g. "Time-based", "Matrix", "Wheel")
├── asset_url         text            URL to the template graphic
├── thumbnail_url     text            smaller preview image for the picker grid
├── source_type       enum            `curated` · `user_uploaded`
├── owner_id          uuid, nullable  null for curated (library-wide); user id for a personal upload
├── active            boolean         soft-disable without deleting, mirrors `sources.active`
├── created_at        timestamptz
```

```
project_system_map_background
├── project_id        uuid, PK/FK → projects   (one background per project's map)
├── template_id       uuid, FK → system_map_templates, nullable — null means no background set
├── opacity           numeric          0–1, default TBD (recommend ~0.35, watermark-style)
├── position_x         numeric          canvas world-space coordinates
├── position_y         numeric
├── scale              numeric          relative scale factor, default 1
├── updated_at         timestamptz
```

**Confirmed by Pass 1 audit.** There is no `system_maps` table (a full grep of `supabase/migrations/` returned zero hits) — `system_map_phase_plan.md`'s multi-map proposal, which would have introduced one, was never executed and remains a plan document only. Today, System Map state is entirely keyed on `project_id`, split across:

- `canvas_nodes` (`project_id`, `cluster_id`, `x`, `y`, unique on `(project_id, cluster_id)`) — cluster placements.
- `canvas_text_nodes` (`project_id`, `x`, `y`, `text`, font/style fields) — freeform annotations.
- `relationships` (`project_id`, `from_cluster_id`, `to_cluster_id`, `type`, plus handle fields) — edges.
- `analyses` (unique on `project_id`) — System Analysis, 1:1 per project.

This confirms `project_system_map_background` keyed on `project_id` as PK/FK is exactly the right shape — it matches every other System Map table's keying convention. **Forward-compatibility note to carry into the migration:** if `system_map_phase_plan.md`'s multi-map work ever ships, this table would need to migrate from `project_id` to a future `system_map_id`. Worth a one-line comment in the migration itself so a future implementer doesn't have to rediscover this.

`scenario_clusters` (Future Models' scenario↔cluster membership join) is confirmed unrelated to System Map rendering — no shared code path with `canvas_nodes`/`relationships` anywhere. No viewport/zoom state is stored server-side at all (it's `localStorage`, keyed `fs_vp_<projectId>`) — irrelevant here since this spec proposes fixed placement, not viewport-relative positioning.

### Launch template candidates

A starter set of well-known foresight frameworks, enough to make the library useful on day one without a large content effort:

- Three Horizons
- 2x2 Scenario Matrix
- Futures Cone
- STEEP / PESTLE Wheel
- Causal Layered Analysis (iceberg)
- Impact / Uncertainty Grid

Final set and artwork are a design task, not part of this spec.

---

## Canvas rendering

**Confirmed by Pass 1 audit:** React Flow (`@xyflow/react` v12) is the sole canvas renderer, used only in `ScenarioCanvas.jsx`. The existing dot-grid uses React Flow's built-in `<Background>` component, which — as covered in the executive summary — renders outside the transformed `.react-flow__viewport` div and therefore outside what PNG export captures. `<Background>` is also pattern-only (dots/lines/cross); it can't carry an arbitrary image or SVG regardless.

**No mechanism for arbitrary world-space content exists today.** The audit checked all three candidates in the codebase:

- **`<Background>`** — pattern-only, ruled out as above.
- **A low-`zIndex` custom node** — the technique that would actually work (mounted inside `.react-flow__viewport`, pans/zooms with content, sits behind cluster nodes via z-order), but nothing in the codebase currently sets a `zIndex` field on any node or edge object — zero precedent to build from. **This is the mechanism to build:** the background template as a custom React Flow node, non-interactive, rendered at a low z-index behind cluster nodes.
- **`<Panel>`** — used once today (`FormatBarTextNode`'s toolbar), explicitly viewport-anchored rather than world-space (it doesn't pan/zoom with content). Confirms this is the wrong mechanism for a background meant to organize spatial placement of clusters.

Z-order today is React Flow's untouched default (background pane → edges → nodes). A background-template layer between the dot-grid and cluster nodes is genuinely new stacking behavior for this canvas, not an extension of an existing pattern — budget real design/implementation time for it, not a config tweak.

**Good news on the non-interactive requirement:** cluster nodes and relationship edges are already built with `selectable: false` at the React Flow node/edge object level, with selection handled entirely as app-level state rather than React Flow's native selection. The same technique is the natural, already-proven way to make the background layer provably non-interactive — low implementation risk on that specific requirement.

### Positioning and scale

- MVP recommendation unchanged from the original draft: the template renders at a fixed default size and position in canvas world-space, panning/zooming together with cluster content. Now concretely: implemented as a custom React Flow node (see above), not a draggable one.
- **Stretch, not MVP:** manual reposition/rescale of the background independent of panning. Flagged as a fast-follow, not launch-blocking.

---

## Interaction model

### Applying a background

- A new entry point on the System Map's Canvas toolbar opens a **template picker**: a grid of thumbnails, optionally grouped by category, with search/filter if the library grows large.
- **Toolbar terminology correction from Pass 1 audit:** the canvas toolbar's actual buttons are Clear Map, the **Connect** tool (Network icon — not a button literally labeled "Add relationship"; that label only exists in Table view), and the Canvas/Table toggle. The picker's entry point should sit alongside these three.
- Selecting a template sets it as the map's background immediately — no separate "apply" confirmation step, matching the app's low-friction interaction style elsewhere.
- The background renders behind all cluster nodes and relationship lines, at reduced opacity so it reads as a guide rather than competing visually with the map's actual content.

### Replacing and removing

- Opening the picker again while a background is already set shows the current selection highlighted; picking a different template swaps it immediately.
- A separate **Remove background** action clears it back to a blank canvas.
- **OQ-BG-01, resolved by Pass 1 audit — with a correction.** The audit found "Clear Map" does more than the original draft assumed: it deletes `canvas_nodes`, `canvas_text_nodes`, **and** `relationships`, and separately calls `deleteAnalysis(activeProjectId)` — it also deletes the project's entire System Analysis record, not just canvas content. (This is intentional, existing behavior — the confirmation dialog already warns about the System Analysis deletion — not a bug this spec is surfacing.) The original draft's description of Clear Map ("clears clusters and relationships") was incomplete and is corrected here. **The recommendation stands regardless: a background template should not be cleared by Clear Map** — if anything, the broader blast radius of that button makes an unrelated, silent side effect on the background even less desirable, not more.

### Positioning and scale

See **Canvas rendering**, above, for the confirmed implementation mechanism.

---

## Export & publish integration

**Confirmed by Sam (20 August 2026) and refined by Pass 1 audit:** there are exactly two paths by which a System Map leaves the live canvas today — PNG export, and the project's Web Publish feature. Both are live. The requirement is concrete: **the background template, at its stored opacity/position/scale, must render as part of both the PNG export and the Web Publish output.**

<details>
<summary>Original framing before Pass 1 audit (superseded, kept for context)</summary>

The earlier draft of this section assumed that if PNG export turned out to be a DOM/canvas snapshot, "a background element that's genuinely present in the canvas DOM at the right z-order should be captured automatically, with no separate export-path code needed." **This is wrong as stated** — see the corrected finding below. It's only true if the background is mounted inside `.react-flow__viewport` specifically, which is a real implementation requirement, not an automatic consequence of adding the layer to the canvas.

</details>

### PNG export mechanism — confirmed

Client-side DOM snapshot via `html-to-image`'s `toPng()`, called from `runExport()` in `ScenarioCanvas.jsx`, targeting `document.querySelector(".react-flow__viewport")` specifically — not the outer `.react-flow` wrapper, not `.react-flow__pane`.

**This is the load-bearing finding of the whole audit.** Because `<Background>` and any other content passed as JSX children of `<ReactFlow>` render as *siblings* of `.react-flow__viewport`, not descendants, the existing dot-grid is already invisible to PNG export today. The background template will only be captured automatically if it's built as a custom React Flow node mounted inside the viewport (per **Canvas rendering**, above) — confirming that decision is now load-bearing for export too, not just for correct on-canvas rendering. If it were instead bolted on the way `<Background>` is, it would need the same kind of explicit pre-capture DOM injection the code already uses for arrow-marker `<defs>` in `runExport()` — a working precedent for "inject before snapshot," just not one that's needed if the custom-node approach is used as recommended.

PNG export is triggered from `ExportModal.jsx` via the Sidebar's global Export button (not a canvas-toolbar button), gated to be selectable only while the System Map screen is active via a `systemMapExportRef`.

### Web Publish mechanism — confirmed independent

`src/publish/systemMap.js` is a from-scratch, server-side SVG string builder — no React Flow, no DOM, no headless browser (the file's own header comment says so explicitly). It reads raw `canvas_nodes` / `canvas_text_nodes` / `relationships` rows directly. Node size is a hardcoded constant (width/height are never persisted, only positions are). Edge curves are a hand-rolled reimplementation of React Flow's bezier math. Z-order is explicit and hardcoded in the render function (edges → nodes → text, always in that order).

**PNG export and Web Publish share zero rendering code** — confirmed by reading both files' import lists. The only overlap is passive: both pull color constants from `tokens.js`, and `systemMap.js`'s `REL_COLORS` is a manually-duplicated copy of `ScenarioCanvas.jsx`'s `REL_TYPES`, kept in sync by hand, not by import.

This means the background needs **brand-new, independent code in `systemMap.js`** — new SVG emission, positioned relative to the existing edge/node/text SVG layers — plus new data plumbing through `server-lib/publish-project.js`'s fetch/assemble step to load the background reference and pass it through. This is a second, genuinely separate implementation track from the canvas/PNG-export work, not a byproduct of it.

### Markdown export — confirmed untouched, no change needed

`buildMarkdown.js` has no reference to `canvas_nodes`, `canvas_text_nodes`, or any spatial relationship field — Clusters/Relationships/Scenarios all render as plain text lists. Matches the original draft's assumption; nothing to build here.

---

## Admin template management

<details>
<summary>Original recommendation before Pass 1 audit (superseded — the precedent it pointed to doesn't exist)</summary>

The original draft recommended: "no dedicated admin UI... templates ship as versioned static assets with rows added via a seed script or direct migration," explicitly matching "the pattern already established for curated Sources."

**Pass 1 audit found this precedent doesn't actually exist.** There is no seed script (`scripts/` has no Sources-seeding file) and no migration `INSERT` anywhere in `supabase/migrations/` — grepped exhaustively, zero hits. A migration file's own comment confirms curated Sources rows are "seeded with the service role," with "no INSERT path for curated rows via the client." In practice, curated Sources exist today only from undocumented, out-of-repo, manual SQL writes. There's nothing reproducible in version control to copy.

</details>

**Revised recommendation:** the `sources` table's *schema shape* is still a solid, real precedent worth copying for `system_map_templates` — curated rows have `owner_id IS NULL`, user-owned rows have `owner_id` set, plus `active` boolean and RLS split on `owner_id`. That part of the original plan holds.

The *seeding workflow* recommendation does not hold, and needs an explicit decision rather than inheriting an undocumented pattern: if the goal (per User story 4) is genuinely to let an administrator "add new templates without a heavy process," this feature should introduce an **actual, version-controlled seed script or migration-based insert now** — not perpetuate Sources' manual, out-of-repo, tribal-knowledge process. Otherwise the user story has no real mechanism behind it, the same gap Sources quietly has today. This is a small amount of extra work at build time (a seed file alongside the migration) that pays for itself the first time someone other than whoever wrote the original rows needs to add a template.

A lightweight admin upload UI remains a sensible fast-follow once the user-upload stretch goal (below) ships, reusing the same upload component with a "publish to shared library" toggle gated to admins.

---

## Asset pipeline

**Confirmed by Pass 1 audit: no reusable image-serving mechanism exists.** The only Supabase Storage bucket in the entire app is `published-projects`, used exclusively for Web Publish's rendered HTML snapshots — unrelated to serving template images. There is no image-upload feature anywhere in the codebase today (no avatar, no cover image, nothing beyond CSV import for Inputs). Static images today are either Vite-bundled `src/assets/` imports (only the app logo is actually in use; several other files there are dead) or bare `public/` favicon/icon files — neither suited to a curated, admin-growable, database-referenced asset library where `asset_url`/`thumbnail_url` need to be stable URLs an admin can add without a code deploy.

**A new Storage bucket is required, not a reuse.** The `published-projects` bucket's structure (public bucket + explicit grants + RLS scoped by `bucket_id`) is a good template to copy for the new bucket's setup, but the bucket itself needs to be created — this is real, if small, infrastructure work, not a config toggle.

---

## Stretch goal: user-uploaded custom templates

Users upload their own image, it's saved to `system_map_templates` with `source_type = user_uploaded` and `owner_id` set to them, and it appears in their picker (alongside the curated set) across every project — uploaded once, reused everywhere.

**Security note, not optional if this ships:** if uploads accept raw SVG, an uploaded file is untrusted user content that can carry embedded `<script>` tags or event-handler attributes — the same class of stored-content risk flagged in the rich-text-editing spec, more acute here since this content could appear on published/public project pages. Before this ships, either (a) sanitize uploaded SVGs through a strict allowlist parser before storage, or (b) rasterize uploads to PNG server-side and never render user-supplied SVG markup directly. Curated, A+W-authored templates aren't subject to this risk since they're trusted content — this only applies to the user-upload path. This also now depends on the new Storage bucket work above being in place first.

---

## Acceptance criteria

- [ ] A template picker is reachable from the System Map Canvas toolbar (alongside Clear Map, Connect, and the Canvas/Table toggle) and shows all active curated templates as thumbnails.
- [ ] Selecting a template sets it as the current project's System Map background immediately.
- [ ] The background renders as a React Flow node inside `.react-flow__viewport`, behind all cluster nodes and relationship lines, at a defined low z-index, and does not intercept clicks/drags meant for them (`selectable: false`, matching the existing cluster/edge pattern).
- [ ] Reopening the picker while a background is set shows which one is active; selecting a different template replaces it.
- [ ] A distinct "Remove background" action clears the background without affecting clusters, relationships, annotations, or System Analysis.
- [ ] Clear Map does not clear the background.
- [ ] The background persists across sessions, scoped to the project (reload the project, background is still there).
- [ ] The background pans and zooms together with the canvas content, staying visually aligned with clusters positioned against it.
- [ ] PNG export of the System Map includes the background at its stored opacity/position/scale, verified by actually opening an exported PNG, not just by code review of the viewport-mounting approach.
- [ ] The Web Publish output for a project includes the System Map background, rendered by new, independent SVG-emission code in `systemMap.js` — verified separately from the PNG export check above, since the two paths share no code.
- [ ] New templates can be added to the shared library via a version-controlled seed script or migration, not a manual out-of-repo write.

---

## Open questions

**OQ-BG-01: Does Clear Map also clear the background? ✅ Resolved.**
No. See **Interaction model**, above, for the corrected description of what Clear Map actually deletes.

**OQ-BG-02: Fixed default placement, or user-adjustable position/scale at launch? ✅ Resolved — Sam confirmed fixed placement for V1** (as a custom React Flow node, not draggable). Manual reposition/rescale remains a fast-follow, not in this pass.

**OQ-BG-03: Default opacity — fixed value or user-adjustable slider? ✅ Resolved — Sam confirmed fixed opacity for V1.** Recommended default ~0.35; exact value is a design call, not re-opened here.

**OQ-BG-04: Does System Map export/publish exist yet at all? ✅ Resolved.**
Yes, both PNG export and Web Publish are live and confirmed fully independent implementations (see **Export & publish integration**). This is now two build tracks, not one — plan and estimate accordingly.

**OQ-BG-05: SVG vs. raster for curated templates, and where do assets live? ✅ Partially resolved.**
SVG remains the right call for curated templates. What's newly confirmed: there is no existing asset pipeline to plug into — a new Storage bucket must be built (see **Asset pipeline**, above). Not previously known.

**OQ-BG-06: Is the user-upload stretch goal in scope for this pass, or a separate later spec? ✅ Resolved — Sam confirmed deferred.** Get the curated-only flow designed and working first; user uploads become their own fast-follow pass once that's proven out and the new Storage bucket exists. Not part of Pass 1 scope.

**OQ-BG-07: Should `system_map_templates` seeding get a real migration-based process now, given Sources never did? ✅ Resolved — Sam confirmed Option B.**
A version-controlled seed script/migration file ships as part of Pass 1, rather than inheriting Sources' undocumented, manual-SQL pattern. See **Admin template management** for the full reasoning.

All open questions blocking Pass 1 are now resolved. See `system-map-background-templates-audit-prompt.md` for the Pass 2 implementation prompt.

---

## Implementation sequence

1. ~~Phase 0 audit~~ — **complete.** See findings folded in above and the full report in `system-map-background-templates-audit-prompt.md`.
2. **Data layer** — `system_map_templates` table + a real seed script/migration for the launch template set (per OQ-BG-07); `project_system_map_background` table, keyed on `project_id`, with the forward-compatibility comment re: future `system_map_id` migration.
3. **New Storage bucket** for template assets, modeled on `published-projects`'s structure but built fresh.
4. **Background-as-custom-node** — the core canvas piece: a non-interactive (`selectable: false`), low-`zIndex` custom React Flow node mounted inside `.react-flow__viewport`. This single piece of work both renders correctly on-canvas *and* makes PNG export work, since export snapshots exactly that DOM subtree.
5. **Template picker UI** — toolbar entry point (next to Clear Map / Connect / Canvas-Table toggle), thumbnail grid, apply/replace/remove interactions.
6. **PNG export verification** — confirm the background is actually captured once step 4 is in place; this should require no changes to `runExport()` itself if the custom-node approach is implemented correctly, but must be verified against a real exported file, not assumed.
7. **Web Publish integration** — separate, independent build: new SVG emission in `systemMap.js`, positioned relative to the existing edge/node/text layers, plus data plumbing through `server-lib/publish-project.js`.
8. **QA pass** against the acceptance criteria above, including both export paths independently.
9. *(Stretch, separate pass)* User-upload path, with sanitization/rasterization handled before any upload UI ships, dependent on the Storage bucket from step 3.

---

## Notes for Sam

- The single most important design decision this audit produced: **build the background as a custom React Flow node inside the viewport, not as a `<Background>`/`<Panel>`-style bolt-on.** That one choice is what makes both correct on-canvas rendering and PNG export work — get it right once in step 4 above and step 6 becomes a verification step rather than new work.
- Web Publish is a real second implementation track, confirmed independent down to zero shared imports with PNG export. Budget it as its own piece of work, not a follow-on afterthought once PNG export is done.
- OQ-BG-07 (a real seed script for templates) is a small deliberate scope addition versus just copying how Sources works today — worth an explicit yes/no from you rather than defaulting silently, since it's the one place this spec recommends doing something differently from existing precedent rather than matching it.

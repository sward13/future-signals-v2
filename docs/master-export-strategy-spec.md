# Future Signals: Master Export & Publish Strategy Spec

Supersedes the separate Report Export / Project Archive / Analysis Export split in John's original doc, and reframes Publish (formerly called Web Export) as something conceptually distinct from the other three, not a fourth export type.

**Export is about extracting data.** Report Export, Project Archive, and Analysis Export all take project data out of Future Signals in some structured form, a document, a backup bundle, a resolved data tree. **Publish is about presentation.** It doesn't extract data for use elsewhere, it presents the project itself, live, styled, at a shareable URL. Both families share one underlying resolution layer (raw project data resolved into readable names and nested objects), but that's an internal implementation detail, not something that should blur the user-facing distinction between the two.

This means Export and Publish should be two separate entry points in the product, not one shared modal with two buttons at the bottom. See Generate Report flow and the Publish section below for how that plays out.

## Scope clarification (July 15)

The immediate build focus is Publish, the standalone web page, not Report Export's expanded flow. Report Export's enhancements (curated section picker, decoupled format selection, resolved relationships) still belong in this spec as the eventual shape of that feature, but they extend the **existing** Export modal (`ExportModal.jsx`) rather than introduce a separate, renamed entry point. The "Generate Report flow" section below describes that eventual capability; it's on hold until after Publish ships, not the next thing being built.

The resolution-layer work already in flight (built, and now being wired into `buildMarkdown`) isn't wasted effort under this reprioritization, both Report Export and Publish consume the same resolved data, so it's shared groundwork either way.

Four open questions are resolved for the Publish MVP:

- **Permissions:** deferred to the backlog. MVP ships public, unlisted URLs, anyone with the link can view, no invite-only or password-gating logic. This simplifies the "thin check in front of the file" the architecture section originally flagged, no check is needed for v1, since public-link access is the whole model.
- **Hosting and branding:** Future Signals domain, supporting the promotional use case, with a "Powered by Future Signals" footer.
- **Strategic Options presentation:** use the existing fields as-is (feasibility, dependencies, risks, and so on) in their own template. No new phase/timeline/owner fields for MVP.
- **Sensitivity check:** none for now. No pre-publish review gate before a project goes out on a public link or gets shared to social media.

Separately, for whenever Report Export's own format work resumes: Markdown only, no PDF for now. That closes the "which PDF path" question below without needing to evaluate a third-party HTML-to-PDF vendor yet.

## Audit findings (confirmed against code, July 15)

An audit-only Claude Code pass against `future-signals-v2` confirmed or corrected several assumptions this spec was making from screenshots and memory. These are now the source of truth; where they contradict earlier framing in this document, the sections below have been updated to match.

**Resolution layer doesn't exist yet.** There is no shared "resolution layer." `ExportModal.jsx` reads everything off `appState` directly, and ID-to-name resolution happens ad hoc in two separate places: a local `clusterName()` helper inside `buildMarkdown`, and an independent `.find()` lookup inside `TableView` in `ScenarioCanvas.jsx`. Worse, the current Markdown export omits relationships entirely, it only emits Clusters, Scenarios, Preferred Future, and Strategic Options. A shared resolver that turns relationship rows into readable "Cluster A —Drives→ Cluster B" text is net-new work for both Report Export and Publish, not a lift-and-reuse of existing infrastructure. The inline patterns in `buildMarkdown` and `TableView` are a reasonable starting point, but neither is shared or reusable today.

**Schema field names differ from this spec's assumed terms.** Clusters use `subtype` (not `type`) for Trend/Driver/Tension, and `horizon`/`likelihood` are both nullable. Inputs use `subtype`, `signal_strength` (not `signal_quality`, which still exists as an unused legacy column), `source_confidence`, and `horizon`. Relationships use `from_cluster_id`/`to_cluster_id`/`type` (snake_case in the DB; React Flow derives camelCase in app state). Relationships and scenarios each carry their own `confidence` column, separate from inputs' `source_confidence`. Any implementation prompt should use these confirmed names, not the ones in earlier drafts of this spec.

**Design tokens are confirmed correct for Horizon, Cluster Type, and Strength/Confidence** (`tokens.js`/`Tag.jsx` match what's used in the prototype). `CLAUDE.md`'s documented token values are stale, out of date since a badge-consolidation pass in early July, and should not be used as a reference going forward. **Likelihood has no dedicated palette.** It borrows the Horizon color family: Probable → green (Horizon H1's colors), Plausible → blue (H2's), Possible → amber (H3's), rendered via `LikelihoodTag` in `ClustersPanel.jsx`. A second surface, `ScenarioCanvas.jsx`, renders Likelihood in plain grey with no color coding at all. This means Horizon and Likelihood badges are visually indistinguishable wherever both appear in the same view, worth a design decision before Publish ships rather than an oversight to fix later. Resolved: rather than ship Likelihood on borrowed Horizon colors, a dedicated warm neutral monochromatic ramp is proposed and approved as the fix, Possible (text #6B6560 / bg #EFEDEB / border #C7C0B9), Plausible (text #4A443F / bg #E3DFDA / border #A89F96), Probable (text #2E2A26 / bg #D6D0C9 / border #8A8177). A single-hue ramp of increasing depth reads as a certainty gradient rather than a fourth category color, which keeps it visually distinct from Horizon, Cluster Type, and Strength/Confidence. This does not exist in `tokens.js` yet and needs to be added as part of implementation. The prototype has been updated to use it.

**System Map rendering: the realistic path for Publish is row-based regeneration, not live-canvas capture.** Today's only export mechanism is client-side DOM rasterization (`html-to-image`'s `toPng`, capturing the live React Flow viewport), which only works while the canvas is mounted in the author's browser, there's no server-side render path, and standing one up would mean running React Flow inside a headless browser, which doesn't fit cleanly into the current Vercel setup. The alternative, and the one this spec's prototype already assumes, is regenerating the map server-side from `canvas_nodes`/`canvas_text_nodes` (persisted layout positions) and the `relationships` table. That won't be pixel-identical to the live canvas, but it doesn't require a browser at publish time and works for a "publish the whole project" action regardless of what screen the author last had open. This resolves the System Map rendering question in favor of regeneration over capture.

**Supabase Storage is entirely unused today**, confirmed by grepping the app for `.storage`, `getPublicUrl`, `createSignedUrl`, and bucket config, zero hits outside Supabase CLI version-tracking metadata. The public bucket this spec assumes for Publish's generated pages is greenfield work: no existing naming convention, no public/private RLS pattern to extend. Standard build, just not a reuse of something already in place.

## Export (extracting data) and Publish (presenting it)

| Type | Family | Purpose | Priority | Format | Status |
|---|---|---|---|---|---|
| Report Export | Export | Curated document for reading and sharing | P1 | Markdown | Spec below; enhancements extend the existing export modal; paused while Publish is built |
| Publish | Publish (distinct from Export) | Standalone scrolling page for presenting and publishing | P2 (current build focus) | Hosted, shareable link, public | New; inspired by the Rewilding Futures reference |
| Project Archive | Export | Full backup and restoration | P3 | CSV bundle + manifest | Spec unchanged from prior review; GDPR caveat below |
| Analysis Export | Export | AI reasoning over the project | P4 | N/A | Folded into Report Export as a preset, not a separate build |

## 1. Report Export (P1, paused while Publish is built)

### What it replaces

The current export modal (`ExportModal.jsx`) is a flat, three-item checklist where each item bundles a section with a fixed format: Future Models & Clusters as one Markdown file (`buildMarkdown`), Inputs as CSV (`buildCSV`), System Map as PNG (delegates to the canvas's own `exportAsPng()`, disabled unless the System Map screen is active). All three are client-side Blob downloads; nothing is persisted server-side. The eventual enhancement separates section selection from format, so any combination of sections can go out in any supported format, built into this same modal rather than a new entry point.

### Section picker

Organized around the methodology stages, matching John's original structure:

Project framing, Scan, Clusters, System Map, System Analysis, and Future Models. The first five are single toggles. Future Models expands to let the user pick specific scenarios, specific Preferred Futures, and specific Strategic Options individually, rather than an all-or-nothing bundle. System Map gets its own sub-choice between a rendered image of the canvas and a relationship table, since a static document can't reproduce an interactive canvas directly.

A "select all" shortcut sits above the list, since a fully expanded picker across all eight groups has real depth.

### Format

Markdown only, for now. PDF is deferred rather than dropped, no near-term need to resolve the Vercel/Chromium constraint or evaluate a third-party HTML-to-PDF vendor until this work resumes.

DOCX is out of scope. It was a candidate third format, and it would be a fairly small incremental build once Markdown and PDF rendering exist, since both are rendering targets on top of the same resolved-content layer. The reason to drop it isn't build cost, it's that Publish covers the "polished, presentable, shareable" use case DOCX would have served. Building and maintaining a third format nobody asked for isn't worth the QA and upkeep, even at low marginal cost. If a specific user need for DOCX surfaces later, it's a cheap add at that point.

### PDF generation: a real infra constraint, not a free rendering target

Sam recalled that PDF export had been investigated and deprioritized before, for a library or tooling reason, without more specific recall. Nothing documenting that decision turned up in memory, the docs folder, or local session history, so this may or may not be the original reasoning, but it lines up with a real, known constraint given this stack (React/Vite, Vercel, Supabase).

High-fidelity PDF generation, reusing the app's actual typography and design system rather than a generic template, is normally done by rendering HTML to PDF through a headless browser (Puppeteer or Playwright). That runs into a documented problem on Vercel specifically: the standard Chromium binary exceeds Vercel's serverless function bundle limit (roughly 50MB compressed), and Vercel's read-only serverless filesystem means Puppeteer can't download Chromium at runtime the way it does locally. The practical workaround is a minimal Chromium build (`@sparticuz/chromium-min`) plus longer function timeouts, and PDF rendering this way still runs noticeably slower on serverless than on a dev machine.

The alternative is a native PDF-generation library (`pdf-lib`, `@react-pdf/renderer`, or similar) that builds the PDF programmatically without a headless browser, sidestepping the Vercel/Chromium problem, but at the cost of a second, separate layout system built in that library's own API (positioning, fonts, tables), rather than inheriting the app's existing CSS the way Markdown-to-web rendering can.

Given Markdown-only is the near-term decision, this section is reference material for whenever PDF scoping resumes, not an active blocker.

### PDF versus Publish: which has lower friction today

Publish is the lower-friction path from where the stack stands right now, and not by a small margin.

Publish stays entirely inside tools already in use. Vercel's core strength is serving hosted web pages, so publishing a page is working with the platform rather than against it. Section templates can be built as ordinary React components, reusing the existing design system (tokens.js, the Tailwind migration in progress) and, in places, the same rendering logic the live app already uses for those views. The remaining new work, a publish action that snapshots selected sections, a public route, a permissions gate (deferred per the scope clarification above), is ordinary application engineering in a stack the team already knows. There's no pagination problem either, a scrolling page handles a project with three scenarios or twelve equally well, where a paginated document has to account for that variability explicitly.

PDF has three possible paths and none of them are low-friction: headless-browser rendering fights the Vercel platform directly; a native PDF library means building a second, parallel template system for every section type; a third-party HTML-to-PDF API sidesteps the Vercel/Chromium problem but trades engineering friction for a vendor dependency and a per-request cost line. Of the three, the third-party API is the one with the least engineering friction, should PDF scope resume later. But Publish is lower-friction than any of the three PDF paths, which reinforces building it first.

### Generate Report flow (deferred; extends the existing modal, not a new entry point)

The eventual enhancement: section tree with the picker described above, format selector (Markdown for now), Generate button, added into the existing `ExportModal.jsx`, not a renamed or relocated entry point. Resolving relationship IDs to names, using product terminology instead of column names, omitting technical fields, is rendering logic behind the button, invisible in the UI itself, and now backed by the shared resolution layer (`server-lib/resolve-references.js`) rather than the ad hoc inline lookups the audit found.

Export and Publish remain two distinct actions in the product either way, an Export button and a Publish button, not one modal with both living at the bottom of the same dialog, since conflating them undoes the point of treating extraction and presentation as different things. This section describes Export's shape once its turn comes back around; it isn't the current build target.

## 2. Publish (P2, current build focus)

Not a fourth export type. Export takes data out of the product; Publish presents the project itself. Kept as its own numbered section here because it shares a resolution layer with Report Export, not because it belongs to the same category conceptually.

### Origin and intent

Inspired by Alison Rand's Rewilding Futures presentation (rewildingfutures.replit.app/presentation), built through the same UofF futures program. Already logged in project memory under **Aspirational output references** as representing "the quality and style of practitioner-produced foresight outputs Future Signals should enable," alongside the frog Futurescape and WEF reports, but not previously elaborated into a feature spec until this conversation.

The idea: once a project reaches a point of completion, generate a standalone, single-page scrolling site that narrates the project the way a foresight report would be presented to stakeholders, not a data export, an editorial artifact. Sam's stated intent is twofold: give practitioners something polished to share with stakeholders, and use shared pages as a promotional channel for Future Signals itself, including publishing broadly to social media, not just sharing with named stakeholders.

### Vision and flow

Publish is its own entry point in the product, not a second button inside the Export flow. Internally, it reuses the same section-picker component and resolution layer the Export flow uses (the user chooses which parts of the project to include, project overview, system map, preferred future, and so on), since rebuilding that picker twice would be wasted effort, but the user reaches it by choosing Publish, not by choosing Export and finding a Publish button at the bottom. Clicking Publish produces a shareable link rather than a file. MVP ships public, unlisted-link access only, no invite-only or password gating, that's on the backlog.

### Publish architecture: static, one-time render

Publish generates a static HTML snapshot once, at publish time, rather than a live page that re-queries the project on every view. Updating means the owner deletes the existing snapshot and regenerates a fresh one from the project's current state. This is simpler and more secure than a live public route: resolution and rendering happen once, under the owner's normal authenticated access, and the only thing ever exposed publicly is the generated artifact, no anonymous queries against project tables, no RLS policy needed for public read access to live data. It also scales to social-media-scale traffic with no backend load, since a static file served from a CDN carries no per-view compute cost.

The shareable URL should stay stable across republishes (same slug, swapped content), so a link already shared or posted doesn't rot when the owner updates and republishes. Since MVP access is public-by-link only (no invite-only or password gating), the static file itself is the whole access model, no additional check in front of it is needed for v1. Supabase Storage (a public bucket) is the natural home for the generated files, but per the audit findings above, Storage isn't used anywhere in the app today, so the bucket, its naming convention, and its public-read policy are greenfield work, not an extension of an existing pattern.

### Data model: committed, pending staging application

Migration committed as `9346589`, not yet applied to staging, the local CLI is linked to production (`tbxjudpxzovbasuomekq`), and there is no staging DB password on hand, correctly treated as a blocker rather than something to work around.

Confirmed table: `public.project_publications`, columns `id` (uuid PK), `workspace_id` (uuid NOT NULL, references `workspaces(id)` on delete cascade), `project_id` (uuid NOT NULL, references `projects(id)` on delete cascade), `slug` (text, unique, not null), `storage_path` (text, nullable), `sections_included` (jsonb, nullable), `status` (text, not null, default `'unpublished'`, check constrained to `'published'`/`'unpublished'`), `published_at` / `republished_at` (timestamptz, nullable), `created_at`/`updated_at` (timestamptz, not null, default `now()`, with an update trigger).

`workspace_id` is a deliberate addition beyond the original prompt, every other project-scoped table in this schema carries it and keys its RLS off `get_workspace_id()`, so this table would have been the odd one out without it. Confirmed: keep it, matching the existing pattern rather than special-casing this table with a project-to-workspace subquery. The pipeline prompt needs to set `workspace_id` on insert, same as every other insert helper in the app.

RLS: `FOR ALL USING (workspace_id = get_workspace_id())`, identical to `preferred_futures`/`canvas_text_nodes`. Grants: `select` to `anon`, full CRUD to `authenticated` and `service_role`, matching existing convention. The `anon` select grant doesn't expose data publicly, RLS still filters by workspace, anonymous requests won't satisfy `get_workspace_id()`. Public access to a published page happens through the storage object, never through a query against this table.

Storage bucket: `published-projects` (first bucket in this app, no prior convention to match). Public read (`public = true`), write/update/delete restricted to `authenticated` via storage policies scoped to `bucket_id = 'published-projects'`, `service_role` bypasses RLS for the pipeline itself. Object path: `{slug}/index.html`, giving a public URL like `https://kptatqipjwihkdxdxlvh.supabase.co/storage/v1/object/public/published-projects/{slug}/index.html`. Stored in `storage_path`. A republish overwrites the same object, so the link never changes, matching the static, one-time-render architecture decided earlier.

**Applied and verified on staging, committed as `3790b49`.** All 11 columns, the RLS policy, and the four storage policies match the spec above exactly, confirmed against `information_schema.columns`, `pg_policies`, and `storage.buckets` directly, not just re-stated from the migration file. Migration re-numbered to `20260715195707` to keep local and remote ledgers aligned. Production is untouched; this lands there on the normal merge-to-master `db push`.

One real discrepancy worth fixing before the pipeline prompt: `status` defaults to `'published'`, not `'unpublished'` as specified. That's backwards, a freshly inserted row would read as publicly live before any content actually exists in storage. The pipeline prompt needs to either explicitly set `status = 'unpublished'` at insert time and only flip it to `'published'` after the storage upload succeeds (working around the bad default rather than fixing it), or a tiny follow-up migration should correct the column default itself. The latter is safer, a wrong default is a footgun for any future insert path that forgets to set it explicitly.

### MVP scope

A static template per section type, project overview, system map, preferred future, and the equivalent for each other section in the Report Export picker, rendering the same resolved data (relationship IDs turned into names, product terminology, no technical fields) into a fixed, pre-designed layout. No per-project custom imagery, no AI-synthesized narrative copy, no user-facing formatting choices, no permissions gating beyond a public link. This is closer to Report Export with a styled web rendering target than to a bespoke editorial build.

System Map in the MVP is rendered by regenerating an SVG server-side from persisted `canvas_nodes`/`canvas_text_nodes` positions and `relationships` rows, per the audit findings above, not by capturing the live canvas. That's the approach the prototype already uses.

Strategic Options render with their existing fields as-is (feasibility, dependencies, risks, and so on), no new phase/timeline/owner fields for MVP.

Hosting is on a Future Signals domain, with a "Powered by Future Signals" footer, supporting the promotional use case. No sensitivity check or pre-publish review gate for MVP.

### Post-MVP (nice-to-have, well down the roadmap)

Permissions model beyond public-by-link (unlisted vs invite-only vs password-protected). Lightweight formatting controls and a choice of color palettes per published page. Strategic Options phase/timeline/owner fields, if a future richer template wants that phased look. A sensitivity check before broad social publishing, if it turns out to be needed. All explicitly deferred, not part of the near-term build.

### What the reference does

The Rewilding Futures page is a full-bleed editorial site: a hero section with a large serif headline over a photographic background, a framing section ("The Ask") with a centered pull-quote question, a card grid of emerging patterns (Future Signals' Clusters) each with an icon, a title, and hover-revealed detail (signal, driving force, why it matters), a signals-across-time visualization, a three-horizon timeline (near/medium/far, mapping directly to Future Signals' H1/H2/H3), two named scenarios presented as narrative blocks, critical questions, and strategic initiatives presented as phased roadmaps (Phase 1/2/3, each with an owner) closing with a call to action.

### Mapping to Future Signals data

Every section in the reference has a direct counterpart in Future Signals' methodology: hero from project name and key question, framing section from Project Framing, pattern cards from Clusters, horizon timeline from H1/H2/H3 definitions, narrative blocks from Scenarios, initiatives from Strategic Options. The two-scenario, two-initiative structure in the reference is a curation choice by its author, not a hard limit, Future Signals would need to handle an arbitrary number of each gracefully.

### Effort, revised for the MVP scope

Reuse the existing Report Export picker UI and resolution layer, render the same resolved data into fixed static templates, and skip AI narrative synthesis, permissions gating, and phased Strategic Options fields entirely for v1. The genuinely new work is the static section templates themselves, the `project_publications` table and storage bucket, and a publish pipeline: generate the page, host it, produce a stable shareable link. Dropping the permissions model from MVP scope (public-by-link only) removes what would have been the trickiest piece, a thin access-check layer in front of the static file.

## 3. Analysis Export (P4, folded into Report Export)

Not built as a separate system. A whole-project Report Export in Markdown, with all sections selected, already satisfies the case of an AI reading the document to reason about the project, since relationships are already resolved to names and organized by methodology stage. The two things that would justify a standalone structured export, stable IDs for cross-referencing, and a JSON shape for non-LLM programmatic consumers, aren't needed unless a specific external tool surfaces that requires deterministic parsing or ID-based roundtripping. No interview or usage signal has raised this need. Worth a quick check with John on whether he has a specific external tool in mind, that's the one thing that would resurrect this as a standalone build.

## 4. Project Archive (P3)

Unchanged from the prior review. Full backup and restoration: roughly seventeen tables to CSV, a manifest with schema versioning and row counts, a new candidate-snapshots table (candidates are currently ephemeral and expire after 30 days, so this doesn't exist yet), and the negative-pool centroid (straightforward, since `project_negative_pool_summary` already exists in the scanner schema). The harder half is import: new project ID, full ID remapping across foreign keys and embedded references in UUID arrays and JSON fields, row-count and reference validation, defined failure handling for unresolvable references. Estimated at 4-6 weeks for a correct, tested round trip.

Dependency: multiple system maps per project is an active, in-progress architecture change. The Archive's canvas and relationship tables assume a settled schema, so this work should follow that migration rather than precede it.

GDPR note: not a must-have on product grounds, but worth a quick check with counsel on whether data portability (Article 20, structured machine-readable export of personal data) creates a compliance floor once there are EU users, independent of product priority. A stripped-down archive, CSV exports plus manifest, would likely satisfy a portability obligation without needing the full restoration fidelity (ID remapping, centroid, candidate snapshots) that the product-driven version calls for.

## Priority summary

- P1 — Report Export. Already roadmapped, validated by the survey's "easy export to outputs" response. Paused while Publish is built; enhancements will extend the existing export modal, Markdown only for now.
- P2 — Publish. Current build focus. Its own entry point, distinct from Export; reuses the Report Export section picker and resolution layer internally; MVP is static per-section templates plus a publish-and-share pipeline, public-by-link, on the Future Signals domain.
- P3 — Project Archive. Not a product must-have; GDPR may force it regardless of product priority.
- P4 — Analysis Export. Folded into Report Export; no separate roadmap item needed.

## Open questions for John and for scoping

Whether John has a specific external tool in mind for Analysis Export, the one thing that would resurrect it as a standalone build. Whether the multi-system-map migration should be sequenced ahead of any Archive work, given the schema dependency. Whether Project Archive needs a GDPR-driven compliance floor once there are EU users, worth a quick check with counsel, independent of product priority.

Resolved and no longer open: Publish's permissions model (backlog, public-by-link for MVP), hosting and branding (Future Signals domain, "Powered by Future Signals" footer), Strategic Options presentation (existing fields as-is), sensitivity check before broad social publishing (none for MVP), and Report Export's format scope (Markdown only, PDF deferred).

## Implementation sequence

1. **Shared resolution layer** — complete. See below.
2. **Wire the resolution layer into `buildMarkdown`** — in progress (dispatched to Claude Code, running).
3. **Publish MVP, next up:**
   - `project_publications` table (migration) and Supabase Storage public bucket (naming convention, public-read policy)
   - System Map SVG regeneration from `canvas_nodes`/`canvas_text_nodes`/`relationships`
   - Static section templates (project overview, system map, preferred future, and so on)
   - Publish pipeline: generate the page, host it, produce the stable slug-based link
4. **Report Export: section picker and format selector inside the existing modal** — deferred until after Publish ships.

### Step 1 complete: resolution layer built

Landed as `server-lib/resolve-references.js`, placed alongside the existing shared server logic (`scoring.js`, `clone-project.js`). Dependency-free ESM, so Vite bundles it client-side for Report Export today and a future server-side Publish pipeline can import it unchanged. All five functions from the prompt shipped as specified, plus a defensive addition: `resolveClusterName` also falls back to "[deleted cluster]" when a row resolves but has an empty name, not only when the ID doesn't resolve at all.

**Real relationship type values, confirmed from `REL_TYPES` in `ScenarioCanvas.jsx`:** Drives, Enables, Accelerates, Inhibits, Blocks, Displaces, Feedback Loop, plus free-text custom labels. This replaces the placeholder "Drives" example used earlier in this spec as the only confirmed type. Sentence phrasing: the six verb types conjugate to third person ("AI regulation drives Insurance pricing models"), Feedback Loop gets its own noun form ("X forms a feedback loop with Y"), custom labels drop in verbatim, and a missing type falls back to "A → B".

16 tests via Node's built-in `node:test` (zero new dependencies), covering normal resolution, dangling references, and empty/non-array inputs for every function plus the sentence-phrasing variants. All passing. Scope was honored exactly: no UI touched, nothing wired into any export flow yet.

### Claude Code prompt: wire the resolution layer into buildMarkdown (dispatched, running)

```
Wire server-lib/resolve-references.js into buildMarkdown. This is the only file in scope. Do not touch ExportModal.jsx's UI, the section-selection checkboxes, buildCSV, the System Map PNG export, TableView's inline resolution in ScenarioCanvas.jsx, or any Publish code.

Two changes to buildMarkdown:

1. Replace the existing local clusterName() helper with buildClusterLookup() + resolveClusterName() from server-lib/resolve-references.js. Same output for driving_forces rendering, just backed by the shared module instead of a duplicate inline implementation. Use resolveDrivingForces() directly for the driving-forces list.

2. Add a Relationships section to the Markdown output, which does not exist today, using resolveRelationship() for every row in the project's relationships table. Render each as its resolved sentence (e.g. "AI regulation drives Insurance pricing models"), grouped under a "Relationships" heading, placed after the Clusters section and before Scenarios, consistent with the methodology's build order (Clusters, then System Map relationships, then Future Models).

Also use buildScenarioLookup() + resolveScenarioRefs() wherever Preferred Future and Strategic Option sections currently reference scenario_ids, if they render those IDs at all today, replace raw IDs with resolved scenario titles.

Confirm the final Markdown output still matches the existing structure and formatting conventions used for Clusters, Scenarios, Preferred Future, and Strategic Options, this is a content addition and an internal refactor, not a redesign of the document's look.

Update or add tests for buildMarkdown confirming: driving forces still resolve correctly through the shared module, the new Relationships section renders resolved sentences (not raw IDs), and a dangling reference doesn't throw or produce "undefined" in the output.

Do not touch CSV or PNG export paths. Use conventional commit format.
```

### Claude Code prompt: Publish data model and storage bucket

```
Implement the Publish data model and storage infrastructure. No UI, no pipeline logic, no System Map rendering, no template code, none of that is in scope for this prompt, this is schema and storage configuration only.

1. Migration: create a project_publications table with columns: id (uuid, primary key, default gen_random_uuid()), project_id (uuid, references projects(id), not null), slug (text, unique, not null, stable across republishes so a shared link never breaks), storage_path (text, nullable, populated once a snapshot exists), sections_included (jsonb, nullable, mirrors whatever the section-picker selection stores), status (text, values 'published' or 'unpublished'), published_at (timestamptz, nullable), republished_at (timestamptz, nullable), plus created_at/updated_at following whatever convention existing tables use. Add RLS policies matching the project-ownership pattern used on other project-scoped tables, only the project's owner (or collaborators, whatever the existing pattern is) can read or write their own project's publication rows.

2. Supabase Storage: create a new public bucket for generated Publish snapshots (name it consistent with existing naming conventions if any exist, otherwise something clear like published-projects). Configure it for public read access (anyone with the object's URL can GET it, no auth required) and authenticated-only write/delete access. Confirm what the object path convention should be, something derived from the stable slug (e.g. {slug}/index.html) so a republish can overwrite the same path without needing to update the public link.

Run this migration against the staging Supabase project (kptatqipjwihkdxdxlvh), not production. Report back the exact table schema, RLS policy definitions, bucket name, and object path convention you used, so the next prompt (the actual publish pipeline) can build against them precisely.

Do not touch ExportModal.jsx, buildMarkdown, System Map rendering, or write any pipeline/route code that populates this table or writes to this bucket, that's the next prompt. Use conventional commit format.
```

### Claude Code prompt: fix the status column default

```
Fix a schema defect in project_publications: the status column defaults to 'published', it should default to 'unpublished'. A freshly inserted row should never read as publicly live before any content has actually been generated and uploaded.

Write a migration that changes the column default only: ALTER TABLE project_publications ALTER COLUMN status SET DEFAULT 'unpublished'. No other schema changes. The table has no rows yet, so no backfill is needed.

Apply this to the staging project (kptatqipjwihkdxdxlvh) using the same Supabase connector from the prior migration, verify the new default via information_schema.columns, and report back. Do not touch production. Do not touch any other column, policy, or bucket. Use conventional commit format.
```

### Claude Code prompt: static section templates

Attach or paste `web-export-prototype.html` into the Claude Code session (or drop a copy into the repo) before running this, it's the structural and styling reference and re-deriving it from prose would be both longer and less accurate.

```
Build the static HTML section templates for Publish's MVP. This prompt is templates only: no System Map rendering (separate prompt), no publish pipeline, storage upload, or project_publications writes (separate prompt), no UI, no ExportModal changes.

Reference the attached web-export-prototype.html, a hand-built static prototype showing the intended structure, copy tone, and inline styling for every section except the System Map (which is a placeholder there and will be handled separately). Build plain JS functions, not React components (this generates a static HTML string, not a client-rendered view), one per section, each taking already-resolved project data (via server-lib/resolve-references.js, do not re-implement resolution here) and returning an HTML string:

- Hero (project name, key question)
- Overview (Key Question, Domain, Geography, Focus, Audience, Stakeholders, Assumptions, plus the Time Horizons proportional bar using real H1/H2/H3 date ranges)
- System Analysis (Description, Key dynamics, Critical uncertainties, Implications, Confidence)
- Scenario / Preferred Future / Strategic Option narrative blocks, using resolveDrivingForces() and resolveScenarioRefs() for any cluster/scenario references
- Appendix: nested disclosure per cluster (name, Type/Horizon/Likelihood badges, description, then nested per-input disclosure showing name, Type/Strength/Confidence/Horizon badges, and a source link)

Use the confirmed design tokens from tokens.js/Tag.jsx for Horizon, Cluster Type, and Strength/Confidence. Likelihood needs a new dedicated token added to tokens.js first, a warm neutral monochromatic ramp: Possible (text #6B6560 / bg #EFEDEB / border #C7C0B9), Plausible (text #4A443F / bg #E3DFDA / border #A89F96), Probable (text #2E2A26 / bg #D6D0C9 / border #8A8177), matching the prototype. Add this token and use it here, this is the first place it's consumed.

Confirm the actual field names and structure by reading the real clusters/inputs/scenarios/preferred_futures/strategic_options schema rather than assuming from the prototype, the prototype's data is illustrative, the schema is authoritative.

Leave a clearly-marked placeholder where the System Map section will go, the next prompt fills it in.

Write tests confirming each template function produces valid, non-empty HTML for a normal input and degrades gracefully (no crash, no "undefined" in output) for a project missing optional fields (no System Analysis, no Strategic Options, etc.). Use conventional commit format.
```

### Step complete: static section templates

Committed as `268d26a`. Landed as `src/publish/sections.js`, pure per-section HTML-string builders: `renderHero`, `renderOverview`, `renderTimeHorizons`, `renderSystemMapPlaceholder` (stub for the next prompt), `renderSystemAnalysis`, `renderScenario`/`renderPreferredFuture`/`renderStrategicOption`, `renderAppendix`. No React, no DB access, no pipeline or storage code, resolution delegated entirely to `server-lib/resolve-references.js`, nothing re-implemented.

**Two more schema corrections surfaced, added to the confirmed-field-names record:** `analyses.critical_uncertainties` is a `text[]`, rendered as a list rather than a paragraph, and `projects.geo` is the actual column (not `geography`, this spec's earlier assumption). The prototype's illustrative data was overridden wherever it disagreed with the live schema, correctly treating the schema as authoritative over the mockup.

**Likelihood ramp shipped:** added to `tokens.js` and kept in sync with the `index.css` `@theme` block per `CLAUDE.md` convention. This module is its first real consumer.

**Safety:** all user text is HTML-escaped, and source URLs pass through the existing `sanitizeUrl` (a `javascript:` URL is dropped, covered by a test), good defensive practice for content that's about to be served publicly and unauthenticated.

**Resolved: Key Question lives in Overview only, not echoed in the Hero.** The Hero stays title, eyebrow, and publish date, matching the original prototype (which only ever put Key Question in Overview); the templates prompt's bullet list was imprecise on this point and Claude Code correctly followed the prototype over the prompt text. No change needed.

Verification: 22 new `node:test` cases (67 total passing), plus a full fixture page assembled and visually checked in-browser, Hero, Overview, horizons bar, System Analysis, all three narrative blocks, and the expanded appendix with nested inputs, badges, and source links all render correctly. Lint clean, `npm run build` green.


### Claude Code prompt: System Map SVG regeneration

```
Build the System Map section for Publish: a plain JS function, matching the pattern already established in src/publish/sections.js, that returns an inline SVG string built server-side from persisted data. This replaces renderSystemMapPlaceholder(). No React Flow involved, no headless browser, no rasterization, no PNG, this is markup, not pixels.

No pipeline, storage, or project_publications code, no UI changes, none of that is in scope here.

Confirm the actual schema before assuming anything: canvas_nodes and canvas_text_nodes hold the persisted x/y position data (and whatever width/height or styling columns actually exist, don't assume), relationships holds from_cluster_id/to_cluster_id/type plus source_handle/target_handle (confirmed to exist in an earlier audit, check whether they're actually populated and whether they matter for edge routing, or whether a straight or simple curved line between node centers is sufficient for this MVP).

Build renderSystemMap(canvasNodes, canvasTextNodes, relationships, clusterLookup):
- One SVG element per cluster, positioned from canvas_nodes' persisted coordinates, labeled with the cluster name, colored by Cluster Type (subtype) using the confirmed tokens (dusty violet / muted teal / dusty rose).
- Render canvas_text_nodes as plain positioned text elements, whatever their actual content model turns out to be.
- One edge per relationship, drawn as a path between the two connected clusters' positions, with an arrowhead marker and a label. Use resolveRelationship() from server-lib/resolve-references.js for the label text, don't re-derive relationship phrasing here. A relationship whose cluster isn't placed on the canvas (no canvas_nodes row for it, this is a real, existing product state, the X button on the canvas already only removes the canvas_nodes row, not the cluster) should be skipped gracefully, not crash or draw a broken edge to nowhere.
- This does not need to be pixel-identical to the live interactive canvas, a simpler visual treatment (straight or gently curved lines, no custom edge routing beyond what source_handle/target_handle cheaply provides) is acceptable for MVP.

Write tests covering: a normal map with several clusters and relationships, an empty map (no clusters placed yet), a relationship referencing an unplaced cluster (must degrade gracefully, not throw), and a cluster with no relationships at all.

Use conventional commit format.
```

### Step complete: System Map SVG regeneration

Landed as `src/publish/systemMap.js`, `renderSystemMap(canvasNodes, canvasTextNodes, relationships, clusterLookup)`, a pure function returning an inline SVG string. `renderSystemMapPlaceholder()` and its test are removed from `sections.js`. No React Flow, no headless browser, no rasterization, confirming this was the lower-friction path.

**Schema confirmed, not assumed:** `canvas_nodes` persists only `cluster_id`/`x`/`y`, no width or height, so node size is fixed in code (`NODE_W = 156`, matching the live `ClusterNode`). `source_handle`/`target_handle` are populated on staging with `t`/`l`/`b`/`r` values and are used for side-anchoring, falling back to node center when null. Edges use a simple quadratic bezier, no custom routing, consistent with the prompt's "doesn't need to be pixel-identical" allowance. The viewBox is computed from actual content bounds, confirmed against real staging data that included negative coordinates.

**Real seam for the pipeline prompt:** `renderSystemMap` expects DB-shaped, snake_case rows (`from_cluster_id`, not `fromClusterId`), matching what `resolveRelationship()` already expects. This is a non-issue if the pipeline fetches project data fresh from the database server-side, which it should anyway, it only matters if something tries to feed it live app-state instead.

Verification: 11 new `node:test` cases covering a normal map, an empty map, an edge to an unplaced cluster (skipped, not thrown), a cluster with no relationships, handle-based versus center anchoring, and text-node styling/escaping. Lint clean, build green, and the real staging project was rendered in-browser to confirm geometry, colors, edges, arrowheads, and labels all display correctly.

### Claude Code prompt: the publish pipeline

```
Build the publish pipeline: the piece that turns a project into a live, hosted static page. This is the last MVP piece, everything it needs already exists (server-lib/resolve-references.js, src/publish/sections.js, src/publish/systemMap.js, the project_publications table, the published-projects storage bucket).

No section-picker UI, no ExportModal changes, no Publish button in the product yet, that's a follow-up. Expose this as a callable server-side function (whatever entry point fits this codebase's convention for a triggered backend action, an API route or Edge Function, your call, but it needs to be invocable without requiring new UI to exist first, a script or test harness calling it directly is fine for now).

Scope:

1. Fetch a project's full data server-side (clusters, inputs, relationships, canvas_nodes, canvas_text_nodes, scenarios, preferred_futures, strategic_options, and the System Analysis record) given a project_id. This data is naturally DB-shaped (snake_case) coming straight from the database, so it already matches what resolveRelationship() and renderSystemMap() expect, no camelCase adapter needed here, that seam only exists for app-state.

2. Assemble one complete HTML document: page shell (doctype, charset, a minimal layout wrapper) wrapping, in reading order, Hero, Overview, the System Map (renderSystemMap output, replacing the old placeholder), System Analysis, then every Scenario, Preferred Future, and Strategic Option the project has (loop over each, these are per-item renderers), then the Appendix, then a "Powered by Future Signals" footer per the branding decision.

3. Slug handling: if the project has no existing project_publications row, generate a new stable slug (derived from the project name, handle collisions) and insert a row. If a row already exists for this project, reuse its existing slug, this is a republish, the public link must not change.

4. Upload the assembled HTML to the published-projects bucket at {slug}/index.html, overwriting any existing object at that path.

5. Only after the upload succeeds, write status = 'published' and set published_at (first publish) or republished_at (subsequent ones) on the project_publications row. Do not mark it published before the file actually exists in storage, that's precisely the failure mode the status-default fix earlier was guarding against.

Whole-project publish only for v1, there's no section-picker UI yet to curate a subset. Populate sections_included with a fixed list representing "everything," in whatever shape makes sense, so the column isn't simply unused, but don't build curation logic against it yet.

Write tests covering: first publish (new row, new slug), republish (existing row, same slug, object overwritten, republished_at set), and a failure partway through the storage upload (status must not flip to 'published' if the upload didn't actually succeed).

Use conventional commit format.
```

### Step complete: the publish pipeline (MVP backend is now end to end)

Committed as `d4a0ca3`. Landed as `server-lib/publish-project.js` (`publishProject(projectId, { supabase?, now? })`, following the `clone-project.js` convention, service-role, DB-shaped, client-injectable for tests) plus `scripts/publish-project.js` as a CLI entry point. No new Vercel function yet, function count stays at 10/12, worth watching, see below.

The five steps landed as specced: fetch project data server-side, assemble one HTML document in reading order (empty sections drop out via `.filter(Boolean)`), reuse-or-mint the slug, upload with upsert, flip `status` to `'published'` only after the upload succeeds.

**Two bugs caught during verification, not during the unit tests:** `cluster_inputs` has no `project_id` column, only `cluster_id`/`input_id`/`workspace_id`, a first draft that fetched by `project_id` passed its own lenient unit test but would have failed against the real database. Verifying against real staging data caught it; fixed to join by cluster id, matching `clone-project.js`'s existing pattern. A second, unrelated test-fake bug (shared-reference state masking an insert snapshot) was also caught and fixed. Good instance of why "verify against real data" earned its place in this project's Claude Code discipline, a mocked-only test suite would have shipped the first bug.

Verification: 12 new tests (65 total), plus a real end-to-end assembly against the live "EV Adoption in the US" staging project, fetched via the connector, rendered in-browser, doctype, real Overview data, the System Map SVG slotted in correctly, the appendix, footer, and empty sections all correctly omitted, no `undefined`/`NaN` anywhere.

**Vercel function budget: 10/12 today.** The follow-up API route this spec already anticipates (a thin Bearer-authed endpoint calling `publishProject`) will be 11, and an unpublish endpoint would be 12, the ceiling. Recommend combining publish and unpublish into a single endpoint (an `action` parameter, or GET-to-publish/DELETE-to-unpublish on the same route) rather than two separate function files, to leave headroom for anything else that needs a new serverless function soon.

**Bigger picture on the Vercel function cap:** the 12-function ceiling is specific to the Hobby plan. Two things on this project's own roadmap would keep eating into it: Report Export's deferred PDF path, if revisited, the recommended approach (a third-party HTML-to-PDF API) needs a server-side endpoint to call that vendor, and Project Archive's export/import (P3), a multi-step process likely needing one or two functions of its own. Beyond what this spec covers, a precise picture needs an actual audit of what the current 10 functions are and what else on the broader roadmap (scanner work, and so on) might need new ones, this document doesn't have visibility into that.

More fundamentally: Vercel's Hobby plan terms restrict usage to personal, non-commercial projects, and Future Signals is a commercial product, consulting revenue funds the build, and it's headed toward a public, presumably paid, launch. That makes the real question less "what do we do when we hit 12" and more "this project probably needs to be on a Pro plan regardless of the function count," the cap is just the most visible symptom of running commercial software on a tier not meant for it. Pro removes the function ceiling and starts at $20 per seat per month. Worth raising with whoever owns the Vercel billing relationship independent of anything else in this spec.

**A gap surfaced by thinking through unpublish, worth resolving before that prompt:** because `published-projects` is a fully public bucket, the object at `{slug}/index.html` is reachable by anyone with the link regardless of what the database row's `status` says. Flipping `status` to `'unpublished'` alone would not actually take the page offline, the file would still be sitting there, publicly readable. Unpublish needs to delete (or overwrite with something inert) the storage object itself, not just update a flag. The row and its slug should stay, republishing later reuses the same link, consistent with the stable-slug decision.

**Restoring a decision from earlier in this project that didn't make it into this document's more recent rewrites:** the management surface, showing publish status, the live link, and Publish / Republish / Unpublish controls, was agreed to live at the bottom of the Project Settings side panel, not as a new standalone page or a modal. That decision holds and belongs in the upcoming UI prompt.

**Recommended before wiring any UI:** run the pipeline for real. `node --env-file=.env.local scripts/publish-project.js --project <id>` needs `SUPABASE_SERVICE_ROLE_KEY`, a secret Claude Code correctly declined to handle, but it's already in your own `.env.local`, so this is a one-command sanity check you can run yourself to see an actual published page at a real URL before anything user-facing gets built on top of it.

### Claude Code prompt: Publish entry point (API + management surface)

```
Wire up the user-facing Publish entry point. The backend is done, server-lib/publish-project.js exists and works, this prompt is the API surface and the UI that call it.

Vercel is at 10/12 functions. Build ONE endpoint, not two, that handles both publish and unpublish (an action parameter, or divide by HTTP method on the same route, your call), to stay at 11/12 rather than spending the last slot. Bearer/session-authed, confirming the caller has access to the project the same way other project-scoped endpoints in this app already do, following existing convention rather than inventing a new auth check.

Publish calls publishProject(projectId) and returns the public URL and slug.

Unpublish must do two things, not one: delete (or overwrite with something inert) the storage object at {slug}/index.html, since published-projects is a fully public bucket and the file is reachable by anyone with the link regardless of what status says in the database, flipping the flag alone would not take the page offline. Then set status = 'unpublished' on the row. Keep the row and its slug, don't delete them, a later republish should produce the same link it always did.

UI: add a management surface at the bottom of the Project Settings side panel (this placement was already agreed earlier in this project). It should show: current publish status, the live public link when published (with a copy-link action), and a Publish / Republish / Unpublish button depending on current state. No section picker here, v1 publishes the whole project, there's nothing to curate yet.

Confirm the existing Project Settings side panel's structure and conventions (how other sections in it are laid out, how it handles async actions and loading/error states) before adding this, match the existing pattern rather than introducing a new one.

Write tests for the new endpoint (publish success, unpublish success including that the storage object is actually removed, auth rejection for a non-owner). Use conventional commit format.
```

### Step complete: Publish entry point (MVP is feature-complete)

Committed as `a97af94`. One endpoint, `api/publish.js` (11/12 functions, as planned), a 4-line wrapper over the testable `createPublishHandler` in `server-lib/publish-handler.js`: `GET` returns current status, `POST` with `action: 'publish' | 'unpublish'` does the thing. Auth follows the existing `seed-onboarding.js` pattern exactly, Bearer token, derive workspace, ownership check in one query, 404 for a non-owner (reveals nothing), 401 for a bad or missing token, no new auth mechanism invented.

`unpublishProject()` does the two things in the required order: removes the storage object first, then flips `status` to `'unpublished'`, a removal failure aborts before the flag changes. The row and slug are kept, so a later republish reuses the same link.

UI: `PublishSection.jsx` at the bottom of the Project Settings drawer, matching the placement decided earlier. Reuses the `AddSourceModal`/`InputDrawer` loading-and-error pattern and the Signal Scanning card's styling, rather than introducing new UI conventions.

Verification: 8 new endpoint tests (67 total), covering publish success, unpublish success (asserting the storage object is actually gone, not just the flag), a removal-failure abort, non-owner rejection, bad-token rejection, and status checks for both published and never-published states. Build passes, lint clean.

**Honestly flagged verification boundary:** no live click-through of the drawer UI, that needs an interactive login and `vercel dev` serving the `/api` routes, neither reproducible in an automated pass. The component compiles, matches two established patterns exactly, and its endpoint is fully tested, but seeing it actually render and click through in a browser is the one thing left to check by hand.

**This closes the implementation sequence for Publish's MVP:** schema and storage, resolution layer, section templates, System Map, pipeline, API and UI. All staging-verified.

**Two things remain before this is actually live, not just built:** first, the click-through above, `vercel dev`, sign in, open a project's settings, scroll to "Publish to the web," confirm it behaves as expected. Second, and easy to overlook in the moment, the schema migrations so far have only ever touched the staging Supabase project. Production still needs `db push` on merge to master, per the normal workflow, this feature isn't reachable by real users until that happens.

## Real gap found in click-through: Supabase Storage won't serve HTML as HTML

The verification click-through this document asked for turned up a genuine architectural gap, not a bug in anything built so far. Supabase Storage deliberately refuses to serve user-uploaded HTML as renderable `text/html` from the shared `*.supabase.co` domain, it serves `content-type: text/plain` with `nosniff` instead, anti-abuse behavior to stop the shared domain being used to host phishing or XSS pages. No upload option or header override changes this, signed URLs behave the same. This means "link straight to the storage object" cannot be the actual serving model, something has to sit in front of it that can set the right content type.

**Correction to the architecture decided earlier:** the public URL is not the raw Supabase Storage URL. It has to be served through the app itself.

**Resolved approach:** fold an unauthenticated view branch into the existing `api/publish.js` (`GET /api/publish?view={slug}`, looks up the row, fetches the stored HTML, returns it as `text/html`), plus a Vercel rewrite (`/p/:slug` → `/api/publish?view=:slug`) for a clean public link. This keeps the function count at 11/12 rather than spending the last slot on a dedicated route, consistent with the budget-conservation stance already established for publish/unpublish. `publishProject` now returns the app URL (`/p/{slug}`), not the Supabase Storage URL.

Two details for whoever implements this: the view branch must use the service-role client, not a plain client, `project_publications`' RLS policy (`workspace_id = get_workspace_id()`) would silently return nothing for an anonymous request otherwise, this is the one legitimate anonymous-read case and needs an explicit RLS bypass, not a workaround. And this technically means an anonymous request now does touch `project_publications` (a narrow slug lookup, not raw project tables), a small, sensible amendment to the "no anonymous queries against project tables" principle decided earlier, project data itself is still never re-queried at view time, it was already baked into the static HTML at publish time.

**Confirmed live on staging.** `GET /p/ev-adoption-in-the-us` returns 200, real rendered HTML, `Content-Type: text/html`, `Cache-Control: public, max-age=300, must-revalidate`, a moderate 5-minute cache with revalidation, so a republish shows up promptly rather than hiding behind a stale or immutable cache. The RLS bypass was verified directly, the anon role sees 0 rows for the published slug; the service-role view branch is what makes the anonymous read succeed. Still 11/12 functions. Existing published pages work immediately on the new deployment, no republish needed, since the fix was the serving route, not the stored file. Committed as `d2f5bf6`, 73 tests passing.

Publish's MVP is now fully verified end to end, live, on staging: schema and storage, resolution layer, section templates, System Map, pipeline, API and UI, and the serving route. Production still needs the migrations pushed on merge to master, per the earlier note.

**A backfill for old raw storage-URL links was offered and isn't worth doing.** Nothing has been distributed externally yet, this is still staging, so any old copied link is at most something from internal testing, not a real shared link. The panel already hands out the correct `/p/` link going forward.

**HEAD support for `/p/{slug}` is worth doing, and matters more than "optional polish."** Publish's entire stated purpose includes promotional use on social media, and this surfaced a bigger, related gap: the assembled page likely has no Open Graph meta tags (`og:title`, `og:description`, maybe an image) either, without them, a share to Slack, X, LinkedIn, or iMessage won't produce a real preview card regardless of whether HEAD is answered. Both are small, standard additions worth bundling into one follow-up before calling the social-sharing use case done.

### Claude Code prompt: link-sharing polish (HEAD support + Open Graph tags)

```
Two small additions to how the published page behaves when shared, not new functionality:

1. The /p/{slug} view branch currently only answers GET and POST (POST 405s, as expected, this route is view-only). Some link-unfurlers issue a HEAD request before or instead of GET. Add HEAD handling that returns the same status and headers (Content-Type, Cache-Control) as GET, with no body, standard HTTP semantics.

2. Confirm whether the assembled HTML page (from the publish pipeline) includes Open Graph meta tags in its <head> (og:title, og:description, og:type, and ideally og:url). If it doesn't, which is likely given the earlier templates prompt didn't ask for this, add them: og:title from the project name, og:description from the Key Question or a truncated project description, og:url from the published /p/{slug} link. No image is required for this pass, that would mean generating or choosing one, out of scope here, but don't block the other tags on it.

This matters because Publish's stated purpose includes sharing to social media, and neither a HEAD-only unfurler nor a Slack/X/LinkedIn/iMessage preview card will work correctly without both pieces.

Write tests confirming HEAD returns the right status/headers with an empty body, and that the assembled page's <head> contains the three Open Graph tags with correct values for a normal project. Use conventional commit format.
```

## Visual fidelity notes from the first real side-by-side comparison

Seeing the live published page next to real app screenshots surfaced three gaps, all styling, nothing structural.

**Overview grid is missing its column dividers.** The prototype's confirmed styling: the second and third `<td>` in each row of the meta-grid carry `border-left:1px solid #E0DED7`, the first column in each row doesn't. This got lost somewhere in the templates build and needs restoring exactly.

**System Map fidelity: close the gap with the real canvas, not just an approximation of it.** Now that there's a real side-by-side, three things are confirmed off: node styling (the live output uses a tinted-box treatment; the real `ClusterNode` in the app is a white card with a colored left accent bar and a pill-shaped Type badge), edge color (the real canvas color-codes edges and their labels per relationship type, e.g. Drives reads blue, Enables reads green, distinct from the tinted colors used so far, this needs confirming against `RelationshipEdgeComponent`'s actual color mapping rather than reusing the prototype's invented values), and label legibility (real edge labels sit on a white background directly on the path; the published version renders bare text with no background, illegible wherever it crosses a line). The System Map section's background should also match the real canvas background color, so a white label box actually reads as a label rather than disappearing into a white section background.

**Appendix divider is cramped against the tag pills.** The line separating a cluster's own content from its nested inputs needs more breathing room above and below it, it's currently sitting right up against the badge row.

### Claude Code prompt: visual fidelity fixes

```
Three styling fixes, no structural changes, confirmed against a real side-by-side comparison of the live published page and the actual app.

1. Overview grid: restore the column divider. The second and third <td> in each row of the meta-grid (Domain/Geography/Focus, Audience/Stakeholders/Assumptions) need border-left:1px solid #E0DED7. The first column in each row does not get this border. Check src/publish/sections.js's renderOverview, this styling exists in the original prototype and needs to match exactly.

2. System Map: match the real canvas, don't approximate it. Before changing anything, read the real ClusterNode component and RelationshipEdgeComponent in ScenarioCanvas.jsx to confirm their actual current styling, don't guess or reuse the prototype's invented colors.
   - Node fill: match ClusterNode's real treatment, likely a white card with a colored left accent bar keyed to cluster subtype (Trend/Driver/Tension) and a pill-shaped Type badge, not the tinted-box fill renderSystemMap currently uses.
   - Edge color: confirm RelationshipEdgeComponent's actual per-relationship-type stroke color mapping (the real canvas color-codes edges by type, e.g. Drives and Enables read as visually distinct colors) and use those confirmed values for both the edge stroke and its arrowhead marker, replacing whatever renderSystemMap uses today.
   - Edge labels: give each label a white background (a rounded rect sitting behind the text, on top of the path), matching how the real canvas renders them, bare text with no background is illegible wherever it crosses a line.
   - Section background: confirm the real canvas's background color in ScenarioCanvas.jsx and apply it to the System Map section's wrapper in the published page, so the white label backgrounds actually contrast against something, not disappear into a white section background.

3. Appendix: fix the cramped divider. The border-top divider separating a cluster's own content (title, tags, description) from its nested inputs needs more padding above and below it, currently the tag pills on the divider's row above are clashing with it. Increase the spacing until it reads as a clear separation, not a crowded line.

Use conventional commit format.
```

### Step complete: visual fidelity fixes (mostly)

Committed as `7cf5c5d`, 80 tests passing, verified against the real EV project render, not just unit tests. Overview grid divider restored exactly. System Map now uses the real `ClusterNode` treatment (white card, subtype-colored left accent bar, pill badges) and the real per-relationship-type edge colors and white label pills, confirmed against `ClusterNode`/`RelationshipEdgeComponent` rather than the prototype's guessed values. Appendix divider spacing fixed.

**One thing still not matching: edge curvature.** The published System Map's edges are a simple single-control-point quadratic curve (an SVG `Q` command), which reads as a fairly direct arc between two points. React Flow's actual bezier edges use a cubic curve (`C`, two control points) offset outward in the direction of the connection side, source_handle and target_handle (already fetched and used for anchoring), that's what produces the characteristic flowing S-curve visible in the real canvas, not just anchoring which face of the node the line touches.

### Claude Code prompt: match the real bezier curve

```
The System Map's edges don't match the real canvas's curve shape yet. renderSystemMap currently draws a single-control-point quadratic curve (SVG Q command) between node centers/anchors. The real canvas uses React Flow's cubic bezier edges (@xyflow/react's getBezierPath), which offset two control points outward in the direction of the connection side (source_handle/target_handle: t/l/b/r), not just a single midpoint bow. That directional offset is what produces the flowing S-curve visible in the app; the current quadratic curve can't replicate it regardless of how it's tuned.

Confirm the actual parameters first: check whether RelationshipEdgeComponent uses React Flow's default bezier edge type as-is or with a custom curvature value, read getBezierPath's control-point formula (offset proportional to distance between points and the connection side's direction, with some minimum offset), and replicate that same formula server-side in renderSystemMap using an SVG C command with two control points, not a Q command with one.

Use the already-fetched source_handle/target_handle values to determine each control point's offset direction (right-handle offsets the control point further right before curving toward the target, and so on), the same information already used for side-anchoring, just applied to curve shape now, not only anchor position.

Update the existing tests that check edge path generation to assert a cubic (C) path with correctly offset control points rather than the current quadratic (Q) path, and add a case confirming the curve direction is correct for each of the four handle sides (t/l/b/r).

Use conventional commit format.
```

### Step complete: bezier curve fixed, System Map visual fidelity done

Committed as `239049e`, 81 tests passing. Confirmed first, not assumed: `RelationshipEdgeComponent` calls `getBezierPath` with no custom curvature, React Flow's default of 0.25, then replicated the actual formula from `@xyflow/system` server-side, the same `calculateControlOffset` distance-based offset and `getControlWithCurvature` per-side control point logic, not an approximation of the look. The path is now a real SVG cubic `C` command with both control points, label positioned at the true curve center (`getBezierEdgeCenter`), and the already-fetched `source_handle`/`target_handle` values now shape the curve direction as well as anchor position. Verified against the real EV project, Drives leaves horizontally from its right handle, Enables leaves vertically from its top handle, matching the live canvas.

This closes out the visual fidelity pass. System Map now matches the real canvas on node styling, edge color, label legibility, background, and curve geometry.

## Publish enhancement: section picker (curated publishing)

Publish's MVP shipped whole-project-only, `sections_included` existed as a column but was always populated with a fixed "everything" value, no curation UI. This enhancement builds the curation the column was always meant for.

### Section tree

Overview: always included, not a choice. System Map: optional. System Analysis: optional. Future Models: optional as a group, and within it, Scenarios, Preferred Future, and Strategic Options are each independently optional, and each supports a multi-select of specific items when a project has more than one of that type. Appendix: always included, resolved as its own question below, it's the source-citation backbone (every input's source link), and omitting it undercuts credibility more than any other section, it doesn't depend on what else is selected.

### UI surface: a dedicated modal, not an expanded side panel

The side panel keeps its existing compact surface, publish status, the live link, Publish/Republish/Unpublish. Clicking Publish (first time) or an "Edit selection" action (once already published) opens a modal with the full section tree and multi-select lists. A narrow side panel can't comfortably hold multi-select lists for a project with many scenarios, Preferred Futures, and Strategic Options, a modal has the room. This is also the shared section-picker component the original spec anticipated Report Export and Publish would both reuse, built for Publish first since Publish is what's shipping.

### Default state and Republish behavior

Default is opt-out, not opt-in: every section starts selected, including every Scenario/Preferred Future/Strategic Option a project has. Empty-by-default risks a user forgetting to check anything and publishing a near-blank page without noticing.

First-time Publish is one click, no modal, publishing everything, identical to today's behavior. A separate Customize action opens the modal (pre-populated all-checked, same default as the one-click path) for anyone who wants to narrow the selection before that first publish, curation is additive, not a tax on the common case. Republish (in the side panel, no modal) reuses the last-saved selection for a fast one-click refresh. Customize, once already published, reopens the modal pre-populated with the current `sections_included` to change it before republishing.

### Data model

`sections_included` moves from the fixed `{ mode: 'all', sections: [...] }` placeholder to the real curated selection: which top-level sections are on, plus the specific scenario/Preferred Future/Strategic Option IDs when multi-select applies. Exact shape is Claude Code's call, but it needs to round-trip cleanly: the picker UI reads it to pre-populate on Edit selection, and the pipeline reads it to know exactly what to assemble.

### Claude Code prompt: backend — curated publish

```
Extend the publish pipeline and API to support a curated section selection instead of always publishing the whole project. No UI in this prompt, that's next.

1. server-lib/publish-project.js: publishProject(projectId, options) should accept a selection describing which sections to include: System Map (on/off), System Analysis (on/off), Future Models as a group (on/off), and within Future Models, Scenarios/Preferred Future/Strategic Options each independently on/off plus a specific list of IDs when multi-select applies (a project can have more than one of each). Overview and Appendix are never optional, always assemble them regardless of the selection. Skip fetching and rendering anything that isn't selected, this isn't just about hiding sections in the output, don't do the resolution work for excluded sections either. If no selection is provided at all (omitted or null), default to including everything, this is what powers a one-click "publish the whole project" path in the UI, and keeps scripts/publish-project.js working unchanged as a full whole-project publish.

2. Persist the exact selection to sections_included on publish, replacing the current fixed { mode: 'all', ... } placeholder. Design a shape that a UI can read back to pre-populate a picker (which top-level sections were on, which specific IDs were chosen for each multi-select type) and that the pipeline itself can consume directly on a future republish.

3. api/publish.js: the POST publish action needs to accept this selection in its request body and pass it through to publishProject. The existing GET status branch should return the current sections_included alongside status/slug/publicUrl, so a UI can pre-populate a picker without a second round-trip.

4. If a project has zero Scenarios (or zero Preferred Futures, or zero Strategic Options), that sub-type contributes nothing regardless of its on/off flag, there's nothing to select, this should never error.

5. A selection with no scenarios/PFs/SOs chosen within an on Future Models group should render the group's heading but skip empty sub-sections gracefully, this is a valid state (a user might include Future Models but only wants Scenarios, not the other two), not an error state.

Update tests for publishProject and the API to cover: a partial selection (only Overview + Appendix + one Scenario, everything else off), a project with zero items of some Future Models sub-type, and confirm sections_included round-trips correctly (write a selection, read it back via GET status, get the same shape back). Use conventional commit format.
```

### Step complete: backend curated publish

Committed as `dcec4d7`, 97 tests passing (+8). `normalizeSelection()` landed as the canonical, versioned, total, idempotent shape, persisted to `sections_included`, returned by GET, and re-consumable on republish. Omitted/null selection defaults to everything, as specified, keeping the one-click path and `scripts/publish-project.js` unchanged. `fetchProjectData` correctly skips excluded tables, with the sensible exception that scenarios still get fetched whenever a Preferred Future or Strategic Option is on, since their references resolve against the scenario lookup.

**One real defect caught before it shipped:** a project with zero Future Models items still showed a lonely "Future Models" heading with nothing under it, the literal combination of "skip empty sub-sections" plus "always render the heading when the group is on" that the original prompt specified. Resolved: suppress the heading entirely when the group resolves to no content. A heading over nothing reads as broken, not as intentional whitespace.

Two commits pushed together (`dcec4d7` plus the earlier token-doc commit `de90853`). Next: the picker UI itself, Publish (one-click, everything) and Customize (modal, pre-populated all-checked) as the two entry actions.

### Claude Code prompt: section picker UI

```
Build the Publish section-picker UI: the modal, and wiring the three side-panel actions (Publish, Republish, Customize) to it and to the API from the prior prompt.

Critical distinction, get this exactly right: an omitted selection in the POST body means "publish everything" per the backend's own default. That's correct for the very first Publish click (never published before), but wrong for Republish, which must reuse whatever was last curated, not silently reset to everything. Republish's fast, no-modal path must explicitly fetch the current sectionsIncluded (via the existing GET, no second endpoint needed) and resend that exact selection in the POST body. Never omit it for Republish. Only the true first-time Publish action omits the selection.

Three entry points in PublishSection.jsx (the existing side-panel surface):
- Publish (only shown when never published): one click, no modal, omits the selection entirely (backend defaults to everything). Matches today's behavior exactly.
- Republish (only shown once published): one click, no modal, fetches current sectionsIncluded via GET and resends it unchanged.
- Customize: opens the section-picker modal. If never published, pre-populate all-checked (the equivalent of the default). If already published, pre-populate from the current sectionsIncluded, respecting exactly which specific Scenario/Preferred Future/Strategic Option IDs were previously selected, not just whether the group was on.

Modal content, mirroring the confirmed section tree: Overview and Appendix shown as always-included (checked, disabled, not a real choice). System Map and System Analysis as simple checkboxes. Future Models as a checkbox that, when on, expands to Scenarios/Preferred Future/Strategic Options, each its own checkbox, and when a sub-type is on and the project has more than one item of that type, a multi-select list of the specific items (id + name/title) to choose from. A project with only one item of a given type doesn't need a multi-select, on means include that one item. A project with zero items of a type shouldn't show that sub-type's controls at all, nothing to pick.

Pull the actual Scenario/Preferred Future/Strategic Option lists from whatever project data is already loaded in the app when Project Settings is open, this shouldn't need a new fetch.

The modal's submit action calls the same publish endpoint's POST with the constructed selection, matching normalizeSelection's shape from the prior prompt exactly (version, overview, appendix, systemMap, systemAnalysis, futureModels.enabled, and each sub-type's enabled/ids).

Reuse the existing loading-and-error pattern already established for PublishSection.jsx (the AddSourceModal/InputDrawer pattern) for the modal itself, don't invent new UI conventions.

Write tests for: the Republish path sending the fetched selection rather than omitting it, the Customize modal pre-populating correctly from an existing sectionsIncluded (including specific chosen IDs, not just group toggles), a project with zero items of some Future Models sub-type not showing that sub-type's controls, and the constructed selection payload matching normalizeSelection's expected shape on submit.

Fold in the small fix flagged earlier: suppress the "Future Models" heading entirely when the group resolves to no content (zero items across all three sub-types, or all sub-types explicitly off), rather than rendering an empty heading.

Use conventional commit format.
```











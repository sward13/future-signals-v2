# Feature Spec: Web Export

**Status:** Draft, prototyped — for Sam + John review, then handoff to implementation
**PRD section:** Export family, alongside Report Export, Project Archive, and Analysis Export
**Last updated:** 15 July 2026
**Prototype:** `web-export-prototype.html` (static HTML mockup, iterated against real app screenshots)

---

## Overview

Web Export lets a user publish a standalone, single-page scrolling version of a project to a shareable URL. Where Report Export produces a file (Markdown or PDF) for reading and sharing directly, Web Export produces a live, styled web page for presenting a finished project to stakeholders or publishing more broadly, including to social media.

Two use cases:

1. **Stakeholder sharing** — a practitioner finishes a project and wants a polished, presentable artifact to send to clients, executives, or workshop participants, something closer to a report presentation than a raw export.
2. **Promotion** — published pages act as a growth channel for Future Signals itself, similar in spirit to the "shareable links from Beta users' published projects" idea already mentioned in passing in the staged launch plan, but never built.

Origin: inspired by Alison Rand's Rewilding Futures presentation (rewildingfutures.replit.app/presentation), from the same UofF futures program. Already logged in project memory under Aspirational output references as representing "the quality and style of practitioner-produced foresight outputs Future Signals should enable," though not elaborated into a feature spec until this review.

Priority: P2, above Project Archive and Analysis Export, reflecting both its stakeholder-sharing and promotional value, and the fact that it's lower-friction to build than PDF export given the current stack (see PDF-versus-Web-Export comparison in the master export strategy doc).

---

## Architecture

### Section selection

Reuses the Report Export section picker rather than building a separate selection UI. The user chooses which parts of the project to include the same way they would for a Report Export, project overview, system map, preferred future, and so on. The only difference in the picker itself is the terminal action: Publish instead of Generate.

OQ-WEB-01 resolved: Web Export includes the full section set, not a curated subset. Scan and Clusters aren't dropped, they're reordered to the end as supporting material (see Reading order below), rather than omitted.

### Reading order (revised from build order)

The methodology's build order, Scan, Cluster, System Map, System Analysis, Future Models, is the order a practitioner works in, not the order a stakeholder should read in. Web Export reorders the same content around the reader's experience instead:

1. **Hook and overview** — title, then a consolidated overview: key question (given the most visual weight, italic), followed by domain, geography, focus, audience, stakeholders, and assumptions in a compact grid. Scope in/out are excluded for now, not because they're unwanted, but to keep the section from overloading before the reader reaches any actual project content. Time horizons closes this section, positioned here (not as its own lead-in to the next movement) since it's project framing, not landscape interpretation.
2. **The world being explored** — System Map (relationships) and System Analysis (description, dynamics, uncertainties, implications, confidence). This is the landscape the rest of the page interprets.
3. **What it means** — Scenarios, then Preferred Futures, then Strategic Options, following the existing informed-by / responds-to causal chain already in the data model.
4. **Appendix** — Clusters and Inputs, for readers who want to trace the synthesis back to its source signals. Visually quieter than the sections above (denser, no serif headlines, collapsed by default behind a disclosure toggle), signaling optional reference material rather than continuing narrative.

One accepted trade-off: the System Map names clusters the reader hasn't been formally introduced to yet, since Clusters now live in the appendix. This mirrors how an executive summary names themes before an appendix defines them, and the relationship table's plain-language rows carry enough context on their own. Checked against the prototype and holds up fine in practice.

### Appendix interaction pattern

Each cluster in the appendix is its own native `<details>` disclosure (no JavaScript required), collapsed by default, showing headline first and its tag badges trailing on the same row, `[title][tags]`, then its description, then its own linked inputs nested inside, each input following the same `[title][tags]` pattern with the source link on its own line below. This replaces an earlier draft that had a single flat Inputs table separate from Clusters, clicking into a cluster is how you see its inputs, rather than cross-referencing two separate lists. Every input always carries a link back to its original source URL.

### Badge inventory

Clusters: Type (Trend, Driver, Tension), Horizon (H1, H2, H3), Likelihood. Inputs: Type (Signal, Issue, Projection, Plan, Obstacle), Strength, Confidence, Horizon. Type and Horizon colors are confirmed against real app screenshots (Type: Trend dusty violet, Driver muted teal, Tension dusty rose, per existing design tokens; Horizon: green/blue/amber, confirmed against the in-app Time Horizons component, correcting an earlier guess that had used the Weak/Moderate/High terracotta/gold/sage scale for horizons). Strength and Confidence use that terracotta/gold/sage scale correctly, since that's the confirmed scale for those two fields specifically. Likelihood's color is inferred from a single observed value ("Plausible," rendered as an outlined blue pill) and should be confirmed against the full scale before treating it as settled.

### Publish pipeline

A one-time, static render, not a live page that re-queries the project on every view:

1. User selects sections and clicks Publish.
2. Server-side, under the owner's normal authenticated access, resolves the selected sections into the same readable, name-resolved content Report Export uses.
3. Renders that content into static HTML using a fixed template (see MVP scope below).
4. Stores the generated HTML in a public Supabase Storage bucket.
5. Returns a shareable link at a stable slug.

Updating a published page means deleting the existing snapshot and regenerating a fresh one from the project's current state. The slug stays stable across republishes, same link, swapped content, so a link already shared or posted doesn't rot when the owner updates and republishes.

No live database access happens on view. The only thing ever exposed to an anonymous visitor is the generated static file, not the project's underlying tables, which avoids needing an RLS policy for public read access to live project data.

### Access control

MVP: unlisted-link access. The slug itself, unguessable, not indexed, is the access control. No login, no password, no per-viewer permission needed for the page to render.

Anything beyond that, password-gating, invite-only, revocable per-viewer access, needs a thin check in front of the static file (validating a token or password against the publish record) rather than the pure static-file model on its own. Not required for MVP; noted as a future extension point, not a blocker (OQ-WEB-02).

### Branding

Default assumption: a "Powered by Future Signals" footer on published pages, supporting the promotional use case. Not yet confirmed whether this is always-on or an opt-out (OQ-WEB-07).

---

## MVP scope

A static template per section type, rendering the same resolved data used for Report Export (relationship IDs turned into names, product terminology, no technical fields) into a fixed, pre-designed layout, in the reading order above rather than build order:

- Title
- Overview: key question, domain, geography, focus, audience, stakeholders, assumptions, then time horizons
- System Map (rendered image or relationship table, same fallback logic as Report Export, see note below)
- System Analysis (description, key dynamics, critical uncertainties, implications, confidence)
- Scenarios, Preferred Futures, Strategic Options
- Appendix: Clusters (each expandable to its own linked Inputs), collapsed by default

System Map rendering: the prototype includes both fallback forms, a relationship table and a node-link SVG reconstructed from the relationship data. Worth considering a third option for real implementation: a server-side rasterized snapshot of the actual canvas at publish time (screenshot-equivalent), which guarantees visual fidelity to what the user built rather than an approximation regenerated from the underlying rows. That's a build-time decision, not something this spec needs to settle now, but it's a meaningfully different engineering path (rendering pipeline vs. canvas screenshot service) worth raising with whoever picks up implementation.

No per-project custom imagery, no AI-synthesized narrative copy, no user-facing formatting choices. Content renders verbatim from what's already in the project, in a single default visual theme.

One known content gap: the Rewilding Futures reference presents strategic initiatives as phased roadmaps (Phase 1/2/3, each with an owner), which doesn't map onto Strategic Options' current fields (feasibility, resource intensity, reversibility, description, intended outcome, what this involves, dependencies, risks, implications). For MVP, present the existing fields in their own template rather than forcing a phase structure the data doesn't have. Revisit only if a future, richer template wants that phased look.

The default visual theme itself, typography, color, section layout, isn't yet designed. That's a design pass that should happen before or alongside implementation, not something this spec resolves (OQ-WEB-03).

## Post-MVP (explicitly deferred)

Lightweight formatting controls and a choice of color palettes per published page. View analytics on published pages. Richer permissions beyond unlisted-link.

Management surface is no longer in this list, see OQ-WEB-05 and the Implementation Sequence note below. Deciding where it lives (Project Settings side panel) effectively pulls it, and the republish/unpublish mechanics it depends on, into MVP scope, since a settings entry with no working actions behind it isn't a real surface. Worth a quick confirmation that this is the intended read, rather than just placement being decided while the functionality itself stays deferred.

---

## Data model (sketch)

New table:

```
project_publications
├── id
├── project_id
├── slug (unique, stable across republishes)
├── storage_path
├── sections_included (jsonb — which sections/items were selected at publish time)
├── status (published · unpublished)
├── published_at
├── republished_at
```

No new fields required on existing tables for MVP. The resolution logic reuses whatever Report Export builds to turn IDs into names and structure raw data into readable content.

---

## Open Questions

**OQ-WEB-01: Section list scope.** Resolved. Full section set, reordered around reading experience rather than curated down (see Reading order above).

**OQ-WEB-02: Permissions beyond unlisted link.** Whether password-gating or invite-only access is needed before or shortly after MVP, and if so, whether that's a per-publish choice or a project-level default.

**OQ-WEB-03: Default visual theme.** Partially addressed. `web-export-prototype.html` is a working static mockup covering every section in the reading order above, with real cluster and relationship data substituted in from actual app screenshots. Treat it as a strong starting point for implementation, not final visual sign-off, John hasn't reviewed it yet, and a few specific colors (Likelihood scale) are inferred rather than confirmed.

**OQ-WEB-04: Slug generation.** Random, unguessable string, or a user-chosen custom slug (with the collision and squatting considerations that come with letting users pick their own).

**OQ-WEB-05: Management surface.** Resolved. Lives at the bottom of the Project Settings side panel. Shows publish status (not published / published on [date]), the shareable link with a copy action, a link to view the live page, and Republish / Unpublish actions. No standalone dashboard or cross-project list for MVP, this is a per-project surface, consistent with publish being a per-project action.

**OQ-WEB-06: Strategic Options presentation.** Resolved for MVP, existing fields render in their own template rather than forcing the reference's phased-roadmap structure. Revisit only for a future, richer template.

**OQ-WEB-07: Branding footer.** Whether "Powered by Future Signals" is always-on or user-removable, given its role in the promotional use case.

---

## Implementation Sequence

1. **Data model** — `project_publications` table, RLS locked to project owner for writes; generated files in a public Supabase Storage bucket for reads.
2. **Section picker reuse** — extend the Report Export picker component with a Publish action alongside Generate; resolve OQ-WEB-01 before finalizing which sections appear here.
3. **Default visual theme** — design pass for the static section templates (OQ-WEB-03), a prerequisite for step 4, not something engineering should improvise.
4. **Static template rendering** — build the fixed section templates against the resolved-content layer shared with Report Export.
5. **Publish pipeline** — resolve, render, store, generate or reuse the stable slug, return the shareable link.
6. **Public serving route** — serve the stored static file at its slug; confirm no project-table queries occur on this path.
7. **Management surface** — Project Settings side panel entry: publish status, shareable link with copy action, view link, Republish and Unpublish actions.
8. **Republish and unpublish** — delete-and-regenerate flow for updates; explicit unpublish (delete without replace). Required to back step 7, no longer deferrable once the settings entry exists.
9. **Post-MVP** — permissions beyond unlisted link, formatting and palette customization, analytics.

Steps 1–8 form the MVP now that the management surface has a confirmed placement. Step 9 can follow incrementally, consistent with how the Signal Scanner spec sequenced its own MVP versus later iteration.

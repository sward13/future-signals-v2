# Future Signals — docs

Specs, audits, and reference material. Organized so it's clear what's still open
versus already built.

- **This folder (top level)** — remaining/unbuilt work and living references.
- **[`completed/`](./completed/)** — specs for features that have shipped, spent
  implementation prompts, resolved audits, and historical session/handoff notes.

Project instructions (`CLAUDE.md`), the repo readme (`README.md`), and the
authoritative design system (`design-principles.md`) live in the repo **root**,
not here — they're load-bearing living documents, not sortable specs.

---

## Remaining / unbuilt work

| Doc | What's left |
|---|---|
| `master-export-strategy-spec.md` | Web Publish shipped; the Report Export / Project Archive / Analysis Export enhancements in this spec are still on hold. |
| `Multiple System Maps Audit.md` | N maps per project + System Analysis as a child entity — **not built** (still one map per project). |
| `system_map_phase_plan.md` | The phased build plan for the multiple-system-maps work above. |

## Living references

| Doc | Purpose |
|---|---|
| `cron-secret.md` | `CRON_SECRET` topology, source of truth, and rotation procedure. |
| `database-schema-reference.md` | Plain-language snapshot of the DB schema (regenerate when `database.types.ts` is). |

## Completed

Shipped features, spent handoff prompts, resolved audits, and historical notes
live in [`completed/`](./completed/). Highlights:

- **Cluster workspace** — `cluster-merge-spec.md`, `clustering-workspace-refactor-spec.md`, `pgvector-clustering-spec.md`
- **Publish & export** — `web-export-spec.md`
- **Onboarding & sample project** — `Sample_Project_Onboarding_PRD.md`, `FutureSignals_Onboarding_ProgressiveDisclosure_Spec.md`, `onboarding-cluster-review-audit.md`
- **Scanner** — `signal-scanner-spec.md` (core live since 2026-09-01; Levels 1–2 are future refinements)
- **System Map backgrounds** — `system-map-background-templates-spec.md` + its Pass 2 prompt (core shipped; two templates unstyled + user uploads deferred)
- **Future Models** — `scenario-forces-picker-spec.md`, `rich-text-editing-requirements.md`
- **Inputs** — `signal-import-spec.md` (CSV import)
- **Chrome extension** — `future-signals-chrome-extension-requirements.md`, `chrome-extension-*-prompt.md`, `chrome-extension-alignment-audit.md`
- **Design/quality** — `design audit.md`, `fable-badge-consolidation-prompt.md`, `merge-readiness-audit.md`
- **History** — `handoff.md`, `session-2026-06-16.md`

> Note: a doc in `completed/` may still note minor deferred/stretch work in its
> own text (e.g. the scanner and system-map-background specs) — "completed" means
> the core feature shipped, not that every future enhancement is done.

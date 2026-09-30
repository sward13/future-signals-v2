# Feature Spec: GA4 Activation Tracking

**Status:** Draft — for Sam + John. EPIC-readiness item #5.
**PRD section:** Analytics / measurement
**Last updated:** 30 September 2026
**Related:** `epic-readiness-priorities.md`, `access-promo-codes-spec.md`, `error-handling-hardening-spec.md`

---

## Overview

The talk's closing questions are *"Is this valuable? Does the structure improve the thinking?"* If we recruit a cohort at EPIC and don't instrument the funnel, we answer those by guessing. This spec adds a **lean activation funnel in GA4** so EPIC becomes a measured learning event: how many recruits sign up, activate, reach first value, and come back — and **which channel each came from**.

## Current state (the gap)

- **The app has no analytics at all** — no `gtag`, no measurement ID, no `VITE_GA*` (verified 2026-09-29).
- **The marketing site already runs GA4** (`G-RRVXQ587R2`) and is configured for **cross-domain linking to `app.futuresignals.io`** (`'domains': ['futuresignals.io','app.futuresignals.io']`). So the intent is a unified marketing→app journey — but the app side was never instrumented, so today that cross-domain config points at an app that tracks nothing. Closing this gap is the core of this work.

## Decision: reuse the marketing measurement ID (cross-domain continuity)

Add gtag to the app using the **same `G-RRVXQ587R2` stream** the marketing site already uses, so a visitor's path (futuresignals.io → sign up → app) is **one session/user**, and the cross-domain linker already configured on the marketing side actually works. (A separate app stream is the alternative but breaks the single-journey view we want for EPIC attribution.) Store the ID in `VITE_GA_MEASUREMENT_ID`.

## SPA gotcha: manual page_views

Navigation is **state-driven, not URL-routed** (per CLAUDE.md — `activeScreen` in `useAppState`, no router). GA4's automatic page_view fires only on load, so **screen changes must fire `page_view` manually** on `activeScreen` transitions (or we rely on custom events and treat page_views as secondary). Note this — it's the classic SPA-analytics trap.

## Event taxonomy (lean funnel for EPIC)

Map events to the cold-start funnel (**Scan → Sign up → Onboard → First value → Come back**). Keep it small — this is an activation funnel, not full product analytics.

| Stage | Event | Key params |
|---|---|---|
| Acquire | `sign_up` (fires at submission, **before** email confirmation) | `method` (password), **`access_code` / `campaign`** |
| Acquire (friction) | `sign_up_blocked` | `reason` (invalid / expired / exhausted code) |
| Onboard | `onboarding_started`, `onboarding_step` (`step`), `onboarding_completed` | `step` shows where people drop out |
| First value | `project_opened` (incl. the sample), `input_added` (manual add), `cluster_created` (manual), `system_map_opened` | entity counts where cheap |
| **AI assist (accept / reject)** | `suggest_clustering_run` · `scanner_input_accepted` / `scanner_input_dismissed` · `cluster_suggestion_accepted` (`type`: new_cluster \| assignment) / `cluster_suggestion_dismissed` · `find_duplicates_run` · `clusters_merged` | — |
| Deeper value | `analysis_started`, `scenario_created` | — |
| **Output / sharing** | `report_exported` (`format`: markdown), `project_published` | *(republish / unpublish optional)* |
| Retain | *(native)* GA4 handles return-visit / day-N retention once users are identified | — |

**AI-assist acceptance is the sharpest value signal.** The paired accept/reject events — scanner (`scanner_input_accepted` / `scanner_input_dismissed`) and clustering (`cluster_suggestion_accepted` / `cluster_suggestion_dismissed`), against the run counts (`suggest_clustering_run`) — give you **acceptance rates**: the fraction of AI suggestions practitioners actually keep. That's the most direct empirical answer to the talk's *"what is the appropriate role for AI?"* — and it distinguishes "the AI is genuinely helping" from "people run it and ignore the output." Manual paths (`input_added`, `cluster_created`) stay separate so scanner-sourced vs. hand-entered can be compared.

**The email-confirmation gap (measure it).** With confirmation ON, `sign_up` fires at form submission but the user then has to leave, confirm via email, and return before their first authenticated session — a real drop-off point, especially at a booth. The funnel must not jump straight from `sign_up` to `onboarding_started` and hide it: treat the **first authenticated session after signup** as the "confirmed & returned" milestone (GA4's returning-user data supports this) so confirmation drop-off is visible.

**Output / sharing signals matter.** Export and Publish are how practitioners get the thinking *out* of the platform — which the talk itself flags as central ("outputs are part of the thinking"). `report_exported` (from `ExportModal` / `buildMarkdown`) and `project_published` (from the Publish flow) are strong "delivered real value" signals — capture both.

**Attribution — mechanism now, granularity later.** Pass the redeemed **access-code campaign** as a param/user-property on `sign_up`. Today that's a **single code (`EPIC2026`)**, so the breakdown is uniform — but the mechanism is in place, so if per-channel codes are added later (booth vs talk vs blog), the attribution "just works" with no code change. Don't promise per-channel breakdowns until multiple codes exist.

## Implementation shape

- **`src/lib/analytics.js`** — a thin wrapper over `gtag`: `track(event, params)` and `pageView(screen)`, plus a no-op guard when `VITE_GA_MEASUREMENT_ID` is unset (so dev/test don't emit). Keep it dependency-free and unit-testable (assert it shapes calls correctly / no-ops when unconfigured).
- **gtag loader** — inject the GA script in `index.html` (or lazily in `App.jsx`) gated on the env var, with the cross-domain linker config matching the marketing site.
- **Fire points** — call `track(...)` from the natural seams:
  - `sign_up` at signup submission success (with `access_code`/`campaign`), and `sign_up_blocked` in `AuthScreen`'s error path when the access-code gate rejects (see `accessCode.js`'s `signupErrorMessage`).
  - `onboarding_started` / `onboarding_completed` in the onboarding flow, plus `onboarding_step` (with `step`) on each step transition (`OnboardingShell`).
  - manual entity events from `useAppState` actions (`addInput`, `addCluster`, `addScenario`, …) and `pageView` on `activeScreen` changes.
  - **AI assist:** `suggest_clustering_run` from `ClusterSuggestions.handleRun`; `scanner_input_accepted` / `scanner_input_dismissed` from the Scanner Suggestions Accept/Dismiss handlers (`saveInputToProject` / `saveInputsToProject` with a bulk `count`, `dismissSuggestedInput`); `cluster_suggestion_accepted` (`type`) / `cluster_suggestion_dismissed` from the `ClusterSuggestions` accept/dismiss handlers. **Fire the suggestion-accept event at the suggestion handler, not in `addCluster`** — otherwise a suggestion-created cluster double-counts as a manual `cluster_created`. `find_duplicates_run` from `ClusterScreen.findDuplicates`; `clusters_merged` from `useAppState.mergeClusters`.
  - **`report_exported`** from `ExportModal` (with `format`), **`project_published`** from the Publish flow (`publishActions` / `PublishSection`).
- **Error events** — the shipped `ErrorBoundary` already exposes an `onError` hook (and a comment pointing here). Wire it to fire an `app_error` event so prod crashes are visible in GA, not just the console.

## Privacy / consent

Privacy Policy + ToS are live (roadmap: Done). For an alpha cohort this is low-risk, but note: if EU users are in scope, GA4 use implies a consent story. Not an EPIC blocker; flag for the Open-Beta security/compliance pass. Don't put PII in event params (no emails/names — use ids/campaigns).

## Non-goals

- Not full product analytics, funnels-as-dashboards, experimentation, or a second tool (PostHog/Mixpanel). Lean GA4 activation funnel only.
- Not server-side event tracking — client gtag is sufficient for EPIC.

## Testing

- **`analytics.js`** — `node:test`: `track`/`pageView` shape the expected `gtag` calls; both no-op cleanly when `VITE_GA_MEASUREMENT_ID` is unset.
- **Manual** — run the funnel once with GA DebugView open; confirm each event fires with the right params (especially `sign_up` carrying the access-code campaign, `sign_up_blocked` on a bad code, and `report_exported` / `project_published` on the output actions) and that a marketing→app journey shows as one session.

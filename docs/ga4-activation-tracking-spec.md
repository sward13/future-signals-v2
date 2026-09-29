# Feature Spec: GA4 Activation Tracking

**Status:** Draft — for Sam + John. EPIC-readiness item #5.
**PRD section:** Analytics / measurement
**Last updated:** 29 September 2026
**Related:** `epic-readiness-priorities.md`, `access-promo-codes-spec.md`

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
| Acquire | `sign_up` | `method` (password), **`access_code` / `campaign`** (from the codes work — this is the attribution join) |
| Onboard | `onboarding_started`, `onboarding_completed` | — |
| First value | `project_opened` (incl. the sample), `input_added`, `cluster_created`, `suggest_clustering_run`, `system_map_opened` | entity counts where cheap |
| Deeper value | `analysis_started`, `scenario_created`, `project_published` | — |
| Retain | *(native)* GA4 handles return-visit / day-N retention once users are identified | — |

**Attribution is the payoff:** passing the redeemed **access-code campaign** (from `access-promo-codes-spec.md`) as a param/user-property on `sign_up` lets GA answer *"how many signups came from the EPIC booth vs the talk QR vs the blog"* — the exact thing you want to learn from the conference. The two features are complementary: codes gate + label, GA counts.

## Implementation shape

- **`src/lib/analytics.js`** — a thin wrapper over `gtag`: `track(event, params)` and `pageView(screen)`, plus a no-op guard when `VITE_GA_MEASUREMENT_ID` is unset (so dev/test don't emit). Keep it dependency-free and unit-testable (assert it shapes calls correctly / no-ops when unconfigured).
- **gtag loader** — inject the GA script in `index.html` (or lazily in `App.jsx`) gated on the env var, with the cross-domain linker config matching the marketing site.
- **Fire points** — call `track(...)` from the natural seams: `sign_up` at the signup success (with campaign), onboarding start/complete in the onboarding flow, and the entity events from the existing `useAppState` actions (`addInput`, `addCluster`, `addScenario`, publish, etc.) and screen changes for `pageView`.

## Privacy / consent

Privacy Policy + ToS are live (roadmap: Done). For an alpha cohort this is low-risk, but note: if EU users are in scope, GA4 use implies a consent story. Not an EPIC blocker; flag for the Open-Beta security/compliance pass. Don't put PII in event params (no emails/names — use ids/campaigns).

## Non-goals

- Not full product analytics, funnels-as-dashboards, experimentation, or a second tool (PostHog/Mixpanel). Lean GA4 activation funnel only.
- Not server-side event tracking — client gtag is sufficient for EPIC.

## Testing

- **`analytics.js`** — `node:test`: `track`/`pageView` shape the expected `gtag` calls; both no-op cleanly when `VITE_GA_MEASUREMENT_ID` is unset.
- **Manual** — run the funnel once with GA DebugView open; confirm each event fires with the right params (especially `sign_up` carrying the access-code campaign) and that a marketing→app journey shows as one session.

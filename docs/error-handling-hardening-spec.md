# Feature Spec: First-Session Error Handling & Hardening

**Status:** Draft — for Sam + John. EPIC-readiness item #2.
**PRD section:** Reliability / onboarding
**Last updated:** 29 September 2026
**Related:** `epic-readiness-priorities.md`, `access-promo-codes-spec.md`

---

## Overview

With open (soon invite-gated) registration and a QR pointing strangers straight into the app, **a first session that white-screens or dead-ends is a lost recruit** — and there's no one standing next to them to recover it. This spec hardens the first-session path so failures degrade gracefully instead of crashing.

Scope is deliberately narrow: **the surfaces a new user hits in their first session**, and the failure modes most likely to occur there — not a full test suite or a hunt for every latent bug.

## Non-goals

- Not a comprehensive test/QA pass or bug hunt.
- Not retry/offline-resilience for every mutation — just no *crashes* and no *silent dead-ends* on the first-session path.
- Not performance work (that's React Query / later).

---

## The cross-cutting fixes (do these first)

### 1. Top-level React error boundary — **P0**

**There is currently no error boundary anywhere in `src/`.** Any unhandled render error (a bad `.map`, an undefined field on a half-loaded record, a canvas edge case) **white-screens the entire app.** For a first-session stranger that's terminal.

- Add a top-level `<ErrorBoundary>` in `App.jsx` wrapping the app shell, rendering a friendly recovery screen ("Something went wrong — reload / back to dashboard") instead of a blank page, and logging the error (to console now; to GA/error tracking once instrumented — see the GA4 spec).
- Add **targeted boundaries around the two React Flow canvases** (`ScenarioCanvas` / System Map, `SystemAnalysisCanvas`) — they're the most crash-prone (node/edge/geometry edge cases) and should fail to a "couldn't render the map" panel without taking the app down.

### 2. One standard async/invoke pattern — **P1**

There are **9 `supabase.functions.invoke` call sites** and error handling is ad hoc (e.g. `ClusterSuggestions.jsx` does try/catch + inline error nicely; `detect-cluster-overlaps` in `ClusterScreen` does too; others are inconsistent). Extract a small shared helper (e.g. `src/lib/invokeEdge.js`) that every call routes through, giving uniform: **loading state → typed result → friendly error (toast or inline) → optional retry.** Audit all 9 sites and convert them.

### 3. Distinguish "empty result" from "error" — **P1**

A successful call that returns nothing ("no suggestions found," "no likely duplicates," "all inputs already clustered") must render a calm **empty state**, never an error. The edge functions already return message payloads for these (`compute-cluster-suggestions` returns "Not enough inputs…", etc.) — the client must treat them as empty, not failure.

### 4. Timeouts + loading states on long operations — **P2**

Scanner and clustering calls can be slow. Every long op needs a visible loading state and a timeout that resolves to "this is taking longer than expected — try again" rather than a spinner that hangs forever.

---

## First-session surface checklist

For each, define and verify graceful behavior (no crash, no infinite spinner, no dead-end):

| Surface | Key edge cases to handle |
|---|---|
| **Signup / access gate** | invalid/expired/exhausted code → friendly message (see access-codes spec's GoTrue-500 quirk); confirmation email not arriving → resend affordance |
| **Onboarding** (sample clone + seed + embeddings) | `clone-sample-project` / `seed-onboarding` / `embed-input` failure must not hang or block entry — proceed to an empty-but-usable workspace with a retry, never a stuck spinner |
| **Dashboard / Overview** | brand-new workspace (no projects) → proper empty state (largely Done per roadmap) |
| **Scan** | scanner timeout/failure → graceful; adding an input offline → error toast + no data loss |
| **Cluster** | **Suggest clustering with 0/1 inputs → calm empty state, not error**; `compute-cluster-suggestions` failure → inline error + retry |
| **System Map** | render errors contained by the canvas boundary (#1); empty map → scaffold, not crash |
| **System Analysis / Future Models** | missing/empty analysis or scenarios → empty states; canvas boundary as above |

## Known edge cases called out on the roadmap

- **Scanner timeout** → graceful failure + retry (not a hung spinner).
- **Clustering with no inputs** → empty state (edge fn already returns the message; client must render it calmly).
- **Graceful failures generally** → the error-boundary + standard-invoke-pattern above cover the class.

## Testing

- **Error boundary** — a unit/component test that a throwing child renders the fallback, not a blank tree.
- **`invokeEdge` wrapper** — pure-ish; unit-test the success / error / empty branches (`node:test`), mirroring the repo convention.
- **Manual first-session walkthrough** — run the whole funnel (signup → onboarding → each screen) once with the network throttled and once offline; confirm every failure is a friendly message, never a white screen or infinite spinner. This is the acceptance test.

## Priority within the spec

1. **Top-level + canvas error boundaries** (P0 — the white-screen risk).
2. Standard invoke pattern + empty-vs-error across the 9 sites (P1).
3. Timeouts/loading on long ops (P2).

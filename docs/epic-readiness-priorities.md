# EPIC Readiness — Prioritized Work

**Status:** Active planning — for Sam + John
**Context:** Presenting Future Signals at EPIC People (Chicago), ~1 month out (late Oct 2026)
**Last updated:** 29 September 2026
**Related:** `access-promo-codes-spec.md`, `FutureSignals_Roadmap_Timeline` (Google Sheet), `design-principles.md`

---

## The goal and the surfaces

The EPIC goal is **recruiting users**, across three surfaces:

1. **The talk** — a reflective *narrative* about how Future Signals came to be, what we've learned, the tensions we're balancing, and what we want to learn going forward. (Draft is strong; this is a content task, not a build task.)
2. **A booth / fair demo** — walk-up conversations.
3. **An open invitation** — a QR code on the final slide (and at the booth) that sends attendees to sign up and try the prototype themselves.

## The reframe: the bottleneck is the self-serve cold-start funnel

Because the goal is recruitment via a QR-to-signup invitation, the thing to optimize is **not features or slides — it's the path a stranger takes after scanning the code.** Every candidate piece of work should be judged by one question:

> *Does this help a stranger who scanned the QR get in and reach a first "aha" — without hitting a wall or needing us standing next to them?*

The funnel: **Scan → Sign up → Onboard → First value → Come back / share.**

## Timeline reality check

The roadmap slots "EPIC 2026 (October)" under *Public Launch (Week 14–16)*, but by the sheet's own week-math we'll be in **late Alpha / early Closed Beta** at EPIC — not launched. So this window optimizes for **a credible prototype + a working recruitment funnel**, explicitly **not** for launch gates (Stripe, full security sprint, marketing-site rebuild, React Query, GA depth beyond activation).

---

## Access model (decided 2026-09-29): invite-only via access codes

Evolution of the decision:
1. **Shipped:** the marketing site's "Request access" (mailto) button was relabeled to **"Sign up"** → `https://app.futuresignals.io/sign-up` and deployed live. `/sign-up` already deep-links to the signup form (`src/lib/authRedirect.test.js`). This made registration **open** — anyone could sign up.
2. **Decided:** rather than leave it fully open (which exposes the signup + AI endpoints to the whole internet), gate it with a **shared/channel access code** — invisible friction for the EPIC crowd (the code rides in the QR link), opaque to everyone else. Full design in **`access-promo-codes-spec.md`**.

**EPIC cut of the code gate:** email/password + access code, validated **at account creation**, with **email confirmation ON** (a legitimacy/security signal for a real-work tool; fits the async "sign up at the booth, dig in later" pattern). **Google SSO is deferred** to a post-EPIC fast-follow. A single, gated signup path is already true invite-only for EPIC, and it gates onboarding/AI spend — which is why the cost/rate-limit work drops to a fast-follow.

---

## Prioritized readiness shortlist (in order)

1. **Access & promo code gate** — the front door. Turns the now-open registration into invite-only, and (because the gate blocks onboarding before any AI fires) removes the runaway-cost exposure. The biggest EPIC build; fully specced in `access-promo-codes-spec.md`. One prerequisite: locate the live `handle_new_user` definition (predates the migrations dir) before extending it.
2. **Error handling for edge cases** — a stranger's *first* session cannot crash: scanner timeout, clustering with no inputs, graceful failures. *(Roadmap: Closed Beta, P1, Not started.)*
3. **Cluster recommendations visible by default** — an unguided user won't find the AI assist behind the Suggested-mode toggle; surfacing it is how a solo user discovers the value. *(Roadmap: Closed Beta, P1, Not started.)*
4. **Stage-transition readiness signals** ("Ready to map?") — the method's guide-rail for someone with no one narrating it. *(Roadmap: Closed Beta, P1, Not started.)*
5. **Activation instrumentation (lightweight GA4 funnel)** — the talk literally asks "is this valuable? does structure improve thinking?" If we recruit a cohort and don't instrument the funnel, we're guessing. Turns EPIC into the learning event the talk promises. Per-channel access codes double as attribution and feed this. *(Roadmap: Open Beta, P1, Not started → pull earlier, lightweight.)*

**Resolved (was on this list):**
- **Email confirmation** → decided **ON** (see Access model).
- **Google SSO** → **deferred** to a post-EPIC fast-follow (see below). It was the top item when the plan was fully-open registration; the code gate makes it optional for EPIC, and it adds the trickiest plumbing (code carried through the OAuth redirect + activation model) to the critical path. Not worth the risk for a marginal convenience gain at a research conference.
- **Scanner cost / rate-limit guard** → **deferred** to a fast-follow. The code gate blocks onboarding/AI before it fires on un-activated accounts, so there's no ungated path to abuse.

## Already shipped — assets that help the funnel

- **Landing-page "Sign up" button** (shipped 2026-09-29) → `app.futuresignals.io/sign-up`. Live now (currently open until the code gate lands).
- **Sample project clone** (Done) — every new user immediately sees a *completed* foresight pass instead of a blank screen. The best cold-start asset we have; make sure it fires reliably for each new signup.
- **Cluster merge + generation-side dedup + "Find duplicates"** (shipped Sep 2026) — backs the talk's "clustering to make new connections / get you off the ground quicker" claim.
- **Web Publish** (`/p/{slug}`) — a user who publishes a shareable page becomes an organic channel; consider raising its prominence.
- **Loom walkthrough** (Alpha version Done) — the async guide for people who sign up at the booth and try it later.

## Explicitly deferred past EPIC (fast-follows)

- **Google SSO + activation-flag model** (gate both paths) — see `access-promo-codes-spec.md`.
- **AI-endpoint rate-limit / cost guard** — softened by the code gate; harden when access widens.
- Stripe / paid tier · full security sprint (beyond a data-isolation spot-check) · React Query · marketing-site rebuild · UMAP embedding viz · multi-domain example projects · CSV import robustness · help-text polish.

---

## Operational risk

The code gate greatly reduces the "conference spike" exposure (no ungated path triggers AI spend), but two things still warrant care:

- **The access code is now load-bearing for *all* signups.** If it's typo'd, expired, or cap-hit, nobody can sign up at the booth. Before EPIC: test the live code end-to-end, set a generous `max_uses` + a comfortable `expires_at`, and keep a backup code.
- **Email-confirmation deliverability.** A confirmation email that lands in spam (or never arrives) is a dead signup and inverts the security signal. Verify it reaches the inbox; consider a branded, from-domain sender (Resend is already wired for other mail).
- **Data isolation** between strangers (light RLS audit Done ✓; do one deliberate two-account check).

## Open decisions / questions

- **Resolved:** marketing-site location (found + button shipped), email confirmation (ON), Google SSO for EPIC (deferred), access model (invite-only via codes).
- **Next:** write the remaining EPIC specs (error-handling hardening, GA4 activation funnel), then build — starting with the access-code gate (prereq: locate `handle_new_user`).

## Notes for the talk (secondary — content, not build)

- Strongest material for an EPIC audience: the **"support good thinking / minimize cognitive outsourcing"** principle, the **"Tensions we're balancing"** slide, and the **"What we want to learn"** slide. Lean in — a research crowd rewards honest open questions over polished claims.
- **Recruitment tie-in:** frame the invitation as *"join our inquiry,"* not *"try our tool"* — invite researchers as **co-investigators** into the open questions. Recruits the right people.
- **Placeholders to fill:** slide 1 "Add point on A+W," slide 2 "HISTORY OF APP," and slides 7–10 (Inputs / Clusters / System Map / Progression) currently repeat the *same* "non-linear practice" paragraph — each artifact needs its own line.

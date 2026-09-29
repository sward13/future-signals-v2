# EPIC Readiness — Prioritized Work

**Status:** Active planning — for Sam + John
**Context:** Presenting Future Signals at EPIC People (Chicago), ~1 month out (late Oct 2026)
**Last updated:** 29 September 2026
**Related:** `FutureSignals_Roadmap_Timeline` (Google Sheet), `design-principles.md`

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

## Access decision (made 2026-09-29): open registration

Current "manual provisioning" is really just: users go to `futuresignals.io` → Log in → flip to Sign Up. The plan is to **relabel the marketing site's "Request Access" button to "Sign up" and link it to `https://app.futuresignals.io/sign-up`** — i.e., move to **open registration**.

- **Rationale:** at a conference, the "try it tonight while excited" moment beats the control a gate would give. Framing it as a *prototype* keeps expectations calibrated.
- **App side is already ready:** `/sign-up` (and `/signup`) deep-link straight to the signup form; URL stays in sync; covered by `src/lib/authRedirect.test.js`. Nothing to build in the app for the link itself.
- **The button lives in the separate marketing site** (`futuresignals.io`), *not* this app repo — that edit happens there.
- **Consequence:** with no gate to hide behind, the readiness items below (esp. error handling + scanner cost guard) move from "nice" to "must."

---

## Prioritized readiness shortlist (in order)

1. **Google Sign-on** — the single biggest friction reducer for a walk-up crowd; email/password on a phone at a booth loses people. Roadmap lists it as unblocked by the `app.futuresignals.io` migration. *(Roadmap: Closed Beta, P2, Not started → promote.)*
2. **Error handling for edge cases** — a stranger's *first* session cannot crash: scanner timeout, clustering with no inputs, graceful failures. No gate to catch them. *(Roadmap: Closed Beta, P1, Not started.)*
3. **Scanner cost / rate-limit guard** — the item most likely to *bite financially*. Every new project may kick off signal scanning → OpenAI spend + cron load; a signup burst from a conference room could spike cost or trip rate limits. Add a cap/throttle before opening the tap. *(Not explicitly on the roadmap; surfaced here.)*
4. **Decide email confirmation** — signup currently shows a "check your email"-style confirmation screen, implying Supabase email-confirm is ON. That means signup → leave → find email → confirm → *then* get in: a real conference drop-off point. Decide consciously (it does filter junk). *(Confirm exact current behavior.)*
5. **Cluster recommendations visible by default** — an unguided user won't find the AI assist behind the Suggested-mode toggle; surfacing it is how a solo user discovers the value. *(Roadmap: Closed Beta, P1, Not started.)*
6. **Stage-transition readiness signals** ("Ready to map?") — the method's guide-rail for someone with no one narrating it. *(Roadmap: Closed Beta, P1, Not started.)*
7. **Activation instrumentation (lightweight GA4 funnel)** — the talk literally asks "is this valuable? does structure improve thinking?" If we recruit a cohort and don't instrument the funnel, we're guessing. Turns EPIC into the learning event the talk promises. *(Roadmap: Open Beta, P1, Not started → pull earlier, lightweight.)*

## Already shipped — assets that help the funnel

- **Sample project clone** (Done) — every new user immediately sees a *completed* foresight pass instead of a blank screen. The best cold-start asset we have; make sure it fires reliably for each new signup.
- **Cluster merge + generation-side dedup + "Find duplicates"** (shipped Sep 2026) — backs the talk's "clustering to make new connections / get you off the ground quicker" claim.
- **Web Publish** (`/p/{slug}`) — a user who publishes a shareable page becomes an organic channel; consider raising its prominence.
- **Loom walkthrough** (Alpha version Done) — the async guide for people who sign up at the booth and try it later.

## Explicitly deferred past EPIC

Stripe / paid tier · full security sprint (beyond a data-isolation spot-check) · React Query · marketing-site rebuild · UMAP embedding viz · multi-domain example projects · CSV import robustness · help-text polish. Real work, no recruitment payoff in this window.

---

## Operational risk (open registration + conference spike)

Going from ~3–5 hand-provisioned users to a conference crowd stresses three things at once:
- **Data isolation** between strangers (light RLS audit Done ✓; do one deliberate two-account check).
- **Scanner cost/load** (see #3 above).
- **Support burden** (mitigated by prototype framing + the Loom walkthrough).

## Open decisions / questions

- **Where is the marketing site hosted?** (separate Git repo vs a builder like Framer/Webflow/Carrd) — determines how the button relabel gets done.
- **Email confirmation on or off** for the booth flow? (see #4)
- **Scope the top three** (Google SSO, error-handling, scanner guard) into concrete work against this repo — next step once the above are settled.

## Notes for the talk (secondary — content, not build)

- Strongest material for an EPIC audience: the **"support good thinking / minimize cognitive outsourcing"** principle, the **"Tensions we're balancing"** slide, and the **"What we want to learn"** slide. Lean in — a research crowd rewards honest open questions over polished claims.
- **Recruitment tie-in:** frame the invitation as *"join our inquiry,"* not *"try our tool"* — invite researchers as **co-investigators** into the open questions. Recruits the right people.
- **Placeholders to fill:** slide 1 "Add point on A+W," slide 2 "HISTORY OF APP," and slides 7–10 (Inputs / Clusters / System Map / Progression) currently repeat the *same* "non-linear practice" paragraph — each artifact needs its own line.

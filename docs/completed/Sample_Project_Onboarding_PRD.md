# Sample Project Onboarding — PRD

**Status:** Draft for review
**Owner:** Sam Ward
**Related:** `FutureSignals_Onboarding_ProgressiveDisclosure_Spec.md` (see Supersession note below)

## Problem

New users finish onboarding today with an empty workspace and four static text slides (`OnboardingEducation.jsx`) walking through Signal → Cluster → System Map → Analysis. There is no live example of a finished project, so users have to infer what a complete methodology pass looks like from prose alone. This is a weak mental model for a tool whose value depends on understanding how the five stages connect.

## Goal

Every new user finishes onboarding with a full, working example project in their workspace: a real clone of John's "Future of Alternative Proteins" project, sitting alongside whatever project they create for themselves during onboarding. It behaves exactly like any other project they own. They can open it, click through Signal, Cluster, System Map, and Analysis with real content already filled in, edit it, or delete it if they're not interested. It exists to demonstrate what the product produces, not to teach through explanation.

## Current state (per Claude Code audit)

- `OnboardingFlow.jsx` step 4 renders only `OnboardingEducation.jsx`: four static slides (title/body/example), no live project, no "Use this as a template" or "Continue to my project" affordance, no copy-into-workspace logic.
- `src/data/seeds.js` contains dead sample data (`SAMPLE_PROJECTS`, `SAMPLE_CLUSTERS`, `SAMPLE_SCENARIOS`, `SAMPLE_CANVAS_NODES`, `SAMPLE_RELATIONSHIPS`) modeling one project, "AI Governance & Trust," with 2 clusters, 1 scenario, and 2 canvas nodes. It is not imported anywhere in the app. This was an earlier, abandoned attempt at the same problem and should be removed once the new approach ships, rather than adapted.
- No clone or copy-on-promote-style logic for whole projects exists yet.

## Supersession note

`FutureSignals_Onboarding_ProgressiveDisclosure_Spec.md:112-134` describes a different model: a read-only sample project with a "promote" action that copies only the structural layer (clusters, system map skeleton — not inputs) into the user's existing project. That model is superseded by this PRD. The new model gives each user a complete, independent, fully editable clone of the sample project as its own project in their workspace, not a partial merge into a project they're already building. Update or retire that section of the onboarding spec once this PRD is approved, so the two documents don't contradict each other.

## Target experience

1. User completes onboarding (whether or not they created their own project along the way).
2. Their workspace now contains their own project (if created) plus a second project: a full, working clone of "Future of Alternative Proteins," populated with real inputs, clusters with AI summaries, a system map, a system analysis, and a scenario with a preferred future.
3. The cloned project behaves like any other project: editable, deletable, fully theirs. Deleting it has no effect on the templates account's original.
4. Signal scanning is off by default on the clone. This is a deliberate contrast with the user's own first project, where scanning defaults on: the sample should feel like a stable, finished reference, while the user's own project is the one that feels alive and actively fed by the scanner.

## Backend requirements

This reuses and extends work already in progress (templates account created in staging and production):

1. **Template master copy.** One clone of "Future of Alternative Proteins" lives in the `templates@futuresignals.io` account, in both staging and production. It is the only project with `is_sample_template = true`. It is never edited directly and never shown to end users.
2. **Clone script.** A Node script or Supabase Edge Function walks every table that hangs off a project (`inputs`, `clusters`, canvas nodes/edges, `analyses`, future models/scenarios, briefs association, `project_sources`, embeddings, scanner candidates) and remaps foreign keys to new IDs. Reuse the FK-remapping approach already used for copy-on-promote of inputs across projects rather than writing a second implementation from scratch; the underlying problem (independent copies sharing a common origin, remapped IDs, no shared mutable state) is the same, just applied project-wide instead of input-by-input.
3. **Two invocations of the same script:**
   - **Template creation (one-time, or re-run if John's source project changes):** clones from John's live project into the templates account. Sets `is_sample_template = true` on the result. Disables signal scanning on the clone's `project_sources`. Strips account-specific state (`last_digest_at`, cron state, activity/audit log rows) and confirms embeddings and scanner-candidate references point at the new project's own rows, not back at John's original.
   - **Per-user clone (triggered at onboarding completion):** clones from the templates account's copy — never from John's live project directly, and never from a previous user's copy. `is_sample_template` stays `false` on every per-user clone; it is a normal project.
4. **Staging note:** staging and production are separate databases. The templates account and its template project need to exist independently in each. Since staging won't have John's actual production data, it needs either an exported/imported copy of the same project or a comparable stand-in, so the onboarding flow can be tested end-to-end in staging without touching production.

## Frontend requirements

- Identify and wire the actual onboarding-completion trigger point in `OnboardingFlow.jsx` (implementation detail for Claude Code — needs the current step/route structure to pin down precisely).
- Trigger the per-user clone server-side at that point.
- Surface the cloned project in the dashboard alongside the user's own, clearly distinguishable at a glance (see Open Decisions — exact labeling not yet decided).
- Remove the dead `seeds.js` sample data once the new flow ships.

## Decisions made

- **Scanning default on the per-user clone: off.** The user's own first project defaults scanning on; the sample project defaults it off. This contrast is intentional: the sample reads as a stable, finished reference, while the user's own project is the one that feels live.

## Open decisions

- **Labeling.** `is_sample_template` is `false` on the user's copy by design, so the dashboard needs some other signal to tell the user "this one's the example, that one's yours" — a title convention, a subtitle/description, or a lightweight new field (e.g., a nullable `source_template_id` on `projects`, for internal tracking only, that doesn't gate any behavior the way `is_sample_template` does). Recommend the new field plus a short description string on the project card; needs a decision before frontend work starts.
- **Onboarding-completion definition.** Assumed to mean "onboarding flow finished," independent of whether the user created their own project. Needs confirmation this is the right trigger point rather than, say, first dashboard visit.

## Test plan

Using a disposable test account, confirm: the cloned project appears correctly on the new user's dashboard; `is_sample_template` is `false` on the clone; every stage (Signal, Cluster, System Map, Analysis, scenario) has real content, not empty states; deleting the test account's copy leaves the templates account's original untouched; re-running the same test in both staging and production gives matching results.

## Out of scope

- Any change to the structural-only "promote" mechanic if it's still wanted elsewhere in the product; this PRD only replaces its use for the onboarding sample project.
- Multi-system-map support (tracked separately, post-Alpha).

# Feature Spec: Access & Promo Codes

**Status:** Draft — for Sam + John. Written for EPIC readiness; one open question (Google SSO gating) flagged inline.
**PRD section:** Auth / signup — access control
**Last updated:** 29 September 2026
**Related:** `epic-readiness-priorities.md`, Google SSO spec (to be written), `signal-scanner-spec.md` (AI cost context)

---

## Overview

We just moved the marketing site's front door to open registration (`futuresignals.io` → "Sign up" → `app.futuresignals.io/sign-up`). Fully open registration exposes the signup flow — and the AI endpoints it triggers (onboarding seeding, embeddings) — to the whole internet, making an AI-endpoint rate-limit guard an urgent pre-EPIC dependency.

A **shared/channel access code** is a better vehicle for where we are (late alpha, ~1 month to EPIC, recruiting a known conference crowd): invisible friction for people who met us at EPIC (the code rides in the QR link), an opaque gate to everyone else. It shrinks the abuse/cost surface enough that the rate-limit guard drops from blocker to fast-follow.

Built as a **codes table** (not a hardcoded constant), the same primitive serves every future need — per-channel attribution, cohort tagging, inflow caps, and eventually Stripe discount/comp promos — so we build it once.

**This is one spec, internally phased:**
- **Phase 1 (EPIC):** codes table + signup gate + attribution + usage caps/expiry. Built now.
- **Future (with Stripe):** the `grants` column drives discounts/plan comps. Schema reserved now; **logic not built**.

## Non-goals

- **No admin UI** for managing codes in Phase 1 — codes are created by SQL insert (Supabase dashboard). An admin surface is future.
- **No discount/plan-grant redemption logic** now — `grants` is a reserved column only.
- **Google SSO is deferred to a post-EPIC fast-follow.** The EPIC cut covers the **email/password path only** (see "EPIC scope" below), which means there's a single signup path and it's gated — so "gate both paths" is automatically satisfied for EPIC, and the activation-flag model moves into the SSO fast-follow.
- **Email confirmation stays ON.** With a code gate it isn't needed for spam prevention, but it signals legitimacy/security for a tool people may use for real work, and it fits the async "sign up at the booth, dig in later" pattern.
- **Not a new Vercel function** — see architecture; we're at 11/12 on the Hobby cap.

---

## Data model

### `access_codes` (new table)

| Column | Type | Notes |
|---|---|---|
| `code` | text, unique, PK | the string users enter/carry (`EPIC-BOOTH`, `BLOG`, …). Case-insensitive match recommended. |
| `label` | text | human name for the campaign/channel |
| `active` | boolean, default true | kill switch |
| `max_uses` | int, nullable | null = unlimited; enforced atomically |
| `uses_count` | int, default 0 | incremented on each redemption |
| `expires_at` | timestamptz, nullable | null = no expiry |
| `grants` | jsonb, nullable | **reserved for future** (e.g. `{"plan":"pro","months_free":3}`). Unused in Phase 1. |
| `created_at` | timestamptz, default now() | |

Standard grants + RLS per the repo convention (service-role + authenticated; but note validation runs in a `SECURITY DEFINER` trigger, so table reads by clients aren't required — keep client access minimal/none).

### Redemption record (attribution)

Phase 1: stamp the redeemed code on the workspace — add `access_code text` and `code_label text` to `workspaces` (or the profile row `handle_new_user` creates). This gives per-account attribution with zero extra tables. A dedicated `code_redemptions` table (code, user_id, redeemed_at) is a clean future upgrade if we need redemption history; not needed for EPIC.

---

## Architecture — where the gate lives

**Decision: gate in the DB via the existing `handle_new_user` signup path — not a new API endpoint.**

Why:
- The client signup is `supabase.auth.signUp(...)` — a direct GoTrue call. Gating it *client-side* is not secure (a bot hits the API directly). A real gate must run server-side at account creation.
- A Vercel `/api/sign-up` endpoint (validate code → admin-create user) would work but **spends the last Vercel Hobby function slot (11/12)** and forces us to re-implement email confirmation. Rejected.
- `handle_new_user` (the existing trigger that provisions a workspace on signup) already runs server-side at exactly the right moment. Extending it costs **zero functions** and keeps the existing client flow.

### Flow (email/password)

1. Client calls `supabase.auth.signUp({ email, password, options: { data: { access_code } } })` — the code rides in `raw_user_meta_data`. (Today the call is bare; this adds `options.data`.)
2. `handle_new_user` (or a companion `SECURITY DEFINER` trigger) reads `new.raw_user_meta_data->>'access_code'` and validates it **atomically**:
   ```sql
   update access_codes
     set uses_count = uses_count + 1
     where lower(code) = lower(:submitted)
       and active
       and (expires_at is null or expires_at > now())
       and (max_uses is null or uses_count < max_uses)
     returning code, label;
   ```
   - **0 rows returned → `raise exception 'invalid or expired access code'`**, which fails the signup transaction; the client surfaces the error. The atomic `update … where uses_count < max_uses … returning` enforces the cap race-safely (no check-then-increment gap).
   - 1 row → stamp `access_code` + `label` onto the new workspace for attribution.

> **Prerequisite — LOCATED (2026-09-29).** `handle_new_user` is identical on staging and prod (`md5 0418d91f…`), fired by trigger `on_auth_user_created` **AFTER INSERT ON auth.users FOR EACH ROW**. Current body (`SECURITY DEFINER`, `search_path=public`):
> ```sql
> begin
>   insert into public.workspaces (user_id) values (new.id)
>     returning id into new_workspace_id;
>   insert into public.workspace_settings (workspace_id) values (new_workspace_id);
>   return new;
> end;
> ```
> It predates the migrations dir (CLAUDE.md's "undocumented-schema-change pattern"). **First capture the current body verbatim into a new migration** (so the ledger is truthful), then extend it with the code check below.
>
> **Because the trigger is AFTER INSERT in the same transaction, a `raise exception` here rolls back the `auth.users` insert** — exactly the block we want. One quirk to handle client-side: GoTrue surfaces a trigger exception as a generic *"Database error saving new user"* (HTTP 500), not our message string — so the client should map a failed signup to a friendly "invalid or expired access code" rather than relying on the DB message text. Workspace columns today: `id, user_id, created_at, experience_level, onboarding_completed` — add `access_code text` + `code_label text` for the redemption stamp.

### Fast-follow (post-EPIC): Google SSO + gating both paths

Deferred past EPIC. Once Google SSO is added, a second signup path exists that can't be gated at account creation (OAuth accounts are created *during the Google redirect*, before any server check we control). The uniform way to gate both is to **gate activation, not account creation**: a new account is inert until a valid code is redeemed. This is the design for that fast-follow — it is **not** built for EPIC (EPIC ships password + code gated at creation; see "EPIC scope").

**Recommended implementation — an activation flag (lower risk than reworking signup provisioning):**

- Add `activated_at timestamptz` (nullable) to `workspaces`. `handle_new_user` stays as-is (still provisions the workspace), but a workspace with `activated_at IS NULL` is **inert**.
- **The whole app gates on activation:** if the signed-in user's workspace isn't activated, show a one-screen **"Enter your access code"** gate and block everything else — crucially including **onboarding/seeding and any AI-triggering endpoints**, so a parked account costs nothing.
- **Activation RPC** (`SECURITY DEFINER`): takes a code, runs the atomic validate-and-increment (see Validation rules), and on success stamps attribution + sets `activated_at = now()`. On failure, returns an error and the account stays parked.
- **Password path:** user enters the code on the signup form → after `signUp`, the client calls the activation RPC with that code → activated inline (no visible "parked" state on the happy path). Onboarding proceeds only after activation.
- **Google SSO path:** user enters the code on the signup page before "Continue with Google" (carried through `redirectTo`/localStorage) → on return, client calls the activation RPC → activated. If someone reaches OAuth without a code (e.g. direct/bypass), they land on the activation gate and can't proceed until they enter one.

**Cost note:** because activation gates onboarding + AI endpoints, this model *also* satisfies the cost concern directly — an un-activated account (bot or otherwise) triggers zero spend. This further softens the standalone rate-limit work.

**Build cost:** this is more than gating the password form alone — it adds the `activated_at` flag, the activation gate screen, the activation RPC, and wiring onboarding to run only post-activation. It's the price of true invite-only across both paths.

---

## Validation rules (single source of truth)

A code is valid iff: `active = true` AND (`expires_at` is null OR `> now()`) AND (`max_uses` is null OR `uses_count < max_uses`). Match case-insensitively. Extract this predicate into a pure, unit-tested module so client-side pre-validation (nice UX) and the server trigger agree; the **server trigger is the enforcement point**, the client check is only for fast feedback.

## UX

- The signup form gains an **"Access code"** field.
- The EPIC QR/link embeds it: `app.futuresignals.io/sign-up?invite=EPIC-BOOTH` → the page reads the param and pre-fills (optionally hides) the field. **Zero friction for the intended crowd.**
- A public visitor clicking "Sign up" with no param sees an empty required field — a gentle "invite-only beta" gate.
- Invalid/expired/exhausted code → clear inline error ("That access code isn't valid or has expired").

## Admin (Phase 1)

Create codes by SQL insert, e.g.:
```sql
insert into access_codes (code, label, max_uses, expires_at)
values ('EPIC-BOOTH', 'EPIC 2026 booth', 300, '2026-11-15');
```
Rotate/disable by setting `active = false`. Issue one code per channel (`EPIC-BOOTH`, `EPIC-TALK`, `BLOG`, `PARTNER-X`) for attribution.

## Phasing recap

| Capability | Phase | Built for EPIC? |
|---|---|---|
| Codes table + signup gate | 1 | ✅ |
| Attribution (code stamped on workspace) | 1 | ✅ |
| `max_uses` + `expires_at` caps | 1 | ✅ (recommended: set `expires_at` + generous `max_uses` as cost insurance) |
| Per-channel codes | 1 | ✅ (data-only; issue as many rows as needed) |
| `grants` → discounts / plan comps | Future | ⛔ schema column only, no logic |
| Admin UI | Future | ⛔ |
| `code_redemptions` history table | Future | ⛔ (workspace stamp suffices) |

## Testing

- **Pure validation predicate** → `node:test` (active/expired/exhausted/inactive/case-insensitive cases), mirroring `src/lib/*.test.js`.
- **Trigger** → verify on staging with fixtures (valid code admits; expired/exhausted/inactive/unknown code blocks; atomic cap holds under two near-simultaneous redemptions of a `max_uses = 1` code), same approach as `merge_clusters`.

## Open questions

- **OQ-CODE-1 — RESOLVED (2026-09-29):** **EPIC ships the email/password path only**, gated by the code at account creation, with **email confirmation ON** (a legitimacy/security signal for a real-work tool). Google SSO is deferred to a fast-follow; "gate both paths" (the activation-flag model) ships with SSO, not at EPIC. Rationale: fewest moving parts for a reliable booth signup, SSO is a marginal gain at a research conference, and a single gated path is already true invite-only for EPIC.
- **OQ-CODE-2 — RESOLVED (2026-09-29):** Leave the public marketing "Sign up" button pointing at `/sign-up`. Public visitors hit the code gate; anyone with a valid code proceeds. One canonical signup URL.
- **OQ-CODE-3 — RESOLVED (2026-09-29):** Yes — enforce `max_uses` **and** `expires_at` from day one, as cost insurance.

## How this changes the EPIC sequence

With a single gated signup path, the AI-endpoint **rate-limit guard moves from pre-EPIC blocker to fast-follow** (no ungated path can trigger onboarding/AI spend). Revised EPIC order: **Access codes (password + code, confirm ON) → error-handling hardening → GA4.** Post-EPIC fast-follow: **Google SSO + activation-flag model (gate both paths) + rate-limit guard.**

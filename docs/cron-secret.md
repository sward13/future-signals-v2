# CRON_SECRET — topology, source of truth, and rotation

`CRON_SECRET` is a **symmetric shared secret**: every consumer must hold the
*exact same string*. There is no server/client asymmetry — a mismatch anywhere
means that specific call returns 401. Because it is consumed in more places than
is obvious, a partial rotation (updating some surfaces but not others) silently
breaks a subset of jobs while leaving others working — which is exactly what
makes it confusing to diagnose.

## Where it is consumed

**Vercel functions** (`process.env.CRON_SECRET`, via `server-lib/cron-auth.js`)
— these both *verify* it on inbound requests **and** *forward* it onward to
Supabase Edge Functions:

- `api/scan.js`, `api/score.js`, `api/classify.js`, `api/trigger-score.js`,
  `api/run-health-check.js`

**Supabase Edge Functions** (`Deno.env.get("CRON_SECRET")`):

- `check-scanner-health` — called by `api/run-health-check.js` and `api/score.js`
  with the **Vercel** copy forwarded as `x-cron-secret`
- `send-weekly-digest` — called **directly** by cron-job.org

**External senders (cron-job.org):**

- "Future Signals signal scanner" → hits Vercel `/api/scan`
- "Future Signals weekly digest" → hits Supabase `send-weekly-digest` directly

### The non-obvious coupling

`run-health-check.js` and `score.js` forward the **Vercel** `CRON_SECRET` to the
**Supabase** `check-scanner-health` function, which checks the **Supabase** copy.
So **within an environment, the Vercel copy and the Supabase copy must be equal.**
If they drift, the scanner health check fails silently (no user-visible symptom),
and the digest — hit directly by cron-job.org against Supabase — fails visibly.

## Source of truth

Because the value must be *read back* to propagate, and both Vercel (marked
sensitive → write-only) and Supabase (masked) are unreadable, **no deployment can
serve as the source of truth.**

- **Canonical copy lives in LastPass**, one entry per environment:
  `CRON_SECRET · prod` and `CRON_SECRET · staging`.
- Every deployment surface is a **write-only mirror** you re-push from LastPass.
- **Prod and staging use different values.** Never share a secret across
  environments.

`.env.local` holds the **staging** value (local dev targets the staging Supabase
project). So `.env.local` differing from prod is *correct* — do not use it to
"fix" prod.

## The full sync inventory

**Prod** (value `P`, canonical: LastPass `CRON_SECRET · prod`):

| Surface | How set |
|---|---|
| Vercel **Production** env | `vercel env` / dashboard |
| Supabase **prod** (`tbxjudpxzovbasuomekq`) secret | `supabase secrets set` |
| cron-job.org — **scanner** job header | dashboard |
| cron-job.org — **digest** job header | dashboard |

**Staging** (value `G` ≠ `P`, canonical: LastPass `CRON_SECRET · staging`):

| Surface | How set |
|---|---|
| Vercel **Preview** env | `vercel env` / dashboard |
| Supabase **staging** (`kptatqipjwihkdxdxlvh`) secret | `supabase secrets set` |
| `.env.local` (local dev) | edit file |
| cron-job.org — any staging jobs | dashboard |

## Rotation

Use `scripts/rotate-cron-secret.sh <prod|staging>`. It generates a fresh value,
pushes it to the two CLI-reachable surfaces (Supabase + Vercel), and prints a
checklist for the manual ones (LastPass canonical + cron-job.org headers +
`.env.local` for staging).

When copies have drifted and you cannot establish which one is authoritative,
**always generate a fresh value and distribute it to every surface at once** —
do not try to "roll back" to an existing copy, which may be one you deliberately
retired.

### Supabase vs Vercel: how new values take effect (asymmetric!)

- **Supabase Edge Functions** pick up new secret values on the **next
  invocation** — no redeploy needed. (`send-weekly-digest`, `check-scanner-health`.)
- **Vercel bakes env vars per-deployment.** Changing the env var does **not**
  affect the currently-running Production deployment — `/api/scan` (and the other
  `api/*` cron endpoints) keep using the **old** `CRON_SECRET` until you
  **redeploy Production**. Symptom: the digest starts working immediately after a
  rotation but the scanner returns 401.
  - Fix: `vercel redeploy <current-prod-deployment-url>` (get the URL from
    `vercel ls future-signals-v2 --prod`), or dashboard → Deployments → current
    Production → ⋯ → Redeploy. This re-runs the **same source commit** with the
    new env — no code change.
  - **Never** `vercel --prod` from a feature branch to force this — it ships that
    branch's code to production. For staging, the new Preview env applies to the
    next Preview deployment (e.g. the next push to `workspace-refactor`).

There is no downtime risk as long as all surfaces are updated before the next
scheduled run (scanner ~daily 19:00, digest weekly Monday 00:00) — a brief
mismatch just yields a failed run you can re-trigger with "Run now".

## History

- **2026-07-14:** digest found failing with `401 UNAUTHORIZED_UNREGISTERED_API_KEY`
  (Supabase gateway) because `send-weekly-digest` was deployed `verify_jwt: true`,
  forcing a project API key the cron-job.org request no longer had after the
  2026-07-09 key rotation. Redeployed `--no-verify-jwt` (matching every other
  externally-triggered function here) so `x-cron-secret` is the sole gate. Then a
  second break surfaced: `CRON_SECRET` had been recycled during the 2026-07-09
  Supabase update but not propagated to every surface, so the Supabase prod copy
  no longer matched Vercel/cron-job.org. Resolved by fresh full rotation.

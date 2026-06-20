# Future Signals v2 — Handoff

_Last updated: 2026-06-19_

---

## Project overview

Future Signals v2 is a strategic foresight SPA (React 18 + Vite + Supabase). It guides practitioners through a structured methodology: Inputs → Clusters → System Map → System Analysis → Future Models.

**Stack:** React 18, Vite, Supabase (Postgres + pgvector + RLS), Vercel (hosting + cron), OpenAI (embeddings + GPT-4o)

**Repo:** `sward13/future-signals-v2` on GitHub  
**Prod:** Deployed on Vercel, auto-deploys from `master`

---

## Current state — main app

All core screens are built and functional:

| Screen | Status |
|---|---|
| Auth (sign up / sign in / email confirm) | Done |
| Onboarding flow | Done |
| Dashboard | Done |
| Inbox | Done |
| Inputs (ProjectDetail) | Done |
| Clustering | Done |
| System Map | Done |
| System Analysis | Done |
| Future Models (Scenarios + Strategic Options) | Done |

Recent notable additions:
- CSV import for Inputs (sidebar entry point, template download, preview, bulk write)
- Search + filter on Clustering screen (type / horizon / likelihood)
- Strategic Options: Reversibility + Resource Intensity fields with colour-coded badges
- System Map: fullscreen toggle, "Other" relationship type with custom label, table view reorder
- Signal Quality disaggregated into Signal Strength (`Weak | Moderate | Strong`) and Source Confidence (`Low | Medium | High`) — both practitioner-set; `signal_quality` DB column retained but unused
- Inbox AI Suggested Project filter: defaults to "All projects" on fresh load; persists within session; deep-link from "Review N suggestions" still pre-selects the correct project
- Per-project scanning controls in Account Settings
- Security hardening: SSRF protection on `/api/scrape`, auth required on `/api/trigger-score`, RLS on `source_health`, dropped `candidates_insert` open policy, O(1) unsubscribe token verification, unsubscribe URL routed through app domain

---

## Chrome extension

**Location:** `extension/` in the same repo — separate Vite/TypeScript build  
**Architecture:** Manifest V3, Chrome native side panel, React + Supabase

### What's done

- Full capture flow: auth check → metadata extraction → form → Supabase insert → success/failure states
- Metadata extraction: `og:title`, `document.title`, `h1` fallback; canonical URL; meta description
- Selected text: content script listens for `selectionchange` (debounced 300ms) and updates the description field automatically while the panel is open
- Subtype picker: TypeSwitcherChip-style dropdown matching main app design
- Project selector: dropdown populated from user's workspaces; defaults to Inbox if no project selected
- Draft persistence: form state saved to `chrome.storage.local`, restored on re-open; stale draft (wrong URL) is cleared on mount
- URL cleanup: strips common tracking params (`utm_*`, `fbclid`, `gclid`, etc.)
- Metadata saved on insert: `{ source: "chrome_extension", page_title, canonical_url }`
- Embedding triggered non-blocking after insert
- Design system: follows main app tokens (colours, typography, spacing)
- Extension context invalidation guard: `isContextValid()` check before any `chrome.runtime.sendMessage` call

### What's not done (post-MVP)

These are explicitly out of scope for MVP per the requirements doc:

- **Expanded fields section** — STEEPLED, signal quality, time horizon are not in the extension form yet. The requirements spec calls for an optional "Add details" toggle. Currently users set these fields in the main app after capture.
- **Duplicate detection** — no warning if the same URL already exists in the selected project
- **Right-click / context menu capture** — highlight text on page, right-click → "Save to Future Signals"
- **Already-saved indicator** — badge or message on the extension icon when current URL is already captured
- **Save to Inbox shortcut** — fast capture without project selection
- **Chrome Web Store submission** — extension is currently loaded unpacked for development; not yet published

### Extension build

```bash
cd extension
npm install
npm run build      # builds dist/ for unpacking in Chrome
npm run dev        # watch mode
```

Load unpacked from `extension/dist/` in `chrome://extensions`.

---

## Signal scanning

### Architecture

The scanner is a Vercel cron pipeline running nightly at 02:00 UTC:

```
/api/scan          — fetches RSS feeds, deduplicates, inserts candidates
/api/classify      — classifies candidates by domain (batched, GPT-4o-mini)
/api/score.js      — scores candidates per project (relevance to key question)
```

Edge functions (Supabase):
```
embed-input                  — generates pgvector embeddings for inputs
score-candidates             — scores candidates per project
generate-cluster-suggestions — LLM cluster name generation
compute-cluster-suggestions  — pgvector similarity clustering
find-related-inputs          — finds semantically related inputs for a cluster
check-scanner-health         — nightly diagnostics; emails admin digest
send-email                   — thin Resend wrapper used by health check
```

### Current source coverage

- **62 active sources** across all 8 domains (Technology & AI, Health & Life Sciences, Defence & Security, Media & Culture, Economy & Finance, Government & Policy, Climate & Energy, Education & Learning)
- **28 inactive sources** in the `sources` table — solid names (Brookings, CFR, RAND, IMF Blog, Stanford HAI, etc.) that were seeded but not yet enabled. Enable with:

  ```sql
  update sources set active = true where active = false;
  ```

  Worth checking the health report first — if any current sources are already flagged noisy, adding 28 more will increase scoring load.

### Scanner health check

- Runs nightly after scoring; emails `sam@aldermanandward.com`
- Email sent via `send-email` edge function (Resend), from `scanner@futuresignals.io`
- Reports: dead / degraded / noisy / healthy status per source; lowest promotion rates
- Only sends on issues or Mondays (all-clear weekly digest)

### Known recent issues resolved

- **Fierce Biotech** (and potentially other sources) were failing due to `rss-parser` sending a generic Node.js User-Agent that some publishers block. Fixed 2026-05-13 by adding a browser-compatible User-Agent to the parser. Should clear on the next scan run.
- **CRON_SECRET** must match between Vercel environment variables and the Supabase edge function secrets dashboard — both must have the same value for cron-triggered health checks to authenticate.

### Source removal policy (rule of thumb)

| Situation | Action |
|---|---|
| Never fetched + 3–5 consecutive failures | Cut — no history to lose |
| Previously healthy, dead < 2 weeks | Investigate — may be a temporary outage |
| Previously healthy, dead 2+ weeks | Cut or replace |
| Degraded / noisy | Monitor for 2 cycles before acting |

---

## Infrastructure notes

- **Vercel cron** (`vercel.json`): `/api/scan` runs at `0 2 * * *`
- **Supabase edge functions** are deployed with `--no-verify-jwt` where needed (health check, send-email)
- **`workspaces` table** uses `user_id` not `owner_id` — check this on any new RLS policy
- **pgvector** columns: do not use `.not('embedding', 'is', null)` via PostgREST — use a workaround
- **Vercel API routes** must be flat files under `api/` — dynamic route paths (e.g. `api/projects/[id]/action.js`) are not recognised by the Vite preset; use query params instead (e.g. `api/action.js?id=`)

---

## Environment variables

**Vercel (production):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `CRON_SECRET`
- `APP_URL` (= `https://future-signals-v2.vercel.app`)

**Supabase edge function secrets:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ADMIN_EMAIL`
- `CRON_SECRET` (must match Vercel value)
- `OPENAI_API_KEY`
- `UNSUBSCRIBE_SECRET`
- `APP_URL` (= `https://future-signals-v2.vercel.app`) — used to build unsubscribe URLs in digest emails

---

## What's deferred to v3

Do not scaffold or reference these in v2:
- Real-time collaboration
- Corpus ingestion
- Explore / social layer
- Slide deck generation (explicitly out of scope, not coming)

Preferred Futures, Strategic Options, and Scenario Narratives **are v2** — they live under Future Models.

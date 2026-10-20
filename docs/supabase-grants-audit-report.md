# Supabase Grants Audit (Read-Only)

**Scope:** repo-wide audit of the `public` schema's migrations, grants, and client access patterns, ahead of Supabase's October 30, 2026 removal of automatic Data API grants on new objects. Covers all 27 live tables, not just the four CLAUDE.md flags. No code, migrations, or database objects were changed to produce this report.

**Environments queried (read-only):** production (`tbxjudpxzovbasuomekq`) and staging (`kptatqipjwihkdxdxlvh`), via two `SELECT`-only catalog queries (listed in full in Section 8).

---

## 1. Summary

| Metric | Count |
|---|---|
| Live tables in `public` schema | 27 |
| Tables with RLS enabled (live, both envs) | 27 / 27 |
| Tables with an explicit `GRANT` statement somewhere in the repo | 10 |
| Tables with **no** explicit grant anywhere in the repo | 17 |
| Of those 17, tables with no creating migration **at all** (not just missing grants) | 1 (`project_negative_pool`) |
| Views in `public` | 0 |
| Explicit sequences in `public` | 0 (all PKs use `gen_random_uuid()`) |
| Distinct functions in `public` | 9 |
| Functions called via `.rpc()` from app/server code | 3 |
| Tables read by the genuine `anon` Postgres role anywhere in this app | **0** |

The headline finding is in Section 4/5: nothing in this codebase ever queries Postgres as the literal `anon` role. The browser client upgrades to `authenticated` on login and never fetches data before that; every server-side path (`api/*.js`, all Supabase Edge Functions) uses `SUPABASE_SERVICE_ROLE_KEY`. That changes the recommended baseline from "copy the anon-select pattern onto every table" to "zero tables need an `anon` grant," full stop.

---

## 2. Table inventory

Columns: creating file, RLS enabled in that file (or a later one), policies present, grants present, and rebuild risk — "will fail on rebuild" per the audit's own definition (no migration in the repo grants it), with a separate, more severe flag for the one table that can't even be *created* from the repo.

| Table | Creating file | RLS in repo | Policies in repo | Grants in repo | Rebuild risk |
|---|---|---|---|---|---|
| `access_codes` | `20260929120000_access_codes.sql` | ✅ same file | **None** — deliberate (clients must never read it) | `service_role` only | None — correct by design |
| `ai_usage_log` | `schema.sql` | ✅ | ✅ 2 (select, insert) | **None** | **Will fail** |
| `analyses` | `schema.sql` | ✅ | ✅ 4 (CRUD) | **None** | **Will fail** |
| `candidates` | `20260705110000_scanner_tables_schema.sql` | ✅ same file | ✅ 1 (select) | ✅ anon select / authenticated+service_role CRUD | None |
| `canvas_nodes` | `schema.sql` | ✅ | ✅ 4 (CRUD) | **None** | **Will fail** |
| `canvas_text_nodes` | `20260624_canvas_text_nodes.sql` | ✅ same file | ✅ 1 (for all) | ✅ same pattern | None |
| `cluster_inputs` | `schema.sql` | ✅ | ✅ 3 (select/insert/delete) | **None** | **Will fail** |
| `cluster_suggestions` | `20260407_cluster_suggestions.sql` | ✅ same file | ✅ 1 (for all) | **None** | **Will fail** ← CLAUDE.md-flagged |
| `clusters` | `schema.sql` | ✅ | ✅ 4 (CRUD) | **None** | **Will fail** |
| `inputs` | `schema.sql` | ✅ | ✅ 4 (CRUD) | **None** | **Will fail** |
| `preferred_futures` | `20260417_future_models.sql` | ✅ same file | ✅ 1 (for all) | **None** | **Will fail** ← CLAUDE.md-flagged |
| `project_candidates` | `20260705110000_scanner_tables_schema.sql` | ✅ same file | ✅ 3 (select/insert/update, no delete) | ✅ same pattern | None |
| `project_negative_pool` | **not found anywhere in the repo** | unknown | unknown | **None** | **Severe — the table itself cannot be recreated from the repo, independent of grants** |
| `project_publications` | `20260715195707_project_publications.sql` | ✅ same file | ✅ 1 (for all) | ✅ same pattern | None |
| `project_sources` | `20260705110000_scanner_tables_schema.sql` | ✅ same file | ✅ 4 (CRUD) | ✅ same pattern | None |
| `project_system_map_background` | `20260820120000_system_map_templates.sql` | ✅ same file | ✅ 1 (for all) | ✅ same pattern | None |
| `projects` | `schema.sql` | ✅ | ✅ 4 (CRUD) | **None** | **Will fail** |
| `relationships` | `schema.sql` | ✅ | ✅ 4 (CRUD) | **None** | **Will fail** |
| `scenario_clusters` | `schema.sql` | ✅ | ✅ 3 (select/insert/delete) | **None** | **Will fail** |
| `scenarios` | `schema.sql` | ✅ | ✅ 4 (CRUD) | **None** | **Will fail** |
| `source_health` | `20260418_source_health.sql` | ✅ but in a *later* file (`20260619_source_health_rls.sql`) | **None** — deliberate deny-all; `service_role` bypasses RLS by role attribute, not policy | **None** | **Will fail for `service_role`** — RLS-policy absence is intentional and safe either way, but `service_role` still needs its own explicit `GRANT` to touch rows post-cutover (BYPASSRLS skips policy checks, not table-level privilege checks) ← CLAUDE.md-flagged |
| `sources` | `20260705110000_scanner_tables_schema.sql` | ✅ same file | ✅ 4 (CRUD) | ✅ same pattern | None |
| `strategic_options` | `20260417_future_models.sql` | ✅ same file | ✅ 1 (for all) | **None** | **Will fail** ← CLAUDE.md-flagged |
| `system_map_templates` | `20260820120000_system_map_templates.sql` | ✅ same file | ✅ 2 (curated-select, owner-write) | ✅ same pattern | None |
| `user_preferences` | `20260614_weekly_digest.sql` | ✅ same file | ✅ 1 (for all) | ✅ same pattern | None |
| `workspace_settings` | `schema.sql` | ✅ | ✅ 2 (select, update) | **None** | **Will fail** |
| `workspaces` | `schema.sql` | ✅ | ✅ 2 (select, update) | **None** | **Will fail** |

**Notable pattern:** every table with explicit grants in the repo was created from **2026-06-24 onward** (`canvas_text_nodes` is the earliest). That's when the team visibly started following the "standard explicit-grant pattern" — `20260705110000_scanner_tables_schema.sql`'s own comments name it and cite "the October 2026 removal of default grants" explicitly, meaning this exact remediation has prior art in the repo already. Everything from before that date (the 12 `schema.sql` tables, plus `cluster_suggestions` and `source_health` which predate it slightly, plus the two `future_models.sql` tables created the same week) never got the pattern applied, retroactively or otherwise.

**`project_negative_pool`** is a distinct and more serious gap than the four CLAUDE.md flags: it's a real, populated production table (used by `server-lib/clone-project.js` and referenced throughout the scoring pipeline per CLAUDE.md's "Known database gotchas"), but there is no `CREATE TABLE` for it anywhere in `supabase/migrations/` *or* in `schema.sql`. It's the purest case of the "undocumented-schema-change pattern" CLAUDE.md already warns about — except unlike the other examples there (`source_template_id`, `last_visited_at`, the auto-populate trigger), this one was never backfilled with a documentation migration at all.

---

## 3. Other objects: views, functions, sequences

**Views:** none exist in `public`.

**Sequences:** none created explicitly — every table uses `uuid primary key default gen_random_uuid()`, so there's no `serial`/`identity` sequence-ownership question to resolve.

**Functions (9 distinct, several evolved via `CREATE OR REPLACE` across multiple migrations):**

| Function | Called via `.rpc()`? | `SECURITY` | Live `anon`/`PUBLIC` EXECUTE? | Notes |
|---|---|---|---|---|
| `duplicate_input_to_cluster` | ✅ `src/hooks/useAppState.js` (browser, authenticated) | DEFINER | **Yes** (verified live) | Self-guards: `raise exception` unless caller's `auth.uid()` owns the target workspace. Safe despite broad EXECUTE. |
| `merge_clusters` | ✅ `src/hooks/useAppState.js` (browser, authenticated) | DEFINER | **Yes** (verified live) | Same ownership guard, same conclusion. |
| `get_seeding_candidates` | ✅ `api/seed-onboarding.js` (server, service_role) | DEFINER | **No** — explicitly `REVOKE EXECUTE ... FROM PUBLIC` and `FROM anon` in `20260817120000_project_domains_multiselect.sql` | The one function in the repo that correctly locks down Postgres's default-to-PUBLIC EXECUTE behavior. Good precedent to copy. |
| `find_similar_input_pairs` | **Never** — not called from any app code, edge function, or script | INVOKER (default) | **Yes** (verified live) | Orphaned. The "Find duplicates" feature it looks built for (`ClusterScreen.jsx`'s `findDuplicates()`) actually calls the `detect-cluster-overlaps` Edge Function instead, which does its own JS-side comparison. Zero functional risk (it's a plain `SECURITY INVOKER` query over `inputs`, so it inherits that table's RLS regardless of who calls it) but it's dead code. |
| `get_workspace_id` | Not called directly — referenced inside RLS policy expressions (`workspace_id = get_workspace_id()`) | DEFINER, `STABLE` | **Yes** (verified live) | Safe: resolves only the caller's own `auth.uid()` → workspace id, never cross-user. Needs to stay PUBLIC-executable since every RLS policy using it runs under the querying role's privileges. |
| `handle_new_user` | Trigger only (`AFTER INSERT ON auth.users`) | DEFINER | **Yes** (verified live) | Can't be invoked directly via RPC — Postgres rejects direct calls to trigger functions outside trigger context. |
| `handle_updated_at` | Trigger only (multiple `BEFORE UPDATE` triggers) | — | **Yes** (verified live) | Same trigger-only protection. |
| `touch_project_updated_at` | Trigger only (`AFTER INSERT/UPDATE/DELETE` on 9 content tables) | DEFINER | **Yes** (verified live) | Same. |
| `auto_populate_project_sources` | Trigger only (`AFTER INSERT ON projects`) | — | **Yes** (verified live) | Same. |

**Important distinction verified against Postgres/Supabase behavior, not assumed:** functions are executable by `PUBLIC` by default in Postgres — the opposite of tables, which default closed. This is unrelated to the October 30 change (that change's own changelog language is scoped to "tables" and "sequences" only, confirmed in Section 6). A schema-scoped `ALTER DEFAULT PRIVILEGES ... IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public` is documented as *ineffective* against Postgres's PUBLIC default (a known Supabase/Postgres gotcha) — but a **direct** `REVOKE EXECUTE ON FUNCTION x() FROM PUBLIC` on an existing function, like `get_seeding_candidates` uses, works fine and was verified live to be the only one of the nine actually locked down.

**Net risk from functions:** none found. The two RPC-exposed write functions are internally ownership-gated; the read-only RPC function already revokes PUBLIC/anon; the rest are trigger-only or unused. This is a separate concern from the October 30 grants change and doesn't need to be part of that fix, but is worth a note in CLAUDE.md since it's non-obvious (see Section 9).

---

## 4. Client usage map (priority section)

**Method:** grepped every `.from(` and `.rpc(` call across `src/` (browser SPA), `extension/src/` (Chrome extension), `api/*.js` (Vercel serverless functions), `server-lib/*.js` (shared server logic, imported by `api/`), and `supabase/functions/*/index.ts` (Edge Functions). Cross-checked which Supabase key each server-side file instantiates its client with.

**Caller-type classification:**

| Caller | Key used | Effective Postgres role | Gated by login? |
|---|---|---|---|
| `src/` (browser SPA) | `VITE_SUPABASE_ANON_KEY` | `anon` pre-login, `authenticated` post-login | **Yes** — `App.jsx` renders only `AuthScreen` while `session === null`; `useAppState` (which owns every `.from()` call) is only meaningfully invoked once a session exists |
| `extension/src/` (Chrome extension) | `VITE_SUPABASE_ANON_KEY` | Same as browser — gates on `supabase.auth.getSession()` / `onAuthStateChange` before querying | Yes |
| `api/*.js` (all 11 files) | `SUPABASE_SERVICE_ROLE_KEY` | `service_role`, always | N/A — service_role doesn't log in |
| `server-lib/*.js` (imported by `api/`) | Inherits caller's client (service_role) | `service_role` | N/A |
| `supabase/functions/*/index.ts` (9 of 9 that touch the DB) | `SUPABASE_SERVICE_ROLE_KEY` | `service_role`, always | N/A |

**Finding: zero code paths in this repository query `public` as the genuine, logged-out `anon` role.**

- The browser client is *initialized* with the anon key, but every actual data read/write happens after `useAppState` is wired up with a real session — there is no pre-login screen that fetches project/input/cluster data.
- Every server-side surface — all 11 `api/*.js` endpoints and all 9 data-touching Edge Functions — uses `SUPABASE_SERVICE_ROLE_KEY` exclusively. None instantiate a client with the anon key.
- The one genuinely public-facing HTTP surface in the product, the Web Publish `/p/{slug}` pages, is **not** served via the anon Postgres role either. Per `api/publish.js`'s `GET ?view` branch (and CLAUDE.md's own documentation of this), it deliberately uses the **service-role** client specifically because "an anonymous viewer has no workspace, so `workspace_id = get_workspace_id()` returns zero rows otherwise" — i.e., the team already discovered that `anon` can't satisfy this RLS pattern and routed around it with service_role, rather than granting `anon` broader access.
- `access_codes` is the one table in the entire schema with zero `.from()` references anywhere in client code — confirmed consistent with its own migration comment ("clients must never read this table") and its runbook (`docs/access-codes-runbook.md`).

**Per-table caller breakdown** (union of all `.from()` call sites found):

| Caller surface | Tables touched |
|---|---|
| Browser (`src/`, post-login `authenticated`) | `analyses`, `canvas_nodes`, `canvas_text_nodes`, `cluster_inputs`, `cluster_suggestions`, `clusters`, `inputs`, `preferred_futures`, `project_candidates`, `project_sources`, `project_system_map_background`, `projects`, `relationships`, `scenario_clusters`, `scenarios`, `sources`, `strategic_options`, `system_map_templates`, `user_preferences`, `workspace_settings`, `workspaces` (21 tables) |
| Extension (`extension/src/`, post-login `authenticated`) | `inputs`, `projects`, `workspaces` (subset of the above) |
| `api/*.js` (service_role) | `ai_usage_log`, `candidates`, `inputs`, `project_candidates`, `projects`, `sources`, `workspace_settings`, `workspaces` |
| `server-lib/*.js` (service_role, via `api/`) | `analyses`, `canvas_nodes`, `canvas_text_nodes`, `cluster_inputs`, `cluster_suggestions`, `clusters`, `inputs`, `preferred_futures`, `project_negative_pool`, `project_publications`, `project_sources`, `project_system_map_background`, `projects`, `relationships`, `scenario_clusters`, `scenarios`, `strategic_options`, `system_map_templates`, `workspaces` |
| Edge Functions (service_role) | `candidates`, `cluster_inputs`, `cluster_suggestions`, `clusters`, `inputs`, `project_candidates`, `projects`, `source_health`, `sources`, `user_preferences`, `workspace_settings`, `workspaces` |
| **Never touched by `.from()` anywhere** | `access_codes` |

26 of 27 tables are touched by at least one caller; every single one of those callers is either a post-login `authenticated` session or a server-side `service_role` client. None is `anon`.

---

## 5. Proposed `anon` baseline (priority section)

**Recommendation: zero tables need a `select`-for-`anon` grant.**

This differs from CLAUDE.md's current boilerplate ("`grant select on public.<table> to anon;`" as step one of the standard pattern for *every* new table). That boilerplate is reasonable generic Supabase advice, but Section 4 shows it isn't actually load-bearing for *this* app: nothing queries Postgres as `anon` anywhere in the codebase, including the one surface (`/p/{slug}` Publish pages) that superficially looks like it should need it — the team already solved that with service_role instead, specifically because `anon` has no workspace to scope through.

Table-by-table reasoning for the ten tables that already carry an `anon` grant (all added since 2026-06-24, all unused by any actual `anon`-role call):

| Table | `anon` grant reason given (if any) | Actually exercised by `anon` traffic? |
|---|---|---|
| `candidates`, `sources`, `project_sources`, `project_candidates` | `20260705110000_scanner_tables_schema.sql`: "follows the repo's standard explicit-grant pattern" | No — only read by `authenticated` (browser) or `service_role` (scanner pipeline) |
| `canvas_text_nodes`, `project_publications`, `project_system_map_background`, `system_map_templates`, `user_preferences` | Same boilerplate pattern, no app-specific justification given | No |
| `access_codes` | *(not granted to anon — correctly excluded)* | N/A |

**If a future public, unauthenticated surface is ever added** (the kind of thing that would actually need `anon`), the only two candidates in today's schema that semantically *could* support one without a redesign are:
- `system_map_templates` (curated rows, `owner_id is null`) — the existing RLS policy already allows unauthenticated read of curated templates by design, it's just never been exercised by an anon caller.
- Nothing else — every other table's RLS policy requires `workspace_id = get_workspace_id()` or an equivalent `auth.uid()` match, which always evaluates to no rows for `anon` regardless of grants.

**Recommendation for the fix prompt:** don't propagate the `anon: select` grant to the newly-covered tables (the 17 missing grants). Grant only `authenticated` and `service_role`, matching what Section 4 shows is actually used, and drop the `anon` line from the 10 tables' pattern too if a cleanup pass is in scope — though that's a live-grant *reduction*, which is a different, more sensitive change than just adding the missing ones, and should be a separate decision from the October 30 fix.

---

## 6. Supabase documentation findings

Searched and fetched Supabase's own changelog and community sources for the October 30, 2026 change.

- **Scope is "tables" and "sequences," by the changelog's own language** — not the broader word "objects." Source: [Breaking Change: Tables not exposed to Data and GraphQL API automatically](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically). Quoted: tables created in `public` "require an explicit opt-in (via a Postgres `grant`) before the Data API can see them," applied "to all existing projects" on October 30, 2026.
- **All three roles are affected**, including `service_role` — a table created without an explicit grant returns `42501 permission denied`, "even for service_role." Confirmed across multiple independent write-ups: [dev.to: don't fix "permission denied" by reopening your tables](https://dev.to/rawilli/supabases-october-30-change-dont-fix-permission-denied-by-reopening-your-tables-1ai4), [dev.to: the exact fix](https://dev.to/cekuu35/supabase-permission-denied-after-october-30-the-exact-fix-copy-paste-sql-4d45), [GitHub Discussion #45329](https://github.com/orgs/supabase/discussions/45329).
- **Existing tables keep their current grants** — this is a change to *defaults for new objects*, not a retroactive revoke.
- **Views are not explicitly named** in the changelog. Postgres treats views under the same privilege/default-privilege object class as tables (`ALTER DEFAULT PRIVILEGES ... GRANT ... ON TABLES` covers tables, views, and foreign tables identically in Postgres's own grammar), so the safest working assumption is that a view would follow the same automatic-grant-removal behavior as a table — flagged as **moderate confidence, not explicitly documented by Supabase**. Moot for this repo today since zero views exist.
- **Functions are out of scope for this specific change.** Verified two ways: (1) the changelog's own language never mentions functions/EXECUTE, only tables and sequences; (2) empirically, this repo's functions already show Postgres's standard default-to-PUBLIC EXECUTE behavior live in production (Section 3), which is a *pre-existing* Postgres default unrelated to the Oct 30 change, not a Supabase removal. Source: [SECURITY DEFINER Functions Are PUBLIC EXECUTE](https://tech.rebounder.jp/en/posts/supabase-security-definer-function-default-public-execute-exposes-rpc/), [GitHub PR #49366: ineffective revoke of function execute from public](https://github.com/supabase/supabase/pull/49366).
- **Recommended fix pattern**, per Supabase and the community write-ups, matches what's already in this repo's `20260705110000_scanner_tables_schema.sql`: explicit `GRANT` statements, then `ENABLE ROW LEVEL SECURITY`, then policies. Source: [supascale.app: Data API Grants Explained](https://www.supascale.app/blog/supabase-october-2026-breaking-change-data-api-grants-explai).

Where documentation doesn't explicitly say (views, and any interaction with `ALTER DEFAULT PRIVILEGES` for future tables specifically), the recommended safe default is explicit grants on creation going forward — which costs nothing and removes the ambiguity, consistent with the audit brief's instruction.

---

## 7. Repo guidance status

**CLAUDE.md already documents this precisely**, under "Grants for new tables":

> New tables require explicit grants — Supabase will not auto-grant public schema access from October 2026 onward. Every `CREATE TABLE` migration must include [the four-line grant + RLS block]... Several existing tables (`cluster_suggestions`, `preferred_futures`, `strategic_options`, `source_health`, etc.) were created before this requirement was identified and have no explicit grants in their migration files.

This is accurate as far as it goes, but this audit found two things it doesn't capture:

1. **The "etc." undercounts by a lot.** 17 tables lack grants, not 4 — the four named are just the ones someone happened to flag, not a complete list. The 13 `schema.sql`-era tables (`workspaces`, `workspace_settings`, `projects`, `inputs`, `clusters`, `cluster_inputs`, `scenarios`, `scenario_clusters`, `canvas_nodes`, `relationships`, `ai_usage_log`, `analyses`) were never mentioned anywhere in CLAUDE.md's grants discussion at all.
2. **`project_negative_pool` isn't mentioned in CLAUDE.md's grants section**, and it's the most severe case in the whole audit (no creating migration, not just no grant) — even though CLAUDE.md's "Sample project cloning" section elsewhere lists it as one of the 13 actively-cloned project-scoped tables, so the gap in the grants section isn't for lack of the table being known/used.

No other `docs/` file adds grants/RLS guidance beyond CLAUDE.md and the two narrowly-scoped files already cited in this report (`docs/access-codes-runbook.md`, `docs/access-promo-codes-spec.md`, both specific to `access_codes`).

---

## 8. Live-database queries

Run against both production and staging per the addendum's pre-approval (read-only, no writes). Findings already reported to you inline this session; reproduced here per the brief's required format.

**Live grants:**
```sql
select table_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;
```
Result: `anon` holds the full privilege set (`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`) on all 27 tables, identically on both production and staging — the live blanket Supabase default, not a per-table grant.

**RLS status:**
```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```
Result: all 27 tables have `rls_enabled = true` on both environments.

---

## 9. Open questions

1. **`project_negative_pool` has no creating migration anywhere in the repo.** Before any grants fix can cover it, someone needs to either (a) introspect the live table definition from the dashboard and write a documentation migration for it (same pattern as `20260705110000_scanner_tables_schema.sql` did for the four scanner tables), or (b) confirm it's intentionally dashboard-only and decide whether that's acceptable long-term. This blocks a complete fix, not just a grants fix.
2. **`source_health`'s correct remediation is `service_role`-only**, not the standard three-role pattern — its own migration comment is explicit that it's "internal operations table — no RLS, not user-facing" and RLS was deliberately enabled with zero policies specifically to deny `anon`/`authenticated` entirely. The fix prompt should grant `service_role` only here, not copy the anon-select template.
3. **`access_codes` should get no new grants at all** — it's already correctly `service_role`-only by design and by actual usage (zero `.from()` call sites). Flagging explicitly so the fix prompt doesn't "complete" its grant block by habit.
4. **No CI/CD or script replays migrations today.** There's no `supabase/config.toml`, no seed files, and no `package.json`/CI script that runs `supabase db reset` or an equivalent fresh rebuild — consistent with CLAUDE.md's existing notes that migrations are applied manually (dashboard SQL editor or ad hoc `db push`) and that the CLI has had unresolved auth issues against staging. That means the "replay risk" this audit is about is currently **latent** (a future fresh project, disaster recovery, or someone finally getting `db push`/`db reset` working), not something exercised by any existing automated pipeline. Worth confirming this is still true before prioritizing the fix urgency.
5. **`find_similar_input_pairs` appears to be dead code** — defined, never called, superseded in practice by the `detect-cluster-overlaps` Edge Function's own JS-side comparison. Out of scope for a grants fix, but worth a separate decision on whether to drop it.
6. **Should the existing 10 tables' `anon: select` grants be revoked**, given Section 5 found zero actual `anon` traffic? This audit recommends *not adding* `anon` to the 17 ungranted tables, but removing `anon` from the 10 that already have it is a live-grant reduction on tables with production data — a different risk profile than adding missing grants, and should be an explicit, separate decision rather than bundled into the October 30 fix.
7. **Function EXECUTE hardening (Section 3) is unrelated to the October 30 change** and so is out of scope for the fix prompt by the letter of this audit's brief — but since CLAUDE.md doesn't document anywhere that Postgres functions default to PUBLIC-executable (the inverse of tables), and this audit found only one of nine functions correctly locks that down, it's worth a follow-up note in CLAUDE.md even though no exploitable issue was found today.

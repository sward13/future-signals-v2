# `get_user_workspace_id()` Documentation Migration — Closeout

Companion to `supabase/migrations/20260905195000_document_get_user_workspace_id.sql` and the one-line CLAUDE.md update, both written per `docs/supabase-grants-audit-report.md` and `docs/project-negative-pool-migration-closeout.md`'s finding that this function has no creating migration anywhere in the repo.

---

## 1. Differences between production and staging

**None.** Compared via `pg_get_functiondef`, owner, language, volatility, `SECURITY DEFINER`/`INVOKER`, `proconfig`, argument/return types, `proacl`, and the function comment — identical on both `tbxjudpxzovbasuomekq` (production) and `kptatqipjwihkdxdxlvh` (staging):

- **Definition:** `LANGUAGE sql STABLE SECURITY DEFINER`, body `select id from workspaces where user_id = auth.uid()`
- **Owner:** `postgres`
- **`proconfig`:** `null` — no `search_path` set at all, on either environment
- **Arguments:** none; **Return type:** `uuid`
- **`proacl`:** `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` on both
- **Comment:** `null` on both

## 2. Dependents: policies, objects, and repo references

**Policies** (via `pg_policies`, cross-checked against `pg_depend`, identical set on both environments — 22 policies across 7 tables):

| Table | Policies referencing the function |
|---|---|
| `ai_usage_log` | `ai_usage_log_select` (1) |
| `clusters` | `clusters_delete`, `clusters_insert`, `clusters_select`, `clusters_update` (4) |
| `cluster_inputs` | `cluster_inputs_delete`, `cluster_inputs_insert`, `cluster_inputs_select` (3 — no update policy, matching the table's general CRUD shape elsewhere in the schema) |
| `inputs` | `inputs_delete`, `inputs_insert`, `inputs_select`, `inputs_update` (4) |
| `projects` | `projects_delete`, `projects_insert`, `projects_select`, `projects_update` (4) |
| `scenarios` | `scenarios_delete`, `scenarios_insert`, `scenarios_select`, `scenarios_update` (4) |
| `workspace_settings` | `workspace_settings_select`, `workspace_settings_update` (2) |

**This is a materially bigger dependent list than the task description's framing ("live RLS policies on two tables") or CLAUDE.md's prior note ("no usages in any tracked migration") suggested** — flagging the discrepancy rather than quietly matching the smaller number. Likely origin of the undercount: an earlier closeout in this same chain of work (`docs/project-negative-pool-migration-closeout.md`, Open question #1) only traced the function as far as the one migration that first failed a replay because of it (`20260905200000_rls_fk_validation_batch1.sql`), and that migration's own header comment only names `analyses`/`scenarios` as using "`get_user_workspace_id()`" — but on inspection, `analyses`'s actual live policy uses the inline `workspace_id in (select id from workspaces where user_id = auth.uid())` form, not the function call. `scenarios` is the only one of that migration's five tables that genuinely calls the function. The other six dependent tables (`ai_usage_log`, `clusters`, `cluster_inputs`, `inputs`, `projects`, `workspace_settings`) were never traced before this pass.

**`pg_depend`** (`refobjid` = this function's oid, `deptype in ('n','a')`): returns exactly the same 22 `pg_policy` rows as above, on production. No other object type depends on it — no triggers, views, or other functions reference it anywhere in `pg_depend`.

**Repo references** (`grep -rn "get_user_workspace_id" supabase/migrations/*.sql schema.sql`):

| File | Nature of reference |
|---|---|
| `20260705_ai_usage_log_insert_service_role.sql` | **Comment only** — notes "the live insert policy's WITH CHECK references `get_user_workspace_id()`, while `schema.sql` records `get_workspace_id()` — a pre-existing drift," then drops that policy (replacing it with a `service_role`-only one that doesn't call the function at all). Proves the function was already live, and already diverged from `schema.sql`'s pattern, by 2026-07-05 — earlier than the Sept-05 migrations below. Does **not** execute a reference to the function (a comment can't fail a replay), so it doesn't constrain this migration's placement. |
| `20260905200000_rls_fk_validation_batch1.sql` | **Executable** — `scenarios`'s four policies (the only one of this file's five covered tables that uses the function; `analyses`, `preferred_futures`, `strategic_options` use the inline form or `get_workspace_id()` instead, per that file's own header comment). **Earliest executable reference — this is what sets the new migration's required position.** |
| `20260905210000_rls_fk_validation_clusters.sql` | Executable — `clusters`'s four policies. |
| `20260905220000_rls_fk_validation_inputs.sql` | Executable — `inputs`'s four policies. |
| `20260905230000_rls_fk_validation_junction_tables.sql` | Executable — `cluster_inputs`'s three policies (this file also creates `scenario_clusters`'s policies, which use `get_workspace_id()`, not this function). |

**Three of the seven dependent tables' current policies have no migration at all documenting their use of this function** — `ai_usage_log_select`, and all of `projects`' and `workspace_settings`' policies. None of the four files above touch those three tables, and `schema.sql` records all three using `get_workspace_id()`, not `get_user_workspace_id()`. Their live policies were switched to this function at some undocumented point — consistent with the same "undocumented-schema-change pattern" CLAUDE.md already tracks elsewhere, just not previously known to apply here. Not fixed in this migration (out of scope — this prompt documents the function, not the policies that call it) but flagged under Open Questions.

## 3. Timestamp rationale

The function's own body depends only on `workspaces` (created in `schema.sql`, available from the very start of any replay) and the built-in `auth.uid()` — no ordering constraint from that side.

The constraining side is the earliest **executable** reference: `20260905200000_rls_fk_validation_batch1.sql`. (The `20260705` file was excluded from this calculation — see Section 2 — since a comment mentioning the function's name doesn't fail a replay the way an actual `CREATE POLICY ... USING (... get_user_workspace_id() ...)` would.)

Named `supabase/migrations/20260905195000_document_get_user_workspace_id.sql` — sorts after `20260905190000_remove_unnecessary_authenticated_policies.sql` (confirmed to not reference the function) and before `20260905200000_rls_fk_validation_batch1.sql`, in the repo's full `YYYYMMDDHHMMSS` timestamp format.

## 4. Replay result and remaining stubs

Rebuilt the Docker replay used in the two prior closeouts (Supabase Postgres base image, `schema.sql` first, then every migration in chronological order) — this time **without** the `get_user_workspace_id()` stub, since the new migration should supply it in its correct position. The replay still needs:

1. **`storage.buckets`/`storage.objects` stub** — unrelated to this function; the storage-api service's own tables, needed for two unrelated bucket migrations (Publish, System Map templates).
2. **`20260705110000_scanner_tables_schema.sql` reordered immediately after `schema.sql`** — unrelated to this function; resolves `source_health`'s and `get_seeding_candidates`'s real dependencies on `sources`/`candidates`, both already documented in `docs/project-negative-pool-migration-closeout.md`.

**The `get_user_workspace_id()` stub is gone — confirmed by its absence causing no error.** The replay applied cleanly end to end (`psql` exit code 0, zero errors), including straight through `20260905200000_rls_fk_validation_batch1.sql` and its three siblings.

**Function comparison, replay vs. live:** `pg_get_functiondef()` text matches **exactly** — `md5(pg_get_functiondef(...))` is `ec144a2c14830b68a64bb5002ded01bb` on both the replay and live production. Volatility (`STABLE`), `SECURITY DEFINER`, and `proconfig` (empty/null on both) also match. **Owner and `proacl` grantor differ** (`supabase_admin` in the replay vs. `postgres` live) — this is an artifact of the verification method, not the migration file: the replay had to run as `supabase_admin` (the only superuser-equivalent role in the bare Postgres image) to get past an unrelated permissions issue creating the `storage.*` stub tables, documented in the `project_negative_pool` closeout. The *set* of grantees in `proacl` (`PUBLIC`, `postgres`, `anon`, `authenticated`, `service_role`) is identical either way — only the grantor label differs, which has no bearing on what the migration file itself produces when run through Supabase's real migration pipeline (which executes as `postgres`, matching live).

## 5. Open questions

1. **`projects`, `workspace_settings`, and `ai_usage_log_select`'s use of this function has no migration anywhere.** This documentation migration captures the function itself, not these three tables' policies. If a from-scratch replay is ever done against a database that *doesn't* already have these three tables' policies pre-existing (i.e., a true `schema.sql`-plus-migrations-only rebuild), the replay would get `schema.sql`'s original `get_workspace_id()`-based policies for `projects`/`workspace_settings`, not the live `get_user_workspace_id()`-based ones — a real (if low-stakes, since the two functions are logically equivalent) drift between a fresh rebuild and the live database. A follow-up documentation migration for these three tables' current policies, matching this prompt's pattern, is still open.
2. **Why two near-identical functions exist at all** (`get_workspace_id()` vs. `get_user_workspace_id()`) is still unknown — nothing in the repo or the live database (no comment on either function) explains the original reason for creating a second one rather than reusing the first. Both resolve `auth.uid()` to the caller's workspace id via the same one-line query; the only functional difference is `get_workspace_id()`'s `set search_path = public` and `limit 1` (the live `get_user_workspace_id()` has neither, confirmed in Section 1). This migration intentionally does not reconcile the two — doing so would change live behavior, which is out of scope here — but it is a plausible future cleanup if someone can confirm it's safe.

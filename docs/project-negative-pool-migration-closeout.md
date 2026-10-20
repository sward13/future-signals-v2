# `project_negative_pool` Documentation Migration — Closeout

Companion to `supabase/migrations/20261020120000_document_project_negative_pool.sql`, written per the Supabase grants audit's finding that `project_negative_pool` exists live on both environments with no creating migration anywhere in the repo.

---

## 1. Differences found between production and staging

**None.** Columns (names, types, defaults, nullability), constraints (PK, FK with `ON DELETE CASCADE`, `UNIQUE(project_id)`), indexes, RLS-enabled status, policies (`project_negative_pool_select`, `project_negative_pool_update` — identical `USING` clauses on both), and triggers (zero on both) are byte-identical between production (`tbxjudpxzovbasuomekq`) and staging (`kptatqipjwihkdxdxlvh`), confirmed via direct read-only introspection (`information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_trigger`) on both. No table or column comments exist on either. The migration was written once, against this single shared definition.

Also cross-checked against two independent sources that happened to already describe this table, neither of which was treated as ground truth but both of which corroborate the live introspection exactly: the generated `src/types/database.types.ts` (`project_negative_pool` entry, `isOneToOne: true`), and a human-written description already in `docs/database-schema-reference.md` ("A per-project cache of what this project's practitioner has already rejected... One row per project. Not read or written by the live scoring path... Referenced only by `clone-project.js`").

## 2. Dependency tables and their creating migrations

The table has exactly one foreign key: `project_id → projects(id) ON DELETE CASCADE`.

| Referenced table | Creating migration |
|---|---|
| `projects` | **None** — `schema.sql` only |

**Flagged per the brief's instruction:** `projects` is not created by any file in `supabase/migrations/`. It's one of the twelve `schema.sql`-era tables already identified in the grants audit (`docs/supabase-grants-audit-report.md`, Section 2) — applied manually via the Supabase SQL Editor, not through the migrations pipeline. This means a migrations-only replay can't satisfy `project_negative_pool`'s own foreign key regardless of this file; `schema.sql` has to run first either way. That gap is pre-existing, out of scope for this prompt (which explicitly excludes touching `schema.sql`), and already tracked in the grants audit. New migration sorts correctly after `projects`' only possible source (`schema.sql`) by virtue of its very-late timestamp.

## 3. Verification result

**`supabase db reset` (as specified) could not run as-is:** there is no `supabase/config.toml` in this repo (confirmed — matches the grants audit's note that migrations are applied manually, not through the CLI). `supabase db reset --local` fails immediately (`supabase start is not running`), and `supabase start` itself fails partway through, because it tries to apply `supabase/migrations/` **alone**, starting from `20260407_cluster_suggestions.sql`, which references `inputs` — a table that, like `projects`, only exists in `schema.sql`. The CLI has no way to know to apply `schema.sql` first; it isn't part of its migrations directory.

**Built a working local verification instead**, since Docker and the Supabase CLI were both available: a standalone container from the same base image the CLI uses (`public.ecr.aws/supabase/postgres:17.6.1.155`, chosen because it ships `pgvector`, the `auth` schema, and `auth.uid()` — a plain `postgres:17` image would have been missing all three), with `schema.sql` applied first via `psql`, then every file in `supabase/migrations/` in chronological order, concatenated into one script and run through a single `psql` session as the `supabase_admin` role (the only role in this image with superuser-equivalent privileges across all Supabase-internal schemas; `postgres` itself is deliberately non-superuser here and lacked privileges on the `storage` schema).

**Getting a clean replay required three local-only workarounds, none of which touched any repo file:**

1. **`storage.buckets`/`storage.objects` don't exist** on a bare `postgres` container — those tables are created by the separate storage-api service's own bootstrap, which a plain `docker run` of the Postgres image doesn't include. Stubbed minimally (bare `id`/`name`/`public` and `id`/`bucket_id`/`name`) so the two storage-bucket migrations (Publish, System Map templates) could insert/policy against something. Unrelated to `project_negative_pool`.
2. **`source_health` (2026-04-18) references `sources`, which isn't created until `20260705110000_scanner_tables_schema.sql`.** Reordered that scanner-tables file to run immediately after `schema.sql`, which also happens to be true of the real history — those four scanner tables predate the migrations directory and existed live long before any migration file referenced them (confirmed by that file's own header comment). Not a defect introduced here.
3. **`get_user_workspace_id()` is called by `20260905200000_rls_fk_validation_batch1.sql` but is never created anywhere in the repo.** This is a second, independently-confirmed instance of the exact gap this prompt exists to fix for `project_negative_pool` — and it corroborates, more strongly than before, CLAUDE.md's existing note that this function "exists in the database but has no usages in any tracked migration": it turns out it *is* referenced (by this one migration), just never defined. Stubbed locally as a functional duplicate of `get_workspace_id()` purely to let the replay continue — **this stub is not a recommendation for the real fix**, just what was needed to reach `project_negative_pool`'s migration intact. See Open Questions.

**With those three local-only stubs in place, the full concatenated replay — `schema.sql` → all 61 migration files (reordered as above) → `20261020120000_document_project_negative_pool.sql` — applied cleanly end to end, `psql` exit code 0.**

Rebuilt `project_negative_pool` compared against the live listing from Section 1:

| | Live (prod/staging) | Rebuilt locally | Match |
|---|---|---|---|
| Columns (name/type/default/nullable) | `id uuid`, `project_id uuid NOT NULL`, `centroid_embedding vector(1536)`, `count integer DEFAULT 0`, `recomputed_at timestamptz DEFAULT now()` | identical | ✅ |
| Constraints | PK on `id`, FK `project_id → projects(id) ON DELETE CASCADE`, `UNIQUE(project_id)` | identical | ✅ |
| Indexes | `project_negative_pool_pkey`, `project_negative_pool_project_id_key` | identical | ✅ |
| RLS enabled | `true` | `true` | ✅ |
| Policies | `project_negative_pool_select` (SELECT), `project_negative_pool_update` (UPDATE), both `roles={public}`, identical `USING` clause | identical (cosmetic-only: displays as `uid()` vs `auth.uid()` — same function, just how `pg_policies` renders it under `search_path`) | ✅ |
| Triggers | none | none | ✅ |

No differences found.

## 4. Open questions

1. **`get_user_workspace_id()` has no creating migration and is now confirmed to be actually in use** (by `20260905200000_rls_fk_validation_batch1.sql`, for `analyses`/`scenarios` policies), not just a dormant leftover as CLAUDE.md's current wording suggests. This is the same category of gap as `project_negative_pool` itself, applied to a function instead of a table, and arguably higher priority since it's load-bearing for existing RLS policies on two tables rather than one dormant one. Recommend a follow-up documentation migration for it, same pattern as this one. Not written here — out of scope for a prompt specifically about `project_negative_pool`, and doing it well means introspecting the live function body/grants first, same as was done here.
2. **`projects` (and the other eleven `schema.sql`-era tables) still have no migration-file equivalent of `schema.sql` itself.** This was already flagged in the grants audit and isn't new, but this verification is now direct, empirical proof that a migrations-only replay fails at the very first file for exactly that reason — not hypothetical.
3. **Should `schema.sql` be split into per-table documentation migrations**, matching the pattern now used for `project_negative_pool` and the four scanner tables? That would make a `supabase/migrations/`-only replay actually possible for the first time. A materially larger undertaking than this prompt, and touches `schema.sql`-adjacent decisions explicitly out of scope here — flagging as a strategic question rather than acting on it.
4. **The `storage.buckets`/`storage.objects` stub step** suggests a true from-scratch local dev loop (`supabase start`, not just `db reset`) would need either a `supabase/config.toml` added (never existed in this repo) or continued reliance on the dashboard-based workflow CLAUDE.md already documents as the status quo. Not acted on here since it's unrelated to `project_negative_pool` and the prompt's "Do not change" list didn't cover adding CLI config.

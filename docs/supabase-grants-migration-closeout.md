# Supabase Grants Migration — Closeout

Companion to `supabase/migrations/20261020130000_explicit_grants_public_tables.sql` and the CLAUDE.md grants-guidance update, both written per `docs/supabase-grants-audit-report.md`'s findings. Run after `supabase/migrations/20261020120000_document_project_negative_pool.sql` was committed, per the brief.

---

## 1. Final grant matrix

27 live tables total. `access_codes` is excluded entirely (already `service_role`-only by design and by usage — see Section 2). The remaining 26 all get `service_role`; 21 of those also get `authenticated`, derived directly from the audit's Section 4 client usage map (the browser-touched table list).

| Table | `anon` | `authenticated` | `service_role` | Basis |
|---|---|---|---|---|
| `access_codes` | — | — | *(already granted, own migration)* | Excluded — see Section 2 |
| `ai_usage_log` | — | — | ✅ | Only `api/*.js` touches it (Section 4) |
| `analyses` | — | ✅ | ✅ | Browser-touched |
| `candidates` | — | — | ✅ | Only `api/*.js`/edge functions touch it |
| `canvas_nodes` | — | ✅ | ✅ | Browser-touched |
| `canvas_text_nodes` | — | ✅ | ✅ | Browser-touched |
| `cluster_inputs` | — | ✅ | ✅ | Browser-touched |
| `cluster_suggestions` | — | ✅ | ✅ | Browser-touched |
| `clusters` | — | ✅ | ✅ | Browser-touched |
| `inputs` | — | ✅ | ✅ | Browser-touched |
| `preferred_futures` | — | ✅ | ✅ | Browser-touched |
| `project_candidates` | — | ✅ | ✅ | Browser-touched |
| `project_negative_pool` | — | — | ✅ | Only `server-lib/clone-project.js` touches it |
| `project_publications` | — | — | ✅ | Only `server-lib/publish-project.js` touches it |
| `project_sources` | — | ✅ | ✅ | Browser-touched |
| `project_system_map_background` | — | ✅ | ✅ | Browser-touched |
| `projects` | — | ✅ | ✅ | Browser-touched |
| `relationships` | — | ✅ | ✅ | Browser-touched |
| `scenario_clusters` | — | ✅ | ✅ | Browser-touched |
| `scenarios` | — | ✅ | ✅ | Browser-touched |
| `source_health` | — | — | ✅ | Decided explicitly — RLS-locked, zero policies, by design |
| `sources` | — | ✅ | ✅ | Browser-touched |
| `strategic_options` | — | ✅ | ✅ | Browser-touched |
| `system_map_templates` | — | ✅ | ✅ | Browser-touched |
| `user_preferences` | — | ✅ | ✅ | Browser-touched |
| `workspace_settings` | — | ✅ | ✅ | Browser-touched |
| `workspaces` | — | ✅ | ✅ | Browser-touched |

Totals: 26 tables × `service_role`, 21 tables × `authenticated`, 0 × `anon`. Privileges granted everywhere are `SELECT, INSERT, UPDATE, DELETE` only — never `TRUNCATE`, `REFERENCES`, or `TRIGGER`, per the decisions. No sequence grants — the audit (Section 3) found zero sequences in `public`.

**No ambiguous tables.** Every one of the 26 granted tables had an unambiguous answer in the audit's Section 4 client usage map — each table's caller list was either entirely browser-surfaced (gets `authenticated`) or entirely `api/*.js`/`server-lib/*.js`/Edge-Function-surfaced (service_role only), with no table split across both in a way that needed a judgment call. Nothing is listed under Open Questions for ambiguity, though one methodological caveat is worth naming: the client usage map was built by grepping literal `.from('tablename')` call sites. A dynamically-constructed table name (a variable rather than a string literal) would not have matched and could, in principle, produce a false "service_role only" classification. No such pattern was found anywhere in `src/`, `extension/src/`, `api/`, `server-lib/`, or `supabase/functions/` during either this migration or the original audit, but it's a real limitation of the method, not a logical guarantee.

## 2. Tables left out and why

| Table | Reason |
|---|---|
| `access_codes` | Decision, verified against the audit: already `service_role`-only via its own migration (`20260929120000_access_codes.sql`) and zero `.from()` call sites anywhere in client code (confirmed again this pass). Adding any grant here — even re-stating `service_role` — risked implying it needs `authenticated`/`anon` too if someone edits the file later without re-reading the context. Left out of this migration entirely; its existing grant stands untouched. |

No table was left out for replay-order reasons. The brief confirmed the replay order explicitly (`schema.sql` first, then `supabase/migrations/` in filename order) and that `schema.sql`-created tables are valid grant targets like any other — resolving what the prior `project_negative_pool` closeout had flagged as an open question. Every table in the matrix is created either by `schema.sql` or by a migration that sorts before `20261020130000_explicit_grants_public_tables.sql`, including `project_negative_pool` itself, which now has its own creating migration (`20261020120000_document_project_negative_pool.sql`, committed first per the brief's instruction).

## 3. Verification result

**`supabase db reset` still can't run as-is** (no `supabase/config.toml`, same root cause documented in the `project_negative_pool` closeout). Reused that closeout's Docker-based replay instead: the Supabase Postgres base image, `schema.sql` applied first, then every file in `supabase/migrations/` in chronological order (with the same three local-only stubs from before — `storage.buckets`/`storage.objects`, `get_user_workspace_id()`, and `20260705110000_scanner_tables_schema.sql` reordered immediately after `schema.sql` so `source_health` and `get_seeding_candidates` resolve their real dependencies on `sources`/`candidates`). Both new migrations (`20261020120000_document_project_negative_pool.sql`, `20261020130000_explicit_grants_public_tables.sql`) were included in their correct chronological position. Full replay applied cleanly, `psql` exit code 0.

**A straightforward grants query against that replay wasn't actually informative**, and it's worth explaining why rather than just reporting a pass: the Supabase Postgres base image itself still carries Supabase's **current, pre-cutover** blanket default-privilege behavior baked into its own bootstrap (this is the same mechanism that gives every live table on production/staging its current broad `anon`/`authenticated`/`service_role` grants, per the original audit). Querying `information_schema.role_table_grants` after a normal replay showed every table with the full privilege set for every role — true, but it's evidence of the base image's own default, not of this migration's correctness. The migration's statements are genuinely additive on top of that and would be invisible in this kind of check.

**To actually test the thing that matters — does this migration alone produce the correct grants once Supabase's default is gone — the replay was extended one step:** after the full replay, every `anon`/`authenticated`/`service_role` grant on every `public` table was explicitly revoked (simulating the post-October-30 state with nothing pre-granted), then `20261020130000_explicit_grants_public_tables.sql` was re-applied by itself. Querying `information_schema.role_table_grants` after that showed:

- **47 total grant rows** — exactly 21 `authenticated` (84 privilege-rows ÷ 4) + 26 `service_role` (104 privilege-rows ÷ 4), matching the matrix's table counts precisely.
- **Zero `anon` rows**, anywhere.
- **Zero `TRUNCATE`/`REFERENCES`/`TRIGGER` grants**, anywhere — confirmed with a direct filtered query, not just by eyeballing the privilege strings.
- **`access_codes` absent** from the result entirely, as intended (this isolated test didn't re-run its own migration, so its grant isn't present in this specific check — but that's the expected state for *this* migration's own scope, not a gap; its own migration already covers it on a real database).

This is the verification the brief asked for (Section 5's query), run under the condition that actually exercises what the migration is for, rather than one that happens to pass today regardless of the migration's content because of the environment's own pre-cutover defaults.

## 4. Open questions

1. **The existing 10 tables' live `anon` grants are untouched**, per the "no REVOKEs" instruction — `candidates`, `sources`, `project_sources`, `project_candidates`, `canvas_text_nodes`, `project_publications`, `project_system_map_background`, `system_map_templates`, `user_preferences` all still carry an `anon` grant live on production/staging that this migration neither removes nor needed to add (it was already there). The audit's Section 9 already flagged this as a separate, deliberately-deferred decision; this migration doesn't change that status.
2. **`project_negative_pool` now has live RLS policies for `authenticated` (`project_negative_pool_select`, `project_negative_pool_update`) that this migration deliberately does not back with an `authenticated` grant**, since the client usage map shows no browser call site for it today. Those policies are not wrong — they'd simply be unreachable by `authenticated` without the grant, and only `service_role` (which bypasses RLS and holds the grant this migration adds) can touch the table in practice. Worth knowing if this table's dormancy ever changes and something starts reading it from the browser — the policy alone wouldn't be sufficient at that point, the grant would need adding too.
3. **A dynamically-constructed `.from()` table name would have evaded the audit's client usage map** (see Section 1's caveat) and so would evade this migration's matrix too. None were found, but the method can't prove a negative with certainty.
4. **`get_user_workspace_id()`'s missing creating migration (flagged in the `project_negative_pool` closeout) is still unaddressed.** It wasn't part of this migration's scope (function `EXECUTE` privileges were explicitly out of scope per the "do not change function EXECUTE privileges" instruction, and the function itself still has no `CREATE FUNCTION` anywhere in the repo) — the new CLAUDE.md function-EXECUTE note doesn't fix that gap, it documents a different, adjacent one. A follow-up documentation migration for `get_user_workspace_id()`, matching this prompt's own pattern, is still open.

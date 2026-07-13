-- Backfill: projects.source_template_id
--
-- Added directly to both staging (kptatqipjwihkdxdxlvh) and production
-- (tbxjudpxzovbasuomekq) via dashboard/SQL, with no migration file — same
-- undocumented-schema-change root cause already resolved for
-- is_sample_template (20260709130000_add_is_sample_template.sql) and the
-- ProjectOverview columns (20260709_backfill_overview_columns.sql). This is
-- the last undocumented column from that audit.
--
-- Cross-checked against the current staging-generated
-- src/types/database.types.ts before writing this DDL: `source_template_id:
-- string | null`, self-referencing FK to projects(id), not unique
-- (isOneToOne: false — multiple per-user clones can share the same
-- template project). Nullable, no default, matching expectations.
--
-- IF NOT EXISTS so this is a no-op on both databases, where the column
-- already exists (confirmed before running against production).
--
-- No GRANT block: adds a column to an existing, already-granted table
-- (projects), not a new table — see CLAUDE.md "Grants for new tables".

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES projects(id);

-- Backfill: projects.is_sample_template
--
-- Required by the project clone utility (api/lib/clone-project.js) built for
-- Sample_Project_Onboarding_PRD.md. Confirmed via direct SQL against
-- production on 2026-07-09 that this column does not exist on either
-- database yet — unlike source_template_id (added directly, no migration
-- file, same undocumented-schema-change pattern flagged in the earlier
-- Claude Code audit), this one is being added properly from the start.
--
-- NOT NULL DEFAULT false, unlike source_template_id (nullable) — this is a
-- boolean flag, not an optional reference. Every project needs a definite
-- true/false state; a nullable boolean would let a query filtering on
-- is_sample_template = false silently miss rows where it's NULL instead.
--
-- IF NOT EXISTS so this is a safe no-op if either database already has it
-- by the time this runs.
--
-- No GRANT block: adds a column to an existing, already-granted table
-- (projects), not a new table — see CLAUDE.md "Grants for new tables."

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_sample_template boolean NOT NULL DEFAULT false;

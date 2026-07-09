-- Documentation migration: trg_auto_populate_project_sources.
--
-- Discovered undocumented on 2026-07-09 while testing api/lib/clone-project.js
-- against staging (kptatqipjwihkdxdxlvh) — an AFTER INSERT trigger on
-- projects, not present in any prior migration file, that auto-creates
-- project_sources rows for every newly-inserted project by matching
-- sources.domain = NEW.domain (active sources only), with opted_in hardcoded
-- true. It fires before any of clone-project.js's own writes, independent of
-- and invisible to that code, which is what caused a cloned project's
-- project_sources to come back opted_in = true despite the source project
-- having none. Definition below is reproduced verbatim from staging via
-- pg_get_triggerdef / pg_proc.prosrc — not otherwise verified against
-- production, but this migration is idempotent (CREATE OR REPLACE +
-- DROP-then-CREATE) so it is safe to run there regardless of whether the
-- trigger already exists in the same form.
--
-- Same treatment already given to the other undocumented scanner-pipeline
-- objects in 20260705110000_scanner_tables_schema.sql: this introduces no
-- new behavior, it documents what was already live.
--
-- No GRANT block: this defines a function/trigger, not a table.

CREATE OR REPLACE FUNCTION auto_populate_project_sources()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_sources (project_id, source_id, opted_in)
  SELECT NEW.id, s.id, true
  FROM sources s
  WHERE s.domain = NEW.domain
    AND s.active = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_populate_project_sources ON projects;
CREATE TRIGGER trg_auto_populate_project_sources
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION auto_populate_project_sources();

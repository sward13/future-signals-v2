-- ─── Future Models schema expansion ───────────────────────────────────────────
-- Expands the scenarios stub table and adds preferred_futures and
-- strategic_options.  Scenario Sets are explicitly deferred — not created here.

-- ─── Ensure handle_updated_at trigger function exists ─────────────────────────

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. Expand scenarios ──────────────────────────────────────────────────────

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS narrative          text,
  ADD COLUMN IF NOT EXISTS key_differences    jsonb        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS driving_forces     jsonb        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS suppressed_forces  jsonb        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS confidence         text,
  ADD COLUMN IF NOT EXISTS geographic_scope   text,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz  NOT NULL DEFAULT now();

-- updated_at trigger on scenarios
DROP TRIGGER IF EXISTS set_scenarios_updated_at ON scenarios;
CREATE TRIGGER set_scenarios_updated_at
  BEFORE UPDATE ON scenarios
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─── 2. preferred_futures ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS preferred_futures (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid        NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  project_id           uuid        NOT NULL REFERENCES projects(id)    ON DELETE CASCADE,
  name                 text        NOT NULL,
  description          text,
  desired_outcomes     text,
  guiding_principles   jsonb       NOT NULL DEFAULT '[]',
  strategic_priorities jsonb       NOT NULL DEFAULT '[]',
  indicators           jsonb       NOT NULL DEFAULT '[]',
  horizon              text,
  scenario_ids         jsonb       NOT NULL DEFAULT '[]',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE preferred_futures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferred_futures_all" ON preferred_futures
  FOR ALL USING (workspace_id = get_workspace_id());

DROP TRIGGER IF EXISTS set_preferred_futures_updated_at ON preferred_futures;
CREATE TRIGGER set_preferred_futures_updated_at
  BEFORE UPDATE ON preferred_futures
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─── 3. strategic_options ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS strategic_options (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  project_id        uuid        NOT NULL REFERENCES projects(id)    ON DELETE CASCADE,
  name              text        NOT NULL,
  description       text,
  intended_outcome  text,
  actions           text,
  implications      text,
  dependencies      text,
  risks             text,
  horizon           text,
  feasibility       text,
  scenario_ids      jsonb       NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE strategic_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategic_options_all" ON strategic_options
  FOR ALL USING (workspace_id = get_workspace_id());

DROP TRIGGER IF EXISTS set_strategic_options_updated_at ON strategic_options;
CREATE TRIGGER set_strategic_options_updated_at
  BEFORE UPDATE ON strategic_options
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

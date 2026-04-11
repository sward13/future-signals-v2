-- ─── Step 1: Scanning flags ───────────────────────────────────────────────────

ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS scanning_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS scanning_enabled boolean NOT NULL DEFAULT true;

-- ─── Step 5: Inbox inactivity detection groundwork ────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

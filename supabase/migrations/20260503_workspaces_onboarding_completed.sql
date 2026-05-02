-- Add onboarding_completed flag to workspaces.
-- experience_level was added in a prior migration (not tracked here).
-- onboarding_completed was referenced in app code but never migrated.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

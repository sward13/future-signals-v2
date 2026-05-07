-- Add reversibility and resource_intensity to strategic_options.
-- Both are optional text fields constrained to High / Medium / Low.

ALTER TABLE strategic_options
  ADD COLUMN IF NOT EXISTS reversibility       text,
  ADD COLUMN IF NOT EXISTS resource_intensity  text;

ALTER TABLE strategic_options
  DROP CONSTRAINT IF EXISTS strategic_options_reversibility_check;
ALTER TABLE strategic_options
  ADD CONSTRAINT strategic_options_reversibility_check
  CHECK (reversibility IS NULL OR reversibility IN ('High', 'Medium', 'Low'));

ALTER TABLE strategic_options
  DROP CONSTRAINT IF EXISTS strategic_options_resource_intensity_check;
ALTER TABLE strategic_options
  ADD CONSTRAINT strategic_options_resource_intensity_check
  CHECK (resource_intensity IS NULL OR resource_intensity IN ('High', 'Medium', 'Low'));

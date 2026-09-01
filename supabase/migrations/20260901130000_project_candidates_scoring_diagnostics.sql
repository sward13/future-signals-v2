-- Persist per-candidate scoring diagnostics that api/score.js computes but
-- previously only console.debug-ed. negative_pool_sim already exists on this
-- table (added for the Level 3 design) but has always been NULL — score.js
-- now computes and writes it; no schema change needed for that one.
--
-- scope_in_sim is diagnostic-only going forward: scope_in no longer has its
-- own scoring weight (folded into the primary question+focus+scope_in
-- embedding instead), but this column still shows candidate similarity to
-- scope_in text alone, to help explain what's driving primarySim/key_question_sim.

ALTER TABLE project_candidates
  ADD COLUMN IF NOT EXISTS scope_in_sim double precision,
  ADD COLUMN IF NOT EXISTS scope_out_sim double precision,
  ADD COLUMN IF NOT EXISTS scope_out_penalty text,
  ADD COLUMN IF NOT EXISTS focus_used boolean NOT NULL DEFAULT false;

ALTER TABLE project_candidates
  DROP CONSTRAINT IF EXISTS project_candidates_scope_out_penalty_check;
ALTER TABLE project_candidates
  ADD CONSTRAINT project_candidates_scope_out_penalty_check
  CHECK (scope_out_penalty IS NULL OR scope_out_penalty IN ('hard', 'soft'));

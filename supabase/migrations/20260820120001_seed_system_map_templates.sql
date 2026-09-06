-- ─── System Map Background Templates: launch seed set ──────────────────────────
-- The six launch template candidates from docs/system-map-background-templates-spec.md.
-- Seeded here (a version-controlled migration) rather than a manual out-of-repo
-- write — see OQ-BG-07, resolved: `sources` never got a reproducible seeding
-- mechanism and this feature deliberately doesn't repeat that gap.
--
-- Real artwork is a design task (per the spec's Non-goals), not yet produced as
-- of this migration. All six rows ship with `active = false` and asset paths
-- that don't exist in the `system-map-templates` bucket yet, so the picker UI
-- can be built and tested end-to-end against real rows without surfacing
-- placeholder/broken images to users. Once real SVGs are uploaded to the exact
-- object paths below, flip `active = true` per row (a simple `update`, not a
-- new migration) — see docs/system-map-background-templates-audit-prompt.md
-- for the upload destination.
--
-- asset_url / thumbnail_url store RELATIVE object paths within the
-- `system-map-templates` bucket, not full URLs — the same convention
-- project_publications.storage_path already uses ('{slug}/index.html'), so the
-- row data stays identical across staging and production despite their
-- different Supabase project refs / storage hostnames. The app resolves these
-- to full URLs at render time via supabase.storage.from(...).getPublicUrl().

insert into public.system_map_templates (name, description, category, asset_url, thumbnail_url, source_type, owner_id, active)
values
  ('Three Horizons',
   'Plots change across three overlapping waves of time — the declining present, the emerging future, and the transition between them.',
   'Time-based', 'three-horizons.svg', 'three-horizons-thumb.svg', 'curated', null, false),

  ('2x2 Scenario Matrix',
   'Two independent, high-uncertainty axes crossed to define four distinct future scenarios.',
   'Matrix', '2x2-scenario-matrix.svg', '2x2-scenario-matrix-thumb.svg', 'curated', null, false),

  ('Futures Cone',
   'A widening cone from the present into probable, plausible, possible, and preposterous futures.',
   'Time-based', 'futures-cone.svg', 'futures-cone-thumb.svg', 'curated', null, false),

  ('STEEP / PESTLE Wheel',
   'A radial wheel organizing signals by Social, Technological, Economic, Environmental, and Political (and related) categories.',
   'Wheel', 'steep-pestle-wheel.svg', 'steep-pestle-wheel-thumb.svg', 'curated', null, false),

  ('Causal Layered Analysis',
   'An iceberg view from surface events down through systemic causes, worldviews, and myth/metaphor.',
   'Layered', 'causal-layered-analysis.svg', 'causal-layered-analysis-thumb.svg', 'curated', null, false),

  ('Impact / Uncertainty Grid',
   'Plots signals or drivers by their potential impact against how uncertain their trajectory is.',
   'Matrix', 'impact-uncertainty-grid.svg', 'impact-uncertainty-grid-thumb.svg', 'curated', null, false)
on conflict (name) where owner_id is null do nothing;

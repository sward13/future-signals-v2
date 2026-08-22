-- ─── System Map Background Templates: real artwork filenames + Cynefin ─────────
-- The original seed migration (20260820120001) guessed at asset filenames before
-- real artwork existed. Corrects three rows to the actual filenames uploaded to
-- the system-map-templates bucket, and adds Cynefin as a new curated template —
-- not one of the original six launch candidates, but produced and requested by
-- Sam on 2026-08-22.

-- 2x2 Scenario Matrix — produced under a simpler filename than the seed guess.
update public.system_map_templates
set asset_url = '2x2.svg', thumbnail_url = '2x2-thumb.svg', active = true
where name = '2x2 Scenario Matrix';

-- Futures Cone — produced under its academic name (Voros' "cone of possibility"),
-- same underlying concept as the seed row.
update public.system_map_templates
set asset_url = 'Cone-of-Possibility.svg', thumbnail_url = 'Cone-of-Possibility-thumb.svg', active = true
where name = 'Futures Cone';

-- STEEP / PESTLE Wheel -> renamed to STEEPLED Analysis: the produced artwork uses
-- the app's own existing STEEPLED taxonomy (Social/Technological/Economic/
-- Environmental/Political/Legal/Ethical/Demographic -- already used elsewhere for
-- Inputs), a more specific framework than the generic STEEP/PESTLE the seed row
-- guessed at. Renamed rather than just swapping the file, since the old name
-- would be actively wrong once paired with this artwork.
update public.system_map_templates
set name = 'STEEPLED Analysis',
    description = 'A radial wheel organizing signals by Social, Technological, Economic, Environmental, Political, Legal, Ethical, and Demographic categories -- matches the app''s own STEEPLED taxonomy.',
    asset_url = 'STEEPLED-Analysis.svg', thumbnail_url = 'STEEPLED-Analysis-thumb.svg', active = true
where name = 'STEEP / PESTLE Wheel';

-- Cynefin -- a new curated template, not one of the original six launch
-- candidates. Distinguishes Simple/Complicated/Complex/Chaotic problem domains.
insert into public.system_map_templates (name, description, category, asset_url, thumbnail_url, source_type, owner_id, active)
values (
  'Cynefin Framework',
  'A sense-making framework distinguishing Simple, Complicated, Complex, and Chaotic problem domains, each calling for a different kind of response.',
  'Framework', 'Cynefin.svg', 'Cynefin-thumb.svg', 'curated', null, true
)
on conflict (name) where owner_id is null do nothing;

-- Causal Layered Analysis and Impact / Uncertainty Grid are left untouched --
-- no artwork produced for these yet; they stay inactive.

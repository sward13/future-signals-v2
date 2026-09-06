-- Converges the two disconnected confidence scales identified in the
-- 2026-09-04 source-confidence-unification audit: sources.credibility
-- (institutional/specialist/general/unvetted) and inputs.source_confidence
-- (low/medium/high). Adds source_confidence to sources, backfilled from the
-- confirmed mapping (verified against real production data on staging +
-- production: institutional=47, specialist=52, general=1, unvetted=1):
--   institutional -> high, specialist -> medium, general -> low, unvetted -> low
--
-- credibility is NOT dropped here — server-lib/scoring.js's CREDIBILITY_SCORES
-- still keys off it for the scanner's relevance-scoring weight (see that
-- file for the decoupling rationale). It is retired from the UI only.

alter table public.sources
  add column source_confidence text;

update public.sources
set source_confidence = case credibility
  when 'institutional' then 'high'
  when 'specialist'    then 'medium'
  when 'general'       then 'low'
  when 'unvetted'      then 'low'
  else 'low'
end
where source_confidence is null;

alter table public.sources
  alter column source_confidence set default 'low',
  alter column source_confidence set not null,
  add constraint sources_source_confidence_check
    check (source_confidence in ('low', 'medium', 'high'));

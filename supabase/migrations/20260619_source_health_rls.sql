-- source_health was created without RLS (internal ops table).
-- Enable it with no policies — service role bypasses RLS by design,
-- so the scanner pipeline is unaffected. PostgREST queries from
-- anon/authenticated roles will be denied.
alter table public.source_health enable row level security;

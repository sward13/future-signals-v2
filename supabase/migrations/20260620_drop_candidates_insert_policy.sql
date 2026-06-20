-- candidates_insert had WITH CHECK (true), allowing any authenticated user to
-- write arbitrary rows into the candidates table. The scanner pipeline uses the
-- service role which bypasses RLS and doesn't need this policy. Drop it.
drop policy if exists "candidates_insert" on public.candidates;

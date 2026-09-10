-- Recurring cleanup for the `candidates` table's expires_at TTL (30 days,
-- set on every row at ingestion), which had no job enforcing it. Candidates
-- accumulated unchecked from first ingestion (2026-04) until a one-time
-- cleanup on 2026-09-09 (33,455 expired rows / ~370MB reclaimed on
-- production — the org's combined database size had exceeded the Free
-- plan's 0.5GB quota, shared across all projects).
--
-- This schedules that same delete daily via pg_cron. Pure SQL, no external
-- API calls, so a native pg_cron job is simpler and more robust here than an
-- Edge Function on the existing cron-job.org + CRON_SECRET pattern (used
-- elsewhere in this app for jobs that DO call OpenAI/etc.) — no secret to
-- manage, no third-party scheduler dependency, no Vercel/Edge Function slot
-- consumed.
--
-- project_candidates rows for a deleted candidate cascade-delete automatically
-- via project_candidates_candidate_id_fkey (ON DELETE CASCADE) — no separate
-- cleanup needed for that table. Nothing else references candidates.id.
--
-- Runs daily at 03:00 UTC (low-traffic hour, after the nightly scan/score/
-- classify cron chain per docs/cron-secret.md's job list). At the current
-- ~285 rows/day ingestion rate this deletes a small, steady batch each run —
-- small enough that regular (non-FULL) autovacuum keeps the table from
-- re-bloating, so no periodic VACUUM FULL should be needed going forward.

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'expire-candidates-daily',
  '0 3 * * *',
  $$delete from public.candidates where expires_at < now();$$
);

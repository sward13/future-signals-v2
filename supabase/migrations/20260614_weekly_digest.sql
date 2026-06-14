-- ─── Weekly signal digest ──────────────────────────────────────────────────

-- Prevents the same candidate appearing in consecutive weekly digests.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS last_digest_at timestamptz;

-- Per-user digest preferences.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_unsubscribed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

grant select on public.user_preferences to anon;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.user_preferences to service_role;
alter table public.user_preferences enable row level security;

create policy "Users manage their own preferences"
  on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

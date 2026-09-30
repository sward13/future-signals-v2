-- Access & Promo Codes — EPIC cut (invite-only signup gate).
-- Spec: docs/access-promo-codes-spec.md
--
-- Gates account creation on a valid access code. A new user must pass a code in
-- signup metadata (raw_user_meta_data.access_code); handle_new_user validates it
-- atomically and blocks signup (rolls back the auth.users insert) if it's
-- missing/invalid/expired/exhausted. Google SSO + the activation-flag model are
-- a post-EPIC fast-follow — this migration covers the email/password path only,
-- gated at account creation.
--
-- handle_new_user is AFTER INSERT ON auth.users; a raise here rolls back the
-- whole signup transaction. Original body (captured verbatim before extending,
-- since it predates the migrations dir — CLAUDE.md "undocumented-schema-change
-- pattern"):
--
--   begin
--     insert into public.workspaces (user_id) values (new.id)
--       returning id into new_workspace_id;
--     insert into public.workspace_settings (workspace_id) values (new_workspace_id);
--     return new;
--   end;

-- ─── access_codes ───────────────────────────────────────────────────────────
create table if not exists public.access_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  label       text,
  active      boolean not null default true,
  max_uses    integer,               -- null = unlimited
  uses_count  integer not null default 0,
  expires_at  timestamptz,           -- null = no expiry
  grants      jsonb,                 -- RESERVED for future promo/plan grants — unused in EPIC cut
  created_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness + lookup (codes are matched case-insensitively).
create unique index if not exists access_codes_code_lower_idx
  on public.access_codes (lower(code));

alter table public.access_codes enable row level security;
-- Deliberately NO anon/authenticated policy or grant: clients must never read
-- this table (it would leak valid codes). handle_new_user is SECURITY DEFINER,
-- so it reads/writes via the function owner, not client privileges.
grant select, insert, update, delete on public.access_codes to service_role;

-- ─── workspaces: redemption stamp (attribution) ─────────────────────────────
alter table public.workspaces
  add column if not exists access_code text,
  add column if not exists code_label  text;

-- ─── handle_new_user: gate on a valid access code ───────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_workspace_id uuid;
  v_code    text := nullif(trim(new.raw_user_meta_data->>'access_code'), '');
  v_matched text;
  v_label   text;
begin
  -- Atomic validate-and-consume: increment only if the code is active, not
  -- expired, and under its cap. The row lock makes the cap race-safe (two
  -- concurrent signups on a max_uses=1 code: the second sees uses_count = 1
  -- and matches 0 rows). A null/blank code matches 0 rows → blocked.
  update public.access_codes
     set uses_count = uses_count + 1
   where lower(code) = lower(v_code)
     and active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or uses_count < max_uses)
   returning code, label into v_matched, v_label;

  if v_matched is null then
    raise exception 'invalid or expired access code';
  end if;

  insert into public.workspaces (user_id, access_code, code_label)
    values (new.id, v_matched, v_label)
    returning id into new_workspace_id;

  insert into public.workspace_settings (workspace_id)
    values (new_workspace_id);

  return new;
end;
$function$;

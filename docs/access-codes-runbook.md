# Access codes — creating and managing them

There is no admin UI for this (deliberately, per `access-promo-codes-spec.md`
Phase 1). Codes are managed with direct SQL against the `access_codes` table.
Run these against the **production** project (`tbxjudpxzovbasuomekq`) unless
you're specifically testing on staging (`kptatqipjwihkdxdxlvh`) — Claude Docs
Supabase tool works, or the Dashboard SQL Editor.

Clients can never read this table (no anon/authenticated grant — only
`service_role`), so this is the only way to see or change codes.

## Create a new code

```sql
insert into public.access_codes (code, label, max_uses, expires_at)
values ('YOUR-CODE', 'A short label for your own reference', 100, '2026-12-31');
```

- `code` — what people type (or what rides in the `?invite=` link). Matched
  case-insensitively, so `epic2026` and `EPIC2026` are the same code.
- `label` — for your own bookkeeping; shown nowhere to end users.
- `max_uses` — `null` = unlimited.
- `expires_at` — `null` = never expires. Use a date string like `'2026-12-31'`.

## Signup link with the code pre-filled

```
https://app.futuresignals.io/sign-up?invite=YOUR-CODE
```

The signup form reads `?invite=` and fills the Access code field automatically
— this is what a QR code or shared link should point to.

## Check a code's status / usage

```sql
select code, label, active, uses_count, max_uses, expires_at
from public.access_codes
order by created_at desc;
```

## Disable a code (without deleting it)

```sql
update public.access_codes set active = false where code = 'YOUR-CODE';
```

Deleting the row works too, but disabling keeps the history (redeemed
workspaces still reference the code via `workspaces.access_code` for
attribution — see below).

## Raise or remove a cap / change the expiry

```sql
update public.access_codes
set max_uses = 200, expires_at = '2027-01-15'
where code = 'YOUR-CODE';
```

Set either to `null` to remove that limit entirely.

## See who signed up with a given code

```sql
select w.id as workspace_id, w.access_code, w.code_label, w.created_at, u.email
from public.workspaces w
join auth.users u on u.id = w.user_id
where w.access_code = 'YOUR-CODE'
order by w.created_at desc;
```

## Current codes (as of 2026-09-30)

| Code | Label | Max uses | Expires |
|---|---|---|---|
| `EPIC2026` | EPIC 2026 | 500 | 2026-11-15 |
| `FS-INTERNAL` | Internal / admin | unlimited | never |

Update this table when you add or retire codes so it stays a quick reference
— it's not authoritative (the database is), just a snapshot.

## Notes

- A code is valid iff `active = true` AND (`expires_at` is null OR in the
  future) AND (`max_uses` is null OR `uses_count < max_uses`). This is
  enforced atomically server-side (`handle_new_user`), so two people racing to
  use the last slot on a capped code can't both get in.
- Full design/rationale: `access-promo-codes-spec.md`.

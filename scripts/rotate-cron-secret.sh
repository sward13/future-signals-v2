#!/usr/bin/env bash
#
# Rotate CRON_SECRET for one environment and push it to the deployment surfaces
# that can be updated from the CLI (Supabase function secrets + Vercel env).
#
# CRON_SECRET is a SYMMETRIC shared secret: every consumer must hold the exact
# same string. It has more consumers than is obvious — see docs/cron-secret.md
# for the full topology and why partial updates silently break the digest and
# the scanner health check.
#
# Source of truth is LastPass (one entry per environment), NOT any deployment —
# Vercel is marked sensitive (unreadable) and Supabase masks its copy, so no
# deployment can be read back. This script generates a fresh value, pushes it to
# the two CLI-reachable surfaces, and prints a checklist for the manual ones
# (cron-job.org job headers + LastPass canonical + .env.local for staging).
#
# Usage:
#   scripts/rotate-cron-secret.sh prod
#   scripts/rotate-cron-secret.sh staging
#
# Requires: supabase CLI (authed), vercel CLI (project linked), openssl.

set -euo pipefail

ENV="${1:-}"
case "$ENV" in
  prod)
    SUPABASE_REF="tbxjudpxzovbasuomekq"
    VERCEL_TARGET="production"
    ;;
  staging)
    SUPABASE_REF="kptatqipjwihkdxdxlvh"
    VERCEL_TARGET="preview"
    ;;
  *)
    echo "usage: $0 prod|staging" >&2
    exit 1
    ;;
esac

echo "About to rotate CRON_SECRET for: $ENV"
echo "  Supabase project: $SUPABASE_REF"
echo "  Vercel target:    $VERCEL_TARGET"
echo
read -r -p "Proceed? This changes live secrets. [y/N] " confirm
[ "$confirm" = "y" ] || { echo "Aborted."; exit 1; }

NEW="$(openssl rand -hex 32)"

echo
echo "→ Setting Supabase function secret..."
supabase secrets set "CRON_SECRET=$NEW" --project-ref "$SUPABASE_REF"

echo
echo "→ Setting Vercel env ($VERCEL_TARGET)..."
# Remove any existing value first (add fails if the key already exists for the target).
vercel env rm CRON_SECRET "$VERCEL_TARGET" -y >/dev/null 2>&1 || true
printf '%s' "$NEW" | vercel env add CRON_SECRET "$VERCEL_TARGET" --sensitive

cat <<EOF

────────────────────────────────────────────────────────────────────────
✅ Pushed to Supabase ($SUPABASE_REF) and Vercel ($VERCEL_TARGET).

New CRON_SECRET ($ENV):

    $NEW

MANUAL STEPS — do these now, before the next scheduled cron run:

  1. LastPass → update entry "CRON_SECRET · $ENV" with the value above.
  2. cron-job.org → update the x-cron-secret header on EVERY job in this
     environment:
        - "Future Signals signal scanner"   (hits Vercel /api/scan)
        - "Future Signals weekly digest"     (hits Supabase send-weekly-digest)
     (Both must match — the scanner uses this too, not just the digest.)
EOF

if [ "$ENV" = "staging" ]; then
  echo "  3. .env.local → update the CRON_SECRET= line (local dev targets staging)."
fi

cat <<EOF

  Then "Run now" on each cron-job.org job → expect HTTP 200.

  Clear this value from your terminal scrollback once copied.
────────────────────────────────────────────────────────────────────────
EOF

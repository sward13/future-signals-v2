#!/usr/bin/env bash
#
# Smoke test for the send-email x-relay-secret gate (see CLAUDE.md,
# "send-email and its callers are a deploy-pair via EMAIL_RELAY_SECRET").
# Run this after redeploying either send-email or send-weekly-digest to
# confirm the gate is actually enforced in that environment.
#
# SAFETY: every request body here is exactly {} — never add a "to" field.
# That's the whole guarantee this script relies on: even against an ungated
# send-email, an empty body can't dispatch a real email (Resend rejects it
# for missing fields before anything is sent).
#
# Usage:
#   SUPABASE_URL=https://<project>.supabase.co scripts/check-email-relay.sh
#   SUPABASE_URL=... EMAIL_RELAY_SECRET=... scripts/check-email-relay.sh   # also runs Test 3
#
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL must be set}"

URL="${SUPABASE_URL%/}/functions/v1/send-email"
fail=0

post() {
  # $1 = extra curl header args (may be empty)
  curl -sS -o /dev/null -w '%{http_code}' -X POST "$URL" \
    -H 'Content-Type: application/json' \
    $1 \
    -d '{}'
}

echo "Test 1: no x-relay-secret header"
status=$(post "")
if [ "$status" = "401" ]; then
  echo "PASS (got $status)"
else
  echo "FAIL (expected 401, got $status)"
  fail=1
fi

echo "Test 2: wrong x-relay-secret header"
status=$(post "-H x-relay-secret:wrong-secret-for-test")
if [ "$status" = "401" ]; then
  echo "PASS (got $status)"
else
  echo "FAIL (expected 401, got $status)"
  fail=1
fi

if [ -n "${EMAIL_RELAY_SECRET:-}" ]; then
  echo "Test 3: correct x-relay-secret header (empty body should fail Resend validation, not the gate)"
  status=$(post "-H x-relay-secret:${EMAIL_RELAY_SECRET}")
  if [ "$status" != "401" ]; then
    echo "PASS (gate passed — got $status, not 401)"
  else
    echo "FAIL (got 401 with the correct secret — gate rejected a valid caller)"
    fail=1
  fi
else
  echo "Test 3: skipped (EMAIL_RELAY_SECRET not set)"
fi

exit $fail

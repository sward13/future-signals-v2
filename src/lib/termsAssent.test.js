import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSignupMetadata, assentError, TERMS_VERSION, MIN_AGE } from "./termsAssent.js";

test("buildSignupMetadata returns the expected shape with a fixed now", () => {
  const now = new Date("2026-10-21T12:00:00.000Z");
  assert.deepEqual(buildSignupMetadata({ accessCode: "EPIC2026", now }), {
    access_code: "EPIC2026",
    tos_version: TERMS_VERSION,
    tos_accepted_at: "2026-10-21T12:00:00.000Z",
    privacy_version: TERMS_VERSION,
    age_confirmed: true,
    min_age: MIN_AGE,
  });
});

test("assentError(true) is null", () => {
  assert.equal(assentError(true), null);
});

test("assentError(false) returns the confirmation message", () => {
  assert.match(assentError(false), /16 or older and agree to the Terms and Privacy Policy/);
});

test("TERMS_VERSION is a YYYY-MM-DD string", () => {
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

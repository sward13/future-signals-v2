/**
 * termsAssent — pure helpers for the Terms of Service / Privacy Policy /
 * age-confirmation gate at signup. The server records nothing on its own;
 * these build the metadata payload the client attaches to auth.signUp() and
 * validate the checkbox before that call is made.
 */

export const TERMS_URL = "https://futuresignals.io/terms-of-service.html";
export const PRIVACY_URL = "https://futuresignals.io/privacy-policy.html";

// Matches the "Last updated" date on both documents. Bump this (and re-prompt
// existing users, if that's ever built) when either document changes.
export const TERMS_VERSION = "2026-07-10";

// Terms section 3 requires users to be 16 or older.
export const MIN_AGE = 16;

/** Build the extra signup metadata recording what was accepted and when. */
export function buildSignupMetadata({ accessCode, now = new Date() }) {
  return {
    access_code: accessCode,
    tos_version: TERMS_VERSION,
    tos_accepted_at: now.toISOString(),
    privacy_version: TERMS_VERSION,
    age_confirmed: true,
    min_age: MIN_AGE,
  };
}

/** Null when the assent checkbox is checked; otherwise the banner message. */
export function assentError(accepted) {
  if (accepted) return null;
  return "Confirm that you are 16 or older and agree to the Terms and Privacy Policy to continue.";
}

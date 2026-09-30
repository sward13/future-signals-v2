/**
 * accessCode — pure helpers for the invite/access-code signup gate.
 * See docs/access-promo-codes-spec.md. The server (handle_new_user trigger) is
 * the enforcement point; these just read the code from the URL and translate a
 * blocked-signup error into friendly copy.
 */

// The QR/invite links carry the code as `?invite=CODE` (…`?access_code=` also accepted).
export const ACCESS_CODE_PARAM = "invite";

/** Read the access code from a URL query string (e.g. window.location.search). */
export function accessCodeFromUrl(search = "") {
  try {
    const params = new URLSearchParams(search);
    return (params.get(ACCESS_CODE_PARAM) || params.get("access_code") || "").trim();
  } catch {
    return "";
  }
}

const CODE_ERROR = "That access code isn't valid or has expired. Check the code and try again.";

// The gate raises inside the AFTER-INSERT trigger, which GoTrue surfaces as a
// generic "Database error saving new user" (HTTP 500) rather than our message
// string — so treat that (or any message mentioning the access code) as a
// code-block, not some other signup failure.
const ACCESS_CODE_ERR_RE = /database error saving new user|access code/i;

/** True when a signup error is the access-code gate rejecting (vs. some other failure). */
export function isAccessCodeError(error) {
  return ACCESS_CODE_ERR_RE.test(String(error?.message || ""));
}

/** Map a Supabase signup error to user-facing copy. Code-blocks → friendly; else pass through. */
export function signupErrorMessage(error) {
  if (!error) return null;
  if (isAccessCodeError(error)) return CODE_ERROR;
  return String(error.message || "") || "Something went wrong. Please try again.";
}

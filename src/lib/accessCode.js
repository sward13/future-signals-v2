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

/**
 * Map a Supabase signup error to user-facing copy. The gate raises inside the
 * AFTER-INSERT trigger, which GoTrue surfaces as a generic "Database error saving
 * new user" (HTTP 500) rather than our message string — so treat that (or any
 * message mentioning the access code) as an invalid-code error. Everything else
 * passes through.
 */
export function signupErrorMessage(error) {
  if (!error) return null;
  const msg = String(error.message || "");
  if (/database error saving new user/i.test(msg) || /access code/i.test(msg)) {
    return CODE_ERROR;
  }
  return msg || "Something went wrong. Please try again.";
}

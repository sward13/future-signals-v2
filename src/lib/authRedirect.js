// Address-bar management for the state-driven app (no router). Decides whether,
// once auth + onboarding have resolved, the URL should be rewritten — and to
// what. Pure so it can be unit tested; App.jsx wires it to window.history.
//
// The app renders from state, not the URL, and is served via a catch-all SPA
// rewrite, so any leftover path (the /onboarding gate URL, or the
// /reset-password redirect target from resetPasswordForEmail) otherwise sticks
// around after the flow that put it there — which is the reset-password bug:
// the user completes a reset and stays on /reset-password instead of landing on
// a clean root.

// Paths Supabase's password-reset redirect can leave the user on. `/reset` is
// included defensively in case the redirect target is ever shortened.
export const RESET_PATHS = ["/reset-password", "/reset"];

// Dedicated, shareable auth URLs. The app is served via the catch-all SPA
// rewrite, so these load index.html and the SPA reads the path to pick the
// initial AuthScreen mode (see authModeFromPath). Both spellings are accepted
// so external links (marketing/email) are forgiving. Once signed in the user
// should never sit on one of these, so they're cleared like the reset paths.
export const SIGNUP_PATHS = ["/sign-up", "/signup"];
export const LOGIN_PATHS  = ["/log-in", "/login"];
export const AUTH_PATHS   = [...SIGNUP_PATHS, ...LOGIN_PATHS];

// Canonical URL for each signed-out auth mode — what the address bar should
// mirror while that form is showing.
export const SIGNUP_URL = "/sign-up";
export const LOGIN_URL  = "/log-in";

/**
 * Which AuthScreen mode a signed-out direct load should open in, based on the
 * URL path. Only signin vs signup are URL-addressable; forgot/reset are
 * in-app sub-states. Anything that isn't a sign-up path (including "/") opens
 * sign-in.
 * @param {string} pathname
 * @returns {"signin"|"signup"}
 */
export function authModeFromPath(pathname) {
  return SIGNUP_PATHS.includes(pathname) ? "signup" : "signin";
}

/**
 * @param {{ pathname: string, session: unknown, onboardingComplete: boolean|undefined, passwordRecovery: boolean }} state
 * @returns {string|null} the path to navigate to, or null to leave the URL alone.
 */
export function postAuthRedirectPath({ pathname, session, onboardingComplete, passwordRecovery }) {
  if (!session) return null;
  if (onboardingComplete === undefined) return null; // workspace state still loading
  if (passwordRecovery) return null; // the reset form is showing — don't touch the URL yet

  if (onboardingComplete === false) {
    // New user entering the onboarding flow.
    return pathname === "/onboarding" ? null : "/onboarding";
  }

  // Onboarding complete — clear any leftover non-app auth path so the user lands
  // on a working root (covers /onboarding after completion, the /reset-password
  // redirect target after a successful reset, and the /log-in|/sign-up entry
  // URLs after signing in).
  if (
    pathname === "/onboarding" ||
    RESET_PATHS.includes(pathname) ||
    AUTH_PATHS.includes(pathname)
  ) return "/";
  return null;
}

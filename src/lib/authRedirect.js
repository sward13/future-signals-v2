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
  // on a working root (covers /onboarding after completion and the
  // /reset-password redirect target after a successful reset).
  if (pathname === "/onboarding" || RESET_PATHS.includes(pathname)) return "/";
  return null;
}

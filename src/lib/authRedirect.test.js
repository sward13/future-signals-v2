import { test } from "node:test";
import assert from "node:assert/strict";

import {
  postAuthRedirectPath,
  authModeFromPath,
  RESET_PATHS,
  AUTH_PATHS,
  SIGNUP_PATHS,
  LOGIN_PATHS,
} from "./authRedirect.js";

const SESSION = { user: { id: "u1" } };

// ─── The regression: reset-password redirect target must not stick ──────────────

test("REGRESSION: a completed reset on /reset-password redirects to root", () => {
  // After updateUser succeeds, PASSWORD_RECOVERY has cleared (passwordRecovery=false)
  // and the user is a signed-in, onboarded account still sitting on /reset-password.
  const target = postAuthRedirectPath({
    pathname: "/reset-password",
    session: SESSION,
    onboardingComplete: true,
    passwordRecovery: false,
  });
  assert.equal(target, "/");
});

test("REGRESSION: reloading at /reset-password while signed in also redirects to root", () => {
  // The recovery token is one-time; on reload there's no PASSWORD_RECOVERY event,
  // just a normal session — the stale path must still be cleaned.
  for (const path of RESET_PATHS) {
    assert.equal(
      postAuthRedirectPath({ pathname: path, session: SESSION, onboardingComplete: true, passwordRecovery: false }),
      "/",
      `expected ${path} to redirect to /`
    );
  }
});

test("the reset form stays put while password recovery is in progress", () => {
  // passwordRecovery=true means the reset form is showing — leave the URL alone.
  assert.equal(
    postAuthRedirectPath({ pathname: "/reset-password", session: SESSION, onboardingComplete: true, passwordRecovery: true }),
    null
  );
});

// ─── Existing behavior preserved ────────────────────────────────────────────────

test("a new user is sent into the onboarding flow", () => {
  assert.equal(
    postAuthRedirectPath({ pathname: "/", session: SESSION, onboardingComplete: false, passwordRecovery: false }),
    "/onboarding"
  );
});

test("no redundant navigation once already on /onboarding", () => {
  assert.equal(
    postAuthRedirectPath({ pathname: "/onboarding", session: SESSION, onboardingComplete: false, passwordRecovery: false }),
    null
  );
});

test("a completed user still on /onboarding is returned to root", () => {
  assert.equal(
    postAuthRedirectPath({ pathname: "/onboarding", session: SESSION, onboardingComplete: true, passwordRecovery: false }),
    "/"
  );
});

test("an ordinary in-app path is left untouched (no yanking to root)", () => {
  // e.g. changing password from Account Settings fires USER_UPDATED but the user
  // is on a normal path — must not be redirected.
  assert.equal(
    postAuthRedirectPath({ pathname: "/", session: SESSION, onboardingComplete: true, passwordRecovery: false }),
    null
  );
  assert.equal(
    postAuthRedirectPath({ pathname: "/projects/abc", session: SESSION, onboardingComplete: true, passwordRecovery: false }),
    null
  );
});

// ─── /sign-up direct URL support ────────────────────────────────────────────────

test("authModeFromPath opens sign-up on the sign-up URLs", () => {
  for (const path of SIGNUP_PATHS) {
    assert.equal(authModeFromPath(path), "signup", `expected ${path} → signup`);
  }
});

test("authModeFromPath opens sign-in on the log-in URLs, root, and anything else", () => {
  for (const path of [...LOGIN_PATHS, "/", "/anything", "/reset-password"]) {
    assert.equal(authModeFromPath(path), "signin", `expected ${path} → signin`);
  }
});

test("a signed-in, onboarded user is cleared off the auth entry URLs", () => {
  // Landing on /log-in or /sign-up (e.g. from marketing) then signing in must
  // not leave the user parked on an auth URL — same treatment as /reset-password.
  for (const path of AUTH_PATHS) {
    assert.equal(
      postAuthRedirectPath({ pathname: path, session: SESSION, onboardingComplete: true, passwordRecovery: false }),
      "/",
      `expected ${path} to redirect to /`
    );
  }
});

test("a new user landing on /sign-up is still routed into onboarding", () => {
  assert.equal(
    postAuthRedirectPath({ pathname: "/sign-up", session: SESSION, onboardingComplete: false, passwordRecovery: false }),
    "/onboarding"
  );
});

// ─── Guards ──────────────────────────────────────────────────────────────────

test("no navigation until session and onboarding state have resolved", () => {
  assert.equal(postAuthRedirectPath({ pathname: "/reset-password", session: null, onboardingComplete: true, passwordRecovery: false }), null);
  assert.equal(postAuthRedirectPath({ pathname: "/reset-password", session: SESSION, onboardingComplete: undefined, passwordRecovery: false }), null);
});

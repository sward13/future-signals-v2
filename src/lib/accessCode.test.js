import { test } from "node:test";
import assert from "node:assert/strict";
import { accessCodeFromUrl, signupErrorMessage, ACCESS_CODE_PARAM } from "./accessCode.js";

test("accessCodeFromUrl reads the invite param", () => {
  assert.equal(accessCodeFromUrl("?invite=EPIC2026"), "EPIC2026");
});

test("accessCodeFromUrl also accepts access_code", () => {
  assert.equal(accessCodeFromUrl("?access_code=FS-INTERNAL"), "FS-INTERNAL");
});

test("accessCodeFromUrl trims whitespace and returns '' when absent", () => {
  assert.equal(accessCodeFromUrl("?invite=%20EPIC2026%20"), "EPIC2026");
  assert.equal(accessCodeFromUrl("?foo=bar"), "");
  assert.equal(accessCodeFromUrl(""), "");
  assert.equal(accessCodeFromUrl(), "");
});

test("ACCESS_CODE_PARAM is 'invite'", () => {
  assert.equal(ACCESS_CODE_PARAM, "invite");
});

test("signupErrorMessage maps the GoTrue trigger-block error to friendly copy", () => {
  const friendly = signupErrorMessage({ message: "Database error saving new user" });
  assert.match(friendly, /access code isn't valid or has expired/i);
});

test("signupErrorMessage maps an explicit access-code error", () => {
  const friendly = signupErrorMessage({ message: "invalid or expired access code" });
  assert.match(friendly, /access code isn't valid or has expired/i);
});

test("signupErrorMessage passes through unrelated errors", () => {
  assert.equal(signupErrorMessage({ message: "User already registered" }), "User already registered");
});

test("signupErrorMessage handles null", () => {
  assert.equal(signupErrorMessage(null), null);
});

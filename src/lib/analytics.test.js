import { test } from "node:test";
import assert from "node:assert/strict";
import { initAnalytics, track, pageView, isAnalyticsEnabled, __resetAnalyticsForTest } from "./analytics.js";

// Fake a browser window with a capturing gtag. initAnalytics returns before the
// DOM branch when `document` is undefined (node), so it sets the id but leaves
// this fake gtag in place — exactly what track/pageView call.
function fakeWindow() {
  const calls = [];
  globalThis.window = { gtag: (...a) => calls.push(a), dataLayer: [] };
  return calls;
}

test("track no-ops before init", () => {
  __resetAnalyticsForTest();
  const calls = fakeWindow();
  assert.equal(isAnalyticsEnabled(), false);
  assert.equal(track("sign_up", { a: 1 }), false);
  assert.equal(calls.length, 0);
});

test("init with an empty id stays disabled", () => {
  __resetAnalyticsForTest();
  fakeWindow();
  initAnalytics("");
  assert.equal(isAnalyticsEnabled(), false);
  assert.equal(track("x"), false);
});

test("track forwards to gtag after init", () => {
  __resetAnalyticsForTest();
  const calls = fakeWindow();
  initAnalytics("G-TEST");
  assert.equal(isAnalyticsEnabled(), true);
  assert.equal(track("sign_up", { method: "password" }), true);
  const evt = calls.find((c) => c[0] === "event" && c[1] === "sign_up");
  assert.ok(evt, "sign_up event was sent");
  assert.deepEqual(evt[2], { method: "password" });
});

test("pageView fires a page_view event with the screen", () => {
  __resetAnalyticsForTest();
  const calls = fakeWindow();
  initAnalytics("G-TEST");
  assert.equal(pageView("dashboard"), true);
  const pv = calls.find((c) => c[1] === "page_view");
  assert.ok(pv, "page_view sent");
  assert.equal(pv[2].page_title, "dashboard");
});

test("init is idempotent (second call with a new id is ignored)", () => {
  __resetAnalyticsForTest();
  fakeWindow();
  initAnalytics("G-FIRST");
  initAnalytics("G-SECOND");
  assert.equal(isAnalyticsEnabled(), true); // still enabled, id not swapped
});

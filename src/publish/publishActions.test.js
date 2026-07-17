import { test } from "node:test";
import assert from "node:assert/strict";

import { doFirstPublish, doRepublish, doCustomize } from "./publishActions.js";

// Records every postPublish call's argument list so we can tell an OMITTED
// selection (no args) apart from a resent one (one arg, even if null).
function recorder(result = { status: "published" }) {
  const calls = [];
  const postPublish = (...args) => {
    calls.push(args);
    return Promise.resolve(result);
  };
  return { postPublish, calls };
}

test("first publish OMITS the selection (backend then defaults to everything)", async () => {
  const { postPublish, calls } = recorder();
  await doFirstPublish({ postPublish });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 0); // called with no argument → selection omitted
});

test("republish RESENDS the fetched selection, never omits it", async () => {
  const SEL = {
    version: 1,
    systemMap: true,
    systemAnalysis: false,
    futureModels: { enabled: true, scenarios: { enabled: true, ids: ["s1"] } },
  };
  const getStatus = async () => ({ status: "published", sectionsIncluded: SEL });
  const { postPublish, calls } = recorder();

  await doRepublish({ getStatus, postPublish });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1); // an argument WAS passed (not omitted)
  assert.deepEqual(calls[0][0], SEL); // and it's exactly the fetched selection
});

test("republish still passes an explicit value (not omitted) even if sectionsIncluded is null", async () => {
  const getStatus = async () => ({ status: "published", sectionsIncluded: null });
  const { postPublish, calls } = recorder();
  await doRepublish({ getStatus, postPublish });
  assert.equal(calls[0].length, 1);
  assert.equal(calls[0][0], null); // present-but-null ≠ omitted
});

test("customize publishes exactly the constructed selection", async () => {
  const SEL = { version: 1, systemMap: false, futureModels: { enabled: false } };
  const { postPublish, calls } = recorder();
  await doCustomize({ postPublish, selection: SEL });
  assert.equal(calls[0].length, 1);
  assert.deepEqual(calls[0][0], SEL);
});

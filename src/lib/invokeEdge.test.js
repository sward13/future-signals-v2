import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInvokeResult, friendlyMessage } from "./invokeEdge.js";

test("success passes data through with no error", () => {
  const out = normalizeInvokeResult({ data: { pairs: [1, 2] }, error: null });
  assert.deepEqual(out.data, { pairs: [1, 2] });
  assert.equal(out.error, null);
});

test("empty-but-successful data is not an error", () => {
  const out = normalizeInvokeResult({ data: { pairs: [] }, error: null });
  assert.deepEqual(out.data, { pairs: [] });
  assert.equal(out.error, null);
});

test("a message-only payload is data, not an error", () => {
  const out = normalizeInvokeResult({ data: { message: "Not enough inputs" }, error: null });
  assert.equal(out.error, null);
  assert.equal(out.data.message, "Not enough inputs");
});

test("transport error is normalized to a friendly Error", () => {
  const out = normalizeInvokeResult({ data: null, error: { message: "Failed to send a request" } });
  assert.equal(out.data, null);
  assert.ok(out.error instanceof Error);
  assert.match(out.error.message, /failed to send a request/i);
});

test("payload-level {error} is treated as an error", () => {
  const out = normalizeInvokeResult({ data: { error: "Forbidden" }, error: null });
  assert.equal(out.data, null);
  assert.match(out.error.message, /forbidden/i);
});

test("friendlyMessage maps timeouts to friendly copy", () => {
  assert.match(friendlyMessage(new Error("timeout")).message, /taking longer than expected/i);
});

test("friendlyMessage falls back when message is empty", () => {
  assert.match(friendlyMessage("", "Couldn't load suggestions.").message, /couldn't load suggestions/i);
  assert.match(friendlyMessage(null).message, /something went wrong/i);
});

test("friendlyMessage accepts a raw string", () => {
  assert.equal(friendlyMessage("Boom").message, "Boom");
});

/**
 * invokeEdge — one wrapper for Supabase edge-function calls so every interactive
 * call site handles failure the same way. See docs/error-handling-hardening-spec.md (P1).
 *
 * Normalizes the two failure channels into one:
 *   1. transport error   → the `error` from supabase.functions.invoke
 *   2. payload error      → a `{ error: "…" }` field inside a 200 response body
 * …and returns { data, error } where `error` is a friendly Error or null.
 *
 * Empty-but-successful responses (e.g. `{ pairs: [] }`, `{ message: "…" }`) are
 * NOT errors — they come back as { data, error: null } so callers can render a
 * calm empty state (spec item #3: distinguish empty from error).
 *
 * Optional timeout is supported but OFF by default — some edge functions (e.g.
 * compute-cluster-suggestions on a large project) legitimately run 10–40s, so
 * timeouts are opt-in per call (spec P2), never a surprise default.
 *
 * `supabase` is imported lazily inside invokeEdge (not at module top) so the pure
 * helpers below stay unit-testable under node — supabase.js pulls in Vite's
 * import.meta.env, which isn't available in the test runner.
 */

const GENERIC = "Something went wrong. Please try again.";
const TIMEOUT_MSG = "This is taking longer than expected. Please try again.";

/** Turn any error shape (string, Error, payload field) into a friendly Error. */
export function friendlyMessage(err, fallback) {
  const raw = typeof err === "string" ? err : (err && err.message) || "";
  if (/timeout/i.test(raw)) return new Error(fallback || TIMEOUT_MSG);
  return new Error(raw || fallback || GENERIC);
}

/** Pure: collapse an invoke result `{ data, error }` into a normalized `{ data, error }`. */
export function normalizeInvokeResult({ data, error } = {}, fallback) {
  if (error) return { data: null, error: friendlyMessage(error, fallback) };
  if (data && data.error) return { data: null, error: friendlyMessage(data.error, fallback) };
  return { data: data ?? null, error: null };
}

function withTimeout(promise, ms) {
  if (!ms) return promise;
  // Note: this rejects the race but does not abort the underlying request —
  // the call may still complete server-side. Adequate for a user-facing timeout.
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Call an edge function and get back a normalized { data, error }.
 * @param {string} name  edge function name
 * @param {{ body?: object, timeoutMs?: number, fallbackMessage?: string }} [opts]
 */
export async function invokeEdge(name, { body, timeoutMs, fallbackMessage } = {}) {
  try {
    const { supabase } = await import("./supabase.js");
    const call = supabase.functions.invoke(name, { body });
    const result = await withTimeout(call, timeoutMs);
    return normalizeInvokeResult(result, fallbackMessage);
  } catch (err) {
    return { data: null, error: friendlyMessage(err, fallbackMessage) };
  }
}

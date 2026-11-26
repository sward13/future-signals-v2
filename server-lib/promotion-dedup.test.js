import { test } from "node:test";
import assert from "node:assert/strict";

import { workspaceHasCandidate } from "./promotion-dedup.js";

// Minimal fake of the supabase query builder used by workspaceHasCandidate:
// from('inputs').select('id').eq(col, val)...limit(n) → { data, error }.
// Filters a static row set; `metadata->>candidate_id` reads row.metadata.candidate_id.
function fakeClient(rows, { error = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, "inputs");
      const filters = [];
      const builder = {
        select() { return builder; },
        eq(col, val) { filters.push([col, val]); return builder; },
        limit(n) {
          calls.push(filters.slice());
          if (error) return Promise.resolve({ data: null, error });
          const read = (row, col) =>
            col === "metadata->>candidate_id" ? row.metadata?.candidate_id : row[col];
          const data = rows
            .filter((r) => filters.every(([col, val]) => read(r, col) === val))
            .slice(0, n)
            .map((r) => ({ id: r.id }));
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
}

const WS = "ws-mine";
const OTHER = "ws-other";
const URL = "https://example.com/article?a=1,(b)";

test("false when the workspace has no matching input", async () => {
  const db = fakeClient([]);
  assert.equal(await workspaceHasCandidate(db, { workspaceId: WS, sourceUrl: URL, candidateId: "c1" }), false);
});

test("ignores a copy of the article in ANOTHER workspace (old global check skipped it)", async () => {
  const db = fakeClient([{ id: "x", workspace_id: OTHER, source_url: URL, metadata: { candidate_id: "c1" } }]);
  assert.equal(await workspaceHasCandidate(db, { workspaceId: WS, sourceUrl: URL, candidateId: "c1" }), false);
});

test("true when the workspace already has the same source_url", async () => {
  const db = fakeClient([{ id: "m", workspace_id: WS, source_url: URL, metadata: {} }]);
  assert.equal(await workspaceHasCandidate(db, { workspaceId: WS, sourceUrl: URL, candidateId: "c1" }), true);
});

test("true when the workspace has the candidate via metadata.candidate_id (onboarding) even if URL differs", async () => {
  const db = fakeClient([{ id: "m", workspace_id: WS, source_url: "https://other.url", metadata: { candidate_id: "c1" } }]);
  assert.equal(await workspaceHasCandidate(db, { workspaceId: WS, sourceUrl: URL, candidateId: "c1" }), true);
});

test("regression: own onboarding copy + another workspace's copy → still detected (old .single() saw 2 rows and errored)", async () => {
  const db = fakeClient([
    { id: "theirs", workspace_id: OTHER, source_url: URL, metadata: {} },
    { id: "mine", workspace_id: WS, source_url: URL, metadata: { source: "onboarding_scanner", candidate_id: "c1" } },
  ]);
  assert.equal(await workspaceHasCandidate(db, { workspaceId: WS, sourceUrl: URL, candidateId: "c1" }), true);
});

test("true when the workspace already has multiple copies (no .single() error path)", async () => {
  const db = fakeClient([
    { id: "a", workspace_id: WS, source_url: URL, metadata: {} },
    { id: "b", workspace_id: WS, source_url: URL, metadata: {} },
  ]);
  assert.equal(await workspaceHasCandidate(db, { workspaceId: WS, sourceUrl: URL }), true);
});

test("every query is scoped to the destination workspace", async () => {
  const db = fakeClient([]);
  await workspaceHasCandidate(db, { workspaceId: WS, sourceUrl: URL, candidateId: "c1" });
  assert.equal(db.calls.length, 2);
  for (const filters of db.calls) assert.deepEqual(filters[0], ["workspace_id", WS]);
});

test("fails closed: a query error throws instead of reporting 'not found'", async () => {
  const db = fakeClient([], { error: { message: "boom" } });
  await assert.rejects(
    workspaceHasCandidate(db, { workspaceId: WS, sourceUrl: URL, candidateId: "c1" }),
    /dedup check on source_url failed: boom/,
  );
});

test("requires a workspaceId", async () => {
  await assert.rejects(workspaceHasCandidate(fakeClient([]), { sourceUrl: URL }), /workspaceId is required/);
});

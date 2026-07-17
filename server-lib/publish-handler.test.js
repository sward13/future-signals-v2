import { test } from "node:test";
import assert from "node:assert/strict";

// public URL is derived from SUPABASE_URL — set a dummy so the handler can build it.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://staging.example.supabase.co";

import { createPublishHandler } from "./publish-handler.js";
import { normalizeSelection } from "./publish-project.js";

// ─── In-memory fake Supabase client (auth + tables + storage) ───────────────────
//
// Generic filter engine: select applies every .eq() and any .in() filter; single
// resolves to the first match. Records inserts/updates/uploads/removals. Storage
// remove can be forced to fail.

function makeFakeClient(fixtures = {}, opts = {}) {
  const pubRows = (fixtures.project_publications || []).map((r) => ({ ...r }));
  const files = { ...(fixtures.storageFiles || {}) }; // path -> html string
  const calls = { inserts: [], updates: [], uploads: [], removals: [] };

  const baseRows = (table) => {
    if (table === "workspaces") return fixtures.workspaces || [];
    if (table === "projects") return fixtures.projects || [];
    if (table === "project_publications") return pubRows;
    return fixtures[table] || [];
  };

  function resolve(state) {
    const { table, op, filters, payload } = state;
    if (op === "insert") {
      pubRows.push({ ...payload });
      calls.inserts.push({ table, row: { ...payload } });
      return { data: null, error: null };
    }
    if (op === "update") {
      calls.updates.push({ table, patch: payload, filters });
      for (const r of pubRows) {
        if (Object.entries(filters).every(([k, v]) => k === "__in" || r[k] === v)) Object.assign(r, payload);
      }
      return { data: null, error: null };
    }
    let rows = baseRows(table);
    for (const [k, v] of Object.entries(filters)) {
      if (k === "__in") continue;
      rows = rows.filter((r) => r[k] === v);
    }
    if (filters.__in) rows = rows.filter((r) => filters.__in.arr.includes(r[filters.__in.col]));
    return { data: rows, error: null };
  }

  function builder(table) {
    const state = { table, op: "select", filters: {}, payload: null };
    const b = {
      select() { return b; },
      insert(p) { state.op = "insert"; state.payload = p; return b; },
      update(p) { state.op = "update"; state.payload = p; return b; },
      eq(col, val) { state.filters[col] = val; return b; },
      in(col, arr) { state.filters.__in = { col, arr }; return b; },
      single() { const r = resolve(state); const row = r.data && r.data[0]; return Promise.resolve({ data: row || null, error: row ? null : { message: "no rows" } }); },
      maybeSingle() { const r = resolve(state); return Promise.resolve({ data: (r.data && r.data[0]) || null, error: null }); },
      then(onF, onR) { return Promise.resolve(resolve(state)).then(onF, onR); },
    };
    return b;
  }

  return {
    auth: {
      getUser: (token) => Promise.resolve({ data: { user: fixtures.tokens?.[token] || null }, error: fixtures.tokens?.[token] ? null : { message: "bad token" } }),
    },
    from: (table) => builder(table),
    storage: {
      from: () => ({
        upload: (path, body, options) => { calls.uploads.push({ path, body, options }); files[path] = body; return Promise.resolve({ data: { path }, error: null }); },
        remove: (paths) => {
          if (opts.removeShouldFail) return Promise.resolve({ data: null, error: { message: "remove failed" } });
          calls.removals.push(...paths);
          for (const p of paths) delete files[p];
          return Promise.resolve({ data: paths.map((p) => ({ name: p })), error: null });
        },
        download: (path) => {
          if (!(path in files)) return Promise.resolve({ data: null, error: { message: "not found" } });
          const body = files[path];
          return Promise.resolve({ data: { text: async () => body }, error: null });
        },
      }),
    },
    __calls: calls,
    __pubRows: pubRows,
    __files: files,
  };
}

function mockRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.end = (b) => { if (b !== undefined) res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  return res;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PID = "proj-1";
const WID = "ws-1";
const TOKEN = "good-token";

function baseFixtures(extra = {}) {
  return {
    tokens: { [TOKEN]: { id: "user-1" } },
    workspaces: [{ id: WID, user_id: "user-1" }],
    projects: [{ id: PID, workspace_id: WID, name: "EV Adoption in the US" }],
    // content tables empty — publish still assembles a valid page
    clusters: [], inputs: [], relationships: [], canvas_nodes: [],
    canvas_text_nodes: [], scenarios: [], preferred_futures: [],
    strategic_options: [], analyses: [], cluster_inputs: [],
    ...extra,
  };
}

const authHeaders = { authorization: `Bearer ${TOKEN}` };

// ─── Publish ──────────────────────────────────────────────────────────────────

test("POST publish: publishes an owned project and returns slug + public URL", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "POST", headers: authHeaders, body: { projectId: PID, action: "publish" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "published");
  assert.equal(res.body.slug, "ev-adoption-in-the-us");
  assert.match(res.body.publicUrl, /\/p\/ev-adoption-in-the-us$/);

  // the file was actually uploaded, and the row finalized to published
  assert.equal(client.__calls.uploads.length, 1);
  assert.equal(client.__calls.uploads[0].path, "ev-adoption-in-the-us/index.html");
  const row = client.__pubRows.find((r) => r.project_id === PID);
  assert.equal(row.status, "published");
});

// ─── Section selection (POST body → publishProject → sections_included) ──────────

const PARTIAL_SELECTION = {
  systemMap: true,
  systemAnalysis: false,
  futureModels: {
    enabled: true,
    scenarios: { enabled: true, ids: ["s1", "s2"] },
    preferredFutures: { enabled: true, ids: null },
    strategicOptions: { enabled: false },
  },
};

test("POST publish: passes the request-body selection through and persists it", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler(
    { method: "POST", headers: authHeaders, body: { projectId: PID, action: "publish", selection: PARTIAL_SELECTION } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.sectionsIncluded, normalizeSelection(PARTIAL_SELECTION));
  const row = client.__pubRows.find((r) => r.project_id === PID);
  assert.deepEqual(row.sections_included, normalizeSelection(PARTIAL_SELECTION));
});

test("sections_included round-trips: publish a selection, read it back via GET status", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });

  const pubRes = mockRes();
  await handler(
    { method: "POST", headers: authHeaders, body: { projectId: PID, action: "publish", selection: PARTIAL_SELECTION } },
    pubRes
  );

  const getRes = mockRes();
  await handler({ method: "GET", headers: authHeaders, query: { projectId: PID } }, getRes);

  assert.equal(getRes.statusCode, 200);
  assert.deepEqual(getRes.body.sectionsIncluded, normalizeSelection(PARTIAL_SELECTION));
  assert.deepEqual(getRes.body.sectionsIncluded, pubRes.body.sectionsIncluded); // same shape both ways
});

test("GET status: sectionsIncluded is null before the first publish", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "GET", headers: authHeaders, query: { projectId: PID } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sectionsIncluded, null);
});

// ─── Unpublish ──────────────────────────────────────────────────────────────

test("POST unpublish: removes the storage object AND flips status, keeping the row/slug", async () => {
  const client = makeFakeClient(
    baseFixtures({
      project_publications: [{ project_id: PID, workspace_id: WID, slug: "stable-slug", status: "published", published_at: "2026-01-01T00:00:00.000Z" }],
    })
  );
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "POST", headers: authHeaders, body: { projectId: PID, action: "unpublish" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "unpublished");

  // storage object actually removed (flipping the flag alone wouldn't take it offline)
  assert.deepEqual(client.__calls.removals, ["stable-slug/index.html"]);

  // row kept, slug preserved for a stable future republish, status flipped
  const row = client.__pubRows.find((r) => r.project_id === PID);
  assert.ok(row);
  assert.equal(row.slug, "stable-slug");
  assert.equal(row.status, "unpublished");
  assert.equal(row.published_at, "2026-01-01T00:00:00.000Z"); // preserved
});

test("POST unpublish: does not flip status if the storage removal fails", async () => {
  const client = makeFakeClient(
    baseFixtures({
      project_publications: [{ project_id: PID, workspace_id: WID, slug: "stable-slug", status: "published" }],
    }),
    { removeShouldFail: true }
  );
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "POST", headers: authHeaders, body: { projectId: PID, action: "unpublish" } }, res);

  assert.equal(res.statusCode, 500);
  const row = client.__pubRows.find((r) => r.project_id === PID);
  assert.equal(row.status, "published"); // still live — not falsely marked down
});

// ─── Auth / ownership ──────────────────────────────────────────────────────────

test("rejects a non-owner: a project in another workspace is 404, and nothing is published", async () => {
  const client = makeFakeClient(
    baseFixtures({ projects: [{ id: PID, workspace_id: "someone-elses-ws", name: "Not yours" }] })
  );
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "POST", headers: authHeaders, body: { projectId: PID, action: "publish" } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(client.__calls.uploads.length, 0);
  assert.equal(client.__calls.inserts.length, 0);
});

test("rejects a missing/invalid bearer token with 401", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });

  const noHeader = mockRes();
  await handler({ method: "POST", headers: {}, body: { projectId: PID, action: "publish" } }, noHeader);
  assert.equal(noHeader.statusCode, 401);

  const badToken = mockRes();
  await handler({ method: "POST", headers: { authorization: "Bearer nope" }, body: { projectId: PID, action: "publish" } }, badToken);
  assert.equal(badToken.statusCode, 401);
});

// ─── Status (GET) ──────────────────────────────────────────────────────────────

test("GET: reports current publish status for an owned project", async () => {
  const client = makeFakeClient(
    baseFixtures({
      project_publications: [{ project_id: PID, workspace_id: WID, slug: "stable-slug", status: "published", published_at: "2026-01-01T00:00:00.000Z" }],
    })
  );
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "GET", headers: authHeaders, query: { projectId: PID } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "published");
  assert.equal(res.body.slug, "stable-slug");
  assert.match(res.body.publicUrl, /\/p\/stable-slug$/);
});

test("GET: reports 'unpublished' with no link when the project was never published", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "GET", headers: authHeaders, query: { projectId: PID } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "unpublished");
  assert.equal(res.body.slug, null);
  assert.equal(res.body.publicUrl, null);
});

// ─── Method / arg guards ───────────────────────────────────────────────────────

test("rejects an unsupported method and a bad action", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });

  const wrongMethod = mockRes();
  await handler({ method: "DELETE", headers: authHeaders, body: {} }, wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);

  const badAction = mockRes();
  await handler({ method: "POST", headers: authHeaders, body: { projectId: PID, action: "explode" } }, badAction);
  assert.equal(badAction.statusCode, 400);
});

// ─── Public page serving (GET ?view={slug}) ─────────────────────────────────────

function publishedFixtures(slug, html) {
  return baseFixtures({
    project_publications: [{ project_id: PID, workspace_id: WID, slug, status: "published", storage_path: `${slug}/index.html` }],
    storageFiles: { [`${slug}/index.html`]: html },
  });
}

test("GET ?view: serves real HTML with a no-cache (always-revalidate) header + ETag", async () => {
  const html = "<!DOCTYPE html><html><body>Hello world</body></html>";
  const client = makeFakeClient(publishedFixtures("live-slug", html));
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "GET", headers: {}, query: { view: "live-slug" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, html);
  assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
  // must always revalidate so a republish shows up immediately — no max-age/immutable
  assert.equal(res.headers["cache-control"], "no-cache");
  assert.doesNotMatch(res.headers["cache-control"], /max-age|immutable/);
  assert.ok(res.headers["etag"], "an ETag is set for conditional requests");
});

test("GET ?view: a matching If-None-Match returns 304 with no body (cheap repeat view)", async () => {
  const html = "<!DOCTYPE html><html><body>Same content</body></html>";
  const client = makeFakeClient(publishedFixtures("etag-slug", html));
  const handler = createPublishHandler({ supabase: client });

  // first request to learn the ETag
  const first = mockRes();
  await handler({ method: "GET", headers: {}, query: { view: "etag-slug" } }, first);
  const etag = first.headers["etag"];
  assert.ok(etag);

  // conditional request with that ETag → 304, no body
  const second = mockRes();
  await handler({ method: "GET", headers: { "if-none-match": etag }, query: { view: "etag-slug" } }, second);
  assert.equal(second.statusCode, 304);
  assert.equal(second.body, null);
});

test("GET ?view: the ETag changes when the published content changes (republish is visible)", async () => {
  const a = mockRes();
  await createPublishHandler({ supabase: makeFakeClient(publishedFixtures("s", "<html>v1</html>")) })(
    { method: "GET", headers: {}, query: { view: "s" } }, a
  );
  const b = mockRes();
  await createPublishHandler({ supabase: makeFakeClient(publishedFixtures("s", "<html>v2</html>")) })(
    { method: "GET", headers: {}, query: { view: "s" } }, b
  );
  assert.notEqual(a.headers["etag"], b.headers["etag"]);
});

test("GET ?view: an anonymous request (no token) succeeds — RLS bypassed, not silently empty", async () => {
  const html = "<h1>Public page</h1>";
  const client = makeFakeClient(publishedFixtures("anon-slug", html));
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  // No Authorization header at all — this is the anonymous viewer path.
  await handler({ method: "GET", headers: {}, query: { view: "anon-slug" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, html); // real content returned, not an empty RLS result
});

test("GET ?view: an unpublished slug returns 404", async () => {
  const client = makeFakeClient(
    baseFixtures({ project_publications: [{ project_id: PID, workspace_id: WID, slug: "down-slug", status: "unpublished", storage_path: "down-slug/index.html" }] })
  );
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "GET", headers: {}, query: { view: "down-slug" } }, res);
  assert.equal(res.statusCode, 404);
});

test("GET ?view: an unknown slug returns 404", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "GET", headers: {}, query: { view: "does-not-exist" } }, res);
  assert.equal(res.statusCode, 404);
});

test("GET ?view: a published row whose file is missing returns 404, not a broken 200", async () => {
  const client = makeFakeClient(
    baseFixtures({ project_publications: [{ project_id: PID, workspace_id: WID, slug: "orphan", status: "published", storage_path: "orphan/index.html" }] })
  );
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "GET", headers: {}, query: { view: "orphan" } }, res);
  assert.equal(res.statusCode, 404);
});

test("HEAD ?view: returns GET's status + headers with an empty body", async () => {
  const html = "<!DOCTYPE html><html><body>Hi there</body></html>";
  const client = makeFakeClient(publishedFixtures("head-slug", html));
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "HEAD", headers: {}, query: { view: "head-slug" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
  assert.equal(res.headers["cache-control"], "no-cache");
  assert.equal(res.headers["content-length"], String(html.length));
  assert.equal(res.body, null); // HEAD has no body
});

test("HEAD ?view: an unpublished slug returns 404 with no body", async () => {
  const client = makeFakeClient(
    baseFixtures({ project_publications: [{ project_id: PID, workspace_id: WID, slug: "head-down", status: "unpublished", storage_path: "head-down/index.html" }] })
  );
  const handler = createPublishHandler({ supabase: client });
  const res = mockRes();
  await handler({ method: "HEAD", headers: {}, query: { view: "head-down" } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body, null);
});

test("publish then view: the served page is the freshly published, rendered HTML", async () => {
  const client = makeFakeClient(baseFixtures());
  const handler = createPublishHandler({ supabase: client });

  const pubRes = mockRes();
  await handler({ method: "POST", headers: authHeaders, body: { projectId: PID, action: "publish" } }, pubRes);
  assert.equal(pubRes.statusCode, 200);
  const slug = pubRes.body.slug;

  const viewRes = mockRes();
  await handler({ method: "GET", headers: {}, query: { view: slug } }, viewRes);
  assert.equal(viewRes.statusCode, 200);
  assert.equal(viewRes.headers["content-type"], "text/html; charset=utf-8");
  assert.match(viewRes.body, /^<!DOCTYPE html>/);
  assert.match(viewRes.body, /EV Adoption in the US/);
});

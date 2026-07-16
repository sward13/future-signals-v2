import { test } from "node:test";
import assert from "node:assert/strict";

import { publishProject, assembleHtml, ALL_SECTIONS } from "./publish-project.js";

// ─── Minimal in-memory fake of the subset of the Supabase client used here ──────
//
// Records inserts/updates/uploads for assertions. Query builder is thenable so
// `await from(t).select().eq(...)` resolves, and `.single()/.maybeSingle()`
// resolve to a single row. Storage upload can be forced to fail.

function makeFakeClient(fixtures = {}, opts = {}) {
  const pubRows = (fixtures.project_publications || []).map((r) => ({ ...r }));
  const calls = { inserts: [], updates: [], uploads: [] };

  function resolve(state) {
    const { table, op, filters, payload } = state;

    if (op === "insert") {
      const row = { ...payload };
      pubRows.push(row);
      calls.inserts.push({ table, row: { ...payload } }); // snapshot, not a live ref
      return { data: null, error: null };
    }
    if (op === "update") {
      calls.updates.push({ table, patch: payload, filters });
      for (const r of pubRows) {
        if (filters.project_id && r.project_id === filters.project_id) Object.assign(r, payload);
      }
      return { data: null, error: opts.updateShouldFail ? { message: "update failed" } : null };
    }

    // select
    if (table === "projects") {
      const p = fixtures.project && fixtures.project.id === filters.id ? fixtures.project : null;
      return { data: p, error: p ? null : { message: "not found" } };
    }
    if (table === "project_publications") {
      let rows = pubRows;
      if (filters.project_id) rows = rows.filter((r) => r.project_id === filters.project_id);
      if (filters.slug) rows = rows.filter((r) => r.slug === filters.slug);
      return { data: rows, error: null, __rows: rows };
    }
    // .in(col, arr) filter (used for cluster_inputs, which has no project_id)
    if (filters.__in) {
      const { col, arr } = filters.__in;
      const rows = (fixtures[table] || []).filter((r) => arr.includes(r[col]));
      return { data: rows, error: null };
    }
    // project-scoped content tables
    const rows = (fixtures[table] || []).filter((r) => r.project_id === filters.project_id);
    return { data: rows, error: null };
  }

  function makeBuilder(table) {
    const state = { table, op: "select", filters: {}, payload: null };
    const builder = {
      select() { state.op = state.op === "select" ? "select" : state.op; return builder; },
      insert(payload) { state.op = "insert"; state.payload = payload; return builder; },
      update(payload) { state.op = "update"; state.payload = payload; return builder; },
      eq(col, val) { state.filters[col] = val; return builder; },
      in(col, arr) { state.filters.__in = { col, arr }; return builder; },
      single() { const r = resolve(state); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: r.data && (!Array.isArray(r.data) || r.data.length) ? r.error : (Array.isArray(r.data) ? { message: "no rows" } : r.error) }); },
      maybeSingle() { const r = resolve(state); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: null }); },
      then(onF, onR) { return Promise.resolve(resolve(state)).then(onF, onR); },
    };
    return builder;
  }

  return {
    from: (table) => makeBuilder(table),
    storage: {
      from: (bucket) => ({
        upload: (path, body, options) => {
          if (opts.uploadShouldFail) return Promise.resolve({ data: null, error: { message: "boom" } });
          calls.uploads.push({ bucket, path, body, options });
          return Promise.resolve({ data: { path }, error: null });
        },
      }),
    },
    __calls: calls,
    __pubRows: pubRows,
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PID = "proj-1";
const WID = "ws-1";

const baseFixtures = () => ({
  project: {
    id: PID, workspace_id: WID, name: "The State of GLP-1s",
    question: "How might access reshape strategy?", domain: "Health", geo: "US",
    h1_start: "2026", h1_end: "2029", h2_start: "2029", h2_end: "2035", h3_start: "2035", h3_end: "2041",
  },
  clusters: [{ id: "c1", project_id: PID, name: "Access widens", subtype: "Trend", horizon: "H1", likelihood: "Plausible", description: "d" }],
  inputs: [{ id: "i1", project_id: PID, name: "A signal", subtype: "Signal", horizon: "H1", source_url: "https://example.com" }],
  cluster_inputs: [{ cluster_id: "c1", input_id: "i1", workspace_id: WID }], // no project_id column
  relationships: [],
  canvas_nodes: [{ cluster_id: "c1", x: 100, y: 100, project_id: PID }],
  canvas_text_nodes: [],
  scenarios: [{ id: "s1", project_id: PID, name: "A scenario", archetype: "Continuation", horizon: "H2", description: "desc", driving_forces: ["c1"] }],
  preferred_futures: [{ id: "pf1", project_id: PID, name: "A future", description: "d", scenario_ids: ["s1"] }],
  strategic_options: [{ id: "o1", project_id: PID, name: "An option", description: "d", scenario_ids: ["s1"] }],
  analyses: [{ id: "a1", project_id: PID, description: "analysis", confidence: "Moderate" }],
});

const NOW = "2026-07-15T12:00:00.000Z";

// ─── assembleHtml (unit) ───────────────────────────────────────────────────────

test("assembleHtml produces a complete document with every section in order", () => {
  const f = baseFixtures();
  const html = assembleHtml(
    {
      project: f.project, clusters: f.clusters.map((c) => ({ ...c, input_ids: ["i1"] })),
      inputs: f.inputs, relationships: f.relationships, canvasNodes: f.canvas_nodes,
      canvasTextNodes: f.canvas_text_nodes, scenarios: f.scenarios,
      preferredFutures: f.preferred_futures, strategicOptions: f.strategic_options, analysis: f.analyses[0],
    },
    { publishedAt: NOW }
  );
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /The State of GLP-1s/);
  assert.match(html, /<svg/); // system map
  assert.match(html, /System analysis/);
  assert.match(html, /A scenario/);
  assert.match(html, /A future/);
  assert.match(html, /An option/);
  assert.match(html, /Appendix/);
  assert.match(html, /Powered by Future Signals/);
  assert.doesNotMatch(html, /undefined/);
  // ordering
  assert.ok(html.indexOf("System map") < html.indexOf("System analysis"));
  assert.ok(html.indexOf("System analysis") < html.indexOf("Appendix"));
});

// ─── Open Graph tags ─────────────────────────────────────────────────────────────

function bareData(project, publicUrl) {
  const html = assembleHtml(
    { project, clusters: [], inputs: [], relationships: [], canvasNodes: [], canvasTextNodes: [], scenarios: [], preferredFutures: [], strategicOptions: [], analysis: null },
    { publishedAt: NOW, publicUrl }
  );
  return html.slice(0, html.indexOf("</head>")); // the <head> only
}

test("assembleHtml puts og:title/description/type/url in <head> for a normal project", () => {
  const head = bareData(baseFixtures().project, "https://app.example.com/p/the-state-of-glp-1s");
  assert.match(head, /<meta property="og:title" content="The State of GLP-1s">/);
  assert.match(head, /<meta property="og:description" content="How might access reshape strategy\?">/);
  assert.match(head, /<meta property="og:type" content="website">/);
  assert.match(head, /<meta property="og:url" content="https:\/\/app\.example\.com\/p\/the-state-of-glp-1s">/);
});

test("assembleHtml: og:description falls back to focus, truncates long text, and escapes markup", () => {
  const longQuestion = "A".repeat(300);
  const head = bareData({ name: 'A "quoted" & <b>bold</b> project', question: longQuestion });
  assert.match(head, /<meta property="og:title" content="A &quot;quoted&quot; &amp; &lt;b&gt;bold&lt;\/b&gt; project">/);
  // truncated to ~200 chars with an ellipsis, not the full 300
  const desc = head.match(/og:description" content="([^"]*)"/)[1];
  assert.ok(desc.length <= 201 && desc.endsWith("…"));
  // og:url omitted when no publicUrl was provided
  assert.doesNotMatch(head, /og:url/);
});

test("assembleHtml: og:description uses focus when there is no key question", () => {
  const head = bareData({ name: "Untitled", focus: "consumer electric vehicles" });
  assert.match(head, /<meta property="og:description" content="consumer electric vehicles">/);
});

// ─── First publish ─────────────────────────────────────────────────────────────

test("first publish: inserts a new row, uploads, sets status=published + published_at", async () => {
  const client = makeFakeClient(baseFixtures());
  const result = await publishProject(PID, { supabase: client, now: NOW });

  assert.equal(result.isRepublish, false);
  assert.equal(result.slug, "the-state-of-glp-1s");
  assert.equal(result.storagePath, "the-state-of-glp-1s/index.html");

  // a new row was inserted, initially unpublished
  assert.equal(client.__calls.inserts.length, 1);
  assert.equal(client.__calls.inserts[0].row.status, "unpublished");
  assert.equal(client.__calls.inserts[0].row.workspace_id, WID);
  assert.deepEqual(client.__calls.inserts[0].row.sections_included.sections, ALL_SECTIONS);

  // uploaded to {slug}/index.html with upsert
  assert.equal(client.__calls.uploads.length, 1);
  assert.equal(client.__calls.uploads[0].path, "the-state-of-glp-1s/index.html");
  assert.equal(client.__calls.uploads[0].options.upsert, true);
  assert.match(client.__calls.uploads[0].body, /<!DOCTYPE html>/);

  // finalized: published + published_at (not republished_at)
  assert.equal(client.__calls.updates.length, 1);
  const patch = client.__calls.updates[0].patch;
  assert.equal(patch.status, "published");
  assert.equal(patch.published_at, NOW);
  assert.equal(patch.republished_at, undefined);
  assert.equal(patch.storage_path, "the-state-of-glp-1s/index.html");
});

test("first publish: upload happens before the published status write", async () => {
  const client = makeFakeClient(baseFixtures());
  const order = [];
  const origUpload = client.storage.from;
  client.storage.from = (b) => {
    const s = origUpload(b);
    return { upload: (...a) => { order.push("upload"); return s.upload(...a); } };
  };
  const origFrom = client.from;
  client.from = (t) => {
    const b = origFrom(t);
    const origUpdate = b.update.bind(b);
    b.update = (p) => { order.push("update"); return origUpdate(p); };
    return b;
  };
  await publishProject(PID, { supabase: client, now: NOW });
  assert.deepEqual(order, ["upload", "update"]);
});

// ─── Republish ──────────────────────────────────────────────────────────────────

test("republish: reuses the existing slug, overwrites the object, sets republished_at", async () => {
  const f = baseFixtures();
  f.project_publications = [
    { project_id: PID, workspace_id: WID, slug: "stable-slug", status: "published", published_at: "2026-01-01T00:00:00.000Z" },
  ];
  const client = makeFakeClient(f);
  const result = await publishProject(PID, { supabase: client, now: NOW });

  assert.equal(result.isRepublish, true);
  assert.equal(result.slug, "stable-slug"); // unchanged — link must not rot

  // no new row inserted
  assert.equal(client.__calls.inserts.length, 0);

  // overwrote the same path
  assert.equal(client.__calls.uploads.length, 1);
  assert.equal(client.__calls.uploads[0].path, "stable-slug/index.html");

  // republished_at set, published_at preserved (not in patch)
  const patch = client.__calls.updates[0].patch;
  assert.equal(patch.status, "published");
  assert.equal(patch.republished_at, NOW);
  assert.equal(patch.published_at, undefined);
});

// ─── Failed upload ────────────────────────────────────────────────────────────

test("upload failure: throws and never flips status to published", async () => {
  const client = makeFakeClient(baseFixtures(), { uploadShouldFail: true });
  await assert.rejects(() => publishProject(PID, { supabase: client, now: NOW }), /Storage upload failed/);

  // the row was inserted (unpublished) but never updated to published
  assert.equal(client.__calls.uploads.length, 0);
  assert.equal(client.__calls.updates.length, 0);
  const row = client.__pubRows.find((r) => r.project_id === PID);
  assert.ok(row);
  assert.equal(row.status, "unpublished");
});

test("republish upload failure: keeps the prior published row unchanged", async () => {
  const f = baseFixtures();
  f.project_publications = [
    { project_id: PID, workspace_id: WID, slug: "stable-slug", status: "published", published_at: "2026-01-01T00:00:00.000Z" },
  ];
  const client = makeFakeClient(f, { uploadShouldFail: true });
  await assert.rejects(() => publishProject(PID, { supabase: client, now: NOW }), /Storage upload failed/);

  assert.equal(client.__calls.updates.length, 0);
  const row = client.__pubRows.find((r) => r.project_id === PID);
  assert.equal(row.status, "published"); // old content still live, untouched
  assert.equal(row.republished_at, undefined);
});

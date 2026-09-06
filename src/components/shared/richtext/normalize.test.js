import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDoc, serializeRichText } from "./normalize.js";

const P = (content) => ({ type: "doc", content });

test("normalizeDoc: valid document passes through unchanged", () => {
  const doc = P([
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
    { type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "bold" }] }] },
  ]);
  const out = normalizeDoc(doc);
  assert.equal(out.content[0].type, "heading");
  assert.equal(out.content[1].content[0].marks[0].type, "bold");
});

test("normalizeDoc: empty → null", () => {
  assert.equal(normalizeDoc(null), null);
  assert.equal(normalizeDoc(P([])), null);
  assert.equal(normalizeDoc(P([{ type: "paragraph", content: [] }])), null);
});

test("normalizeDoc: disallowed node type is rejected, text recovered", () => {
  const doc = P([
    { type: "paragraph", content: [{ type: "text", text: "keep me" }] },
    { type: "iframe", attrs: { src: "javascript:alert(1)" } },
  ]);
  const out = normalizeDoc(doc);
  // No iframe survives; the recoverable text is preserved as a paragraph.
  const json = JSON.stringify(out);
  assert.ok(!json.includes("iframe"), "iframe node must not survive");
  assert.match(json, /keep me/);
});

test("normalizeDoc: disallowed mark is rejected, text recovered", () => {
  const doc = P([{ type: "paragraph", content: [{ type: "text", text: "styled", marks: [{ type: "strike" }] }] }]);
  const out = normalizeDoc(doc);
  const json = JSON.stringify(out);
  assert.ok(!json.includes("strike"), "strike mark must not survive");
  assert.match(json, /styled/);
});

test("normalizeDoc: unknown attributes are stripped from valid nodes", () => {
  const doc = P([{ type: "paragraph", attrs: { evil: "<script>" }, content: [{ type: "text", text: "x" }] }]);
  const out = normalizeDoc(doc);
  assert.ok(!JSON.stringify(out).includes("evil"), "unknown attr stripped");
  assert.match(JSON.stringify(out), /"x"/);
});

test("serializeRichText: is the save-path alias for normalizeDoc", () => {
  const doc = P([{ type: "paragraph", content: [{ type: "text", text: "ok" }] }]);
  assert.deepEqual(serializeRichText(doc), normalizeDoc(doc));
  assert.equal(serializeRichText(null), null);
});

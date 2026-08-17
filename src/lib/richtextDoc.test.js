import { test } from "node:test";
import assert from "node:assert/strict";
import {
  textToDoc, docIsEmpty, docToText, docToHtml, docToMarkdown, EMPTY_DOC,
} from "./richtextDoc.js";

// ── textToDoc: legacy plain text → doc ────────────────────────────────────────
test("textToDoc: empty / whitespace → empty doc", () => {
  assert.deepEqual(textToDoc(""), EMPTY_DOC);
  assert.deepEqual(textToDoc("   \n  "), EMPTY_DOC);
  assert.deepEqual(textToDoc(null), EMPTY_DOC);
});

test("textToDoc: blank lines split into separate paragraphs", () => {
  const doc = textToDoc("First para.\n\nSecond para.");
  assert.equal(doc.content.length, 2);
  assert.equal(doc.content[0].type, "paragraph");
  assert.equal(doc.content[0].content[0].text, "First para.");
  assert.equal(doc.content[1].content[0].text, "Second para.");
});

test("textToDoc: single newline within a block → hardBreak (preserves pre-wrap)", () => {
  const doc = textToDoc("Line one\nLine two");
  assert.equal(doc.content.length, 1);
  const inline = doc.content[0].content;
  assert.deepEqual(inline.map((n) => n.type), ["text", "hardBreak", "text"]);
  assert.equal(inline[0].text, "Line one");
  assert.equal(inline[2].text, "Line two");
});

test("textToDoc: 3+ newlines collapse to one paragraph break", () => {
  const doc = textToDoc("A\n\n\n\nB");
  assert.equal(doc.content.length, 2);
});

// ── docIsEmpty ────────────────────────────────────────────────────────────────
test("docIsEmpty: true for empty, null, stray-empty-paragraph docs", () => {
  assert.equal(docIsEmpty(EMPTY_DOC), true);
  assert.equal(docIsEmpty(null), true);
  assert.equal(docIsEmpty({ type: "doc", content: [{ type: "paragraph", content: [] }] }), true);
  assert.equal(docIsEmpty({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }] }), true);
});
test("docIsEmpty: false when real text present", () => {
  assert.equal(docIsEmpty(textToDoc("hi")), false);
});

// ── round-trip: text → doc → text preserves structure ────────────────────────
test("docToText: round-trips legacy text (paragraphs + line breaks)", () => {
  const original = "Line one\nLine two\n\nSecond para.";
  assert.equal(docToText(textToDoc(original)), original);
});

// ── docToHtml: formatting ─────────────────────────────────────────────────────
test("docToHtml: paragraphs, headings, marks, lists, links", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      { type: "paragraph", content: [
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: " and " },
        { type: "text", text: "italic", marks: [{ type: "italic" }] },
      ] },
      { type: "bulletList", content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
      ] },
      { type: "paragraph", content: [
        { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
      ] },
    ],
  };
  const html = docToHtml(doc);
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>bold<\/strong> and <em>italic<\/em>/);
  assert.match(html, /<ul><li>one<\/li><\/ul>/);
  assert.match(html, /<a href="https:\/\/example\.com" rel="nofollow noopener noreferrer" target="_blank">link<\/a>/);
});

test("docToHtml: heading level clamps to 2/3", () => {
  const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "x" }] }] };
  assert.match(docToHtml(doc), /<h2>x<\/h2>/); // level 1 not allowed → falls back to h2
});

// ── docToHtml: SECURITY (XSS payloads) ────────────────────────────────────────
test("docToHtml: escapes HTML in text content", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] }] };
  const html = docToHtml(doc);
  assert.ok(!html.includes("<script>"), "must not emit a script tag");
  assert.match(html, /&lt;script&gt;/);
});

test("docToHtml: strips javascript: and data: hrefs to #", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox"]) {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "x", marks: [{ type: "link", attrs: { href: bad } }] },
    ] }] };
    const html = docToHtml(doc);
    assert.match(html, /href="#"/, `href ${bad} must be neutralized`);
    assert.ok(!html.toLowerCase().includes("javascript:"), "no javascript: URL");
  }
});

test("docToHtml: drops disallowed node types entirely", () => {
  const doc = { type: "doc", content: [
    { type: "image", attrs: { src: "x" } },
    { type: "paragraph", content: [{ type: "text", text: "kept" }] },
    { type: "codeBlock", content: [{ type: "text", text: "evil" }] },
  ] };
  const html = docToHtml(doc);
  assert.equal(html, "<p>kept</p>");
});

test("docToHtml: drops disallowed marks but keeps the text", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "styled", marks: [{ type: "strike" }, { type: "bold" }] },
  ] }] };
  const html = docToHtml(doc);
  assert.match(html, /<strong>styled<\/strong>/);
  assert.ok(!html.includes("strike"));
});

test("docToHtml: attribute-injection in text can't break out of the href attr", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: `x" onmouseover="alert(1)`, marks: [{ type: "bold" }] },
  ] }] };
  const html = docToHtml(doc);
  assert.ok(!html.includes('onmouseover="alert'), "quotes in text are escaped");
  assert.match(html, /&quot;/);
});

// ── docToMarkdown ─────────────────────────────────────────────────────────────
// ── Red-team regressions (payloads the initial tests didn't cover) ───────────

test("docToHtml: deep nesting is bounded, never throws (stack-overflow DoS)", () => {
  let inner = { type: "paragraph", content: [{ type: "text", text: "deep" }] };
  for (let i = 0; i < 5000; i++) inner = { type: "bulletList", content: [{ type: "listItem", content: [inner] }] };
  const doc = { type: "doc", content: [inner] };
  assert.doesNotThrow(() => docToHtml(doc));
  assert.doesNotThrow(() => docToText(doc));
  assert.doesNotThrow(() => docToMarkdown(doc));
});

test("docToHtml: URL scheme bypass variants all neutralize to #", () => {
  const bad = [
    "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)",
    "java script:alert(1)", "  javascript:alert(1)", "javascript:alert(1)",
    "%6Aavascript:alert(1)", "vbscript:msgbox(1)", "file:///etc/passwd",
    "ϳavascript:alert(1)", "//evil.com", "#frag", "",
  ];
  for (const href of bad) {
    const html = docToHtml({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] }] });
    assert.match(html, /href="#"/, `href ${JSON.stringify(href)} must be neutralized`);
  }
});

test("docToHtml: link emits only href/rel/target — extra attrs ignored", () => {
  const html = docToHtml({ type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "x", marks: [{ type: "link", attrs: {
      href: "https://ok.com", onclick: "alert(1)", target: "_self", rel: "x\" onmouseover=\"alert(1)" } }] }] }] });
  assert.ok(!html.includes("onclick"), "no onclick attr");
  assert.ok(!html.includes("onmouseover"), "no injected event handler");
  assert.match(html, /target="_blank"/);
});

test("docToHtml: non-string href → #", () => {
  const html = docToHtml({ type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "x", marks: [{ type: "link", attrs: { href: { toString: () => "javascript:alert(1)" } } }] }] }] });
  assert.match(html, /href="#"/);
});

test("docToHtml: HTML in text escaped for every node type", () => {
  const evil = "<img src=x onerror=alert(1)>";
  const escd = "&lt;img src=x onerror=alert(1)&gt;";
  const has = (doc) => { const h = docToHtml(doc); assert.ok(h.includes(escd) && !h.includes("<img"), h); };
  has({ type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: evil }] }] });
  has({ type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: evil }] }] }] }] });
  has({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: evil, marks: [{ type: "link", attrs: { href: "https://ok.com" } }] }] }] });
});

test("docToHtml: unknown node types dropped, non-string text dropped", () => {
  assert.equal(docToHtml({ type: "doc", content: [{ type: "script", content: [{ type: "text", text: "alert(1)" }] }] }), "");
  assert.equal(docToHtml({ type: "doc", content: [{ type: "iframe", attrs: { src: "javascript:alert(1)" } }] }), "");
  assert.equal(docToHtml({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: { toString: () => "<script>x</script>" } }] }] }), "<p></p>");
});

test("docToHtml: heading level injection can't escape the tag", () => {
  const html = docToHtml({ type: "doc", content: [{ type: "heading", attrs: { level: "2><script>alert(1)</script>" }, content: [{ type: "text", text: "x" }] }] });
  assert.equal(html, "<h2>x</h2>");
});

test("docToMarkdown: link text can't break out of [](); parens in href encoded", () => {
  const md = docToMarkdown({ type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "a](javascript:alert(1))[b", marks: [{ type: "link", attrs: { href: "https://ok.com" } }] }] }] });
  // The label's ]/[ are backslash-escaped, so no UNescaped `](javascript:` exists
  // for a Markdown parser to treat as a second link target.
  assert.ok(!/(^|[^\\])\]\(javascript:/.test(md), `unescaped link breakout in: ${md}`);
  assert.match(md, /a\\\]/); // ] escaped in label
  assert.match(md, /\\\[b/); // [ escaped in label

  const md2 = docToMarkdown({ type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "wiki", marks: [{ type: "link", attrs: { href: "https://en.wikipedia.org/wiki/Foo_(bar)" } }] }] }] });
  assert.match(md2, /%28bar%29/); // parens encoded so the link URL isn't closed early
});

test("docToMarkdown: marks, headings, lists", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Sub" }] },
      { type: "paragraph", content: [
        { type: "text", text: "b", marks: [{ type: "bold" }] },
        { type: "text", text: "i", marks: [{ type: "italic" }] },
      ] },
      { type: "orderedList", content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "first" }] }] },
      ] },
    ],
  };
  const md = docToMarkdown(doc);
  assert.match(md, /### Sub/);
  assert.match(md, /\*\*b\*\*_i_/);
  assert.match(md, /1\. first/);
});

/**
 * Rich-text document helpers — the single source of truth for the constrained
 * Tiptap schema and every serialize/deserialize path around it.
 *
 * Storage format: Tiptap/ProseMirror JSON ({ type: "doc", content: [...] }).
 *
 * This module is pure and dependency-free (only sanitizeUrl) so it runs
 * identically in the browser (editor, read view) and on the server (publish
 * render, markdown export) and is fully unit-testable.
 *
 * SECURITY: docToHtml() is the publish security boundary. It is a strict
 * whitelist walker — it can ONLY emit <p> <h2> <h3> <ul> <ol> <li> <strong>
 * <em> <a> <br>, always escapes text, and runs every href through sanitizeUrl
 * (http/https only). Unknown node/mark types are dropped. There is no path by
 * which typed or pasted input becomes arbitrary HTML.
 */
import { sanitizeUrl } from "../utils/sanitizeUrl.js";

// ── The allowed schema (editor + every serializer agree on exactly this) ──────
export const ALLOWED_NODES = new Set([
  "doc", "paragraph", "text", "hardBreak",
  "heading", "bulletList", "orderedList", "listItem",
]);
export const ALLOWED_MARKS = new Set(["bold", "italic", "link"]);
export const ALLOWED_HEADING_LEVELS = new Set([2, 3]);

/** Canonical empty document. */
export const EMPTY_DOC = { type: "doc", content: [] };

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Legacy plain text → doc ───────────────────────────────────────────────────
/**
 * Wrap a legacy plain-text value as a Tiptap doc. Blank lines (one or more
 * empty lines) separate paragraphs; single newlines within a block become hard
 * breaks — reproducing the old `white-space: pre-wrap` display exactly.
 */
export function textToDoc(text) {
  const str = typeof text === "string" ? text.replace(/\r\n?/g, "\n") : "";
  if (!str.trim()) return { type: "doc", content: [] };

  const blocks = str
    .split(/\n[ \t]*\n+/)          // blank line(s) split paragraphs
    .map((b) => b.replace(/^\n+|\n+$/g, ""))
    .filter((b) => b.trim() !== "");

  const content = blocks.map((block) => {
    const lines = block.split("\n");
    const inline = [];
    lines.forEach((line, i) => {
      if (i > 0) inline.push({ type: "hardBreak" });
      if (line.length > 0) inline.push({ type: "text", text: line });
    });
    return { type: "paragraph", content: inline };
  });

  return { type: "doc", content };
}

// ── Emptiness ─────────────────────────────────────────────────────────────────
/** True when the doc holds no practitioner text (→ store null, no stray <p>). */
export function docIsEmpty(doc) {
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.content)) return true;
  return !nodeHasText(doc);
}
function nodeHasText(node) {
  if (!node) return false;
  if (node.type === "text") return typeof node.text === "string" && node.text.trim() !== "";
  if (Array.isArray(node.content)) return node.content.some(nodeHasText);
  return false;
}

// ── doc → plain text (dual-write column + legacy fallback) ────────────────────
export function docToText(doc) {
  if (!doc || !Array.isArray(doc.content)) return "";
  return doc.content
    .map(blockToText)
    .filter((s) => s !== "")
    .join("\n\n")
    .trim();
}
function blockToText(node) {
  if (!node) return "";
  if (node.type === "bulletList" || node.type === "orderedList") {
    return renderListText(node, 0);
  }
  // paragraph, heading, or listItem contents
  return inlineToText(node.content);
}
// Renders a bulletList/orderedList as indented plain-text lines, recursing
// into any list nested inside a listItem. Depth-capped like docToHtml's
// renderBlock, for the same reason (a hand-crafted deeply-nested document
// bypassing the editor shouldn't be able to blow the stack).
function renderListText(listNode, depth) {
  if (depth > MAX_DEPTH) return "";
  const indent = "  ".repeat(depth);
  return (listNode.content || [])
    .map((li, i) => {
      const prefix = listNode.type === "orderedList" ? `${i + 1}. ` : "- ";
      const line = `${indent}${prefix}${inlineToText(collapseListItem(li))}`;
      const nested = nestedLists(li)
        .map((nl) => renderListText(nl, depth + 1))
        .filter((s) => s !== "")
        .join("\n");
      return nested ? `${line}\n${nested}` : line;
    })
    .join("\n");
}
function listItemBlocks(li) {
  return li && li.type === "listItem" && Array.isArray(li.content) ? li.content : [];
}
// listItem wraps its own text in a paragraph; return just that inline
// content. Nested lists are deliberately excluded here — a caller renders
// them separately, recursively (see renderListText/renderListMarkdown) — this
// used to flatMap every child block's .content indiscriminately, which mixed
// a nested list's listItem nodes into the same array as inline text nodes;
// inlineToText/inlineToMarkdown silently drop anything that isn't
// text/hardBreak, so nested list content vanished entirely (audit finding,
// 2026-09-05).
function collapseListItem(li) {
  return listItemBlocks(li).filter((b) => b?.type !== "bulletList" && b?.type !== "orderedList")
    .flatMap((b) => (Array.isArray(b.content) ? b.content : []));
}
function nestedLists(li) {
  return listItemBlocks(li).filter((b) => b?.type === "bulletList" || b?.type === "orderedList");
}
function inlineToText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .map((n) => (n.type === "hardBreak" ? "\n" : n.type === "text" ? n.text || "" : ""))
    .join("");
}

// ── doc → HTML (PUBLISH SECURITY BOUNDARY — whitelist only) ───────────────────
/**
 * Serialize a doc to safe HTML. `opts.styles` is an optional { tag: cssString }
 * map (p, h2, h3, ul, ol, li, a) — used by the publish path to emit inline
 * styles matching the surrounding inline-styled page. The style strings are
 * hardcoded by the caller, never derived from document content, so they don't
 * widen the security surface. Omit for semantic tags (in-app CSS-class path).
 */
// Cap the block-recursion depth. Legitimate documents never approach this;
// a hand-crafted deeply-nested list (bypassing the editor via the API) would
// otherwise blow the stack when rendered at publish/export time. Content below
// the cap is simply dropped, never thrown on.
const MAX_DEPTH = 100;

export function docToHtml(doc, opts = {}) {
  if (!doc || !Array.isArray(doc.content)) return "";
  const styles = opts.styles || {};
  return doc.content.map((n) => renderBlock(n, styles, 0)).join("");
}
function styleAttr(tag, styles) {
  return styles[tag] ? ` style="${styles[tag]}"` : "";
}
function renderBlock(node, styles, depth) {
  if (!node || typeof node !== "object" || depth > MAX_DEPTH) return "";
  switch (node.type) {
    case "paragraph":
      return `<p${styleAttr("p", styles)}>${renderInline(node.content, styles)}</p>`;
    case "heading": {
      const level = ALLOWED_HEADING_LEVELS.has(node.attrs?.level) ? node.attrs.level : 2;
      const tag = `h${level}`;
      return `<${tag}${styleAttr(tag, styles)}>${renderInline(node.content, styles)}</${tag}>`;
    }
    case "bulletList":
      return `<ul${styleAttr("ul", styles)}>${(node.content || []).map((li) => renderListItem(li, styles, depth + 1)).join("")}</ul>`;
    case "orderedList":
      return `<ol${styleAttr("ol", styles)}>${(node.content || []).map((li) => renderListItem(li, styles, depth + 1)).join("")}</ol>`;
    default:
      return ""; // disallowed / unknown block dropped
  }
}
function renderListItem(node, styles, depth) {
  if (!node || node.type !== "listItem" || depth > MAX_DEPTH) return "";
  const blocks = node.content || [];
  const inner = blocks.length === 1 && blocks[0].type === "paragraph"
    ? renderInline(blocks[0].content, styles)
    : blocks.map((b) => renderBlock(b, styles, depth + 1)).join("");
  return `<li${styleAttr("li", styles)}>${inner}</li>`;
}
function renderInline(content, styles) {
  if (!Array.isArray(content)) return "";
  return content.map((n) => renderInlineNode(n, styles)).join("");
}
function renderInlineNode(node, styles) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "hardBreak") return "<br>";
  if (node.type !== "text" || typeof node.text !== "string") return "";
  let html = esc(node.text);
  const marks = Array.isArray(node.marks) ? node.marks : [];
  for (const mark of marks) {
    if (!mark || !ALLOWED_MARKS.has(mark.type)) continue; // drop disallowed mark, keep text
    if (mark.type === "bold") html = `<strong>${html}</strong>`;
    else if (mark.type === "italic") html = `<em>${html}</em>`;
    else if (mark.type === "link") {
      const href = sanitizeUrl(mark.attrs?.href || "");
      html = `<a href="${esc(href)}"${styleAttr("a", styles)} rel="nofollow noopener noreferrer" target="_blank">${html}</a>`;
    }
  }
  return html;
}

// ── doc → Markdown (export path — buildMarkdown JSON→MD step) ──────────────────
export function docToMarkdown(doc) {
  if (!doc || !Array.isArray(doc.content)) return "";
  return doc.content
    .map(blockToMarkdown)
    .filter((s) => s !== "")
    .join("\n\n")
    .trim();
}
function blockToMarkdown(node) {
  if (!node) return "";
  switch (node.type) {
    case "paragraph":
      return inlineToMarkdown(node.content);
    case "heading": {
      const level = ALLOWED_HEADING_LEVELS.has(node.attrs?.level) ? node.attrs.level : 2;
      return `${"#".repeat(level)} ${inlineToMarkdown(node.content)}`;
    }
    case "bulletList":
    case "orderedList":
      return renderListMarkdown(node, 0);
    default:
      return "";
  }
}
// Mirrors renderListText but for Markdown — see collapseListItem/nestedLists
// for why nested lists need their own recursive render rather than being
// flattened through inlineToMarkdown.
function renderListMarkdown(listNode, depth) {
  if (depth > MAX_DEPTH) return "";
  const indent = "  ".repeat(depth);
  return (listNode.content || [])
    .map((li, i) => {
      const prefix = listNode.type === "orderedList" ? `${i + 1}. ` : "- ";
      const line = `${indent}${prefix}${inlineToMarkdown(collapseListItem(li))}`;
      const nested = nestedLists(li)
        .map((nl) => renderListMarkdown(nl, depth + 1))
        .filter((s) => s !== "")
        .join("\n");
      return nested ? `${line}\n${nested}` : line;
    })
    .join("\n");
}
// Escape the characters that would let link text break out of a Markdown
// `[label](url)` construct (e.g. text `a](javascript:x)[b`).
function escapeMdLinkText(text) {
  return String(text).replace(/[\\[\]]/g, (ch) => "\\" + ch);
}
// Neutralize characters that would prematurely close a Markdown link URL — both
// an injection vector and a correctness bug for legitimate URLs containing
// parens (e.g. Wikipedia `..._(disambiguation)`).
function safeMdHref(href) {
  return sanitizeUrl(href)
    .replace(/\(/g, "%28").replace(/\)/g, "%29")
    .replace(/ /g, "%20").replace(/</g, "%3C").replace(/>/g, "%3E");
}
function inlineToMarkdown(content) {
  if (!Array.isArray(content)) return "";
  return content
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type !== "text" || typeof n.text !== "string") return "";
      const marks = Array.isArray(n.marks) ? n.marks : [];
      const has = (t) => marks.some((m) => m && m.type === t);
      const link = marks.find((m) => m && m.type === "link");
      // Escape the label only when it is used as Markdown link text.
      let text = link ? escapeMdLinkText(n.text) : n.text;
      if (has("bold")) text = `**${text}**`;
      if (has("italic")) text = `_${text}_`;
      if (link) text = `[${text}](${safeMdHref(link.attrs?.href || "")})`;
      return text;
    })
    .join("");
}

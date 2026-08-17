/**
 * Client-side schema normalization for RichTextField values.
 *
 * The save path trusts nothing that reaches the database. RLS scopes rows to
 * their owner, but a document hand-crafted via direct API access (bypassing the
 * editor) could contain node/mark types outside the allowed schema. docToHtml
 * filters those at PUBLISH time, but the in-app Tiptap read/edit view calls
 * Node.fromJSON, which THROWS on unknown node/mark types — so a tampered
 * document would crash the editor the next time that record is opened.
 *
 * normalizeDoc() runs a document through the exact same constrained schema the
 * editor uses (getSchema(richTextExtensions())). Unknown node/mark types and
 * content-model violations are rejected; when that happens we recover the
 * document's plain text rather than persist/return something the editor can't
 * reopen. Unknown attributes are silently stripped by ProseMirror.
 *
 * Kept OUT of src/lib/richtextDoc.js on purpose: that module is dependency-free
 * and also runs on the publish server. This one pulls in Tiptap and is
 * client-only.
 */
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { richTextExtensions } from "./extensions.js";
import { docIsEmpty, docToText, textToDoc } from "../../../lib/richtextDoc.js";

let cachedSchema;
function schema() {
  return (cachedSchema ||= getSchema(richTextExtensions()));
}

/**
 * Normalize a Tiptap JSON document to the allowed schema.
 * @returns a schema-conformant doc, or null when empty.
 */
export function normalizeDoc(doc) {
  if (docIsEmpty(doc)) return null;
  try {
    const node = PMNode.fromJSON(schema(), doc); // throws on unknown node/mark
    node.check();                                // throws on content-model violations
    const json = node.toJSON();
    return docIsEmpty(json) ? null : json;
  } catch {
    // Non-conformant (tampered / hand-crafted): recover the plain text and drop
    // structure, rather than keep a document the editor can't reopen.
    const recovered = textToDoc(docToText(doc));
    return docIsEmpty(recovered) ? null : recovered;
  }
}

/**
 * Serialize a RichTextField value for persistence. This is the single call
 * every RichTextField caller uses when building its DB payload, so schema
 * normalization is inherited uniformly across all rich-text fields rather than
 * re-implemented per field.
 */
export function serializeRichText(doc) {
  return normalizeDoc(doc);
}

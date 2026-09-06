/**
 * Async save-path serialization for RichTextField values.
 *
 * Kept separate from normalize.js so the Tiptap schema — and the ~150KB editor
 * bundle behind it — is NOT statically reachable from the forms' main-bundle
 * code. normalize.js (and Tiptap) is dynamically imported only when a save
 * actually happens. By that point the user has already opened the editor, so
 * the chunk is already loaded and this resolves instantly.
 *
 * Every RichTextField-backed form calls this in its async save handler:
 *   const doc = await serializeRichText(fieldDoc);
 */
export async function serializeRichText(doc) {
  const { normalizeDoc } = await import("./normalize.js");
  return normalizeDoc(doc);
}

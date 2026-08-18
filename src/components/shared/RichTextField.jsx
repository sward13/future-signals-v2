/**
 * RichTextField — shared WYSIWYG editor for the narrative fields in Future
 * Models & Strategic Options. Stores/emits Tiptap JSON documents.
 *
 * This is a thin lazy wrapper: the actual Tiptap editor lives in
 * RichTextFieldEditor.jsx and is React.lazy-loaded so the ~150KB
 * Tiptap/ProseMirror bundle is code-split out of the main chunk and only
 * fetched when a rich-text field first renders (i.e. when a user opens a Future
 * Models edit/read view). The forms' save path uses the async serializeRichText
 * (serialize.js) for the same reason — nothing statically pulls Tiptap into the
 * main bundle.
 *
 * Props (unchanged): value (JSON doc|null), onChange (JSON doc|null),
 * placeholder, variant "standard"|"compact", editable, minHeight.
 */
import { lazy, Suspense } from "react";
import { c } from "../../styles/tokens.js";

const RichTextFieldEditor = lazy(() => import("./RichTextFieldEditor.jsx"));

// Placeholder shown for the brief moment the editor chunk is loading. Sized to
// match the resolved field so there's no layout shift.
function Fallback({ variant, editable, minHeight }) {
  if (editable === false) return <div className="rtf" style={{ minHeight: 0 }} />;
  if (variant === "compact") return <div style={{ minHeight: minHeight ?? 40 }} />;
  return (
    <div
      className="rtf rtf-standard"
      style={{
        border: `1px solid ${c.borderStrong}`,
        borderRadius: 8,
        background: c.white,
        minHeight: (minHeight ?? 96) + 40,
      }}
    />
  );
}

export function RichTextField(props) {
  return (
    <Suspense fallback={<Fallback {...props} />}>
      <RichTextFieldEditor {...props} />
    </Suspense>
  );
}

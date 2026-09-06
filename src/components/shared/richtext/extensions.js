/**
 * The constrained Tiptap extension set — the editor-side counterpart to the
 * whitelist in src/lib/richtextDoc.js. The schema permits exactly:
 *   nodes: paragraph, heading (H2/H3), bulletList, orderedList, listItem, hardBreak
 *   marks: bold, italic, link
 * Everything else StarterKit would bundle (blockquote, code, codeBlock,
 * horizontalRule, strike, underline) is disabled. Because the schema itself is
 * constrained, pasting from Word/Docs/web can't introduce unsupported nodes or
 * inline styles — ProseMirror drops anything outside the schema on paste.
 */
import { StarterKit } from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extensions";

export function richTextExtensions(placeholder = "") {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // Everything outside the allowed schema, off:
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: false, // replaced by our own configured Link below
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https"],
      HTMLAttributes: { rel: "nofollow noopener noreferrer", target: "_blank" },
    }),
    Placeholder.configure({ placeholder }),
  ];
}

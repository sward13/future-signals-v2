/**
 * RichTextFieldEditor — the Tiptap editor implementation behind RichTextField.
 * Lazy-loaded (React.lazy) by RichTextField.jsx so the ~150KB Tiptap/ProseMirror
 * bundle is code-split out of the main chunk and only fetched when a rich-text
 * field actually renders. Do not import this module directly — import
 * { RichTextField } from "./RichTextField.jsx".
 *
 * Stores/emits Tiptap JSON documents.
 *
 * Two style variants:
 *   - "standard" (default): bordered box matching the `ta` textarea pattern,
 *     with a fixed minimal toolbar on top. Drop-in for the PF/Scenario/SO forms.
 *   - "compact": borderless/transparent for the System Analysis canvas cards,
 *     with the toolbar as a Tiptap bubble menu that appears on selection.
 *
 * Controlled by value (JSON doc | null) / onChange (JSON doc | null). Emits null
 * when empty so no stray empty-paragraph document is ever saved.
 *
 * Set editable={false} for read-only display (no toolbar/bubble menu) — reuses
 * the exact same constrained schema, so the in-app read view never touches
 * dangerouslySetInnerHTML.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Link2 } from "lucide-react";
import { c } from "../../styles/tokens.js";
import { richTextExtensions } from "./richtext/extensions.js";
import { normalizeDoc } from "./richtext/normalize.js";
import { docIsEmpty, EMPTY_DOC } from "../../lib/richtextDoc.js";

// ── Toolbar ───────────────────────────────────────────────────────────────────

const btn = (active) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 6,
  border: "none", background: active ? c.brandBg : "transparent",
  color: active ? c.brand : c.muted,
  cursor: "pointer", padding: 0,
  transition: "background 0.12s, color 0.12s",
});

function ToolbarButton({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // preventDefault so clicking the toolbar doesn't blur the editor selection
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={btn(active)}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = c.surfaceHover; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

const Divider = () => (
  <span style={{ width: 1, height: 16, background: c.border, margin: "0 3px" }} />
);

function Toolbar({ editor, onLinkClick }) {
  if (!editor) return null;
  const ic = { size: 15, strokeWidth: 2 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
      <ToolbarButton active={editor.isActive("bold")} title="Bold (⌘B)"
        onClick={() => editor.chain().focus().toggleBold().run()}><Bold {...ic} /></ToolbarButton>
      <ToolbarButton active={editor.isActive("italic")} title="Italic (⌘I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}><Italic {...ic} /></ToolbarButton>
      <Divider />
      <ToolbarButton active={editor.isActive("heading", { level: 2 })} title="Heading"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 {...ic} /></ToolbarButton>
      <ToolbarButton active={editor.isActive("heading", { level: 3 })} title="Subheading"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 {...ic} /></ToolbarButton>
      <Divider />
      <ToolbarButton active={editor.isActive("bulletList")} title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}><List {...ic} /></ToolbarButton>
      <ToolbarButton active={editor.isActive("orderedList")} title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered {...ic} /></ToolbarButton>
      <Divider />
      <ToolbarButton active={editor.isActive("link")} title="Link"
        onClick={onLinkClick}><Link2 {...ic} /></ToolbarButton>
    </div>
  );
}

// ── Link entry popover (minimal inline input) ────────────────────────────────

function LinkInput({ initial, onApply, onCancel }) {
  const [url, setUrl] = useState(initial || "");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px" }}>
      <input
        ref={ref}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onApply(url.trim()); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        placeholder="https://…"
        style={{
          flex: 1, minWidth: 160, fontSize: 12, fontFamily: "inherit",
          padding: "5px 8px", border: `1px solid ${c.borderStrong}`, borderRadius: 6,
          outline: "none", color: c.ink, background: c.white,
        }}
      />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onApply(url.trim())}
        style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "none", background: c.brand, color: c.white, cursor: "pointer", fontFamily: "inherit" }}>
        Apply
      </button>
      {initial && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onApply("")}
          title="Remove link"
          style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.muted, cursor: "pointer", fontFamily: "inherit" }}>
          Remove
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RichTextFieldEditor({
  value,
  onChange,
  placeholder = "",
  variant = "standard",
  editable = true,
  minHeight,
}) {
  const compact = variant === "compact";
  const [linkOpen, setLinkOpen] = useState(false);
  const emitting = useRef(false);

  // Only show the compact bubble menu when THIS editor is focused and has a
  // selection — otherwise, with several editors on the System Analysis canvas,
  // the menu sticks over a field after focus moves elsewhere (ProseMirror keeps
  // the selection on blur). Stay open while the link input is active, since
  // typing in it blurs the editor.
  const linkOpenRef = useRef(false);
  useEffect(() => { linkOpenRef.current = linkOpen; }, [linkOpen]);
  const bubbleShouldShow = useCallback(({ editor: ed, state }) => {
    if (linkOpenRef.current) return true;
    return ed.isEditable && ed.isFocused && !state.selection.empty;
  }, []);

  const editor = useEditor({
    extensions: richTextExtensions(placeholder),
    // Normalize incoming content to the allowed schema — a doc tampered via the
    // API could otherwise crash Node.fromJSON when this record is opened.
    content: normalizeDoc(value) ?? EMPTY_DOC,
    editable,
    editorProps: {
      attributes: {
        class: "rtf-content",
        style: `min-height:${minHeight ?? (compact ? 0 : 96)}px;`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      emitting.current = true;
      onChange?.(docIsEmpty(json) ? null : json);
      emitting.current = false;
    },
  });

  // Reflect external value changes (e.g. switching records) into the editor,
  // without clobbering the user's own in-flight edits. The isDestroyed guard
  // matters under React StrictMode / the lazy boundary, where a passive effect
  // can re-run against an editor that was already torn down.
  useEffect(() => {
    if (!editor || editor.isDestroyed || emitting.current) return;
    const current = editor.getJSON();
    const incoming = normalizeDoc(value) ?? EMPTY_DOC;
    if (JSON.stringify(current) !== JSON.stringify(incoming)) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editable, editor]);

  const openLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    setLinkOpen(true);
  };

  const applyLink = (url) => {
    setLinkOpen(false);
    if (!editor) return;
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const currentHref = editor?.getAttributes("link")?.href || "";

  // ── Read-only display ──────────────────────────────────────────────────────
  if (!editable) {
    return (
      <div className="rtf rtf-readonly">
        <EditorContent editor={editor} />
      </div>
    );
  }

  // ── Compact (canvas): borderless + bubble-menu toolbar ─────────────────────
  if (compact) {
    return (
      <div className="rtf rtf-compact" style={{ width: "100%" }}>
        {editor && (
          <BubbleMenu editor={editor} options={{ placement: "top" }} shouldShow={bubbleShouldShow}>
            <div style={{
              display: "flex", flexDirection: "column",
              background: c.white, border: `1px solid ${c.border}`, borderRadius: 8,
              boxShadow: "0 2px 10px rgba(0,0,0,0.12)", padding: 3,
            }}>
              <Toolbar editor={editor} onLinkClick={openLink} />
              {linkOpen && <LinkInput initial={currentHref} onApply={applyLink} onCancel={() => setLinkOpen(false)} />}
            </div>
          </BubbleMenu>
        )}
        <EditorContent editor={editor} />
      </div>
    );
  }

  // ── Standard (forms): bordered box + fixed toolbar ─────────────────────────
  return (
    <div className="rtf rtf-standard" style={{
      border: `1px solid ${c.borderStrong}`, borderRadius: 8, background: c.white,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        padding: "4px 6px", borderBottom: `1px solid ${c.border}`, background: c.fieldBg,
      }}>
        <Toolbar editor={editor} onLinkClick={openLink} />
      </div>
      {linkOpen && (
        <div style={{ borderBottom: `1px solid ${c.border}`, background: c.surfaceAlt }}>
          <LinkInput initial={currentHref} onApply={applyLink} onCancel={() => setLinkOpen(false)} />
        </div>
      )}
      <div style={{ padding: "8px 11px" }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

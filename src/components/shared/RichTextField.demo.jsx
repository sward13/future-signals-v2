/**
 * RichTextField sandbox — isolated harness to review both variants without the
 * rest of the app. Mounted at /#rtf-demo (see main.jsx). Dev/review only; not
 * linked from anywhere in the product.
 */
import { useState } from "react";
import { c } from "../../styles/tokens.js";
import { RichTextField } from "./RichTextField.jsx";
import { textToDoc, docToHtml, docToMarkdown } from "../../lib/richtextDoc.js";

const SEED = textToDoc(
  "This is an existing plain-text value.\nIt had a soft line break.\n\nAnd a second paragraph, to show the migration wrapper splitting on blank lines."
);

function Panel({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: c.hint, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Output({ label, text }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: c.faint, marginBottom: 3 }}>{label}</div>
      <pre style={{
        margin: 0, fontSize: 11, lineHeight: 1.5, color: c.muted, background: c.surfaceAlt,
        border: `1px solid ${c.border}`, borderRadius: 6, padding: "8px 10px",
        whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 180, overflow: "auto",
      }}>{text}</pre>
    </div>
  );
}

export default function RichTextFieldDemo() {
  const [standardDoc, setStandardDoc] = useState(SEED);
  const [compactDoc, setCompactDoc] = useState(null);
  const [compactDoc2, setCompactDoc2] = useState(null);

  return (
    <div style={{
      minHeight: "100vh", background: c.bg, padding: "40px 24px",
      fontFamily: "var(--font-body)",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: c.ink, margin: "0 0 4px" }}>RichTextField — sandbox</h1>
        <p style={{ fontSize: 13, color: c.muted, margin: "0 0 32px" }}>
          Both variants, live JSON storage + publish HTML + Markdown export. Try pasting from Word/Docs — it strips to the supported marks.
        </p>

        {/* Standard variant */}
        <Panel title="Standard variant (PF / Scenario / Strategic Option forms)">
          <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, marginBottom: 5 }}>Narrative</div>
          <div style={{ fontSize: 11, color: c.hint, marginBottom: 6 }}>Seeded with a migrated legacy plain-text value.</div>
          <RichTextField
            value={standardDoc}
            onChange={setStandardDoc}
            placeholder="Write a narrative description…"
          />
          <Output label="Stored JSON (null when empty)" text={JSON.stringify(standardDoc, null, 2)} />
          <Output label="Publish HTML (docToHtml — the security boundary)" text={docToHtml(standardDoc)} />
          <Output label="Markdown export (docToMarkdown)" text={docToMarkdown(standardDoc)} />
        </Panel>

        {/* Compact variant */}
        <Panel title="Compact variant (System Analysis canvas — borderless, bubble-menu toolbar)">
          <div style={{
            background: c.white, border: `1px solid ${c.border}`, borderRadius: 8,
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          }}>
            {/* Two compact editors side by side — mirrors the System Analysis
                canvas so click-away bubble-menu behavior can be tested. */}
            <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 12px", minHeight: 90 }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: c.faint, marginBottom: 6 }}>Key Dynamics</div>
              <RichTextField
                value={compactDoc}
                onChange={setCompactDoc}
                variant="compact"
                placeholder="The most significant pattern is a reinforcing loop between…"
              />
            </div>
            <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 12px", minHeight: 90 }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: c.faint, marginBottom: 6 }}>Description</div>
              <RichTextField
                value={compactDoc2}
                onChange={setCompactDoc2}
                variant="compact"
                placeholder="Summarise what this system is…"
              />
            </div>
          </div>
          <Output label="Stored JSON (Key Dynamics)" text={JSON.stringify(compactDoc, null, 2)} />
        </Panel>

        {/* Read-only */}
        <Panel title="Read-only display (editable={false} — reuses the same schema, no innerHTML)">
          <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 8, padding: "12px 14px" }}>
            <RichTextField value={standardDoc} editable={false} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

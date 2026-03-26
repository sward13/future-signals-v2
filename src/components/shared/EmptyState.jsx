/**
 * EmptyState — consistent empty list/section placeholder with an optional CTA.
 * @param {{ icon?: string, title: string, body: string, ctaLabel?: string, onCta?: () => void }} props
 */
import { c, btnP } from "../../styles/tokens.js";

export function EmptyState({ icon = "◎", title, body, ctaLabel, onCta }) {
  return (
    <div style={{
      background: c.white,
      border: `1px dashed ${c.border}`,
      borderRadius: 12,
      padding: "40px 24px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.15 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: c.muted, marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.6, maxWidth: 320, margin: "0 auto 20px" }}>{body}</div>
      {ctaLabel && onCta && (
        <button onClick={onCta} style={btnP}>{ctaLabel}</button>
      )}
    </div>
  );
}

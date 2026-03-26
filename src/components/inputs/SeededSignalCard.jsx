/**
 * SeededSignalCard — card for signals from the curated onboarding pool.
 * Shows domain badge, strength, and Save/Dismiss actions.
 * @param {{ sig: object, onSave: () => void, onDismiss: () => void, saved?: boolean }} props
 */
import { c, btnSm, btnG } from "../../styles/tokens.js";
import { StrengthDot, HorizTag } from "../shared/Tag.jsx";
import { DOMAIN_META } from "../../data/seeds.js";

export function SeededSignalCard({ sig, onSave, onDismiss, saved }) {
  const domainMeta = DOMAIN_META.find((m) => m.label === sig.domain);

  return (
    <div style={{
      background: c.white,
      border: `1px solid ${saved ? c.greenBorder : c.border}`,
      borderRadius: 10,
      padding: "14px 16px",
      transition: "border-color 0.2s",
    }}>
      {/* Domain badge + strength */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: c.hint }}>Curated from</span>
        {domainMeta && (
          <span style={{
            fontSize: 10,
            padding: "1px 7px",
            borderRadius: 10,
            background: domainMeta.bg,
            color: domainMeta.col,
            border: `1px solid ${domainMeta.border}`,
          }}>
            {domainMeta.label}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          <StrengthDot str={sig.strength} />
        </span>
      </div>

      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, lineHeight: 1.35, marginBottom: 5 }}>
        {sig.name}
      </div>

      {/* Description */}
      <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.6, marginBottom: 10 }}>
        {sig.desc || sig.description}
      </div>

      {/* Tags + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {(sig.steepled || sig.cats || []).map((cat) => (
          <span key={cat} style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 4,
            background: "#f0f0ee",
            color: c.muted,
          }}>
            {cat}
          </span>
        ))}
        <HorizTag h={sig.horizon || sig.h} />

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {saved ? (
            <span style={{
              fontSize: 11,
              color: c.green700,
              background: c.green50,
              border: `1px solid ${c.greenBorder}`,
              borderRadius: 6,
              padding: "3px 9px",
            }}>
              ✓ Saved to Inbox
            </span>
          ) : (
            <>
              <button onClick={onSave} style={{ ...btnSm, fontSize: 11, padding: "4px 12px" }}>
                Save to Inbox
              </button>
              <button onClick={onDismiss} style={{ ...btnG, fontSize: 11, padding: "4px 8px", color: c.hint }}>
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

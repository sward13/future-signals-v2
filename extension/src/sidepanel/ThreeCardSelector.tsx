import { c, fl } from "../../../src/styles/tokens.js";

/**
 * Mirrors ThreeCardSelector in src/components/inputs/InputFormFields.jsx:
 * a 3-column grid of bordered cards, each showing a colored dot, a title,
 * and a description line, with a checkmark on the selected card. Single-select
 * — clicking the selected card clears it back to null. Used for Signal
 * strength and Source confidence, which share the same amber/blue/green
 * tier-color scale in the main app regardless of label semantics.
 */
type Option = { id: string; label: string; desc: string };

type Props = {
  label: string;
  options: readonly Option[];
  value: string | null;
  onChange: (id: string | null) => void;
};

const TIER_DOT_COLORS = [c.amber700, c.blue700, c.green700];

export function ThreeCardSelector({ label, options, value, onChange }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {options.map((o, i) => {
          const on = value === o.id;
          const dotColor = TIER_DOT_COLORS[i] ?? c.ink;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(on ? null : o.id)}
              style={{
                padding: "8px 8px",
                borderRadius: 8,
                border: `1px solid ${on ? c.ink : c.border}`,
                background: on ? "rgba(0,0,0,0.02)" : c.white,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: on ? dotColor : c.hint,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: on ? 500 : 400, color: c.ink }}>{o.label}</span>
                {on && <span style={{ fontSize: 9, marginLeft: "auto", color: c.ink }}>✓</span>}
              </div>
              <div style={{ fontSize: 9.5, color: c.muted, lineHeight: 1.4 }}>{o.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

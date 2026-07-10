import { c, fl } from "../../../src/styles/tokens.js";

/**
 * Compact single-select toggle row — mirrors the interaction pattern of
 * HorizonSelector in src/components/inputs/InputFormFields.jsx (click to
 * select, click again to clear back to null). Used for Signal strength and
 * Source confidence, which are optional fields with no default value.
 */
type Option = { id: string; label: string };

type Props = {
  label: string;
  options: readonly Option[];
  value: string | null;
  onChange: (id: string | null) => void;
};

export function ToggleOptionRow({ label, options, value, onChange }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={fl}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(on ? null : o.id)}
              style={{
                flex: 1,
                padding: "7px 8px",
                borderRadius: 7,
                fontSize: 12,
                border: `1px solid ${on ? c.ink : c.border}`,
                background: on ? "rgba(0,0,0,0.04)" : c.white,
                color: on ? c.ink : c.muted,
                cursor: "pointer",
                fontWeight: on ? 500 : 400,
                fontFamily: "inherit",
              }}
            >
              {o.label}
              {on ? " ✓" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

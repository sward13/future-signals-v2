import { c, fl, fh } from "../../../src/styles/tokens.js";

/**
 * Mirrors SteepleSelector in src/components/inputs/InputFormFields.jsx:
 * a 4-column grid of toggle pills, multi-select. Stores the array of
 * selected STEEPLED category strings directly, same shape as the main app.
 */
type Props = {
  options: readonly string[];
  selected: string[];
  onToggle: (category: string) => void;
};

export function SteepleSelector({ options, selected, onToggle }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>STEEPLED category</div>
      <div style={fh}>Select all that apply.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {options.map((cat) => {
          const on = selected.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggle(cat)}
              style={{
                padding: "6px 4px",
                borderRadius: 7,
                fontSize: 10.5,
                border: `1px solid ${on ? c.ink : c.border}`,
                background: on ? "rgba(0,0,0,0.05)" : c.white,
                color: on ? c.ink : c.muted,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: on ? 500 : 400,
                textAlign: "center",
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

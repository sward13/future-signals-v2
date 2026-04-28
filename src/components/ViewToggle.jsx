import { c } from "../styles/tokens.js";

export function ViewToggle({ view, onChange, options }) {
  return (
    <div style={{
      display: "flex",
      border: `1px solid ${c.border}`,
      borderRadius: 7,
      overflow: "hidden",
    }}>
      {options.map(({ value, icon, title }, i) => {
        const active = view === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            title={title}
            style={{
              padding: "5px 9px",
              display: "flex",
              alignItems: "center",
              background: active ? c.brand : c.white,
              color: active ? c.white : c.muted,
              border: "none",
              borderLeft: i > 0 ? `1px solid ${c.border}` : "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

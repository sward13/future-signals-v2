import { c } from "../../styles/tokens.js";

export function FilterDropdown({ label, value, options, onChange, onClear, isOpen, onToggle, menuWidth = 150 }) {
  const active = !!value;
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 9px", borderRadius: 5, fontSize: 11,
          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          background: active ? c.ink : "transparent",
          color: active ? c.white : c.muted,
          border: `1px solid ${active ? c.ink : c.border}`,
        }}
      >
        {active ? options.find(o => o.value === value)?.label ?? value : label}
        {active ? (
          <span
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}
          >✕</span>
        ) : (
          <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
        )}
      </button>
      {isOpen && (
        <>
          <div onClick={() => onToggle()} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
          <div style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4,
            background: c.white, border: `1px solid ${c.border}`,
            borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            zIndex: 51, minWidth: menuWidth, maxHeight: 280, overflowX: "hidden", overflowY: "auto",
          }}>
            {options.map((opt) => (
              <button
                key={opt.value || "__all__"}
                onClick={() => { onChange(opt.value); onToggle(); }}
                style={{
                  display: "block", width: "100%", padding: "8px 12px",
                  background: value === opt.value ? c.surfaceAlt : "transparent",
                  border: "none", borderBottom: `1px solid ${c.border}`,
                  textAlign: "left", cursor: "pointer",
                  fontSize: 12, color: c.ink, fontFamily: "inherit",
                }}
              >
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</div>
                {opt.sublabel && (
                  <div style={{ fontSize: 10, color: c.hint, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.sublabel}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

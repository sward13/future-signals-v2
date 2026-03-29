/**
 * InputFormFields — shared field sub-components used by both InputDrawer (create)
 * and InputDetailDrawer (edit). Exporting from one place prevents the panels diverging.
 * Exports: INPUT_TYPES, ThreeCardSelector, SteepleSelector, HorizonSelector, TypeSwitcherChip
 */
import { useState } from "react";
import { c, fl, fh } from "../../styles/tokens.js";
import { STEEPLED } from "../../data/seeds.js";

// ─── Input type definitions ────────────────────────────────────────────────────

export const INPUT_TYPES = [
  {
    id: "signal",
    label: "Signal",
    category: "Most common",
    categoryColor: c.green700,
    categoryBg: c.green50,
    categoryBorder: c.greenBorder,
    icon: "◎",
    color: c.green700,
    bg: c.green50,
    border: c.greenBorder,
    description: "A concrete, observable piece of evidence — an event, data point, or article that points toward change.",
  },
  {
    id: "issue",
    label: "Issue",
    category: "Analytical",
    categoryColor: c.red800,
    categoryBg: c.red50,
    categoryBorder: c.redBorder,
    icon: "▲",
    color: c.red800,
    bg: c.red50,
    border: c.redBorder,
    description: "A structural tension, conflict, or ongoing problem that creates friction in the system.",
  },
  {
    id: "projection",
    label: "Projection",
    category: "Analytical",
    categoryColor: c.blue700,
    categoryBg: c.blue50,
    categoryBorder: c.blueBorder,
    icon: "◆",
    color: c.blue700,
    bg: c.blue50,
    border: c.blueBorder,
    description: "A quantitative or qualitative forecast — growth rates, scenario outputs, demographic estimates.",
  },
  {
    id: "plan",
    label: "Plan",
    category: "Contextual",
    categoryColor: c.violet700,
    categoryBg: c.violet50,
    categoryBorder: c.violetBorder,
    icon: "◉",
    color: c.violet700,
    bg: c.violet50,
    border: c.violetBorder,
    description: "An announced strategy, policy, roadmap, or intended action by an actor in the system.",
  },
  {
    id: "obstacle",
    label: "Obstacle",
    category: "Contextual",
    categoryColor: c.amber700,
    categoryBg: c.amber50,
    categoryBorder: c.amberBorder,
    icon: "▲",
    color: c.amber700,
    bg: c.amber50,
    border: c.amberBorder,
    description: "A barrier — regulatory, technical, social, or economic — that constrains a trend or plan.",
  },
  {
    id: "source",
    label: "Source",
    category: "Reference",
    categoryColor: c.muted,
    categoryBg: c.surfaceAlt,
    categoryBorder: c.border,
    icon: "◻",
    color: c.muted,
    bg: c.surfaceAlt,
    border: c.border,
    description: "A publication, database, expert, or institution to return to repeatedly. Not a single item.",
  },
];

// ─── Three-card radio selector ─────────────────────────────────────────────────

/** @param {{ label: string, options: {value,title,desc,dotColor}[], selected: string|null, onSelect: (v) => void }} props */
export function ThreeCardSelector({ label, options, selected, onSelect }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {options.map(({ value, title, desc, dotColor }) => {
          const on = selected === value;
          return (
            <button
              key={value}
              onClick={() => onSelect(on ? null : value)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${on ? c.ink : c.border}`,
                background: on ? "rgba(0,0,0,0.02)" : c.white,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? (dotColor || c.ink) : c.hint, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: on ? 500 : 400, color: c.ink }}>{title}</span>
                {on && <span style={{ fontSize: 10, marginLeft: "auto", color: c.ink }}>✓</span>}
              </div>
              <div style={{ fontSize: 10, color: c.muted, lineHeight: 1.45 }}>{desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── STEEPLED pill grid ────────────────────────────────────────────────────────

/** @param {{ selected: string[], onToggle: (cat: string) => void }} props */
export function SteepleSelector({ selected, onToggle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>STEEPLED category</div>
      <div style={fh}>Select all that apply.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {STEEPLED.map((cat) => {
          const on = selected.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              style={{
                padding: "6px 8px",
                borderRadius: 7,
                fontSize: 11,
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

// ─── Horizon toggle buttons ────────────────────────────────────────────────────

/** @param {{ selected: string|null, onSelect: (v: string|null) => void }} props */
export function HorizonSelector({ selected, onSelect }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>Time horizon</div>
      <div style={{ display: "flex", gap: 8 }}>
        {["H1", "H2", "H3"].map((h) => {
          const on = selected === h;
          return (
            <button
              key={h}
              onClick={() => onSelect(on ? null : h)}
              style={{
                padding: "7px 22px",
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
              {h} {on && "✓"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Type switcher chip + dropdown ────────────────────────────────────────────

/**
 * @param {{ selectedType: string, onChange: (typeId: string) => void }} props
 * Renders the coloured type chip that opens a dropdown to switch type.
 * Does NOT render the description banner — render that separately using INPUT_TYPES.
 */
export function TypeSwitcherChip({ selectedType, onChange }) {
  const [open, setOpen] = useState(false);
  const typeData = INPUT_TYPES.find((t) => t.id === selectedType) || INPUT_TYPES[0];

  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 12px 6px 10px",
          borderRadius: 20,
          border: `1px solid ${typeData.border}`,
          background: typeData.bg,
          color: typeData.color,
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 11 }}>{typeData.icon}</span>
        {typeData.label}
        <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
      )}

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          zIndex: 11,
          background: c.white,
          border: `1px solid ${c.borderMid}`,
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          minWidth: 300,
          overflow: "hidden",
        }}>
          {INPUT_TYPES.map((t) => {
            const active = selectedType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { onChange(t.id); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  width: "100%",
                  background: active ? "rgba(0,0,0,0.03)" : "transparent",
                  border: "none",
                  borderBottom: `1px solid ${c.border}`,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: t.bg, border: `1px solid ${t.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: t.color, flexShrink: 0,
                }}>
                  {t.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{t.label}</span>
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 8,
                      background: t.categoryBg, color: t.categoryColor, border: `1px solid ${t.categoryBorder}`,
                    }}>
                      {t.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.4, marginTop: 1 }}>{t.description}</div>
                </div>
                {active && <span style={{ fontSize: 11, color: c.ink, flexShrink: 0 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

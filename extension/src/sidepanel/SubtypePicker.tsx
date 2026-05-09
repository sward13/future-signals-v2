import { useRef, useState } from "react";
import { c } from "../../../src/styles/tokens.js";

// Mirrors INPUT_TYPES in src/components/inputs/InputFormFields.jsx
const TYPES = [
  {
    id:            "signal",
    label:         "Signal",
    category:      "Most common",
    icon:          "◎",
    color:         c.green700,
    bg:            c.green50,
    border:        c.greenBorder,
    categoryColor: c.green700,
    categoryBg:    c.green50,
    categoryBorder:c.greenBorder,
    description:   "A concrete, observable piece of evidence — an event, data point, or article that points toward change.",
  },
  {
    id:            "issue",
    label:         "Issue",
    category:      "Analytical",
    icon:          "▲",
    color:         c.red800,
    bg:            c.red50,
    border:        c.redBorder,
    categoryColor: c.red800,
    categoryBg:    c.red50,
    categoryBorder:c.redBorder,
    description:   "A structural tension, conflict, or ongoing problem that creates friction in the system.",
  },
  {
    id:            "projection",
    label:         "Projection",
    category:      "Analytical",
    icon:          "◆",
    color:         c.blue700,
    bg:            c.blue50,
    border:        c.blueBorder,
    categoryColor: c.blue700,
    categoryBg:    c.blue50,
    categoryBorder:c.blueBorder,
    description:   "A quantitative or qualitative forecast — growth rates, scenario outputs, demographic estimates.",
  },
  {
    id:            "plan",
    label:         "Plan",
    category:      "Contextual",
    icon:          "◉",
    color:         c.violet700,
    bg:            c.violet50,
    border:        c.violetBorder,
    categoryColor: c.violet700,
    categoryBg:    c.violet50,
    categoryBorder:c.violetBorder,
    description:   "An announced strategy, policy, roadmap, or intended action by an actor in the system.",
  },
  {
    id:            "obstacle",
    label:         "Obstacle",
    category:      "Contextual",
    icon:          "▲",
    color:         c.amber700,
    bg:            c.amber50,
    border:        c.amberBorder,
    categoryColor: c.amber700,
    categoryBg:    c.amber50,
    categoryBorder:c.amberBorder,
    description:   "A barrier — regulatory, technical, social, or economic — that constrains a trend or plan.",
  },
  {
    id:            "source",
    label:         "Source",
    category:      "Reference",
    icon:          "◻",
    color:         c.muted,
    bg:            c.surfaceAlt,
    border:        c.border,
    categoryColor: c.muted,
    categoryBg:    c.surfaceAlt,
    categoryBorder:c.border,
    description:   "A publication, database, expert, or institution to return to repeatedly. Not a single item.",
  },
] as const;

type SubtypeId = (typeof TYPES)[number]["id"];

type Props = {
  value: string;
  onChange: (id: SubtypeId) => void;
};

export function SubtypePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(0);
  const chipRef = useRef<HTMLButtonElement>(null);
  const selected = TYPES.find((t) => t.id === value) ?? TYPES[0];

  const handleOpen = () => {
    if (chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect();
      setMenuTop(rect.bottom + 6);
    }
    setOpen((o) => !o);
  };

  return (
    <div>
      {/* Chip trigger */}
      <button
        ref={chipRef}
        type="button"
        onClick={handleOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 12px 6px 10px",
          borderRadius: 20,
          border: `1px solid ${selected.border}`,
          background: selected.bg,
          color: selected.color,
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 11 }}>{selected.icon}</span>
        {selected.label}
        <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>▾</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 10 }}
        />
      )}

      {/* Dropdown — fixed so the overflowY scroll container can't clip it */}
      {open && (
        <div
          style={{
            position: "fixed",
            top: menuTop,
            left: 0,
            right: 0,
            zIndex: 11,
            background: c.white,
            border: `1px solid ${c.borderMid}`,
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {TYPES.map((t) => {
            const active = value === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { onChange(t.id); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  width: "100%",
                  background: active ? "rgba(0,0,0,0.03)" : "transparent",
                  border: "none",
                  borderBottom: `1px solid ${c.border}`,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                {/* Icon badge */}
                <span
                  style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: t.bg, border: `1px solid ${t.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: t.color, flexShrink: 0,
                  }}
                >
                  {t.icon}
                </span>

                {/* Label + category + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{t.label}</span>
                    <span
                      style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 8,
                        background: t.categoryBg, color: t.categoryColor,
                        border: `1px solid ${t.categoryBorder}`,
                      }}
                    >
                      {t.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: c.muted, lineHeight: 1.4 }}>
                    {t.description}
                  </div>
                </div>

                {active && (
                  <span style={{ fontSize: 11, color: c.ink, flexShrink: 0 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { c } from "../../../src/styles/tokens.js";

// Mirrors INPUT_TYPES in src/components/inputs/InputFormFields.jsx
// Using hardcoded token values to avoid pulling in main-app JSX dependencies.
const TYPES = [
  {
    id:     "signal",
    label:  "Signal",
    icon:   "◎",
    color:  c.green700,
    bg:     c.green50,
    border: c.greenBorder,
    desc:   "A concrete, observable piece of evidence pointing toward change.",
  },
  {
    id:     "issue",
    label:  "Issue",
    icon:   "▲",
    color:  c.red800,
    bg:     c.red50,
    border: c.redBorder,
    desc:   "A structural tension, conflict, or ongoing problem in the system.",
  },
  {
    id:     "projection",
    label:  "Projection",
    icon:   "◆",
    color:  c.blue700,
    bg:     c.blue50,
    border: c.blueBorder,
    desc:   "A quantitative or qualitative forecast — growth rates, estimates.",
  },
  {
    id:     "plan",
    label:  "Plan",
    icon:   "◉",
    color:  c.violet700,
    bg:     c.violet50,
    border: c.violetBorder,
    desc:   "An announced strategy, policy, roadmap, or intended action.",
  },
  {
    id:     "obstacle",
    label:  "Obstacle",
    icon:   "▲",
    color:  c.amber700,
    bg:     c.amber50,
    border: c.amberBorder,
    desc:   "A barrier — regulatory, technical, or economic — that constrains a trend.",
  },
  {
    id:     "source",
    label:  "Source",
    icon:   "◻",
    color:  c.muted,
    bg:     c.surfaceAlt,
    border: c.border,
    desc:   "A publication, database, or institution to return to repeatedly.",
  },
] as const;

type SubtypeId = (typeof TYPES)[number]["id"];

type Props = {
  value: string;
  onChange: (id: SubtypeId) => void;
};

export function SubtypePicker({ value, onChange }: Props) {
  const selected = TYPES.find((t) => t.id === value) ?? TYPES[0];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
          marginBottom: 8,
        }}
      >
        {TYPES.map((t) => {
          const on = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              style={{
                padding: "7px 6px",
                borderRadius: 7,
                border: `1.5px solid ${on ? t.border : c.border}`,
                background: on ? t.bg : c.white,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 11, color: on ? t.color : c.hint }}>
                  {t.icon}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: on ? 600 : 400,
                    color: on ? t.color : c.muted,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Description for the selected type */}
      <div
        style={{
          fontSize: 11,
          color: selected.color,
          background: selected.bg,
          border: `1px solid ${selected.border}`,
          borderRadius: 6,
          padding: "6px 9px",
          lineHeight: 1.5,
        }}
      >
        <span style={{ marginRight: 5 }}>{selected.icon}</span>
        {selected.desc}
      </div>
    </div>
  );
}

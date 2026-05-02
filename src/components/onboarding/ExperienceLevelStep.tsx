import { useState } from "react";
import { c, btnP } from "../../styles/tokens.js";

interface Props {
  onNext: () => void;
  onSelect: (level: string) => void;
}

const OPTS = [
  {
    id: "new-user",
    label: "I'm new to structured foresight",
    sub: "I'll learn the methodology as I go",
  },
  {
    id: "regular",
    label: "I use foresight methods regularly",
    sub: "I have a practice but want better structure",
  },
  {
    id: "expert",
    label: "I'm an experienced practitioner or consultant",
    sub: "I know what I'm doing — just give me the tools",
  },
];

// 5 dots total; this step is dot index 1
const STEP_DOT = 1;
const TOTAL_DOTS = 5;

function StepDots() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: TOTAL_DOTS }, (_, i) => {
        const isActive = i === STEP_DOT;
        const isDone   = i  < STEP_DOT;
        return (
          <div
            key={i}
            style={{
              width:        isActive ? 20 : 6,
              height:       6,
              borderRadius: 3,
              background:   isActive
                ? c.brand
                : isDone
                  ? "rgba(59,130,246,0.4)"
                  : "rgba(0,0,0,0.15)",
              transition: "all 0.2s",
            }}
          />
        );
      })}
    </div>
  );
}

function LogoMark() {
  return (
    <div
      style={{
        width: 28, height: 28, borderRadius: 6,
        background: c.brand,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <svg viewBox="0 0 16 16" width={16} height={16}>
        <circle cx={4}  cy={8}  r={2} fill="#fff" />
        <circle cx={8}  cy={4}  r={2} fill="rgba(255,255,255,0.6)" />
        <circle cx={12} cy={8}  r={2} fill="rgba(255,255,255,0.85)" />
        <circle cx={8}  cy={12} r={2} fill="rgba(255,255,255,0.4)" />
      </svg>
    </div>
  );
}

export function ExperienceLevelStep({ onNext, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    onSelect(selected);
    onNext();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: c.bg,
        fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
        fontSize: 13,
        lineHeight: 1.5,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: c.white,
          borderBottom: "0.5px solid rgba(0,0,0,0.09)",
          padding: "0 32px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LogoMark />
          <span
            style={{
              fontFamily: "'Roboto', -apple-system, sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: c.ink,
            }}
          >
            Future Signals
          </span>
        </div>
        <StepDots />
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "40px 24px 32px",
        }}
      >
        <div
          style={{
            background: c.white,
            border: "0.5px solid rgba(0,0,0,0.09)",
            borderRadius: 12,
            padding: "32px 36px",
            width: "100%",
            maxWidth: 520,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            boxSizing: "border-box",
          }}
        >
          {/* Tag */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: c.brand,
              marginBottom: 8,
            }}
          >
            One quick question
          </div>

          {/* Heading */}
          <h2
            style={{
              fontFamily: "'Roboto', -apple-system, sans-serif",
              fontSize: 22,
              fontWeight: 500,
              color: c.ink,
              margin: "0 0 7px",
            }}
          >
            How do you practise foresight?
          </h2>

          {/* Sub */}
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 22, lineHeight: 1.6, margin: "0 0 22px" }}>
            Helps us calibrate guidance levels. You can change this any time.
          </p>

          {/* Option cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {OPTS.map((opt) => {
              const isSelected = selected === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelected(opt.id)}
                  style={{
                    border: `1px solid ${isSelected ? c.brand : "rgba(0,0,0,0.16)"}`,
                    borderRadius: 8,
                    padding: "13px 15px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    background: isSelected ? "#EFF6FF" : c.white,
                    transition: "border-color 0.15s, background 0.15s",
                    userSelect: "none",
                  }}
                >
                  {/* Radio dot */}
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: `1.5px solid ${isSelected ? c.brand : "rgba(0,0,0,0.2)"}`,
                      flexShrink: 0,
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "border-color 0.15s",
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: c.brand,
                        }}
                      />
                    )}
                  </div>

                  {/* Label + sub */}
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: c.ink,
                        marginBottom: 2,
                      }}
                    >
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{opt.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 24,
            }}
          >
            <button
              onClick={handleContinue}
              disabled={!selected}
              style={{
                ...btnP,
                opacity: selected ? 1 : 0.4,
                cursor: selected ? "pointer" : "default",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

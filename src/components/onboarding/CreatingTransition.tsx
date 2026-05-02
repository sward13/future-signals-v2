import { useState, useEffect } from "react";
import { c } from "../../styles/tokens.js";

interface Props {
  onNext: () => void;
  projectDomain: string;
}

const STEP_DOT = 2;
const TOTAL_DOTS = 5;

// Timings in ms
const TIMINGS = [450, 900, 1400] as const; // each step becomes "done" at these points
const AUTO_ADVANCE_MS = 2500;

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

type StepStatus = "pending" | "active" | "done";

function StepIcon({ status }: { status: StepStatus }) {
  return (
    <div
      style={{
        width: 18, height: 18,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9,
        background:
          status === "done"    ? "#D1FAE5" :
          status === "active"  ? "#DBEAFE" :
          "#E5E7EB",
        border: status === "active" ? "1.5px solid #3B82F6" : "none",
      }}
    >
      {status === "done" && (
        <span style={{ color: "#065F46", fontSize: 9, fontWeight: 600 }}>✓</span>
      )}
      {status === "active" && (
        <div
          style={{
            width: 10, height: 10,
            borderRadius: "50%",
            border: "1.5px solid #BFDBFE",
            borderTopColor: "#3B82F6",
            animation: "ct-spin 0.7s linear infinite",
          }}
        />
      )}
    </div>
  );
}

export function CreatingTransition({ onNext, projectDomain }: Props) {
  // stepIdx = index of the currently active step (0-3)
  const [stepIdx, setStepIdx] = useState(0);

  const steps = [
    "Creating your project",
    `Connecting to ${projectDomain} sources`,
    "Scanning for relevant signals",
    "Signals ready",
  ];

  useEffect(() => {
    const timers = [
      setTimeout(() => setStepIdx(1), TIMINGS[0]),
      setTimeout(() => setStepIdx(2), TIMINGS[1]),
      setTimeout(() => setStepIdx(3), TIMINGS[2]),
      setTimeout(onNext, AUTO_ADVANCE_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onNext]);

  const getStatus = (index: number): StepStatus => {
    if (index < stepIdx)  return "done";
    if (index === stepIdx) return "active";
    return "pending";
  };

  return (
    <>
      <style>{`
        @keyframes ct-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.06); opacity: 0.85; }
        }
        @keyframes ct-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

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
                fontSize: 14, fontWeight: 500, color: c.ink,
              }}
            >
              Future Signals
            </span>
          </div>
          <StepDots />
        </div>

        {/* Body — centred, no card border */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 400, width: "100%" }}>
            {/* Pulsing ring */}
            <div
              style={{
                width: 60, height: 60,
                borderRadius: "50%",
                background: "#EFF6FF",
                border: "2px solid #BFDBFE",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
                animation: "ct-pulse 1.5s ease-in-out infinite",
              }}
            >
              <div
                style={{
                  width: 30, height: 30,
                  borderRadius: "50%",
                  background: "#3B82F6",
                  border: "2px solid #93C5FD",
                }}
              />
            </div>

            {/* Title */}
            <h2
              style={{
                fontFamily: "'Roboto', -apple-system, sans-serif",
                fontSize: 18, fontWeight: 500,
                color: c.ink,
                margin: "0 0 7px",
              }}
            >
              Setting up your project
            </h2>

            {/* Sub */}
            <p
              style={{
                fontSize: 13, color: "#6B7280",
                lineHeight: 1.6,
                margin: "0 0 22px",
              }}
            >
              We're connecting to sources in your domain and scanning for signals
              matched to your key question.
            </p>

            {/* Step list */}
            <div
              style={{
                display: "flex", flexDirection: "column", gap: 9,
                textAlign: "left",
                background: c.white,
                borderRadius: 10,
                padding: "16px 18px",
                border: `1px solid ${c.border}`,
              }}
            >
              {steps.map((label, i) => {
                const status = getStatus(i);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      fontSize: 12,
                      color:
                        status === "done"   ? "#065F46" :
                        status === "active" ? c.ink :
                        "#9CA3AF",
                      fontWeight: status === "active" ? 500 : 400,
                      transition: "color 0.3s",
                    }}
                  >
                    <StepIcon status={status} />
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

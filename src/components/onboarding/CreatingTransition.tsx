import { useState, useEffect } from "react";
import { Circle, CircleCheck, Target } from "lucide-react";
import { c } from "../../styles/tokens.js";
import logoLight from "../../assets/logo_light.svg";

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
                  : "#9C9B96",
              transition: "all 0.2s",
            }}
          />
        );
      })}
    </div>
  );
}

type StepStatus = "pending" | "active" | "done";

function StepIcon({ status, isFinal }: { status: StepStatus; isFinal: boolean }) {
  const size = 17;
  // The terminal "Signals ready" step is marked with a target, in every state.
  if (isFinal) {
    return (
      <Target
        size={size}
        color={status === "pending" ? c.hint : c.brand}
        strokeWidth={2}
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      />
    );
  }
  if (status === "done") {
    return <CircleCheck size={size} color={c.green700} strokeWidth={2} style={{ flexShrink: 0 }} aria-hidden="true" />;
  }
  return (
    <Circle
      size={size}
      color={status === "active" ? c.brand : c.hint}
      strokeWidth={2}
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    />
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
        @keyframes ct-spin {
          to { transform: rotate(360deg); }
        }
        .ct-spinner {
          width: 48px; height: 48px;
          border-radius: 50%;
          border: 3px solid ${c.border};
          border-top-color: ${c.brand};
          animation: ct-spin 0.8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ct-spinner { animation: none; }
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
          <div style={{ display: "flex", alignItems: "center" }}>
            <img src={logoLight} alt="Future Signals" style={{ width: 130, height: "auto", display: "block" }} />
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
            {/* CSS loader (cssloaders.github.io style) — respects reduced motion */}
            <div className="ct-spinner" style={{ margin: "0 auto 20px" }} aria-hidden="true" />

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
                    <StepIcon status={status} isFinal={i === steps.length - 1} />
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

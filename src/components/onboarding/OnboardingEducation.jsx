/**
 * OnboardingEducation — four educational slides walking through the methodology.
 * Has its own internal slide navigation. When the user reaches the last slide
 * and clicks Continue, onContinue() is called to advance the parent flow.
 * @param {{ onContinue: () => void }} props
 */
import { useState } from "react";
import { c, btnP, btnSec } from "../../styles/tokens.js";

const SLIDES = [
  {
    icon: "◎",
    title: "Signals are early indicators of change",
    body: "A signal is any piece of evidence — an event, trend, statement, or data point — that suggests something might be shifting in your environment. Signals can be weak and emerging, or widely confirmed.",
    example: "Example: A government announces a major funding programme for nuclear fusion research.",
  },
  {
    icon: "◈",
    title: "Clusters reveal patterns across signals",
    body: "When multiple signals point in the same direction, they form a cluster. A cluster is a named group of related signals that together describe a Trend, Driver, or Tension shaping the future.",
    example: "Example: Three signals about AI regulation cluster into 'Regulatory Pressure on Frontier AI'.",
  },
  {
    icon: "◆",
    title: "System Maps show how clusters interact",
    body: "Clusters don't exist in isolation. Use the System Map to draw relationships between them — how one Drives, Enables, or Inhibits another. This reveals the deeper structure of the system you're studying.",
    example: "Example: 'AI Regulation' Inhibits 'Rapid AI Deployment', which Drives 'Labour Market Disruption'.",
  },
  {
    icon: "◑",
    title: "Analysis synthesises your insights",
    body: "The Analysis screen turns your system map into structured intelligence: key dynamics, critical uncertainties, and strategic implications — ready to brief a team or inform a strategy.",
    example: "The workflow: Capture signals → Group into clusters → Map relationships → Analyse the system.",
  },
];

export function OnboardingEducation({ onContinue }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Slide indicator */}
      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === idx ? 18 : 6, height: 6, borderRadius: 3,
            background: i === idx ? c.ink : i < idx ? c.muted : c.border,
            transition: "all 0.2s",
          }} />
        ))}
      </div>

      {/* Slide content */}
      <div style={{
        background: c.surfaceAlt, border: `1px solid ${c.border}`,
        borderRadius: 10, padding: "24px 22px",
      }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>{slide.icon}</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: c.ink, marginBottom: 10, lineHeight: 1.35 }}>
          {slide.title}
        </div>
        <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.7, marginBottom: 14 }}>
          {slide.body}
        </div>
        <div style={{
          fontSize: 11, color: c.hint, fontStyle: "italic", lineHeight: 1.55,
          borderLeft: `2px solid ${c.border}`, paddingLeft: 12,
        }}>
          {slide.example}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={() => setIdx((i) => i - 1)}
          disabled={idx === 0}
          style={{
            ...btnSec, fontSize: 12, padding: "7px 16px",
            opacity: idx === 0 ? 0 : 1, pointerEvents: idx === 0 ? "none" : "auto",
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 10, color: c.hint }}>{idx + 1} of {SLIDES.length}</span>
        {isLast ? (
          <button onClick={onContinue} style={{ ...btnP, fontSize: 12, padding: "8px 20px" }}>
            Continue →
          </button>
        ) : (
          <button onClick={() => setIdx((i) => i + 1)} style={{ ...btnP, fontSize: 12, padding: "8px 20px" }}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

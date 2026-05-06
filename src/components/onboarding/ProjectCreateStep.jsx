import { useState } from "react";
import { c, inp, ta, btnP, btnSec } from "../../styles/tokens.js";
import logoLight from "../../assets/logo_light.svg";
import { HorizonSlider, YearInput } from "../projects/NewProjectModal.jsx";

// 8 domains — "Custom / Other" intentionally excluded from onboarding
const DOMAINS = [
  { label: "Technology & AI" },
  { label: "Climate & Energy" },
  { label: "Health & Life Sciences" },
  { label: "Government & Policy" },
  { label: "Economy & Finance" },
  { label: "Education & Learning" },
  { label: "Media & Culture" },
  { label: "Defence & Security" },
];

// 5 dots total; this step is dot index 2
const STEP_DOT = 2;
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

/**
 * ProjectCreateStep — onboarding project creation form.
 *
 * @param {{
 *   experienceLevel: 'new-user' | 'regular' | 'expert' | null,
 *   onSubmit: (fields: object) => void,
 *   onBack: () => void,
 * }} props
 *
 * onSubmit receives: { name, domain, question, focus, geo, stakeholders, fromYear, toYear }
 * Stage 3 will wire the actual Supabase insert and onNext(projectId) call inside onSubmit.
 */
export function ProjectCreateStep({ experienceLevel, onSubmit, onBack, initialValues }) {
  const iv = initialValues ?? {};

  // Quick Start fields
  const [name,     setName]     = useState(iv.name     ?? "");
  const [domain,   setDomain]   = useState(iv.domain   ?? "");
  const [question, setQuestion] = useState(iv.question ?? "");

  // Enhanced fields
  const [focus,        setFocus]        = useState(iv.focus        ?? "");
  const [geo,          setGeo]          = useState(iv.geo          ?? "");
  const [stakeholders, setStakeholders] = useState(iv.stakeholders ?? "");
  const [fromYear,     setFromYear]     = useState(iv.fromYear != null ? Number(iv.fromYear) : new Date().getFullYear());
  const [toYear,       setToYear]       = useState(iv.toYear   != null ? Number(iv.toYear)   : new Date().getFullYear() + 15);
  const [h1Pct,        setH1Pct]        = useState(iv.h1Pct    ?? 0.22);
  const [h2Pct,        setH2Pct]        = useState(iv.h2Pct    ?? 0.58);

  // Enhanced panel open state — experts start open
  const [enhancedOpen, setEnhancedOpen] = useState(experienceLevel === "expert");

  const isExpert  = experienceLevel === "expert";
  const canSubmit = name.trim() !== "" && domain !== "" && question.trim() !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    const span   = toYear - fromYear;
    const h1End  = String(Math.round(fromYear + h1Pct * span));
    const h2End  = String(Math.round(fromYear + h2Pct * span));
    onSubmit({
      name: name.trim(), domain, question: question.trim(),
      focus, geo, stakeholders,
      fromYear: String(fromYear), toYear: String(toYear),
      h1Pct, h2Pct,
      h1_start: String(fromYear), h1_end: h1End,
      h2_start: h1End,            h2_end: h2End,
      h3_start: h2End,            h3_end: String(toYear),
    });
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
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logoLight} alt="Future Signals" style={{ width: 130, height: "auto", display: "block" }} />
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
            Create your first project
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
            What are you trying to understand?
          </h2>

          {/* Sub */}
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 22px", lineHeight: 1.6 }}>
            Three fields to get started. Your scanner starts finding signals as soon as you hit create.
          </p>

          {/* ── Project name ────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: c.ink,
                marginBottom: 5,
              }}
            >
              Project name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Future of Diagnostic Medicine"
              style={{ ...inp }}
              autoFocus
            />
          </div>

          {/* ── Domain ──────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: c.ink,
                marginBottom: 8,
              }}
            >
              Domain
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {DOMAINS.map((d) => {
                const isActive = domain === d.label;
                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setDomain(isActive ? "" : d.label)}
                    style={{
                      padding: "10px 13px",
                      borderRadius: 8,
                      border: `1px solid ${isActive ? c.brand : "rgba(0,0,0,0.16)"}`,
                      background: isActive ? "#EFF6FF" : c.white,
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? "#1E40AF" : c.ink,
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s, color 0.15s",
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Key question ────────────────────────────── */}
          <div style={{ marginBottom: 4 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: c.ink,
                marginBottom: 5,
              }}
            >
              Key question
            </label>
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How might AI reshape diagnostic medicine over the next decade?"
              style={{ ...ta }}
            />
            <p
              style={{
                fontSize: 11,
                color: "#9CA3AF",
                fontStyle: "italic",
                marginTop: 5,
                marginBottom: 0,
                lineHeight: 1.5,
              }}
            >
              A starting point — you'll refine this as your project develops.
            </p>
          </div>

          {/* ── Enhanced toggle ──────────────────────────── */}
          {isExpert ? (
            /* Expert: blue-tinted panel, open by default */
            <div
              style={{
                marginTop: 16,
                background: "#F0F7FF",
                border: "1px solid #BFDBFE",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 500, color: c.ink }}
                >
                  Advanced setup
                </span>
                <button
                  type="button"
                  onClick={() => setEnhancedOpen((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    color: c.brand,
                    fontFamily: "inherit",
                    padding: "0 2px",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      transition: "transform 0.15s",
                      fontSize: 9,
                      transform: enhancedOpen ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  >
                    ►
                  </span>
                  {enhancedOpen ? "Hide" : "Show"}
                </button>
              </div>

              {/* Enhanced fields */}
              {enhancedOpen && (
                <div
                  style={{
                    padding: "0 14px 14px",
                    borderTop: "0.5px solid rgba(59,130,246,0.2)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    paddingTop: 12,
                  }}
                >
                  <EnhancedFields
                    focus={focus} setFocus={setFocus}
                    geo={geo} setGeo={setGeo}
                    stakeholders={stakeholders} setStakeholders={setStakeholders}
                    fromYear={fromYear} setFromYear={setFromYear}
                    toYear={toYear} setToYear={setToYear}
                    h1Pct={h1Pct} setH1Pct={setH1Pct}
                    h2Pct={h2Pct} setH2Pct={setH2Pct}
                  />
                </div>
              )}
            </div>
          ) : (
            /* New-user / regular: text toggle, collapsed by default */
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setEnhancedOpen((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: c.brand,
                  fontFamily: "inherit",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transition: "transform 0.15s",
                    fontSize: 9,
                    transform: enhancedOpen ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                >
                  ►
                </span>
                + Add more detail (optional for now)
              </button>

              {enhancedOpen && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "0.5px solid rgba(0,0,0,0.09)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <EnhancedFields
                    focus={focus} setFocus={setFocus}
                    geo={geo} setGeo={setGeo}
                    stakeholders={stakeholders} setStakeholders={setStakeholders}
                    fromYear={fromYear} setFromYear={setFromYear}
                    toYear={toYear} setToYear={setToYear}
                    h1Pct={h1Pct} setH1Pct={setH1Pct}
                    h2Pct={h2Pct} setH2Pct={setH2Pct}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Actions ──────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 24,
            }}
          >
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                style={{ ...btnSec, fontSize: 13 }}
              >
                ← Back
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                ...btnP,
                opacity: canSubmit ? 1 : 0.4,
                cursor: canSubmit ? "pointer" : "default",
              }}
            >
              Create project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Extracted so both expert and non-expert panels share the same fields
function EnhancedFields({
  focus, setFocus,
  geo, setGeo,
  stakeholders, setStakeholders,
  fromYear, setFromYear,
  toYear, setToYear,
  h1Pct, setH1Pct,
  h2Pct, setH2Pct,
}) {
  return (
    <>
      {/* Time horizons */}
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>
            Time horizons
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <YearInput label="From" value={fromYear} onChange={setFromYear} min={2000} max={toYear - 5} />
            <YearInput label="To"   value={toYear}   onChange={setToYear}   min={fromYear + 5} max={2100} />
          </div>
        </div>
        <HorizonSlider
          startYear={fromYear}
          endYear={toYear}
          h1Pct={h1Pct}
          h2Pct={h2Pct}
          onH1Change={setH1Pct}
          onH2Change={setH2Pct}
        />
      </div>

      {/* Focus area */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            color: c.ink,
            marginBottom: 5,
          }}
        >
          Focus area
        </label>
        <input
          type="text"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="e.g. Urban freight and last-mile delivery"
          style={{ ...inp }}
        />
      </div>

      {/* Geographic scope */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            color: c.ink,
            marginBottom: 5,
          }}
        >
          Geographic scope
        </label>
        <input
          type="text"
          value={geo}
          onChange={(e) => setGeo(e.target.value)}
          placeholder="e.g. OECD cities / Global South"
          style={{ ...inp }}
        />
      </div>

      {/* Stakeholders */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            color: c.ink,
            marginBottom: 5,
          }}
        >
          Stakeholders
        </label>
        <input
          type="text"
          value={stakeholders}
          onChange={(e) => setStakeholders(e.target.value)}
          placeholder="e.g. Urban planners, transit authorities"
          style={{ ...inp }}
        />
      </div>
    </>
  );
}

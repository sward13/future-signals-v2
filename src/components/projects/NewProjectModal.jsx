/**
 * NewProjectModal — centered overlay modal for creating a new project.
 * Contains a graphical three-horizon timeline slider (drag handles, not text inputs)
 * plus optional methodology fields behind a disclosure toggle.
 * @param {{ open: boolean, onClose: () => void, onSave: (fields: object) => void }} props
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { c, inp, ta, sel, btnP, btnG, fl, fh, badg } from "../../styles/tokens.js";
import { DOMAINS } from "../../data/seeds.js";

// ─── Horizon slider ────────────────────────────────────────────────────────────

/**
 * HorizonSlider — graphical drag-handle slider that sets H1/H2/H3 boundaries.
 * @param {{ startYear: number, endYear: number, h1Pct: number, h2Pct: number, onH1Change: fn, onH2Change: fn }} props
 */
function HorizonSlider({ startYear, endYear, h1Pct, h2Pct, onH1Change, onH2Change }) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // null | 0 (h1 handle) | 1 (h2 handle)

  // Use refs to always have fresh values in mousemove closure
  const h1Ref = useRef(h1Pct);
  const h2Ref = useRef(h2Pct);
  useEffect(() => { h1Ref.current = h1Pct; }, [h1Pct]);
  useEffect(() => { h2Ref.current = h2Pct; }, [h2Pct]);

  const MIN_GAP = 0.1; // minimum fraction between handles and edges

  useEffect(() => {
    if (dragging === null) return;

    const onMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

      if (dragging === 0) {
        const clamped = Math.max(MIN_GAP, Math.min(h2Ref.current - MIN_GAP, pct));
        onH1Change(clamped);
      } else {
        const clamped = Math.max(h1Ref.current + MIN_GAP, Math.min(1 - MIN_GAP, pct));
        onH2Change(clamped);
      }
    };

    const onMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, onH1Change, onH2Change]);

  const span = endYear - startYear;
  const h1EndYear = Math.round(startYear + h1Pct * span);
  const h2EndYear = Math.round(startYear + h2Pct * span);

  const Handle = ({ pct, index }) => (
    <div
      onMouseDown={(e) => { e.preventDefault(); setDragging(index); }}
      style={{
        position: "absolute",
        left: `${pct * 100}%`,
        top: 0,
        bottom: 0,
        width: 4,
        background: c.ink,
        transform: "translateX(-50%)",
        zIndex: 3,
        cursor: "ew-resize",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Visible grip pill */}
      <div style={{
        width: 14,
        height: 28,
        borderRadius: 6,
        background: c.ink,
        border: `2px solid ${c.white}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
      }}>
        <div style={{ width: 4, height: 1, background: "rgba(255,255,255,0.5)", borderRadius: 1 }} />
        <div style={{ width: 4, height: 1, background: "rgba(255,255,255,0.5)", borderRadius: 1 }} />
        <div style={{ width: 4, height: 1, background: "rgba(255,255,255,0.5)", borderRadius: 1 }} />
      </div>
    </div>
  );

  return (
    <div style={{ userSelect: "none" }}>
      {/* The bar */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          height: 52,
          borderRadius: 10,
          overflow: "visible",
          cursor: "default",
        }}
      >
        {/* H1 band */}
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: `${h1Pct * 100}%`,
          height: "100%",
          background: c.green50,
          border: `1px solid ${c.greenBorder}`,
          borderRadius: "10px 0 0 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 0,
          overflow: "hidden",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: c.green700, letterSpacing: "0.03em" }}>H1</span>
        </div>

        {/* H2 band */}
        <div style={{
          position: "absolute",
          left: `${h1Pct * 100}%`,
          top: 0,
          width: `${(h2Pct - h1Pct) * 100}%`,
          height: "100%",
          background: c.blue50,
          border: `1px solid ${c.blueBorder}`,
          borderLeft: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: c.blue700, letterSpacing: "0.03em" }}>H2</span>
        </div>

        {/* H3 band */}
        <div style={{
          position: "absolute",
          left: `${h2Pct * 100}%`,
          top: 0,
          right: 0,
          height: "100%",
          background: c.amber50,
          border: `1px solid ${c.amberBorder}`,
          borderLeft: "none",
          borderRadius: "0 10px 10px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: c.amber700, letterSpacing: "0.03em" }}>H3</span>
        </div>

        {/* Drag handles */}
        <Handle pct={h1Pct} index={0} />
        <Handle pct={h2Pct} index={1} />
      </div>

      {/* Year labels below bar */}
      <div style={{ position: "relative", height: 20, marginTop: 6 }}>
        <span style={{ position: "absolute", left: 0, fontSize: 11, color: c.muted }}>{startYear}</span>
        <span style={{
          position: "absolute",
          left: `${h1Pct * 100}%`,
          transform: "translateX(-50%)",
          fontSize: 11,
          fontWeight: 500,
          color: c.ink,
          whiteSpace: "nowrap",
        }}>
          {h1EndYear}
        </span>
        <span style={{
          position: "absolute",
          left: `${h2Pct * 100}%`,
          transform: "translateX(-50%)",
          fontSize: 11,
          fontWeight: 500,
          color: c.ink,
          whiteSpace: "nowrap",
        }}>
          {h2EndYear}
        </span>
        <span style={{ position: "absolute", right: 0, fontSize: 11, color: c.muted }}>{endYear}</span>
      </div>

      {/* Horizon breakdown cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
        <div style={{ padding: "9px 12px", borderRadius: 8, background: c.green50, border: `1px solid ${c.greenBorder}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: c.green700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>H1 · Near</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: c.green700 }}>{startYear}–{h1EndYear}</div>
        </div>
        <div style={{ padding: "9px 12px", borderRadius: 8, background: c.blue50, border: `1px solid ${c.blueBorder}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: c.blue700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>H2 · Transition</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: c.blue700 }}>{h1EndYear}–{h2EndYear}</div>
        </div>
        <div style={{ padding: "9px 12px", borderRadius: 8, background: c.amber50, border: `1px solid ${c.amberBorder}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: c.amber700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>H3 · Emerging</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: c.amber700 }}>{h2EndYear}–{endYear}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Range year controls ───────────────────────────────────────────────────────

function YearInput({ label, value, onChange, min, max }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ fontSize: 10, color: c.hint }}>{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(v);
        }}
        style={{
          width: 62,
          padding: "5px 7px",
          border: `1px solid ${c.borderMid}`,
          borderRadius: 6,
          fontSize: 12,
          textAlign: "center",
          background: c.white,
          color: c.ink,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </div>
  );
}

// ─── Mode selector ─────────────────────────────────────────────────────────────

function ModeSelector({ value, onChange }) {
  const modes = [
    {
      id: "quick_scan",
      label: "Quick scan",
      desc: "Light-touch exploration. Good for rapid horizon briefs or single-session work.",
    },
    {
      id: "deep_analysis",
      label: "Deep analysis",
      desc: "Structured methodology with full STEEPLED tagging, horizon framing, and scenario development.",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {modes.map((m) => {
        const on = value === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            style={{
              padding: "12px 14px",
              borderRadius: 9,
              border: `1px solid ${on ? c.ink : c.border}`,
              background: on ? "rgba(0,0,0,0.02)" : c.white,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{m.label}</span>
              {on && <span style={{ fontSize: 10, color: c.ink, marginLeft: "auto" }}>✓</span>}
            </div>
            <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.45 }}>{m.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Modal component ───────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_END_YEAR = CURRENT_YEAR + 15;

export function NewProjectModal({ open, onClose, onSave }) {
  // ── Form fields ──────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [mode, setMode] = useState("quick_scan");
  const [question, setQuestion] = useState("");
  const [nameError, setNameError] = useState(false);
  const [domainError, setDomainError] = useState(false);

  // ── Horizon slider state ─────────────────────────────────────────────
  const [startYear, setStartYear] = useState(CURRENT_YEAR);
  const [endYear, setEndYear] = useState(DEFAULT_END_YEAR);
  const [h1Pct, setH1Pct] = useState(0.22);  // ~3-4 years in
  const [h2Pct, setH2Pct] = useState(0.58);  // ~8-9 years in

  // ── Optional methodology fields (shown only for deep_analysis) ──────
  const [unit, setUnit] = useState("");
  const [geo, setGeo] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [stakeholders, setStakeholders] = useState("");

  const resetForm = () => {
    setName(""); setDomain(""); setMode("quick_scan"); setQuestion("");
    setNameError(false); setDomainError(false);
    setStartYear(CURRENT_YEAR); setEndYear(DEFAULT_END_YEAR);
    setH1Pct(0.22); setH2Pct(0.58);
    setUnit(""); setGeo(""); setAssumptions(""); setStakeholders("");
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSave = () => {
    let hasError = false;
    if (!name.trim()) { setNameError(true); hasError = true; }
    if (!domain) { setDomainError(true); hasError = true; }
    if (hasError) return;

    const span = endYear - startYear;
    const h1End = String(Math.round(startYear + h1Pct * span));
    const h2End = String(Math.round(startYear + h2Pct * span));

    onSave({
      name: name.trim(),
      domain,
      mode,
      question,
      h1_start: String(startYear),
      h1_end: h1End,
      h2_start: h1End,
      h2_end: h2End,
      h3_start: h2End,
      h3_end: String(endYear),
      unit,
      geo,
      assumptions,
      stakeholders,
    });
    resetForm();
  };

  // Clamp end year when start changes
  const handleStartYearChange = (v) => {
    const clamped = Math.min(v, endYear - 5);
    setStartYear(clamped);
  };
  const handleEndYearChange = (v) => {
    const clamped = Math.max(v, startYear + 5);
    setEndYear(clamped);
  };

  // Completion percentage (rough estimate for the progress bar)
  const pct = Math.round(
    ([name.trim(), domain, question].filter(Boolean).length / 3) * 100
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 200,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 40,
          paddingBottom: 40,
          overflowY: "auto",
        }}
      />

      {/* Card — positioned above backdrop */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 201,
          width: "100%",
          maxWidth: 640,
          maxHeight: "calc(100vh - 80px)",
          background: c.white,
          borderRadius: 14,
          border: `1px solid ${c.border}`,
          boxShadow: "0 12px 48px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modalIn 0.2s ease",
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: "22px 28px 18px",
          borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
            New project
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, color: c.ink }}>What are you investigating?</div>
          <div style={{ fontSize: 12, color: c.muted, marginTop: 3, lineHeight: 1.5 }}>
            Start with the essentials. Add context any time from project settings.
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

          {/* ── Name ──────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={fl}>Project name <span style={badg}>required</span></div>
            <input
              style={{ ...inp, borderColor: nameError ? c.redBorder : undefined }}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(false); }}
              placeholder="e.g. Future of Alternative Proteins"
              autoFocus
            />
            {nameError && <div style={{ fontSize: 11, color: c.red800, marginTop: 4 }}>Project name is required.</div>}
          </div>

          {/* ── Domain ────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={fl}>Domain <span style={badg}>required</span></div>
            <div style={{ position: "relative" }}>
              <select
                style={{ ...sel, borderColor: domainError ? c.redBorder : undefined }}
                value={domain}
                onChange={(e) => { setDomain(e.target.value); setDomainError(false); }}
              >
                <option value="">Select a domain…</option>
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: c.hint, pointerEvents: "none" }}>▾</span>
            </div>
            {domainError && <div style={{ fontSize: 11, color: c.red800, marginTop: 4 }}>Domain is required.</div>}
          </div>

          {/* ── Mode ──────────────────────────────────────────── */}
          <div style={{ marginBottom: 18 }}>
            <div style={fl}>Analysis mode</div>
            <ModeSelector value={mode} onChange={setMode} />
          </div>

          {/* ── Key question ──────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <div style={fl}>Key question <span style={{ ...badg, marginLeft: 2 }}>optional</span></div>
            <div style={fh}>The central question this project seeks to explore.</div>
            <textarea
              style={ta}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How might alternative proteins reshape global food supply chains by 2040?"
            />
          </div>

          {/* ── Time horizons ─────────────────────────────────── */}
          <div style={{
            padding: "18px 20px",
            background: c.fieldBg,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            marginBottom: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, marginBottom: 2 }}>Time horizons</div>
                <div style={{ fontSize: 11, color: c.hint, fontStyle: "italic" }}>Drag the handles to set H1/H2 and H2/H3 boundaries.</div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <YearInput label="From" value={startYear} onChange={handleStartYearChange} min={2000} max={endYear - 5} />
                <YearInput label="To" value={endYear} onChange={handleEndYearChange} min={startYear + 5} max={2100} />
              </div>
            </div>
            <HorizonSlider
              startYear={startYear}
              endYear={endYear}
              h1Pct={h1Pct}
              h2Pct={h2Pct}
              onH1Change={setH1Pct}
              onH2Change={setH2Pct}
            />
          </div>

          {/* ── Methodology fields — visible only in Deep Analysis mode ── */}
          {mode === "deep_analysis" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 16 }}>
                Methodology fields <div style={{ flex: 1, height: 1, background: c.border }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={fl}>Unit of analysis</div>
                  <div style={fh}>The specific thing being examined.</div>
                  <input style={inp} type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. Global supply chains" />
                </div>
                <div>
                  <div style={fl}>Geographic scope</div>
                  <input style={inp} type="text" value={geo} onChange={(e) => setGeo(e.target.value)} placeholder="e.g. North America, Global" />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={fl}>Key assumptions</div>
                <textarea style={ta} rows={2} value={assumptions} onChange={(e) => setAssumptions(e.target.value)} placeholder="Conditions assumed true for this project." />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={fl}>Stakeholders & audience</div>
                <div style={fh}>Who this work aims to inform.</div>
                <input style={inp} type="text" value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} placeholder="e.g. Policy makers, researchers" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 28px 20px",
          borderTop: `1px solid ${c.border}`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          {/* Progress bar */}
          <div style={{ flex: 1, marginRight: 8 }}>
            <div style={{
              height: 3,
              borderRadius: 2,
              background: "rgba(0,0,0,0.07)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                borderRadius: 2,
                background: c.ink,
                width: `${pct}%`,
                transition: "width 0.35s ease",
              }} />
            </div>
            <div style={{ fontSize: 10, color: c.hint, marginTop: 4 }}>{pct}% complete</div>
          </div>
          <button onClick={handleClose} style={btnG}>Cancel</button>
          <button
            onClick={handleSave}
            style={{ ...btnP, opacity: name.trim() && domain ? 1 : 0.35 }}
          >
            Create project
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}

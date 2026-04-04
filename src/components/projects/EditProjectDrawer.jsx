/**
 * EditProjectDrawer — slide-over drawer for editing an existing project.
 * All fields are pre-populated from the current project object.
 * @param {{ project: object, onClose: () => void, onSave: (fields: object) => void, scrollTo?: string }} props
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { c, inp, ta, sel, btnP, btnSec, btnG, fl, fh } from "../../styles/tokens.js";
import { DOMAINS } from "../../data/seeds.js";
import { HorizonSlider, YearInput } from "./NewProjectModal.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

const CURRENT_YEAR = new Date().getFullYear();

/** Derive slider percentages from stored year strings. */
function parseHorizonState(project) {
  const startYear = parseInt(project.h1_start, 10) || CURRENT_YEAR;
  const endYear = parseInt(project.h3_end, 10) || CURRENT_YEAR + 15;
  const h1End = parseInt(project.h1_end, 10) || startYear + 3;
  const h2End = parseInt(project.h2_end, 10) || startYear + 8;
  const span = Math.max(endYear - startYear, 5);
  return {
    startYear,
    endYear,
    h1Pct: Math.max(0.05, Math.min(0.9, (h1End - startYear) / span)),
    h2Pct: Math.max(0.1, Math.min(0.95, (h2End - startYear) / span)),
  };
}

export function EditProjectDrawer({ project, onClose, onSave, onDelete, scrollTo }) {
  const initial = parseHorizonState(project);

  const [name, setName] = useState(project.name || "");
  const [domain, setDomain] = useState(project.domain || "");
  const [question, setQuestion] = useState(project.question || "");
  const [focus, setFocus] = useState(project.focus || "");
  const [geo, setGeo] = useState(project.geo || "");
  const [assumptions, setAssumptions] = useState(project.assumptions || "");
  const [stakeholders, setStakeholders] = useState(project.stakeholders || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [startYear, setStartYear] = useState(initial.startYear);
  const [endYear, setEndYear] = useState(initial.endYear);
  const [h1Pct, setH1Pct] = useState(initial.h1Pct);
  const [h2Pct, setH2Pct] = useState(initial.h2Pct);
  const [nameError, setNameError] = useState(false);

  const bodyRef = useRef(null);

  // Scroll to a specific field after the drawer has slid in
  useEffect(() => {
    if (!scrollTo || !bodyRef.current) return;
    const t = setTimeout(() => {
      const el = bodyRef.current.querySelector(`[data-field="${scrollTo}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 260);
    return () => clearTimeout(t);
  }, [scrollTo]);

  const handleStartYearChange = useCallback((v) => {
    setStartYear(Math.min(v, endYear - 5));
  }, [endYear]);

  const handleEndYearChange = useCallback((v) => {
    setEndYear(Math.max(v, startYear + 5));
  }, [startYear]);

  const handleSave = () => {
    if (!name.trim()) { setNameError(true); return; }
    const span = endYear - startYear;
    const h1End = String(Math.round(startYear + h1Pct * span));
    const h2End = String(Math.round(startYear + h2Pct * span));
    onSave({
      name: name.trim(),
      domain,
      question,
      focus: focus,  // was: unit
      geo,
      assumptions,
      stakeholders,
      h1_start: String(startYear),
      h1_end: h1End,
      h2_start: h1End,
      h2_end: h2End,
      h3_start: h2End,
      h3_end: String(endYear),
    });
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 300 }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: c.white, borderLeft: `1px solid ${c.border}`,
        zIndex: 301, display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
        animation: "drawerSlideIn 0.25s ease",
      }}>

        {/* Header */}
        <div style={{
          padding: "18px 24px 14px", borderBottom: `1px solid ${c.border}`, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 2 }}>
                Project
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, color: c.ink }}>Edit project</div>
            </div>
            <button onClick={onClose} style={{ ...btnG, fontSize: 16, padding: "2px 6px", color: c.muted }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Name */}
          <div style={{ marginBottom: 16 }} data-field="name">
            <div style={fl}>Project name <span style={{ color: c.red800, marginLeft: 2 }}>*</span></div>
            <input
              style={{ ...inp, borderColor: nameError ? c.redBorder : undefined }}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(false); }}
              placeholder="e.g. Future of Alternative Proteins"
            />
            {nameError && (
              <div style={{ fontSize: 11, color: c.red800, marginTop: 4 }}>Project name is required.</div>
            )}
          </div>

          {/* Domain */}
          <div style={{ marginBottom: 16 }} data-field="domain">
            <div style={fl}>Domain</div>
            <div style={{ position: "relative" }}>
              <select
                style={sel}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              >
                <option value="">Select a domain…</option>
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: c.hint, pointerEvents: "none" }}>▾</span>
            </div>
          </div>

          {/* Key question */}
          <div style={{ marginBottom: 18 }} data-field="question">
            <div style={fl}>Key question</div>
            <div style={fh}>The central question this project seeks to explore.</div>
            <textarea
              style={ta}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How might alternative proteins reshape global food supply chains by 2040?"
            />
          </div>

          {/* Time horizons */}
          <div
            data-field="horizons"
            style={{
              padding: "16px 18px",
              background: c.fieldBg,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              marginBottom: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, marginBottom: 2 }}>Time horizons</div>
                <div style={{ fontSize: 11, color: c.hint, fontStyle: "italic" }}>Drag the handles to set H1/H2 and H2/H3 boundaries.</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
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

          {/* Methodology divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 16 }}>
            Methodology <div style={{ flex: 1, height: 1, background: c.border }} />
          </div>

          {/* Unit + Geography */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div data-field="unit">
              <div style={fl}>Focus</div>
              <div style={fh}>The specific thing being examined.</div>
              <input style={inp} type="text" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Global supply chains" />
            </div>
            <div data-field="geo">
              <div style={fl}>Geographic scope</div>
              <div style={fh}>Where does this research focus?</div>
              <input style={inp} type="text" value={geo} onChange={(e) => setGeo(e.target.value)} placeholder="e.g. North America, Global" />
            </div>
          </div>

          {/* Assumptions */}
          <div style={{ marginBottom: 14 }} data-field="assumptions">
            <div style={fl}>Key assumptions</div>
            <div style={fh}>Foundational beliefs or conditions assumed to be true for the purposes of the project.</div>
            <textarea style={ta} rows={2} value={assumptions} onChange={(e) => setAssumptions(e.target.value)} placeholder="Conditions assumed true for this project." />
          </div>

          {/* Stakeholders */}
          <div style={{ marginBottom: 8 }} data-field="stakeholders">
            <div style={fl}>Stakeholders & audience</div>
            <div style={fh}>Who this work aims to inform.</div>
            <input style={inp} type="text" value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} placeholder="e.g. Policy makers, researchers" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ padding: "14px 24px 18px", borderTop: `1px solid ${c.border}`, display: "flex", gap: 8 }}>
            <button onClick={onClose} style={btnSec}>Cancel</button>
            <button
              onClick={handleSave}
              style={{ ...btnP, flex: 1, opacity: name.trim() ? 1 : 0.4 }}
            >
              Save
            </button>
          </div>
          {onDelete && (
            <div style={{ padding: "0 24px 20px", borderTop: `1px solid ${c.border}` }}>
              <div style={{ paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 11, color: c.hint }}>Danger zone</div>
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    fontSize: 11, padding: "4px 12px", borderRadius: 6,
                    border: `1px solid ${c.redBorder}`, background: "transparent",
                    color: c.red800, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Delete project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${project.name}"?`}
          message="This will permanently delete the project and all its inputs, clusters, and maps. This cannot be undone."
          onConfirm={onDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

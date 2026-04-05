/**
 * OnboardingFlow — 5-step new-user onboarding.
 * Step 1: Experience level
 * Step 2: Domain interests
 * Step 3: Purpose (skippable)
 * Step 4: Methodology education (wraps OnboardingEducation)
 * Step 5: Create first project
 *
 * @param {{ onComplete: (preferences: object, project: object) => void }} props
 */
import { useState, useEffect, useMemo } from "react";
import { c, btnP, btnSec, inp } from "../../styles/tokens.js";
import { OnboardingEducation } from "./OnboardingEducation.jsx";

const TOTAL_STEPS = 5;

const DOMAINS = [
  "Technology & AI",
  "Climate & Energy",
  "Health & Life Sciences",
  "Government & Policy",
  "Economy & Finance",
  "Education & Learning",
  "Media & Culture",
  "Defence & Security",
  "Custom / Other",
];

const LEVELS = [
  {
    id: "beginner",
    label: "New to foresight",
    desc: "I'm learning how to work with signals and futures thinking.",
  },
  {
    id: "intermediate",
    label: "Some experience",
    desc: "I've done horizon scanning or scenario work before.",
  },
  {
    id: "advanced",
    label: "Experienced practitioner",
    desc: "Foresight is a core part of my professional practice.",
  },
];

// ─── Progress dots ──────────────────────────────────────────────────────────

function ProgressDots({ step }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 28 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const done    = i < step - 1;
        const current = i === step - 1;
        return (
          <div key={i} style={{
            width: current ? 20 : 6,
            height: 6,
            borderRadius: 3,
            background: current ? c.ink : done ? c.muted : c.hint,
            transition: "all 0.2s",
          }} />
        );
      })}
    </div>
  );
}

// ─── Step 1 — Experience level ───────────────────────────────────────────────

function StepLevel({ value, onChange, onNext }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          What's your foresight experience?
        </div>
        <div style={{ fontSize: 12, color: c.muted }}>
          This helps us tailor the experience for you.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {LEVELS.map((lv) => {
          const active = value === lv.id;
          return (
            <button
              key={lv.id}
              onClick={() => onChange(lv.id)}
              style={{
                textAlign: "left",
                padding: "13px 16px",
                borderRadius: 8,
                border: `1px solid ${active ? c.ink : c.borderMid}`,
                background: active ? "rgba(0,0,0,0.03)" : c.white,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
                outline: active ? `2px solid ${c.ink}` : "none",
                outlineOffset: 2,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 3 }}>
                {lv.label}
              </div>
              <div style={{ fontSize: 11, color: c.muted }}>{lv.desc}</div>
            </button>
          );
        })}
      </div>

      <button onClick={onNext} disabled={!value} style={{
        ...btnP, width: "100%", justifyContent: "center",
        opacity: value ? 1 : 0.4, cursor: value ? "pointer" : "default",
      }}>
        Continue →
      </button>
    </div>
  );
}

// ─── Step 2 — Domains ────────────────────────────────────────────────────────

function StepDomains({ value, onChange, onNext, onBack }) {
  const toggle = (d) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          Which domains do you work in?
        </div>
        <div style={{ fontSize: 12, color: c.muted }}>
          Select all that apply. You can change this later.
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {DOMAINS.map((d) => {
          const active = value.includes(d);
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              style={{
                padding: "7px 13px",
                borderRadius: 20,
                border: `1px solid ${active ? c.ink : c.borderMid}`,
                background: active ? c.ink : c.white,
                color: active ? c.white : c.muted,
                fontSize: 12, fontWeight: active ? 500 : 400,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ ...btnSec, fontSize: 13, padding: "10px 18px" }}>
          ← Back
        </button>
        <button onClick={onNext} disabled={value.length === 0} style={{
          ...btnP, flex: 1, justifyContent: "center",
          opacity: value.length > 0 ? 1 : 0.4,
          cursor: value.length > 0 ? "pointer" : "default",
        }}>
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — Purpose ────────────────────────────────────────────────────────

const PURPOSES = [
  { id: "strategy",   label: "Strategy",   desc: "Organisational or business strategy" },
  { id: "research",   label: "Research",   desc: "Academic or policy research" },
  { id: "consulting", label: "Consulting", desc: "Client-facing foresight work" },
  { id: "teaching",   label: "Teaching",   desc: "Foresight education and facilitation" },
];

function StepPurpose({ value, onChange, onNext, onBack, onSkip }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          What's your primary use?
        </div>
        <div style={{ fontSize: 12, color: c.muted }}>
          This helps us tailor the experience.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PURPOSES.map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onChange(active ? "" : p.id)}
              style={{
                textAlign: "left",
                padding: "13px 16px",
                borderRadius: 8,
                border: `1px solid ${active ? c.ink : c.borderMid}`,
                background: active ? "rgba(0,0,0,0.03)" : c.white,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
                outline: active ? `2px solid ${c.ink}` : "none",
                outlineOffset: 2,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 3 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 11, color: c.muted }}>{p.desc}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ ...btnSec, fontSize: 13, padding: "10px 18px" }}>
          ← Back
        </button>
        <button onClick={onNext} style={{ ...btnP, flex: 1, justifyContent: "center" }}>
          Continue →
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        <button onClick={onSkip} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11, color: c.hint, fontFamily: "inherit",
          textDecoration: "underline", padding: 0,
        }}>
          Skip this step
        </button>
      </div>
    </div>
  );
}

// ─── Step 4 — Education ──────────────────────────────────────────────────────

function StepEducation({ onNext, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          How Future Signals works
        </div>
        <div style={{ fontSize: 12, color: c.muted }}>
          A quick look at the core methodology before you begin.
        </div>
      </div>

      <OnboardingEducation onContinue={onNext} />

      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: 11, color: c.hint, fontFamily: "inherit",
        textDecoration: "underline", padding: 0, textAlign: "center",
      }}>
        ← Back
      </button>
    </div>
  );
}

// ─── Step 5 — Create first project ───────────────────────────────────────────

function StepProject({ onSubmit, onBack, onSkip }) {
  const [name,     setName]     = useState("");
  const [domain,   setDomain]   = useState("");
  const [question, setQuestion] = useState("");

  const canSave = name.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          Create your first project
        </div>
        <div style={{ fontSize: 12, color: c.muted }}>
          A project is a focused inquiry. You can add more later.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Name */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>
            Project name <span style={{ color: c.red800 }}>*</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Future of Work 2030"
            style={{ ...inp }}
            autoFocus
          />
        </div>

        {/* Domain */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>Domain</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {DOMAINS.map((d) => {
              const active = domain === d;
              return (
                <button
                  key={d}
                  onClick={() => setDomain(active ? "" : d)}
                  style={{
                    padding: "4px 10px", borderRadius: 14,
                    border: `1px solid ${active ? c.ink : c.borderMid}`,
                    background: active ? c.ink : "transparent",
                    color: active ? c.white : c.muted,
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Key question */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>
            Key inquiry question
          </div>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How might AI reshape knowledge work by 2030?"
            style={{ ...inp }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ ...btnSec, fontSize: 13, padding: "10px 18px" }}>
          ← Back
        </button>
        <button
          onClick={() => onSubmit({ name: name.trim(), domain, question })}
          disabled={!canSave}
          style={{
            ...btnP, flex: 1, justifyContent: "center",
            opacity: canSave ? 1 : 0.4,
            cursor: canSave ? "pointer" : "default",
          }}
        >
          Create project →
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        <button onClick={onSkip} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11, color: c.hint, fontFamily: "inherit",
          textDecoration: "underline", padding: 0,
        }}>
          I'll do this later
        </button>
      </div>
    </div>
  );
}

const STEEPLED_ABB = {
  Social: "Soc", Technological: "Tech", Economic: "Eco", Environmental: "Env",
  Political: "Pol", Legal: "Leg", Ethical: "Eth", Demographic: "Dem",
};

// ─── Step 6 — Loading / signal seeding ───────────────────────────────────────

function StepLoading({ newProjectId, inputs, refreshInputs, onEnter }) {
  const [phase, setPhase] = useState("loading"); // 'loading' | 'signals' | 'done'
  const [visibleCount, setVisibleCount] = useState(0);
  const [liveInputs, setLiveInputs] = useState(inputs);

  const seedSignals = useMemo(() =>
    liveInputs.filter((i) =>
      i.is_seeded &&
      i.metadata?.source === "scanner" &&
      i.metadata?.suggested_projects?.some((p) => p.id === newProjectId)
    ).slice(0, 5),
    [liveInputs, newProjectId]
  );

  // Await scorer, then refresh inputs, then transition
  useEffect(() => {
    const runScorer = async () => {
      try {
        await fetch('/api/trigger-score', { method: 'POST' });
        // Refresh inputs so newly promoted signals appear in state
        if (refreshInputs) await refreshInputs();
      } catch {
        // Silent fail
      }
      setPhase('signals_check');
    };
    runScorer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After refresh, read updated inputs from appState prop
  useEffect(() => {
    setLiveInputs(inputs);
  }, [inputs]);

  // Transition from signals_check → signals or done
  useEffect(() => {
    if (phase !== 'signals_check') return;
    setPhase(seedSignals.length > 0 ? 'signals' : 'done');
  }, [phase, seedSignals.length]);

  // Phase 2: reveal signals one by one, then → done
  useEffect(() => {
    if (phase !== "signals") return;
    if (visibleCount < seedSignals.length) {
      const t = setTimeout(() => setVisibleCount((v) => v + 1), 500);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase("done"), 800);
      return () => clearTimeout(t);
    }
  }, [phase, visibleCount, seedSignals.length]);

  const hasFallback = seedSignals.length === 0;

  return (
    <>
      <style>{`
        @keyframes fs-spin { to { transform: rotate(360deg); } }
        @keyframes fs-fade  { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "8px 0" }}>

        {/* Phase 1 — Loading */}
        {phase === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 0" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: `3px solid rgba(0,0,0,0.1)`,
              borderTopColor: c.ink,
              animation: "fs-spin 0.8s linear infinite",
            }} />
            <div style={{ fontSize: 16, fontWeight: 500, color: c.ink }}>Scanning for signals</div>
            <div style={{ fontSize: 12, color: c.muted, textAlign: "center" }}>
              Finding recent developments relevant to your project…
            </div>
          </div>
        )}

        {/* Phase 2 — Signals appearing */}
        {phase === "signals" && (
          <div style={{ width: "100%" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 12, textAlign: "center" }}>
              Signals found
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {seedSignals.slice(0, visibleCount).map((sig, i) => {
                const firstCat = (sig.steepled || [])[0];
                return (
                  <div key={sig.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 8,
                    border: `1px solid ${c.border}`, background: c.surfaceAlt,
                    animation: "fs-fade 0.3s ease both",
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.ink, flexShrink: 0 }} />
                    <div style={{
                      flex: 1, fontSize: 12, fontWeight: 500, color: c.ink,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {sig.name}
                    </div>
                    {firstCat && (
                      <span style={{
                        fontSize: 10, padding: "1px 6px", borderRadius: 4,
                        background: "#f0f0ee", color: c.muted, flexShrink: 0,
                      }}>
                        {STEEPLED_ABB[firstCat] || firstCat}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 3 — Done */}
        {phase === "done" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0", width: "100%", animation: "fs-fade 0.4s ease both" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: c.ink,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: c.white, fontSize: 22, lineHeight: 1 }}>✓</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: c.ink }}>Your workspace is ready</div>
            <div style={{ fontSize: 12, color: c.muted, textAlign: "center", maxWidth: 340 }}>
              {hasFallback
                ? "Your Inbox is ready — signals will arrive overnight as the scanner runs."
                : `We've found ${seedSignals.length} signal${seedSignals.length !== 1 ? "s" : ""} to review — keep what's useful, dismiss the rest.`
              }
            </div>
            <button onClick={onEnter} style={{ ...btnP, marginTop: 4 }}>
              Go to my workspace →
            </button>
          </div>
        )}

      </div>
    </>
  );
}

// ─── Main flow ───────────────────────────────────────────────────────────────

export function OnboardingFlow({ inputs, refreshInputs, onProjectCreate, onComplete }) {
  const [step,         setStep]         = useState(1);
  const [level,        setLevel]        = useState("");
  const [domains,      setDomains]      = useState([]);
  const [purpose,      setPurpose]      = useState("");
  const [newProjectId, setNewProjectId] = useState(null);

  const prefs = { level, domains, purpose };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const handleProjectSubmit = (projectFields) => {
    const newProject = onProjectCreate(projectFields);
    setNewProjectId(newProject.id);
    setStep(6);
  };

  const handleEnterWorkspace = () => {
    onComplete(prefs, newProjectId);
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: c.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
      fontSize: 14,
      WebkitFontSmoothing: "antialiased",
      padding: "24px 16px",
      boxSizing: "border-box",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 560,
        background: c.white,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: "32px 32px 28px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 28 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.ink }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: c.ink }}>Future Signals</span>
        </div>

        {step < 6 && <ProgressDots step={step} />}

        {step === 1 && (
          <StepLevel value={level} onChange={setLevel} onNext={next} />
        )}
        {step === 2 && (
          <StepDomains value={domains} onChange={setDomains} onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <StepPurpose
            value={purpose}
            onChange={setPurpose}
            onNext={next}
            onBack={back}
            onSkip={() => { setPurpose(""); next(); }}
          />
        )}
        {step === 4 && (
          <StepEducation onNext={next} onBack={back} />
        )}
        {step === 5 && (
          <StepProject
            onSubmit={handleProjectSubmit}
            onBack={back}
            onSkip={() => onComplete(prefs, null)}
          />
        )}
        {step === 6 && (
          <StepLoading
            newProjectId={newProjectId}
            inputs={inputs}
            refreshInputs={refreshInputs}
            onEnter={handleEnterWorkspace}
          />
        )}
      </div>
    </div>
  );
}

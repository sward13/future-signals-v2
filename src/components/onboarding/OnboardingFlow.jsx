/**
 * OnboardingFlow — 7-step new-user onboarding.
 * Step 1: Experience level      → ExperienceLevelStep (full-screen)
 * Step 2: Domain interests
 * Step 3: Purpose (skippable)
 * Step 4: Methodology education
 * Step 5: Create first project  → ProjectCreateStep (full-screen)
 * Step 6: Creating transition   → CreatingTransition (full-screen, ~2.5s)
 * Step 7: Scanner inbox         → ScannerInboxStep (full-screen)
 *
 * @param {{ workspaceId: string, onProjectCreate: (fields) => Promise, onComplete: (prefs, projectId) => void }} props
 */
import { useState, useEffect } from "react";
import { c, btnP, btnSec, inp } from "../../styles/tokens.js";
import { supabase } from "../../lib/supabase.js";
import { OnboardingEducation } from "./OnboardingEducation.jsx";
import { ExperienceLevelStep } from "./ExperienceLevelStep.tsx";
import { ProjectCreateStep } from "./ProjectCreateStep.jsx";
import { CreatingTransition } from "./CreatingTransition.tsx";
import { ScannerInboxStep } from "./ScannerInboxStep.jsx";

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

// ─── Main flow ───────────────────────────────────────────────────────────────

export function OnboardingFlow({ workspaceId, onProjectCreate, onComplete }) {
  const [step,    setStep]    = useState(1);
  const [level,   setLevel]   = useState("");
  const [domains, setDomains] = useState([]);
  const [purpose, setPurpose] = useState("");

  // Post-project state
  const [pendingProject,  setPendingProject]  = useState(null);  // confirmed project object
  const [seedCandidates,  setSeedCandidates]  = useState(null);  // null = loading, [] or [...] = resolved
  const [waitingForSeed,  setWaitingForSeed]  = useState(false); // CreatingTransition finished before seed resolved

  const prefs = { level, domains, purpose };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  // Advance to scanner inbox once seed resolves while we were waiting
  useEffect(() => {
    if (waitingForSeed && seedCandidates !== null) {
      setWaitingForSeed(false);
      setStep(7);
    }
  }, [waitingForSeed, seedCandidates]);

  // Write experience_level to workspaces on Continue — fire-and-forget.
  // Null experience_level is treated as 'regular' throughout the product.
  const handleLevelSelect = (selectedLevel) => {
    setLevel(selectedLevel);
    if (!workspaceId) return;
    supabase
      .from("workspaces")
      .update({ experience_level: selectedLevel })
      .eq("id", workspaceId)
      .then(({ error }) => {
        if (error) console.error("[onboarding] experience_level write failed:", error);
      });
  };

  // Awaits confirmed DB insert, fires seed-onboarding in background, advances
  // to CreatingTransition. Does NOT call onComplete — that happens after the
  // scanner inbox step.
  const handleProjectSubmit = async (projectFields) => {
    const newProject = await onProjectCreate(projectFields);
    setPendingProject(newProject);
    setSeedCandidates(null); // mark as loading

    // Fire seed-onboarding — store result in state when it arrives
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !newProject?.id) {
        setSeedCandidates([]);
        return;
      }
      fetch(`/api/projects/${newProject.id}/seed-onboarding`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((data) => setSeedCandidates(data.candidates ?? []))
        .catch((err) => {
          console.error("[onboarding] seed-onboarding failed:", err);
          setSeedCandidates([]);
        });
    });

    setStep(6); // advance to CreatingTransition immediately
  };

  // Called when CreatingTransition's 2.5s animation completes
  const handleCreatingDone = () => {
    if (seedCandidates !== null) {
      setStep(7);
    } else {
      // Seed hasn't resolved yet — wait (useEffect above will advance when it does)
      setWaitingForSeed(true);
    }
  };

  // Called when the scanner inbox completes (user adds or skips)
  const handleScannerComplete = (promotedInputIds) => {
    // promotedInputIds unused in current routing — Stage 4/5 will sync local state
    onComplete(prefs, pendingProject?.id ?? null);
  };

  // ── Full-screen steps (bypass legacy card shell) ─────────────────────────

  if (step === 1) {
    return (
      <ExperienceLevelStep
        onSelect={handleLevelSelect}
        onNext={next}
      />
    );
  }

  if (step === 5) {
    return (
      <ProjectCreateStep
        experienceLevel={level || "regular"}
        onSubmit={handleProjectSubmit}
        onBack={back}
      />
    );
  }

  if (step === 6) {
    return (
      <CreatingTransition
        projectDomain={pendingProject?.domain || "your"}
        onNext={handleCreatingDone}
      />
    );
  }

  // "Almost ready…" — seed resolved after CreatingTransition finished, useEffect
  // will flip to step 7 on the next render cycle
  if (waitingForSeed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: c.bg,
          fontFamily: "'Open Sans', -apple-system, sans-serif",
          fontSize: 13,
          color: "#6B7280",
        }}
      >
        Almost ready…
      </div>
    );
  }

  if (step === 7) {
    return (
      <ScannerInboxStep
        candidates={seedCandidates ?? []}
        projectId={pendingProject?.id}
        workspaceId={workspaceId}
        projectName={pendingProject?.name ?? ""}
        domain={pendingProject?.domain ?? ""}
        keyQuestion={pendingProject?.question ?? ""}
        onComplete={handleScannerComplete}
      />
    );
  }

  // ── Steps 2–4: legacy card shell ─────────────────────────────────────────
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

        <ProgressDots step={step} />

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
      </div>
    </div>
  );
}

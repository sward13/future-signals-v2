/**
 * OnboardingShell — state machine for the complete new-user onboarding flow.
 *
 * Steps (App.jsx handles step 0 = sign-up before this component mounts):
 *   1  ExperienceLevelStep      dot 1
 *   2  ProjectCreateStep        dot 2
 *   3  CreatingTransition       dot 2 (shared with step 2)
 *   4  ScannerInboxStep         dot 3
 *   5  ClusteringResultsStep    dot 4
 *
 * Sign-up (step 0) is rendered by App.jsx via AuthScreen before this
 * component is shown.
 */

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

// ── QA step-jump ──────────────────────────────────────────────────────────────
// Only active when VITE_ENABLE_QA_TOOLS=true. Completely inert in production.

const QA_ENABLED = import.meta.env.VITE_ENABLE_QA_TOOLS === "true";

const QA_STEP_MAP: Record<string, number> = {
  experience: 1,
  domain:     2,
  horizon:    2,
  focus:      2,
  signals:    4,
  clusters:   5,
  complete:   5,
};
import { ExperienceLevelStep } from "./ExperienceLevelStep.tsx";
import { ProjectCreateStep } from "./ProjectCreateStep.jsx";
import { CreatingTransition } from "./CreatingTransition.tsx";
import { ScannerInboxStep } from "./ScannerInboxStep.jsx";
import { ClusteringResultsStep } from "./ClusteringResultsStep.tsx";

interface Project {
  id: string;
  name: string;
  domain: string;
  question: string;
}

interface Props {
  workspaceId: string;
  onProjectCreate: (fields: Record<string, unknown>) => Promise<Project>;
  onComplete: (projectId: string | null) => void;
}

export function OnboardingShell({ workspaceId, onProjectCreate, onComplete }: Props) {
  const [step,             setStep]            = useState(1);
  const [experienceLevel,  setExperienceLevel]  = useState<string | null>(null);
  const [pendingProject,   setPendingProject]   = useState<Project | null>(null);
  const [seedCandidates,   setSeedCandidates]   = useState<object[] | null>(null); // null = loading
  const [waitingForSeed,   setWaitingForSeed]   = useState(false);
  const [promotedInputIds, setPromotedInputIds] = useState<string[]>([]);

  // Advance to scanner inbox when the seed resolves while we were waiting
  useEffect(() => {
    if (waitingForSeed && seedCandidates !== null) {
      setWaitingForSeed(false);
      setStep(4);
    }
  }, [waitingForSeed, seedCandidates]);

  // ── QA step-jump — initialise at a specific step via ?step= param ─────────
  useEffect(() => {
    if (!QA_ENABLED || !workspaceId) return;

    const params    = new URLSearchParams(window.location.search);
    const stepParam = params.get("step");
    if (!stepParam || !(stepParam in QA_STEP_MAP)) return;

    const targetStep = QA_STEP_MAP[stepParam];

    // Steps 1–3 need no async context — jump immediately
    if (targetStep <= 3) {
      setStep(targetStep);
      return;
    }

    // Steps 4–5 need the most recent project and, for signals, seed candidates
    const init = async () => {
      const { data: rows } = await supabase
        .from("projects")
        .select("id, name, domain, question")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1);

      const project = (rows?.[0] ?? null) as Project | null;
      if (project) setPendingProject(project);

      if (targetStep === 4) {
        // Fetch seed candidates via the existing endpoint
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (project && token) {
            const res  = await fetch(`/api/seed-onboarding?id=${project.id}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json().catch(() => ({}));
            setSeedCandidates((json as { candidates?: object[] }).candidates ?? []);
          } else {
            setSeedCandidates([]);
          }
        } catch {
          setSeedCandidates([]);
        }
      }

      if (targetStep === 5) {
        if (stepParam === "complete") {
          // complete → ZeroInputsState (promotedInputIds stays empty)
          setPromotedInputIds([]);
        } else if (project) {
          // clusters → pass existing input IDs so ClusteringResultsStep can
          // run its normal embedding-wait + clustering flow against real data
          const { data: inputs } = await supabase
            .from("inputs")
            .select("id")
            .eq("project_id", project.id)
            .limit(20);
          setPromotedInputIds(
            (inputs ?? []).map((i: { id: string }) => i.id)
          );
        }
      }

      setStep(targetStep);
    };

    init();
  }, [workspaceId]); // Runs once workspaceId is available

  // ── Step handlers ─────────────────────────────────────────────────────────

  const handleLevelSelect = (level: string) => {
    setExperienceLevel(level);
    if (!workspaceId) return;
    // Fire-and-forget — null is treated as 'regular' throughout the product
    supabase
      .from("workspaces")
      .update({ experience_level: level })
      .eq("id", workspaceId)
      .then(({ error }) => {
        if (error) console.error("[onboarding] experience_level write failed:", error);
      });
  };

  const handleProjectSubmit = async (fields: Record<string, unknown>) => {
    const project = await onProjectCreate(fields);
    setPendingProject(project);
    setSeedCandidates(null);

    // Fire seed-onboarding in background — do not block the creating transition
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !project?.id) {
        setSeedCandidates([]);
        return;
      }
      fetch(`/api/seed-onboarding?id=${project.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((data) => setSeedCandidates((data as { candidates?: object[] }).candidates ?? []))
        .catch((err) => {
          console.error("[onboarding] seed-onboarding failed:", err);
          setSeedCandidates([]);
        });
    });

    setStep(3);
  };

  const handleCreatingDone = () => {
    if (seedCandidates !== null) {
      setStep(4);
    } else {
      // Seed call hasn't resolved yet — the useEffect above will advance us
      setWaitingForSeed(true);
    }
  };

  const handleScannerComplete = (ids: string[]) => {
    setPromotedInputIds(ids);
    setStep(5);
  };

  const handleClusteringComplete = () => {
    onComplete(pendingProject?.id ?? null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <ExperienceLevelStep
        onSelect={handleLevelSelect}
        onNext={() => setStep(2)}
      />
    );
  }

  if (step === 2) {
    return (
      <ProjectCreateStep
        experienceLevel={experienceLevel ?? "regular"}
        onSubmit={handleProjectSubmit}
        onBack={() => setStep(1)}
      />
    );
  }

  if (step === 3) {
    return (
      <CreatingTransition
        projectDomain={pendingProject?.domain ?? "your"}
        onNext={handleCreatingDone}
      />
    );
  }

  // Brief interstitial — seed resolved after the transition completed.
  // The useEffect above will flip to step 4 on the next render cycle.
  if (waitingForSeed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f4f0",
          fontFamily: "'Open Sans', -apple-system, sans-serif",
          fontSize: 13,
          color: "#6B7280",
        }}
      >
        Almost ready…
      </div>
    );
  }

  if (step === 4) {
    return (
      <ScannerInboxStep
        candidates={seedCandidates ?? []}
        projectId={pendingProject?.id ?? ""}
        workspaceId={workspaceId}
        projectName={pendingProject?.name ?? ""}
        domain={pendingProject?.domain ?? ""}
        keyQuestion={pendingProject?.question ?? ""}
        onComplete={handleScannerComplete}
      />
    );
  }

  // step === 5
  return (
    <ClusteringResultsStep
      projectId={pendingProject?.id ?? ""}
      projectName={pendingProject?.name ?? ""}
      workspaceId={workspaceId}
      promotedInputIds={promotedInputIds}
      onComplete={handleClusteringComplete}
    />
  );
}

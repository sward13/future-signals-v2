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
      fetch(`/api/projects/${project.id}/seed-onboarding`, {
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
      promotedInputIds={promotedInputIds}
      onComplete={handleClusteringComplete}
    />
  );
}

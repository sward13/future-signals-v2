/**
 * App — root component. Manages Supabase auth session, then holds all app state
 * via useAppState, renders the AppShell, active screen, modals, and toast.
 * New users are gated behind OnboardingFlow until workspace_settings.onboarding_complete.
 */
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import { useAppState } from "./hooks/useAppState.js";
import { AuthScreen } from "./components/auth/AuthScreen.jsx";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { Toast } from "./components/layout/Toast.jsx";
import { NewProjectModal } from "./components/projects/NewProjectModal.jsx";
import { InputDetailDrawer } from "./components/inputs/InputDetailDrawer.jsx";
import { ClusterDetailDrawer } from "./components/clusters/ClusterDetailDrawer.jsx";
import Dashboard from "./components/screens/Dashboard.jsx";
import Inbox from "./components/screens/Inbox.jsx";
import ProjectDetail from "./components/screens/ProjectDetail.jsx";
import Clustering from "./components/screens/Clustering.jsx";
import ScenarioCanvas from "./components/screens/ScenarioCanvas.jsx";
import NarrativeCanvas from "./components/screens/NarrativeCanvas.jsx";
import ScenarioNarrativeCanvas from "./components/screens/ScenarioNarrativeCanvas.jsx";
import SystemAnalysisCanvas from "./components/screens/SystemAnalysisCanvas.jsx";

function ActiveScreen({ appState }) {
  switch (appState.activeScreen) {
    case "dashboard": return <Dashboard appState={appState} />;
    case "inbox": return <Inbox appState={appState} />;
    case "projects": return <Dashboard appState={appState} />;  // projects list = dashboard
    case "project": return <ProjectDetail appState={appState} />;
    case "clustering": return <Clustering appState={appState} />;
    case "scenarios": return <ScenarioCanvas appState={appState} />;
    case "narrative": return <NarrativeCanvas appState={appState} />;
    case "scenario_canvas": return <ScenarioNarrativeCanvas appState={appState} />;
    case "analysis": return <SystemAnalysisCanvas appState={appState} />;
    default: return <Inbox appState={appState} />;
  }
}

export default function App() {
  // ── Auth layer ─────────────────────────────────────────────────────────────
  // session === undefined: still resolving initial state (show nothing)
  // session === null:      resolved, not signed in (show AuthScreen)
  // session === object:    signed in
  const [session,          setSession]          = useState(undefined);
  const [workspaceId,      setWorkspaceId]      = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // ── Onboarding gate ────────────────────────────────────────────────────────
  // undefined = still loading, true/false = resolved
  const [onboardingComplete, setOnboardingComplete] = useState(undefined);
  const [preferences,        setPreferences]        = useState({});

  useEffect(() => {
    // Resolve the initial session synchronously (from local storage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) fetchWorkspaceId(session.user.id);
    });

    // Subscribe to future auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        setSession(session ?? null);
        return;
      }
      if (event === "USER_UPDATED") {
        setPasswordRecovery(false);
      }
      setSession(session ?? null);
      if (session) fetchWorkspaceId(session.user.id);
      else {
        setWorkspaceId(null);
        setOnboardingComplete(undefined);
        setPreferences({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchWorkspaceId = async (userId) => {
    const { data } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (data) {
      setWorkspaceId(data.id);
      fetchWorkspaceSettings(data.id);
    }
  };

  const fetchWorkspaceSettings = async (wsId) => {
    const { data } = await supabase
      .from("workspace_settings")
      .select("onboarding_complete, preferences")
      .eq("workspace_id", wsId)
      .single();
    if (data) {
      setOnboardingComplete(data.onboarding_complete ?? false);
      setPreferences(data.preferences ?? {});
    } else {
      // Row doesn't exist yet — treat as not complete
      setOnboardingComplete(false);
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem("fs_active_screen");
    localStorage.removeItem("fs_active_project");
    await supabase.auth.signOut();
  };

  // ── App state ──────────────────────────────────────────────────────────────
  const appState = useAppState(workspaceId, session ?? null, preferences);
  const { inputDetailId, clusterDetailId, closeInputDetail, closeClusterDetail, updateInput, updateCluster, assignInputToCluster, removeInputFromCluster, deleteInput, deleteCluster, inputs, clusters, projects } = appState;

  // ── Onboarding handlers ────────────────────────────────────────────────────
  const handleOnboardingProjectCreate = (fields) => {
    return appState.addProject(fields);
  };

  const handleOnboardingComplete = async (prefs, projectId) => {
    // Persist preferences and mark complete
    await supabase.from("workspace_settings").upsert({
      workspace_id: workspaceId,
      onboarding_complete: true,
      preferences: prefs,
    }, { onConflict: "workspace_id" });

    setPreferences(prefs);
    setOnboardingComplete(true);

    if (projectId) {
      appState.openProject(projectId);
    }
    // If skipped (projectId === null), lands on Dashboard (default screen)
  };

  // ── Auth gates ─────────────────────────────────────────────────────────────
  if (session === undefined) return null;   // resolving — render nothing briefly
  if (passwordRecovery)     return <AuthScreen initialMode="reset" />;  // password reset flow
  if (!session)             return <AuthScreen />;  // not signed in

  // ── Onboarding gate ────────────────────────────────────────────────────────
  // Wait until workspace settings are loaded before deciding
  if (onboardingComplete === undefined) return null;
  if (!onboardingComplete) {
    return (
      <OnboardingFlow
        inputs={appState.inputs}
        onProjectCreate={handleOnboardingProjectCreate}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  const handleCreateProject = (fields) => {
    const newProject = appState.addProject(fields);
    appState.closeProjectModal();
    appState.openProject(newProject.id);
    appState.showToast(`"${newProject.name}" created`);
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
      fontSize: 14,
      color: "#111111",
      WebkitFontSmoothing: "antialiased",
    }}>
      <AppShell appState={appState} onSignOut={handleSignOut} scroll={!["scenarios", "scenario_canvas", "analysis"].includes(appState.activeScreen)}>
        <ActiveScreen appState={appState} />
      </AppShell>

      <NewProjectModal
        open={appState.projectModalOpen}
        onClose={appState.closeProjectModal}
        onSave={handleCreateProject}
      />

      <Toast toast={appState.toast} />

      <InputDetailDrawer
        inputId={inputDetailId}
        inputs={inputs}
        projects={projects}
        clusters={clusters}
        onClose={closeInputDetail}
        onSave={(id, fields) => { updateInput(id, fields); appState.showToast("Input updated"); closeInputDetail(); }}
        onDelete={() => { deleteInput(inputDetailId); appState.showToast("Input deleted"); closeInputDetail(); }}
      />

      <ClusterDetailDrawer
        clusterId={clusterDetailId}
        clusters={clusters}
        inputs={inputs}
        onClose={closeClusterDetail}
        onSave={(id, fields) => { updateCluster(id, fields); appState.showToast("Cluster updated"); closeClusterDetail(); }}
        onRemoveInput={(inputId, clusterId) => { removeInputFromCluster(inputId, clusterId); appState.showToast("Input removed from cluster"); }}
        onAssignInput={(inputId, clusterId) => { assignInputToCluster(inputId, clusterId); appState.showToast("Input added to cluster"); }}
        onDelete={() => { deleteCluster(clusterDetailId); appState.showToast("Cluster deleted"); closeClusterDetail(); }}
      />
    </div>
  );
}

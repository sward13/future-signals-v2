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
import { ExportModal } from "./components/projects/ExportModal.jsx";
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
import AccountSettings from "./components/screens/AccountSettings.jsx";
import FutureModels from "./components/screens/FutureModels.jsx";
import ScenarioForm from "./components/scenarios/ScenarioForm.jsx";
import ScenarioRead from "./components/scenarios/ScenarioRead.jsx";
import PreferredFutureForm from "./components/preferred-futures/PreferredFutureForm.jsx";
import PreferredFutureRead from "./components/preferred-futures/PreferredFutureRead.jsx";
import StrategicOptionForm from "./components/strategic-options/StrategicOptionForm.jsx";
import StrategicOptionRead from "./components/strategic-options/StrategicOptionRead.jsx";

function ActiveScreen({ appState, onSignOut }) {
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
    case "future-models": return <FutureModels appState={appState} />;
    case "scenario-new":  return <ScenarioForm appState={appState} mode="new" />;
    case "scenario-read": return <ScenarioRead appState={appState} />;
    case "scenario-edit": return <ScenarioForm appState={appState} mode="edit" />;
    case "pf-new":        return <PreferredFutureForm appState={appState} mode="new" />;
    case "pf-read":       return <PreferredFutureRead appState={appState} />;
    case "pf-edit":       return <PreferredFutureForm appState={appState} mode="edit" />;
    case "so-new":        return <StrategicOptionForm appState={appState} mode="new" />;
    case "so-read":       return <StrategicOptionRead appState={appState} />;
    case "so-edit":       return <StrategicOptionForm appState={appState} mode="edit" />;
    case "settings": return <AccountSettings appState={appState} onSignOut={onSignOut} />;
    default: return <Inbox appState={appState} />;
  }
}

export default function App() {
  // ── Auth layer ─────────────────────────────────────────────────────────────
  // session === undefined: still resolving initial state (show nothing)
  // session === null:      resolved, not signed in (show AuthScreen)
  // session === object:    signed in
  const [session, setSession] = useState(undefined);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // ── Onboarding gate ────────────────────────────────────────────────────────
  // undefined = still loading, true/false = resolved
  const [onboardingComplete, setOnboardingComplete] = useState(undefined);
  const [preferences, setPreferences] = useState({});

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
    const { data, error } = await supabase
      .from("workspace_settings")
      .select("onboarding_complete, preferences")
      .eq("workspace_id", wsId)
      .single();
    if (data) {
      setOnboardingComplete(data.onboarding_complete ?? false);
      setPreferences(data.preferences ?? {});
    } else {
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


    const { data, error } = await supabase
      .from("workspace_settings")
      .update({
        onboarding_complete: true,
        preferences: prefs,
      })
      .eq("workspace_id", workspaceId);


    setPreferences(prefs);
    setOnboardingComplete(true);
    if (projectId) appState.openProject(projectId);
  };

  // ── Auth gates ─────────────────────────────────────────────────────────────
  if (session === undefined) return null;   // resolving — render nothing briefly
  if (passwordRecovery) return <AuthScreen initialMode="reset" />;  // password reset flow
  if (!session) return <AuthScreen />;  // not signed in

  // ── Onboarding gate ────────────────────────────────────────────────────────
  // Wait until workspace settings are loaded before deciding
  if (onboardingComplete === undefined) return null;
  if (!onboardingComplete) {
    return (
      <OnboardingFlow
        onProjectCreate={handleOnboardingProjectCreate}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  const [exportModalOpen, setExportModalOpen] = useState(false);

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
      <AppShell appState={appState} onSignOut={handleSignOut} onExport={() => setExportModalOpen(true)} scroll={!["scenarios", "scenario_canvas", "analysis"].includes(appState.activeScreen)}>
        <ActiveScreen appState={appState} onSignOut={handleSignOut} />
      </AppShell>

      <NewProjectModal
        open={appState.projectModalOpen}
        onClose={appState.closeProjectModal}
        onSave={handleCreateProject}
        workspaceScanningEnabled={appState.workspaceScanningEnabled}
      />

      <Toast toast={appState.toast} />

      {exportModalOpen && (
        <ExportModal appState={appState} onClose={() => setExportModalOpen(false)} />
      )}

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

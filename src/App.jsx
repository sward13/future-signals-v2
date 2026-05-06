/**
 * App — root component. Manages Supabase auth session, then holds all app state
 * via useAppState, renders the AppShell, active screen, modals, and toast.
 * New users are gated behind OnboardingFlow until workspace_settings.onboarding_complete.
 */
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import { useAppState } from "./hooks/useAppState.js";
import { AuthScreen } from "./components/auth/AuthScreen.jsx";
import { OnboardingShell } from "./components/onboarding/OnboardingShell.tsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { Toast } from "./components/layout/Toast.jsx";
import { NewProjectModal } from "./components/projects/NewProjectModal.jsx";
import { ExportModal } from "./components/projects/ExportModal.jsx";
import { ProjectPickerModal } from "./components/shared/ProjectPickerModal.jsx";
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

// Shown while the session is resolving (localStorage read) or while a
// Supabase email-confirmation token is being exchanged with the server.
// Prevents the blank-page experience users see when arriving via a
// confirmation link.
function AppLoader() {
  return (
    <>
      <style>{`@keyframes app-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F7F7F5",
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "2.5px solid rgba(0,0,0,0.1)",
          borderTopColor: "#3B82F6",
          animation: "app-spin 0.7s linear infinite",
        }} />
      </div>
    </>
  );
}

export default function App() {
  // ── Auth layer ─────────────────────────────────────────────────────────────
  // session === undefined: still resolving initial state (show nothing)
  // session === null:      resolved, not signed in (show AuthScreen)
  // session === object:    signed in
  const [session, setSession] = useState(undefined);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [drawerSavingInputId, setDrawerSavingInputId] = useState(null);

  // ── Onboarding gate ────────────────────────────────────────────────────────
  // undefined = still loading, true/false = resolved
  const [onboardingComplete, setOnboardingComplete] = useState(undefined);
  const [preferences, setPreferences] = useState({});

  useEffect(() => {
    // ── Auth callback handler ──────────────────────────────────────────────────
    // Supabase email confirmation links (PKCE / OTP flow) arrive with
    // ?token_hash=xxx&type=xxx in the URL. The SDK does NOT auto-process
    // query-param tokens — getSession() returns null until verifyOtp() is
    // called. Without this handler the user sees a blank page and must reload.
    //
    // The legacy implicit flow (#access_token=...) is handled automatically
    // by the SDK, so getSession() covers it without any extra work here.
    const initSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type      = params.get("type");

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) console.error("[auth] token exchange failed:", error.message);
        // Remove the one-time token from the URL so it isn't reprocessed on refresh
        window.history.replaceState(
          {},
          "",
          window.location.pathname + window.location.hash
        );
      }

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session ?? null);
      if (session) fetchWorkspaceId(session.user.id);
    };

    initSession();

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
      .select("id, onboarding_completed")
      .eq("user_id", userId)
      .single();
    if (data) {
      setWorkspaceId(data.id);
      // Pass the new flag; fetchWorkspaceSettings will OR it with the legacy flag
      fetchWorkspaceSettings(data.id, data.onboarding_completed ?? false);
    }
  };

  const fetchWorkspaceSettings = async (wsId, newFlagCompleted = false) => {
    const { data } = await supabase
      .from("workspace_settings")
      .select("onboarding_complete, preferences")
      .eq("workspace_id", wsId)
      .single();
    // Completed if either the new flag (workspaces.onboarding_completed) or the
    // legacy flag (workspace_settings.onboarding_complete) is true.
    // This ensures existing users who completed via the old flow are not re-shown onboarding.
    setOnboardingComplete(newFlagCompleted || (data?.onboarding_complete ?? false));
    setPreferences(data?.preferences ?? {});
  };

  const handleSignOut = async () => {
    localStorage.removeItem("fs_active_screen");
    localStorage.removeItem("fs_active_project");
    await supabase.auth.signOut();
  };

  // ── App state ──────────────────────────────────────────────────────────────
  const appState = useAppState(workspaceId, session ?? null, preferences);
  const { inputDetailId, clusterDetailId, closeInputDetail, closeClusterDetail, updateInput, updateCluster, assignInputToCluster, removeInputFromCluster, deleteInput, deleteCluster, inputs, clusters, projects, activeProjectId } = appState;
  const projectClusters = activeProjectId ? clusters.filter((cl) => cl.project_id === activeProjectId) : null;

  // ── Onboarding handlers ────────────────────────────────────────────────────
  const handleOnboardingProjectCreate = (fields) => {
    return new Promise((resolve) => {
      appState.addProject(fields, { onInserted: resolve });
    });
  };

  const handleOnboardingComplete = async (projectId) => {
    // Write to the new column on workspaces (canonical) — fire-and-forget
    if (workspaceId) {
      supabase
        .from("workspaces")
        .update({ onboarding_completed: true })
        .eq("id", workspaceId)
        .then(({ error }) => {
          if (error) console.error("[onboarding] onboarding_completed write failed:", error);
        });
    }
    setOnboardingComplete(true);
    if (projectId) {
      window.history.pushState({}, "", `/projects/${projectId}`);
      appState.openProject(projectId);
      // Refresh inputs so onboarding-promoted signals appear in the project
      // immediately — they were inserted via direct Supabase calls in
      // ScannerInboxStep and are not yet in local state.
      appState.refreshInputs();
      appState.refreshClusters();
    } else {
      window.history.pushState({}, "", "/");
    }
  };

  // ── URL management — pushState side-effects, not routing logic ────────────
  // Updates the browser address bar without installing a router.
  // The app remains state-driven; this is purely cosmetic / for browser history.
  useEffect(() => {
    if (session === undefined || onboardingComplete === undefined) return;
    if (!session) return;
    if (onboardingComplete === false) {
      // New user entering the onboarding flow
      if (window.location.pathname !== "/onboarding") {
        window.history.pushState({}, "", "/onboarding");
      }
    } else if (window.location.pathname === "/onboarding") {
      // Already completed but URL still shows /onboarding — replace with root
      window.history.replaceState({}, "", "/");
    }
  }, [session, onboardingComplete]);

  // ── Deep-link handler — /projects/[uuid] ──────────────────────────────────
  // Fires once after projects have loaded. If the URL matches /projects/[id],
  // opens that project rather than landing at root state.
  // Handles both post-onboarding redirect and hard-refresh at a project URL.
  useEffect(() => {
    if (!onboardingComplete || projects.length === 0) return;
    const match = window.location.pathname.match(
      /^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
    );
    if (!match) return;
    const projectId = match[1];
    const exists = projects.some((p) => p.id === projectId);
    if (exists) {
      appState.openProject(projectId);
    } else {
      // Project not in workspace — fall back to root and clean the URL
      window.history.replaceState({}, "", "/");
    }
  }, [onboardingComplete, projects]);

  // ── Auth gates ─────────────────────────────────────────────────────────────
  if (session === undefined) return <AppLoader />;  // resolving (or exchanging token)
  if (passwordRecovery) return <AuthScreen initialMode="reset" />;  // password reset flow
  if (!session) return <AuthScreen />;  // not signed in

  // ── Onboarding gate ────────────────────────────────────────────────────────
  // Wait until workspace state is loaded before deciding
  if (onboardingComplete === undefined) return <AppLoader />;
  if (!onboardingComplete) {
    return (
      <OnboardingShell
        workspaceId={workspaceId}
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
      <AppShell appState={appState} onSignOut={handleSignOut} onExport={() => setExportModalOpen(true)} scroll={!["scenarios", "scenario_canvas", "analysis", "project"].includes(appState.activeScreen)}>
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
        onAccept={(inp) => {
          const topProject = inp.metadata?.suggested_projects?.[0];
          if (!topProject) return;
          appState.saveInputToProject(inp.id, topProject.id);
          appState.showToast(`Added to "${topProject.name}"`);
        }}
        onSaveToProject={(id) => { setDrawerSavingInputId(id); }}
        onDismissSuggested={(inp) => { appState.dismissSuggestedInput(inp); appState.showToast("Signal dismissed"); }}
        projectClusters={projectClusters}
        onAssignToCluster={(inputId, clusterId) => {
          assignInputToCluster(inputId, clusterId);
          const cl = clusters.find((c) => c.id === clusterId);
          appState.showToast(cl ? `Assigned to "${cl.name}"` : "Input assigned");
        }}
        onOpenCluster={(clusterId) => { closeInputDetail(); appState.openClusterDetail(clusterId); }}
      />

      {drawerSavingInputId && (
        <ProjectPickerModal
          projects={projects}
          onSelect={(project) => {
            appState.saveInputToProject(drawerSavingInputId, project.id);
            appState.showToast(`Added to "${project.name}"`);
            setDrawerSavingInputId(null);
            closeInputDetail();
          }}
          onClose={() => setDrawerSavingInputId(null)}
          onCreateProject={appState.openProjectModal}
        />
      )}

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

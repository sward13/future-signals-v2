/**
 * App — root component. Holds all state via useAppState, renders the AppShell,
 * active screen, project creation modal, and toast.
 */
import { useAppState } from "./hooks/useAppState.js";
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
    case "dashboard":  return <Dashboard     appState={appState} />;
    case "inbox":      return <Inbox         appState={appState} />;
    case "projects":   return <Dashboard     appState={appState} />;  // projects list = dashboard
    case "project":    return <ProjectDetail appState={appState} />;
    case "clustering": return <Clustering    appState={appState} />;
    case "scenarios":         return <ScenarioCanvas          appState={appState} />;
    case "narrative":         return <NarrativeCanvas          appState={appState} />;
    case "scenario_canvas":   return <ScenarioNarrativeCanvas  appState={appState} />;
    case "analysis":          return <SystemAnalysisCanvas      appState={appState} />;
    default:           return <Inbox         appState={appState} />;
  }
}

export default function App() {
  const appState = useAppState();
  const { inputDetailId, clusterDetailId, closeInputDetail, closeClusterDetail, updateInput, updateCluster, assignInputToCluster, removeInputFromCluster, inputs, clusters, projects } = appState;

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
      <AppShell appState={appState} scroll={!["scenarios", "scenario_canvas", "analysis"].includes(appState.activeScreen)}>
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
        onClose={closeInputDetail}
        onSave={(id, fields) => { updateInput(id, fields); appState.showToast("Input updated"); closeInputDetail(); }}
      />

      <ClusterDetailDrawer
        clusterId={clusterDetailId}
        clusters={clusters}
        inputs={inputs}
        onClose={closeClusterDetail}
        onSave={(id, fields) => { updateCluster(id, fields); appState.showToast("Cluster updated"); closeClusterDetail(); }}
        onRemoveInput={(inputId, clusterId) => { removeInputFromCluster(inputId, clusterId); appState.showToast("Input removed from cluster"); }}
        onAssignInput={(inputId, clusterId) => { assignInputToCluster(inputId, clusterId); appState.showToast("Input added to cluster"); }}
      />
    </div>
  );
}

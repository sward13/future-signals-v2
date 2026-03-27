/**
 * AppShell — sidebar + main content area wrapper.
 * Passes active project context to Sidebar for in-project navigation display.
 * @param {{ appState: object, children: React.ReactNode, scroll?: boolean }} props
 */
import { Sidebar } from "./Sidebar.jsx";

export function AppShell({ appState, children, scroll = true }) {
  const { activeScreen, setActiveScreen, setActiveProjectId, user, inputs, clusters, scenarios, projects, activeProjectId, openProjectModal } = appState;

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const clusterCount = activeProjectId
    ? clusters.filter((cl) => cl.project_id === activeProjectId).length
    : 0;
  const scenarioCount = activeProjectId
    ? scenarios.filter((s) => s.project_id === activeProjectId).length
    : 0;

  // Clear active project when navigating to workspace-level screens
  const handleNavigation = (screen) => {
    if (screen === "dashboard" || screen === "inbox" || screen === "projects") {
      setActiveProjectId(null);
    }
    setActiveScreen(screen);
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <Sidebar
        activeScreen={activeScreen}
        setActiveScreen={handleNavigation}
        user={user}
        inputCount={inputs.length}
        projectCount={projects.length}
        activeProject={activeProject}
        openProjectModal={openProjectModal}
        clusterCount={clusterCount}
        scenarioCount={scenarioCount}
      />
      <div style={{
        flex: 1,
        overflowY: scroll ? "auto" : "hidden",
        overflowX: "hidden",
        minWidth: 0,
      }}>
        {children}
      </div>
    </div>
  );
}

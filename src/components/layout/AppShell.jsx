/**
 * AppShell — sidebar + main content area wrapper.
 * Passes active project context to Sidebar for in-project navigation display.
 * @param {{ appState: object, children: React.ReactNode, scroll?: boolean }} props
 */
import { Sidebar } from "./Sidebar.jsx";

export function AppShell({ appState, children, scroll = true, onSignOut }) {
  const { activeScreen, setActiveScreen, setActiveProjectId, user, inputs, clusters, scenarios, preferredFutures, strategicOptions, projects, activeProjectId, openProjectModal, analyses, canvasNodes } = appState;

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const inboxCount = inputs.filter((i) =>
    i.project_id === null &&
    !(i.is_seeded && i.metadata?.source === 'scanner' && i.metadata?.dismissed)
  ).length;
  const projectInputCount = activeProjectId
    ? inputs.filter((i) => i.project_id === activeProjectId).length : 0;
  const clusterCount = activeProjectId
    ? clusters.filter((cl) => cl.project_id === activeProjectId).length : 0;
  const scenarioCount = activeProjectId
    ? (canvasNodes.some((n) => n.projectId === activeProjectId) ? 1 : 0) : 0;
  const analysisCount = activeProjectId
    ? analyses.filter((a) => a.project_id === activeProjectId).length : 0;

  const futureModelsCount = activeProjectId
    ? scenarios.filter((s) => s.project_id === activeProjectId).length
      + (preferredFutures || []).filter((pf) => pf.project_id === activeProjectId).length
      + (strategicOptions || []).filter((o) => o.project_id === activeProjectId).length
    : 0;

  // Analysis nav item unlocked once the project has ≥1 system built (same condition as "N built" badge)
  const hasRelationships = activeProjectId
    ? appState.relationships.filter((r) => r.projectId === activeProjectId).length > 0
    : false;

  // Clear active project when navigating to workspace-level screens
  const handleNavigation = (screen) => {
    if (screen === "dashboard" || screen === "inbox" || screen === "projects" || screen === "settings") {
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
        inboxCount={inboxCount}
        activeProject={activeProject}
        openProjectModal={openProjectModal}
        projectInputCount={projectInputCount}
        clusterCount={clusterCount}
        scenarioCount={scenarioCount}
        analysisCount={analysisCount}
        futureModelsCount={futureModelsCount}
        hasRelationships={hasRelationships}
        onSignOut={onSignOut}
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

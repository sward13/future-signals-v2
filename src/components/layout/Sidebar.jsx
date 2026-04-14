/**
 * Sidebar — primary navigation with two states:
 *   Workspace level (no active project): Dashboard, Inbox, Projects only.
 *   Project level (active project): same top nav + PROJECT section with
 *     Inputs, Clustering, Systems scoped to that project.
 * @param {{
 *   activeScreen: string,
 *   setActiveScreen: (screen: string) => void,
 *   user: object,
 *   inboxCount: number,
 *   activeProject: object|null,
 *   openProjectModal: () => void,
 *   projectInputCount: number,
 *   clusterCount: number,
 *   scenarioCount: number,
 *   analysisCount: number,
 * }} props
 */
import { c } from "../../styles/tokens.js";

const NAV_ITEMS = [
  { icon: "⌂", label: "Dashboard", screen: "dashboard" },
  { icon: "◎", label: "Inbox",     screen: "inbox" },
];

const PROJECT_ITEMS = [
  { icon: "◎", label: "Inputs",       screen: "project" },
  { icon: "◈", label: "Clusters",     screen: "clustering" },
  { icon: "◆", label: "System Map",   screen: "scenarios" },
  { icon: "◑", label: "System Analysis", screen: "analysis" },
];

export function Sidebar({
  activeScreen,
  setActiveScreen,
  user,
  inboxCount = 0,
  activeProject = null,
  openProjectModal,
  projectInputCount = 0,
  clusterCount = 0,
  scenarioCount = 0,
  analysisCount = 0,
  hasRelationships = false,
  onSignOut,
}) {
  const inProject = !!activeProject;

  const navCounts = {
    inbox: inboxCount || null,
  };

  const projCounts = {
    project:    projectInputCount || null,
    clustering: clusterCount      || null,
    scenarios:  scenarioCount     || null,
    analysis:   analysisCount     || null,
  };

  const NavButton = ({ icon, label, screen, isActive, count, indented = false }) => (
    <button
      onClick={() => setActiveScreen(screen)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: indented ? "6px 16px 6px 32px" : "8px 16px",
        width: "100%",
        fontSize: indented ? 11 : 12,
        color: isActive ? c.ink : c.muted,
        fontWeight: isActive ? 500 : 400,
        background: isActive ? "rgba(0,0,0,0.04)" : "transparent",
        border: "none",
        borderRight: isActive ? `2px solid ${c.ink}` : "2px solid transparent",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color 0.1s, background 0.1s",
      }}
    >
      {!indented && (
        <span style={{ fontSize: 11, width: 14, flexShrink: 0 }}>{icon}</span>
      )}
      {indented && (
        <span style={{ fontSize: 9, width: 14, flexShrink: 0, color: c.hint }}>↳</span>
      )}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {count != null && !indented && (
        <span style={{
          fontSize: 10,
          padding: "1px 6px",
          borderRadius: 10,
          background: isActive ? c.ink : "rgba(0,0,0,0.07)",
          color: isActive ? c.white : c.muted,
          fontWeight: 500,
          flexShrink: 0,
        }}>
          {count}
        </span>
      )}
      {indented && isActive && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.ink, flexShrink: 0 }} />
      )}
    </button>
  );

  return (
    <div style={{
      width: 188,
      flexShrink: 0,
      background: c.surfaceAlt,
      borderRight: `1px solid ${c.border}`,
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      {/* Logo / context */}
      <div style={{ padding: "16px", borderBottom: `1px solid ${c.border}` }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          fontSize: 13, fontWeight: 600, color: c.ink,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.ink }} />
          Future Signals
        </div>
        <div style={{
          fontSize: 10,
          color: inProject ? c.muted : c.hint,
          fontWeight: inProject ? 500 : 400,
          marginTop: 2,
          paddingLeft: 14,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {inProject ? activeProject.name : "Strategic Foresight"}
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>

        {/* Top-level workspace nav — always visible */}
        {NAV_ITEMS.map(({ icon, label, screen }) => (
          <NavButton
            key={screen}
            icon={icon}
            label={label}
            screen={screen}
            isActive={activeScreen === screen}
            count={navCounts[screen]}
          />
        ))}

        {/* PROJECT section — only when a project is active */}
        {inProject && (
          <>
            <div style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: c.hint,
              padding: "14px 16px 4px",
            }}>
              Project
            </div>
            {PROJECT_ITEMS.map(({ icon, label, screen }) => {
              const disabled = screen === "analysis" && !hasRelationships;
              if (disabled) {
                return (
                  <div
                    key={screen}
                    title="Build at least one system in the System Map to unlock Scenarios"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      fontSize: 12,
                      color: c.hint,
                      fontWeight: 400,
                      cursor: "default",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ fontSize: 11, width: 14, flexShrink: 0 }}>{icon}</span>
                    <span style={{ flex: 1 }}>{label}</span>
                  </div>
                );
              }
              return (
                <NavButton
                  key={screen}
                  icon={icon}
                  label={label}
                  screen={screen}
                  isActive={activeScreen === screen}
                  count={projCounts[screen]}
                />
              );
            })}
          </>
        )}
      </div>

      {/* User footer */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${c.border}` }}>
        <button
          onClick={() => setActiveScreen("settings")}
          style={{
            display: "block", width: "100%", textAlign: "left",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontFamily: "inherit",
          }}
        >
          <div style={{ fontSize: 11, color: activeScreen === "settings" ? c.ink : c.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: activeScreen === "settings" ? 500 : 400 }}>
            {user?.email || "user@example.com"}
          </div>
          <div style={{ fontSize: 10, color: c.hint, marginTop: 1 }}>
            {user?.level === "advanced" ? "Advanced" : user?.level === "intermediate" ? "Intermediate" : "Beginner"} · Account settings
          </div>
        </button>
        {onSignOut && (
          <button
            onClick={onSignOut}
            style={{
              fontSize: 9, color: c.hint, background: "none", border: "none",
              cursor: "pointer", fontFamily: "inherit", padding: 0, marginTop: 4,
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

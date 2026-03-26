/**
 * Sidebar — primary navigation. When inside a project (activeScreen === 'project'),
 * shows the active project name below the logo and as a sub-row under Projects.
 * @param {{ activeScreen: string, setActiveScreen: (screen: string) => void, user: object, inputCount: number, projectCount: number, activeProject: object|null }} props
 */
import { c } from "../../styles/tokens.js";

const NAV_ITEMS = [
  { icon: "⌂", label: "Dashboard", screen: "dashboard" },
  { icon: "◎", label: "Inbox",     screen: "inbox" },
  { icon: "◻", label: "Projects",  screen: "projects" },
];

const WORKSPACE_ITEMS = [
  { icon: "◈", label: "Clustering", screen: "clustering" },
  { icon: "◆", label: "Systems",    screen: "scenarios" },
];

export function Sidebar({ activeScreen, setActiveScreen, user, inputCount = 0, projectCount = 0, activeProject = null, openProjectModal, clusterCount = 0 }) {
  const inProject = activeScreen === "project" && activeProject;

  const counts = {
    inbox: inputCount || null,
    projects: projectCount || null,
    clustering: clusterCount || null,
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
      <span style={{
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
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
        <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c.ink,
          flexShrink: 0,
        }} />
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
      {/* Logo */}
      <div style={{ padding: "16px", borderBottom: `1px solid ${c.border}` }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 13,
          fontWeight: 600,
          color: c.ink,
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
        {NAV_ITEMS.map(({ icon, label, screen }) => {
          // Projects parent is only active on the projects/dashboard list, NOT when inside a project
          // (the indented sub-item carries the active state when inside a project)
          const isActive = activeScreen === screen;

          return (
            <div key={screen}>
              <NavButton
                icon={icon}
                label={label}
                screen={screen}
                isActive={isActive}
                count={counts[screen]}
              />
              {/* Project sub-row — shown under Projects when inside a project */}
              {screen === "projects" && inProject && (
                <NavButton
                  icon="◻"
                  label={activeProject.name}
                  screen="project"
                  isActive={activeScreen === "project"}
                  indented
                />
              )}
            </div>
          );
        })}

        <div style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: c.hint,
          padding: "14px 16px 4px",
        }}>
          Workspace
        </div>

        {WORKSPACE_ITEMS.map(({ icon, label, screen }) => (
          <NavButton
            key={screen}
            icon={icon}
            label={label}
            screen={screen}
            isActive={activeScreen === screen}
            count={counts[screen]}
          />
        ))}
      </div>

      {/* New project button */}
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${c.border}` }}>
        <button
          onClick={openProjectModal}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 7,
            border: `1px dashed ${c.borderMid}`,
            background: "transparent",
            color: c.muted,
            fontSize: 11,
            fontFamily: "inherit",
            cursor: "pointer",
            textAlign: "left",
            transition: "background 0.1s, color 0.1s",
          }}
        >
          + New project
        </button>
      </div>

      {/* User footer */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${c.border}` }}>
        <div style={{ fontSize: 11, color: c.faint }}>{user?.email || "user@example.com"}</div>
        <div style={{ fontSize: 10, color: c.hint, marginTop: 1 }}>
          {user?.level === "advanced" ? "Advanced" : user?.level === "intermediate" ? "Intermediate" : "Beginner"} · Pro plan
        </div>
      </div>
    </div>
  );
}

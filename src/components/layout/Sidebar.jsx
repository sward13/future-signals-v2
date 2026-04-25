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
import logoLight from "../../assets/logo_light.svg";
import { c } from "../../styles/tokens.js";
import {
  Home, Inbox as InboxIcon, SquareArrowRight, Boxes,
  Network, LayoutDashboard, ChartNoAxesCombined, Download,
} from "lucide-react";

function getInitials(user) {
  if (user?.name) {
    const parts = user.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (user?.email) return user.email[0].toUpperCase();
  return "?";
}

const NAV_ITEMS = [
  { icon: <Home size={16} />,    label: "Dashboard", screen: "dashboard" },
  { icon: <InboxIcon size={16} />, label: "Inbox",   screen: "inbox" },
];

const PROJECT_ITEMS = [
  { icon: <SquareArrowRight size={16} />, label: "Inputs",          screen: "project" },
  { icon: <Boxes size={16} />,            label: "Clusters",        screen: "clustering" },
  { icon: <Network size={16} />,          label: "System Map",      screen: "scenarios" },
  { icon: <LayoutDashboard size={16} />,  label: "System Analysis", screen: "analysis" },
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
  futureModelsCount = 0,
  hasRelationships = false,
  onExport,
}) {
  const inProject = !!activeProject;

  const navCounts = {
    inbox: inboxCount || null,
  };

  const projCounts = {
    project:       projectInputCount  || null,
    clustering:    clusterCount       || null,
    scenarios:     scenarioCount      || null,
    analysis:      analysisCount      || null,
    "future-models": futureModelsCount || null,
  };

  const NavButton = ({ icon, label, screen, isActive, count, indented = false }) => (
    <button
      onClick={() => setActiveScreen(screen)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: indented ? "6px 14px 6px 30px" : "7px 14px",
        width: "100%",
        fontSize: indented ? 11 : 12,
        color: isActive ? "#3B82F6" : c.muted,
        fontWeight: isActive ? 500 : 400,
        background: isActive ? "#EFF6FF" : "transparent",
        border: "none",
        borderLeft: isActive ? "2px solid #3B82F6" : "2px solid transparent",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color 0.1s, background 0.1s",
      }}
    >
      {!indented && (
        <span style={{ width: 16, flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
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
          background: isActive ? "#DBEAFE" : "rgba(0,0,0,0.07)",
          color: isActive ? "#3B82F6" : c.muted,
          fontWeight: 500,
          flexShrink: 0,
        }}>
          {count}
        </span>
      )}
      {indented && isActive && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", flexShrink: 0 }} />
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
      <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${c.border}` }}>
        <img src={logoLight} alt="Future Signals" style={{ width: 140, height: "auto", display: "block" }} />
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

        {/* Project nav — only when a project is active */}
        {inProject && (
          <>
            <div style={{ height: 1, background: c.border, margin: "6px 0" }} />
            {PROJECT_ITEMS.map(({ icon, label, screen }) => (
              <NavButton
                key={screen}
                icon={icon}
                label={label}
                screen={screen}
                isActive={activeScreen === screen}
                count={projCounts[screen]}
              />
            ))}
            <NavButton
              icon={<ChartNoAxesCombined size={16} />}
              label="Future Models"
              screen="future-models"
              isActive={activeScreen === "future-models"}
              count={projCounts["future-models"]}
            />
          </>
        )}
      </div>

      {/* Export — only shown when a project is active */}
      {inProject && (
        <div style={{ borderTop: `1px solid ${c.border}` }}>
          <button
            onClick={onExport}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px", width: "100%",
              fontSize: 12, color: c.hint, fontWeight: 400,
              background: "transparent", border: "none",
              textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              transition: "color 0.1s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = c.muted; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = c.hint; }}
          >
            <span style={{ width: 16, flexShrink: 0, display: "flex", alignItems: "center" }}><Download size={16} /></span>
            <span>Export</span>
          </button>
        </div>
      )}

      {/* User footer */}
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${c.border}` }}>
        <button
          onClick={() => setActiveScreen("settings")}
          onMouseEnter={(e) => { e.currentTarget.style.background = c.surfaceAlt; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            width: "100%", background: "transparent", border: "none",
            cursor: "pointer", padding: "5px 6px", borderRadius: 7,
            fontFamily: "inherit", textAlign: "left",
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: c.surfaceAlt, border: `1px solid ${c.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 600, color: c.muted, letterSpacing: "0.03em",
            userSelect: "none",
          }}>
            {getInitials(user)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 11, color: activeScreen === "settings" ? c.ink : c.faint,
              fontWeight: activeScreen === "settings" ? 500 : 400,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {user?.email || "user@example.com"}
            </div>
            <div style={{ fontSize: 10, color: c.hint, marginTop: 1 }}>
              {user?.level === "advanced" ? "Advanced" : user?.level === "intermediate" ? "Intermediate" : "Beginner"}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

/**
 * Sidebar — primary navigation with two states:
 *   Workspace level (no active project): Dashboard, Inbox, Projects only.
 *   Project level (active project): same top nav + PROJECT section with
 *     Scan, Cluster, Systems scoped to that project.
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
import { useState } from "react";
import logoLight from "../../assets/logo_light.svg";
import { c, countBadge } from "../../styles/tokens.js";
import { projectDomainLabel } from "../../lib/projectDomains.js";
import {
  Home, Inbox as InboxIcon, PanelsTopLeft, SquareArrowRight,
  Boxes, Network, LayoutDashboard, ChartNoAxesCombined, Download,
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
  { icon: <PanelsTopLeft size={16} />,     label: "Overview",        screen: "project-overview" },
  { icon: <SquareArrowRight size={16} />, label: "Scan",            screen: "project" },
  { icon: <Boxes size={16} />,             label: "Cluster",         screen: "cluster" },
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
  projects = [],
  setActiveProjectId,
  openProject,
  dragActive = false,
  onDropInputsToProject,
}) {
  const inProject = !!activeProject;
  // id of the project row currently being hovered during an Inbox-input drag
  const [dropTargetId, setDropTargetId] = useState(null);

  const navCounts = {
    inbox: inboxCount || null,
  };

  const projCounts = {
    project:         projectInputCount  || null,
    cluster:         clusterCount       || null,
    scenarios:       scenarioCount      || null,
    analysis:        analysisCount      || null,
    "future-models": futureModelsCount  || null,
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
        color: isActive ? c.blue700 : c.muted,
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
          ...countBadge,
          background: isActive ? "#DBEAFE" : "rgba(0,0,0,0.07)",
          color: isActive ? c.blue700 : c.muted,
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

        {/* Workspace-level project list — only when no project is active */}
        {!inProject && projects.length > 0 && (
          <>
            <div style={{ height: 1, background: c.border, margin: "6px 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 14px 4px" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, fontWeight: 500 }}>Projects</div>
              <span style={{ ...countBadge, background: "rgba(0,0,0,0.07)", color: c.muted, fontWeight: 500 }}>
                {projects.length}
              </span>
            </div>
            {projects.slice(0, 8).map((p) => {
              const isDropTarget = dragActive && dropTargetId === p.id;
              return (
              <button
                key={p.id}
                onClick={() => openProject(p.id)}
                onDragOver={dragActive ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTargetId(p.id); } : undefined}
                onDragLeave={dragActive ? () => setDropTargetId((cur) => (cur === p.id ? null : cur)) : undefined}
                onDrop={dragActive ? (e) => { e.preventDefault(); setDropTargetId(null); onDropInputsToProject?.(p); } : undefined}
                style={{
                  display: "block", width: "100%", padding: "5px 14px",
                  textAlign: "left",
                  background: isDropTarget ? c.brandBg : "transparent",
                  border: "none",
                  borderLeft: `2px solid ${isDropTarget ? c.brand : "transparent"}`,
                  outline: isDropTarget ? `2px solid ${c.brand}` : "none",
                  outlineOffset: -2,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isDropTarget) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                onMouseLeave={(e) => { if (!isDropTarget) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </div>
                {projectDomainLabel(p) && (
                  <div style={{ fontSize: 10, color: c.hint, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {projectDomainLabel(p)}
                  </div>
                )}
              </button>
              );
            })}
            {projects.length > 8 && (
              <button
                onClick={() => setActiveScreen("dashboard")}
                style={{ fontSize: 11, color: c.brand, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 14px", textAlign: "left" }}
              >
                View all →
              </button>
            )}
          </>
        )}

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
          <div style={{
            minWidth: 0, flex: 1,
            fontSize: 11, color: activeScreen === "settings" ? c.ink : c.faint,
            fontWeight: activeScreen === "settings" ? 500 : 400,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {user?.email || "user@example.com"}
          </div>
        </button>
      </div>
    </div>
  );
}

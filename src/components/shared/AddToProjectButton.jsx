import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { c } from "../../styles/tokens.js";
import { ChevronDown } from "lucide-react";

const sectionHeader = {
  padding: "8px 14px 4px", fontSize: 11,
  letterSpacing: "0.02em", color: c.hint, fontWeight: 500,
};

const item = {
  display: "block", width: "100%", padding: "8px 14px",
  background: "transparent", border: "none",
  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
};

/**
 * Inline "Add to project" dropdown button, shared by My Inputs and AI
 * Suggested rows in the Inbox.
 *
 * If `recommendedProjectId` is provided, the dropdown shows a Recommended
 * section (with an "AI pick" badge) above an alphabetical "Other projects"
 * list. Otherwise it shows a single alphabetical "Add to project" list.
 */
export function AddToProjectButton({ projects, recommendedProjectId, onAdd, buttonStyle }) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const buttonRef = useRef(null);

  const recommendedProject = recommendedProjectId
    ? projects.find((p) => p.id === recommendedProjectId)
    : null;

  const otherProjects = projects
    .filter((p) => !recommendedProject || p.id !== recommendedProject.id)
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const handleSelect = (projectId) => {
    setOpen(false);
    onAdd(projectId);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!open) setAnchorRect(buttonRef.current.getBoundingClientRect());
          setOpen((o) => !o);
        }}
        style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", ...buttonStyle }}
      >
        Add to project <ChevronDown size={11} strokeWidth={2} />
      </button>
      {open && anchorRect && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed", top: anchorRect.bottom + 4, right: window.innerWidth - anchorRect.right,
              background: c.white, border: `1px solid ${c.border}`,
              borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
              minWidth: 220, maxHeight: 280, overflowY: "auto",
              zIndex: 51, textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            {recommendedProject && (
              <>
                <div style={sectionHeader}>Recommended</div>
                <button onClick={() => handleSelect(recommendedProject.id)} style={{ ...item, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {recommendedProject.name}
                    </div>
                    <div style={{ fontSize: 10, color: c.hint }}>{recommendedProject.domain}</div>
                  </div>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: c.blue50, color: c.blue700, border: `1px solid ${c.blueBorder}`, fontWeight: 500, flexShrink: 0 }}>
                    AI pick
                  </span>
                </button>
                <div style={{ height: 1, background: c.border, margin: "2px 0" }} />
              </>
            )}
            <div style={sectionHeader}>{recommendedProject ? "Other projects" : "Add to project"}</div>
            {otherProjects.length === 0 ? (
              <div style={{ padding: "4px 14px 12px", fontSize: 11, color: c.hint }}>
                {recommendedProject ? "No other projects yet." : "No projects yet."}
              </div>
            ) : (
              otherProjects.map((p) => (
                <button key={p.id} onClick={() => handleSelect(p.id)} style={item}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: c.hint }}>{p.domain}</div>
                </button>
              ))
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

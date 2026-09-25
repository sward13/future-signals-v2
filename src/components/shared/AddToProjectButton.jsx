import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { c } from "../../styles/tokens.js";
import { projectDomainLabel } from "../../lib/projectDomains.js";
import { computeFlipPosition } from "../../lib/panelPosition.js";
import { ROW_ACTION_BASE } from "./RowActionButton.jsx";
import { ChevronDown } from "lucide-react";

// Matches the panel's own maxHeight below — used as the worst-case height
// estimate for the viewport-collision check (see computeFlipPosition).
const PANEL_MAX_HEIGHT = 280;

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
 * Suggested rows in the Inbox, and by InputDetailDrawer.jsx's slide-in panel.
 *
 * If `recommendedProjectId` is provided, the dropdown shows a Recommended
 * section (with a "Best match" badge) above an alphabetical "Other projects"
 * list. Otherwise it shows a single alphabetical "Add to project" list.
 *
 * `zIndex` defaults to a baseline appropriate for a flat inline row (the
 * Inbox list). A host with its own elevated stacking context — e.g.
 * InputDetailDrawer.jsx's slide-in panel at zIndex 300/301 — must pass a
 * `zIndex` explicitly higher than its own, or this dropdown paints underneath
 * it (portaled to document.body correctly, but z-index alone still
 * determines paint order against anything else also in the root stacking
 * context). The panel itself renders one above `zIndex` (backdrop uses
 * `zIndex`, panel uses `zIndex + 1`), matching ClusterAssignMenu.jsx's
 * 9998/9999 backdrop/panel pairing convention.
 */
export function AddToProjectButton({ projects, recommendedProjectId, onAdd, buttonStyle, zIndex = 50, align = "right", variant = "panel" }) {
  const isRow = variant === "row";
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [hoverMain, setHoverMain] = useState(false);
  const [hoverChevron, setHoverChevron] = useState(false);
  const buttonRef = useRef(null);   // fallback single button
  const groupRef = useRef(null);    // split-button group (menu anchor)
  const chevronRef = useRef(null);  // split-button chevron (focus target on Escape)

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

  // Open the menu, anchoring to the given element's current bounding rect.
  const openMenu = (el) => {
    if (!open && el) setAnchorRect(el.getBoundingClientRect());
    setOpen((o) => !o);
  };

  // Escape closes the menu and returns focus to the trigger (chevron in split
  // mode, the single button otherwise). Window-level so it works whether focus
  // is on the trigger or inside the portaled menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        (chevronRef.current || buttonRef.current)?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const panelPosition = computeFlipPosition(anchorRect, { panelHeight: PANEL_MAX_HEIGHT, zIndex: zIndex + 1, align });

  // ── Split-button segment styling, derived from the surface's buttonStyle ──
  // (filled brand for every current call site). Outer corners take the surface
  // radius; inner corners are square (the container clips via overflow).
  const radius = buttonStyle?.borderRadius ?? 7;
  const segBg = buttonStyle?.background ?? c.brand;
  const segColor = buttonStyle?.color ?? c.white;
  const segFontSize = buttonStyle?.fontSize ?? 12;
  const segFontWeight = buttonStyle?.fontWeight ?? 500;
  const pad = String(buttonStyle?.padding ?? "4px 12px").trim().split(/\s+/);
  const padY = pad[0];
  const padX = pad[1] ?? pad[0];
  const chevronPadX = `${Math.max(6, Math.round((parseInt(padX, 10) || 12) * 0.55))}px`;

  const segBase = {
    border: "none", background: segBg, color: segColor,
    fontSize: segFontSize, fontWeight: segFontWeight,
    fontFamily: "inherit", cursor: "pointer",
    display: "flex", alignItems: "center", whiteSpace: "nowrap", lineHeight: 1,
  };

  // ── Row variant: standard row-action styling via the shared base class ──
  // (Inbox List/Card). Segments compose ROW_ACTION_BASE; the group owns the
  // rounded-btn radius with square inner corners; hover is CSS (hover:brightness-90),
  // and the chevron stays darkened while the menu is open.
  const rowTrigger = recommendedProject ? (
    <div ref={groupRef} role="group" aria-label="Add to project" className="inline-flex h-6 rounded-btn overflow-hidden">
      <button
        onClick={(e) => { e.stopPropagation(); onAdd(recommendedProject.id); }}
        aria-label={`Add to ${recommendedProject.name}`}
        title={`Add to ${recommendedProject.name}`}
        className={clsx(ROW_ACTION_BASE, "px-[9px]")}
      >
        Add
      </button>
      <button
        ref={chevronRef}
        onClick={(e) => { e.stopPropagation(); openMenu(groupRef.current); }}
        aria-label="Choose another project"
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(ROW_ACTION_BASE, "px-[6px] border-l border-l-white/40", open && "brightness-90")}
      >
        <ChevronDown size={11} strokeWidth={2} />
      </button>
    </div>
  ) : (
    <button
      ref={buttonRef}
      onClick={(e) => { e.stopPropagation(); openMenu(buttonRef.current); }}
      aria-haspopup="menu"
      aria-expanded={open}
      className={clsx(ROW_ACTION_BASE, "gap-1 px-[9px] rounded-btn")}
    >
      Add to project <ChevronDown size={11} strokeWidth={2} />
    </button>
  );

  // ── Panel variant (default): unchanged inline-styled split button, driven
  // by the caller's buttonStyle. Used by InputDetailDrawer's larger split button.
  const panelTrigger = recommendedProject ? (
    <div
      ref={groupRef}
      role="group"
      aria-label="Add to project"
      style={{ display: "inline-flex", borderRadius: radius, overflow: "hidden" }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onAdd(recommendedProject.id); }}
        onMouseEnter={() => setHoverMain(true)}
        onMouseLeave={() => setHoverMain(false)}
        aria-label={`Add to ${recommendedProject.name}`}
        title={`Add to ${recommendedProject.name}`}
        style={{ ...segBase, padding: `${padY} ${padX}`, filter: hoverMain ? "brightness(0.9)" : "none" }}
      >
        Add
      </button>
      <button
        ref={chevronRef}
        onClick={(e) => { e.stopPropagation(); openMenu(groupRef.current); }}
        onMouseEnter={() => setHoverChevron(true)}
        onMouseLeave={() => setHoverChevron(false)}
        aria-label="Choose another project"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          ...segBase, padding: `${padY} ${chevronPadX}`,
          borderLeft: "1px solid rgba(255,255,255,0.4)",
          filter: (hoverChevron || open) ? "brightness(0.9)" : "none",
        }}
      >
        <ChevronDown size={11} strokeWidth={2} />
      </button>
    </div>
  ) : (
    <button
      ref={buttonRef}
      onClick={(e) => { e.stopPropagation(); openMenu(buttonRef.current); }}
      aria-haspopup="menu"
      aria-expanded={open}
      style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", ...buttonStyle }}
    >
      Add to project <ChevronDown size={11} strokeWidth={2} />
    </button>
  );

  const trigger = isRow ? rowTrigger : panelTrigger;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {trigger}
      {open && panelPosition && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...panelPosition,
              background: c.white, border: `1px solid ${c.border}`,
              borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
              minWidth: 220, maxHeight: PANEL_MAX_HEIGHT, overflowY: "auto",
              textAlign: "left",
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
                    <div style={{ fontSize: 10, color: c.hint }}>{projectDomainLabel(recommendedProject)}</div>
                  </div>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: c.blue50, color: c.blue700, border: `1px solid ${c.blueBorder}`, fontWeight: 500, flexShrink: 0 }}>
                    Best match
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
                  <div style={{ fontSize: 10, color: c.hint }}>{projectDomainLabel(p)}</div>
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

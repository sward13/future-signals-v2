/**
 * ClusterAssignMenu — portal-based cluster picker used by any "Assign →" button.
 * Renders via createPortal to escape overflow:hidden ancestors.
 */
import { createPortal } from "react-dom";
import { c } from "../../styles/tokens.js";
import { SubtypeTag } from "./Tag.jsx";

const DROPDOWN_MAX_HEIGHT = 240;

export function ClusterAssignMenu({ clusters, onAssign, onNewCluster, onClose, anchorRect }) {
  if (!anchorRect) return null;

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT + 48;

  const style = {
    position: "fixed",
    right: window.innerWidth - anchorRect.right,
    ...(openUp
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
    minWidth: 240,
    zIndex: 9999,
    overflow: "hidden",
    fontFamily: "inherit",
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
      <div style={style}>
        {clusters.length > 0 && (
          <div style={{ maxHeight: DROPDOWN_MAX_HEIGHT, overflowY: "auto" }}>
            {clusters.map((cl) => (
              <button
                key={cl.id}
                onClick={() => onAssign(cl)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "10px 14px",
                  background: "transparent", border: "none",
                  borderBottom: `1px solid ${c.border}`,
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <SubtypeTag sub={cl.subtype} />
                <span style={{ fontSize: 12, color: c.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cl.name}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onNewCluster}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", padding: "10px 14px",
            background: "transparent", border: "none",
            textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, color: c.muted,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> New cluster
        </button>
      </div>
    </>,
    document.body
  );
}

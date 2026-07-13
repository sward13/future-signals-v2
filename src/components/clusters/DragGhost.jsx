import { createPortal } from "react-dom";
import { c } from "../../styles/tokens.js";

export function DragGhost({ active, label, x, y, isCopy }) {
  if (!active) return null;
  return createPortal(
    <div style={{
      position: "fixed",
      left: x + 14,
      top: y - 12,
      pointerEvents: "none",
      zIndex: 9999,
      background: c.ink,
      color: "#ffffff",
      fontSize: 12,
      fontWeight: 500,
      padding: "5px 10px",
      borderRadius: 7,
      whiteSpace: "nowrap",
      boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
      fontFamily: "inherit",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}>
      <span style={{
        maxWidth: 200,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      {isCopy && (
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          background: "#166534",
          color: "#ffffff",
          borderRadius: "50%",
          width: 16,
          height: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          +
        </span>
      )}
    </div>,
    document.body
  );
}

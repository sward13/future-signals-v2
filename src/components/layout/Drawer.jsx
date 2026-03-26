/**
 * Drawer — slide-over drawer shell. Overlays content with a semi-transparent backdrop.
 * @param {{ open: boolean, onClose: () => void, title: string, children: React.ReactNode, width?: number }} props
 */
import { c } from "../../styles/tokens.js";

export function Drawer({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.18)",
          zIndex: 100,
        }}
      />
      {/* Panel */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width,
        background: c.white,
        borderLeft: `1px solid ${c.border}`,
        zIndex: 101,
        display: "flex",
        flexDirection: "column",
        animation: "drawerSlideIn 0.25s ease",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: c.hint,
              lineHeight: 1,
              padding: "2px 4px",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes toastIn {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </>
  );
}

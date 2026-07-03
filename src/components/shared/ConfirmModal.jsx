import { createPortal } from "react-dom";
import { c, btnSec } from "../../styles/tokens.js";

export function ConfirmModal({ message, onConfirm, onCancel }) {
  return createPortal(
    <>
      <div
        onClick={onCancel}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 400 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: c.white, borderRadius: 12, padding: "24px 28px",
        boxShadow: "0 16px 48px rgba(0,0,0,0.18)", zIndex: 401, minWidth: 320,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          {message}
        </div>
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 20, lineHeight: 1.5 }}>
          This cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...btnSec, fontSize: 12, padding: "7px 16px" }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit", border: "none",
              background: "#DC2626", color: "#fff",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/**
 * ConfirmDialog — modal overlay for confirming a destructive action.
 * @param {{ title: string, message: string, confirmLabel?: string, onConfirm: () => void, onClose: () => void }} props
 */
import { c, btnSec } from "../../styles/tokens.js";

export function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 700 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 380, background: c.white, borderRadius: 10, zIndex: 701,
        border: `1px solid ${c.borderMid}`, boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
        padding: "24px 26px 20px",
      }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: c.ink, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.55, marginBottom: 22 }}>{message}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSec}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: "none", background: c.red800, color: c.white,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

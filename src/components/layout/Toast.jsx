/**
 * Toast — bottom-right success/error notification.
 * Driven by appState.toast. Auto-dismisses after 2s (handled in useAppState).
 * @param {{ toast: { message: string, type: 'success' | 'error' } | null }} props
 */
import { c } from "../../styles/tokens.js";

export function Toast({ toast }) {
  if (!toast) return null;

  const isError = toast.type === "error";
  const bg = isError ? c.red50 : c.green50;
  const border = isError ? c.redBorder : c.greenBorder;
  const color = isError ? c.red800 : c.green700;
  const icon = isError ? "✕" : "✓";

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 16px",
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 9,
      fontSize: 13,
      color,
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      animation: "toastIn 0.2s ease",
    }}>
      <span style={{ fontWeight: 600 }}>{icon}</span>
      {toast.message}
    </div>
  );
}

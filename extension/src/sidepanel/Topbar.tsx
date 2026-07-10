import type { ReactNode } from "react";
import { c } from "../../../src/styles/tokens.js";

type Props = { right?: ReactNode };

/**
 * No logo here — Chrome's native side panel header (icon + "Future Signals")
 * already carries that branding via manifest.json's icons/default_icon, so
 * repeating the wordmark in-panel was redundant. This bar now only exists
 * to host per-screen right-aligned actions (e.g. Sign out); it collapses to
 * an empty strip when there's nothing to show.
 */
export function Topbar({ right }: Props) {
  if (!right) return null;
  return (
    <div
      style={{
        background: c.white,
        borderBottom: "0.5px solid rgba(0,0,0,0.09)",
        padding: "0 16px",
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      {right}
    </div>
  );
}

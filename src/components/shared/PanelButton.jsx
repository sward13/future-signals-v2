import { forwardRef } from "react";
import clsx from "clsx";

/**
 * Shared styling for panel-level primary/secondary action buttons (Create,
 * Accept, Edit, …) — the tier above row actions (RowActionButton.jsx).
 * Sourced from ClusterDrawer.jsx's btnPClass/btnSecClass (the only
 * primary/secondary panel-button pair found across the migrated Cluster
 * components), normalized so variants share identical box geometry.
 *
 * Primary carries a transparent border of the same width as secondary's
 * so both variants compute to the same height from shared padding —
 * fill, border color, and text color are the only differences.
 */
const PANEL_BUTTON_BASE =
  "inline-flex items-center justify-center whitespace-nowrap cursor-pointer font-[inherit] " +
  "py-2.25 px-4.5 rounded-container text-ui font-medium border " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const PANEL_BUTTON_PRIMARY =
  PANEL_BUTTON_BASE + " border-transparent bg-brand text-white hover:brightness-90";

export const PANEL_BUTTON_SECONDARY =
  PANEL_BUTTON_BASE + " border-border-strong bg-transparent text-muted hover:bg-surface-hover";

/**
 * Standalone panel button (Create cluster, Accept, Edit, …).
 * `className` is for layout-only additions, not restyling.
 */
export const PanelButton = forwardRef(function PanelButton(
  { children, variant = "primary", onClick, className, disabled, title, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(variant === "secondary" ? PANEL_BUTTON_SECONDARY : PANEL_BUTTON_PRIMARY, className)}
      {...rest}
    >
      {children}
    </button>
  );
});

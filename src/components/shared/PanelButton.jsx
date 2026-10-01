import { forwardRef } from "react";
import clsx from "clsx";

/**
 * Shared styling for compact action buttons (Create cluster, Accept, Edit, …)
 * that sit in the same dense list context as row actions — e.g. the
 * "Assign →" button (RowActionButton.jsx), used right below these cards in
 * the same Cluster screen. Matches that h-6/11px/rounded-btn geometry rather
 * than ClusterDrawer's larger drawer-footer scale, which reads oversized next
 * to Assign at this density (confirmed in production — the drawer scale was
 * the wrong reference).
 *
 * Primary carries a transparent border of the same width as secondary's;
 * both also pin a fixed h-6, so neither border presence nor absence can
 * shift total height — fill, border color, and text color are the only
 * differences.
 */
const PANEL_BUTTON_BASE =
  "text-[11px] font-medium whitespace-nowrap cursor-pointer font-[inherit] " +
  "h-6 inline-flex items-center justify-center px-[9px] rounded-btn border " +
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

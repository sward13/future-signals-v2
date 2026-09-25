import clsx from "clsx";

/**
 * Shared styling for row-level action buttons across tables and card lists
 * (Inbox List/Card, Scan Scanner Suggestions, Cluster inputs table).
 *
 * `ROW_ACTION_BASE` is the filled-brand visual WITHOUT horizontal padding or
 * radius, so callers/segments can add their own:
 *   - RowActionButton (standalone): adds `px-[9px] rounded-btn`.
 *   - AddToProjectButton split segments: add per-segment px and let the group
 *     own the radius (square inner corners via the group's overflow-hidden).
 *
 * Standard size: 11px / weight 500 / py 3px / px 9px / radius 7px (rounded-btn),
 * filled brand, white text, hover darkens (brightness-90), keyboard focus ring.
 */
export const ROW_ACTION_BASE =
  "text-[11px] font-medium leading-none whitespace-nowrap cursor-pointer font-[inherit] " +
  "bg-brand text-white py-[3px] hover:brightness-90 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 " +
  "disabled:opacity-50 disabled:cursor-default";

/**
 * `ROW_ACTION_LINK` — the secondary row action rendered as a text link
 * (e.g. Dismiss). Matches the Inbox row Dismiss: 10px / weight normal /
 * `c.hint` (text-hint) / py 3px px 6px, transparent, no border. Adds a hover
 * darken and a keyboard focus ring. Still applied to a <button> element.
 */
export const ROW_ACTION_LINK =
  "text-[11px] font-normal leading-none whitespace-nowrap cursor-pointer font-[inherit] " +
  "bg-transparent text-hint py-[3px] px-1.5 rounded-btn hover:text-muted " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1";

/**
 * Standalone filled row action button (Accept, Assign →, …).
 * `className` is for layout-only additions (e.g. flex/gap), not restyling.
 */
export function RowActionButton({ children, onClick, className, disabled, title, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(ROW_ACTION_BASE, "px-[9px] rounded-btn", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

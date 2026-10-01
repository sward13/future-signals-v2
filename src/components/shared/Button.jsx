/* eslint-disable react-refresh/only-export-components -- BUTTON_SIZES/buttonClasses are
   plain helpers co-located with Button by design (buttonClasses must be importable for
   non-<button> elements, e.g. a future <Link>), not a Fast Refresh hazard. */
import { forwardRef } from "react";
import clsx from "clsx";

/**
 * Shared sizing/variant map for page-level buttons. Only "header" is
 * implemented for now (the page-header action row — e.g. Cluster's "Find
 * duplicates" / "New cluster"). "panel" and "row" scales already exist as
 * PanelButton.jsx / RowActionButton.jsx and are intentionally not
 * consolidated here yet — add them to this map when that migration happens.
 *
 * "header" reproduces the Cluster header's py-1.75/px-4/rounded-btn/text-xs
 * geometry, but pins an explicit h-8 rather than relying on padding +
 * line-height + border to add up: the Cluster source had primary on
 * `border-none` and secondary on `border border-border-strong`, which (on an
 * auto-sized box) made secondary 2px taller than primary. An explicit height
 * sidesteps that class of mismatch instead of reproducing it.
 */
export const BUTTON_SIZES = {
  header: {
    base: "h-8 px-4 text-xs font-medium gap-1.25 rounded-btn",
    icon: 13,
  },
};

const BASE =
  "inline-flex items-center justify-center whitespace-nowrap cursor-pointer font-[inherit] border " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANTS = {
  primary: "border-transparent bg-brand text-white hover:brightness-90",
  secondary: "border-border-strong bg-transparent text-muted hover:bg-surface-hover",
  ghost: "border-transparent bg-transparent text-muted hover:bg-surface-hover",
};

/**
 * Pure class-string builder so non-<button> elements (e.g. React Router
 * <Link>) can render with the same visual treatment.
 */
export function buttonClasses({ variant = "secondary", size = "header" } = {}) {
  const sizeConfig = BUTTON_SIZES[size] || BUTTON_SIZES.header;
  return clsx(BASE, sizeConfig.base, VARIANTS[variant] || VARIANTS.secondary);
}

/**
 * Standalone page-header button (Add an input, New project, Find
 * duplicates, …). `className` is for layout-only additions (e.g. margin),
 * not restyling — it's appended last so callers can't fight the variant.
 */
export const Button = forwardRef(function Button(
  { children, variant = "secondary", size = "header", onClick, className, disabled, title, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(buttonClasses({ variant, size }), className)}
      {...rest}
    >
      {children}
    </button>
  );
});

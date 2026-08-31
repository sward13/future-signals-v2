// Viewport-collision positioning for portal-based dropdown/menu panels.
//
// Four components independently reinvented the same ~10-15 line
// "measure the trigger, flip when there isn't room" pattern before this was
// extracted: AddToProjectButton.jsx, ProjectDetail.jsx's row context menu and
// its duplicate-to-cluster picker, and InputDetailDrawer.jsx's own
// duplicate-to-cluster picker. The pattern itself originates in
// ClusterAssignMenu.jsx (left untouched — it already gets this right and
// isn't part of this consolidation).
//
// Pure and framework-free so it's unit-testable with node:test, unlike the
// components themselves — this repo has no jsdom/RTL (see CLAUDE.md's
// Testing section), so extracting the geometry math out of JSX is the only
// way to get real automated coverage on it, matching the pattern already
// used for src/lib/clusterForcePicker.js.

const FLIP_BUFFER = 48;

/**
 * Compute the fixed-position CSS for a panel anchored to a trigger element,
 * flipping to the opposite vertical direction when the preferred one doesn't
 * have room. Two existing reference behaviors, both preserved exactly:
 *   - preferredDirection: "down" (ClusterAssignMenu, AddToProjectButton,
 *     ProjectDetail's two menus): stays down while there's enough space
 *     below; flips up otherwise.
 *   - preferredDirection: "up" (InputDetailDrawer's picker): stays up while
 *     there's enough space above; falls back down otherwise. This is the
 *     mirror image, not the same comparison run backwards — space is
 *     measured on the side the panel actually opens toward.
 *
 * @param {{top:number, bottom:number, left:number, right:number}|null} anchorRect
 *   From the trigger's getBoundingClientRect(). Null before a trigger has
 *   ever been measured (panel not open yet).
 * @param {{
 *   panelHeight: number,                 // worst-case panel height estimate
 *   preferredDirection?: "down"|"up",    // default "down"
 *   align?: "right"|"left",              // default "right"
 *   gap?: number,                        // gap between trigger and panel, default 4
 * }} opts
 * @returns {{position: "fixed", top?: number, bottom?: number, left?: number, right?: number}|null}
 *   A style object to spread into the panel's `style` prop, or null when
 *   anchorRect is absent (mirrors every call site's existing `anchorRect &&`
 *   guard before rendering the portal).
 */
export function computeFlipPosition(anchorRect, opts = {}) {
  if (!anchorRect) return null;
  const {
    panelHeight,
    preferredDirection = "down",
    align = "right",
    gap = 4,
  } = opts;

  const threshold = panelHeight + FLIP_BUFFER;
  const opensDownward = preferredDirection === "down"
    ? (window.innerHeight - anchorRect.bottom) >= threshold // enough room below → stay down
    : anchorRect.top < threshold;                            // NOT enough room above → fall back down

  const vertical = opensDownward
    ? { top: anchorRect.bottom + gap }
    : { bottom: window.innerHeight - anchorRect.top + gap };

  const horizontal = align === "left"
    ? { left: anchorRect.left }
    : { right: window.innerWidth - anchorRect.right };

  return { position: "fixed", ...vertical, ...horizontal };
}

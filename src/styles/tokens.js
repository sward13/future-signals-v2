/** Design tokens and shared style primitives for Future Signals v2. */

export const c = {
  bg: "#f5f4f0",
  white: "#ffffff",
  ink: "#111111",
  muted: "#666666",
  faint: "#5F5F5F",
  hint: "#6B6860",
  border: "rgba(0,0,0,0.09)",
  borderMid: "rgba(0,0,0,0.18)",
  borderStrong: "#9CA3AF",
  placeholder: "#6B7280",
  surfaceAlt: "#f9f9f7",
  fieldBg: "#fafaf8",
  canvas: "#f7f6f2",
  surfaceHover: "rgba(0,0,0,0.02)",
  brand: "#2563EB",
  brandBg: "#EFF6FF",
  brandBorder: "#BFDBFE",
  green25: "#F0FDF4",
  green50: "#EAF3DE",
  green600: "#16a34a",
  green700: "#3B6D11",
  greenBorder: "#C0DD97",
  blue50: "#E6F1FB",
  blue700: "#185FA5",
  blueBorder: "#B5D4F4",
  amber50: "#FAEEDA",
  amber700: "#854F0B",
  amberBorder: "#FAC775",
  violet50: "#F0EAFA",
  violet700: "#5B21B6",
  violetBorder: "#C4B5FD",
  cyan50: "#E0F9F9",
  cyan700: "#0E7490",
  cyanBorder: "#A5F3FC",
  red50: "#FCEBEB",
  red800: "#791F1F",
  redBorder: "#F7C1C1",
  teal50: "#E6FFFA",
  teal700: "#0F766E",
  tealBorder: "#5EEAD4",

  // Signal Strength / Source Confidence tier scale (locked badge-consolidation colors,
  // 2026-07-07 audit). Source Confidence reuses this scale: low→rust, medium→tan, high→sage.
  rust50: "#EFE1DC",
  rust700: "#A05F4E",
  rustBorder: "#C8A095",
  tan50: "#EFE6D3",
  tan700: "#9C7A3C",
  tanBorder: "#C6B088",
  sage50: "#DEE6D6",
  sage700: "#5C7A52",
  sageBorder: "#9DB094",

  // Cluster Subtype color scale (locked badge-consolidation colors, 2026-07-07 audit).
  dustyViolet50: "#E6E1EA",
  dustyViolet700: "#6B5B7E",
  dustyVioletBorder: "#A99EB4",
  mutedTeal50: "#DCE6E4",
  mutedTeal700: "#4E7A73",
  mutedTealBorder: "#95B0AC",
  dustyRose50: "#EAE0E1",
  dustyRose700: "#8A5560",
  dustyRoseBorder: "#BA9BA1",

  // Scenario Archetype color scale (locked badge-consolidation colors, 2026-07-09).
  // Closes the Archetype consistency gap — the last badge family still on fully
  // saturated colors after Signal Strength / Source Confidence / Subtype went muted.
  archContinuation50: "#E4E8D2",
  archContinuation700: "#6B7A3F",
  archContinuationBorder: "#A8B189",
  archCollapse50: "#EFDFDD",
  archCollapse700: "#9C4F44",
  archCollapseBorder: "#C69791",
  archConstraint50: "#E1E6EC",
  archConstraint700: "#52708C",
  archConstraintBorder: "#9AABBC",
  archTransformation50: "#E9DFE6",
  archTransformation700: "#86527D",
  archTransformationBorder: "#B899B2",
};

// Font-family tokens — not in c{} (color-only). Mirrors --font-heading /
// --font-body in the @theme block in index.css; keep both in sync.
export const fontHeading = "'Roboto', -apple-system, sans-serif";
export const fontBody = "'Open Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

export const inp = {
  width: "100%",
  padding: "9px 11px",
  border: `1px solid ${c.borderStrong}`,
  borderRadius: 8,
  background: c.white,
  color: c.ink,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

export const ta = { ...inp, resize: "none", lineHeight: 1.55 };

export const sel = { ...inp, appearance: "none" };

export const btnP = {
  padding: "10px 22px",
  borderRadius: 8,
  background: c.brand,
  color: c.white,
  border: "none",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

export const btnSm = {
  padding: "7px 16px",
  borderRadius: 7,
  background: c.brand,
  color: c.white,
  border: "none",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

export const btnSec = {
  padding: "9px 18px",
  borderRadius: 8,
  background: "transparent",
  color: c.muted,
  border: `1px solid ${c.borderStrong}`,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

export const btnG = {
  padding: "7px 12px",
  borderRadius: 7,
  background: "transparent",
  color: c.muted,
  border: "none",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

export const fl = {
  fontSize: 12,
  fontWeight: 500,
  color: c.ink,
  marginBottom: 5,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export const fh = {
  fontSize: 11,
  color: c.hint,
  marginBottom: 6,
  fontStyle: "italic",
  lineHeight: 1.45,
};

export const badg = {
  fontSize: 10,
  padding: "1px 6px",
  borderRadius: 4,
  background: "#f9f9f7",
  color: c.faint,
};

// Count-badge shape family (locked, 2026-07-08 badge-consolidation audit). Two
// specs, chosen by embedding context rather than "is this a counter":
// - countBadge: a numeral sitting next to text (sidebar nav counts, section-header
//   totals) — same shape as the canonical content-badge spec from Phase 3.
// - tabCount: a numeral inside a clickable filter tab, constrained by the tab's
//   own chrome — deliberately tighter, not meant to converge with countBadge.
export const countBadge = {
  fontSize: 10,
  padding: "2px 7px",
  borderRadius: 10,
};

export const tabCount = {
  fontSize: 10,
  padding: "0 4px",
  borderRadius: 6,
};

// Form-level "* required" caption — paired with a bare asterisk next to the
// one required field (Title/Name) on entity creation/edit forms.
export const legend = {
  fontSize: 11,
  color: c.hint,
  marginTop: 4,
};

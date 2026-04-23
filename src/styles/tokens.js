/** Design tokens and shared style primitives for Future Signals v2. */

export const c = {
  bg: "#f5f4f0",
  white: "#ffffff",
  ink: "#111111",
  muted: "#666666",
  faint: "#717171",
  hint: "#6B6860",
  border: "rgba(0,0,0,0.09)",
  borderMid: "rgba(0,0,0,0.18)",
  surfaceAlt: "#f9f9f7",
  fieldBg: "#fafaf8",
  canvas: "#f7f6f2",
  brand: "#3B82F6",
  green50: "#EAF3DE",
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
};

export const inp = {
  width: "100%",
  padding: "9px 11px",
  border: `1px solid ${c.borderMid}`,
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
  border: `1px solid ${c.borderMid}`,
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

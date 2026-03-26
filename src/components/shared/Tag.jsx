/**
 * Tag and semantic tag variants used throughout the app.
 * Exports: Tag, StrengthDot, HorizTag, ArchTag, SubtypeTag
 */
import { c } from "../../styles/tokens.js";

/** @param {{ label: string, color: string, bg: string, border: string }} props */
export function Tag({ label, color, bg, border }) {
  return (
    <span style={{
      fontSize: 10,
      padding: "2px 7px",
      borderRadius: 10,
      background: bg,
      color,
      border: `1px solid ${border}`,
      display: "inline-flex",
      alignItems: "center",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

/** @param {{ str: string }} props — str is 'Weak' | 'Moderate' | 'High' */
export function StrengthDot({ str }) {
  const map = {
    High: [c.green700, c.green50, c.greenBorder],
    Moderate: [c.amber700, c.amber50, c.amberBorder],
    Weak: [c.red800, c.red50, c.redBorder],
  };
  const [col, bg, brd] = map[str] || [c.hint, "transparent", c.border];
  return <Tag label={str} color={col} bg={bg} border={brd} />;
}

/** @param {{ h: string }} props — h is 'H1' | 'H2' | 'H3' */
export function HorizTag({ h }) {
  const map = {
    H1: [c.green700, c.green50, c.greenBorder],
    H2: [c.blue700, c.blue50, c.blueBorder],
    H3: [c.amber700, c.amber50, c.amberBorder],
  };
  const [col, bg, brd] = map[h] || [c.hint, "transparent", c.border];
  return <Tag label={h} color={col} bg={bg} border={brd} />;
}

/** @param {{ arch: string }} props — arch is 'Continuation' | 'Collapse' | 'Constraint' | 'Transformation' */
export function ArchTag({ arch }) {
  const map = {
    Continuation: [c.green700, c.green50, c.greenBorder],
    Collapse: [c.red800, c.red50, c.redBorder],
    Constraint: [c.blue700, c.blue50, c.blueBorder],
    Transformation: [c.amber700, c.amber50, c.amberBorder],
  };
  const [col, bg, brd] = map[arch] || [c.hint, "transparent", c.border];
  return <Tag label={arch} color={col} bg={bg} border={brd} />;
}

/** @param {{ sub: string }} props — sub is 'Trend' | 'Driver' | 'Tension' */
export function SubtypeTag({ sub }) {
  const map = {
    Trend: [c.violet700, c.violet50, c.violetBorder],
    Driver: [c.cyan700, c.cyan50, c.cyanBorder],
    Tension: [c.amber700, c.amber50, c.amberBorder],
  };
  const [col, bg, brd] = map[sub] || [c.hint, "transparent", c.border];
  return <Tag label={sub} color={col} bg={bg} border={brd} />;
}

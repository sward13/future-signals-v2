/**
 * Tag and semantic tag variants used throughout the app.
 * Exports: Tag, StrengthDot, HorizTag, ArchTag, SubtypeTag, ConfidenceBadge
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

// Shared tier colors for Signal Strength and Source Confidence — both are three-tier
// scales (weak/moderate/strong, low/medium/high) that map onto the same color slots.
const TIER_COLORS = {
  weak: [c.rust700, c.rust50, c.rustBorder],
  moderate: [c.tan700, c.tan50, c.tanBorder],
  strong: [c.sage700, c.sage50, c.sageBorder],
};

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** @param {{ str: string }} props — str is signal_strength: 'weak' | 'moderate' | 'strong' */
export function StrengthDot({ str }) {
  const key = str?.toLowerCase();
  const [col, bg, brd] = TIER_COLORS[key] || [c.hint, "transparent", c.border];
  return <Tag label={str ? capitalize(str) : str} color={col} bg={bg} border={brd} />;
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
    Continuation: [c.archContinuation700, c.archContinuation50, c.archContinuationBorder],
    Collapse: [c.archCollapse700, c.archCollapse50, c.archCollapseBorder],
    Constraint: [c.archConstraint700, c.archConstraint50, c.archConstraintBorder],
    Transformation: [c.archTransformation700, c.archTransformation50, c.archTransformationBorder],
  };
  const [col, bg, brd] = map[arch] || [c.hint, "transparent", c.border];
  return <Tag label={arch} color={col} bg={bg} border={brd} />;
}

/** @param {{ sub: string }} props — sub is 'Trend' | 'Driver' | 'Tension' */
export function SubtypeTag({ sub }) {
  const map = {
    Trend: [c.dustyViolet700, c.dustyViolet50, c.dustyVioletBorder],
    Driver: [c.mutedTeal700, c.mutedTeal50, c.mutedTealBorder],
    Tension: [c.dustyRose700, c.dustyRose50, c.dustyRoseBorder],
  };
  const [col, bg, brd] = map[sub] || [c.hint, "transparent", c.border];
  return <Tag label={sub} color={col} bg={bg} border={brd} />;
}

// Dedicated warm-neutral Likelihood ramp — deliberately distinct from the
// Horizon green/blue/amber family (see tokens.js). ClustersPanel.jsx still has
// its own local LikelihoodTag borrowing Horizon colors (a known, untouched
// inconsistency); this is the correct-token version for new call sites.
const LIKELIHOOD_MAP = {
  Possible: [c.likelihoodPossible700, c.likelihoodPossible50, c.likelihoodPossibleBorder],
  Plausible: [c.likelihoodPlausible700, c.likelihoodPlausible50, c.likelihoodPlausibleBorder],
  Probable: [c.likelihoodProbable700, c.likelihoodProbable50, c.likelihoodProbableBorder],
};

/** @param {{ l: string }} props — l is 'Possible' | 'Plausible' | 'Probable' */
export function LikelihoodTag({ l }) {
  const [col, bg, brd] = LIKELIHOOD_MAP[l] || [c.hint, "transparent", c.border];
  return <Tag label={l} color={col} bg={bg} border={brd} />;
}

// source_confidence tiers resolve onto Signal Strength's tier colors — one shared
// map, so a future color change never has to be made twice.
const CONFIDENCE_TO_TIER = { low: "weak", medium: "moderate", high: "strong" };

/** @param {{ conf: string }} props — conf is source_confidence: 'low' | 'medium' | 'high' */
export function ConfidenceBadge({ conf }) {
  if (!conf) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  const tier = CONFIDENCE_TO_TIER[conf.toLowerCase()];
  const [col, bg, brd] = TIER_COLORS[tier] || [c.hint, "transparent", c.border];
  return <Tag label={capitalize(conf)} color={col} bg={bg} border={brd} />;
}

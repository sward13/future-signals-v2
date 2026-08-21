/**
 * Web Publish — System Map section (static inline SVG, built server-side).
 *
 * Replaces the earlier renderSystemMapPlaceholder(). This is markup, not pixels:
 * no React Flow, no headless browser, no rasterization. It reconstructs a simple
 * node-link diagram from persisted rows and returns an inline SVG string, in the
 * same pure-function style as src/publish/sections.js.
 *
 * Expected row shapes are the DB (snake_case) shapes the publish pipeline reads
 * server-side — NOT the camelCase shapes useAppState exposes:
 *   canvasNodes:     [{ cluster_id, x, y }]              (canvas_nodes)
 *   canvasTextNodes: [{ text, x, y, font_family, font_size, bold, italic, color }]
 *   relationships:   [{ from_cluster_id, to_cluster_id, type,
 *                       source_handle, target_handle }]  (relationships)
 *   clusterLookup:   Map<cluster_id, clusterRow> from buildClusterLookup()
 *   mapBackground:   { assetUrl, opacity, positionX, positionY, scale } | null
 *                    — pre-resolved by server-lib/publish-project.js's
 *                    fetchMapBackground() (project_system_map_background joined
 *                    to system_map_templates, asset_url already a public URL).
 *                    See docs/system-map-background-templates-spec.md.
 *
 * Confirmed schema facts this relies on:
 *   - canvas_nodes persists ONLY cluster_id + x/y — no width/height. Node size
 *     is therefore fixed here (NODE_W matches the live canvas; height nominal).
 *   - x/y is the node's top-left (React Flow convention).
 *   - relationships.source_handle/target_handle are populated with 't'|'l'|'b'|'r'
 *     (top/left/bottom/right). Used for cheap side-anchoring; falls back to the
 *     node center when null.
 *   - A relationship can reference a cluster that has no canvas_nodes row (the
 *     canvas "×" removes only the node, not the cluster). Such edges are skipped.
 */

import { c } from "../styles/tokens.js";
import { esc } from "./sections.js";
import {
  resolveRelationship,
  resolveClusterName,
} from "../../server-lib/resolve-references.js";

// Fixed node box. Width matches the live canvas ClusterNode (NODE_W = 156);
// height is nominal since it isn't persisted.
const NODE_W = 156;
const NODE_H = 56;
const PAD = 48;

// Background template's base box, matching BACKGROUND_BASE_W/H in
// ScenarioCanvas.jsx's BackgroundTemplateNode — kept in sync by hand, same as
// REL_COLORS below vs. REL_TYPES in that file.
const BACKGROUND_BASE_W = 1400;
const BACKGROUND_BASE_H = 900;

const CH = {
  ink: "#17171A",
  muted: "#5B5A56",
  faint: "#9A988F",
  border: "#E0DED7",
  cardBorder: "rgba(0,0,0,0.09)", // c.border — the neutral ClusterNode card border
  canvasBg: "#F7F6F2", // c.canvas — the real System Map canvas background
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
};

const NEUTRAL = [CH.muted, "#F2F1ED", CH.border];

// Per-relationship-type stroke colors, matching REL_TYPES in ScenarioCanvas.jsx
// so published edges (and their arrowheads) read the same as the live canvas.
const REL_COLORS = {
  Drives: "#185FA5",
  Enables: "#3B6D11",
  Accelerates: "#0F766E",
  Inhibits: "#854F0B",
  Blocks: "#791F1F",
  "Feedback Loop": "#B45309",
  Displaces: "#4B1010",
};
const REL_DASH = { "Feedback Loop": true };
const DEFAULT_EDGE_COLOR = "#185FA5"; // custom/unknown types (matches the canvas default)

/** Cluster Type → confirmed subtype token colors [text, bg, border]. */
function subtypeColors(subtype) {
  const map = {
    Trend: [c.dustyViolet700, c.dustyViolet50, c.dustyVioletBorder],
    Driver: [c.mutedTeal700, c.mutedTeal50, c.mutedTealBorder],
    Tension: [c.dustyRose700, c.dustyRose50, c.dustyRoseBorder],
  };
  return map[subtype] || NEUTRAL;
}

/** Horizon → [text, bg, border] token colors, or null. */
function horizonColors(h) {
  const map = {
    H1: [c.green700, c.green50, c.greenBorder],
    H2: [c.blue700, c.blue50, c.blueBorder],
    H3: [c.amber700, c.amber50, c.amberBorder],
  };
  return map[h] || null;
}

const colorKey = (hex) => hex.replace("#", "").toLowerCase();
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const round = (v) => Math.round(v * 10) / 10;

/** A rounded pill badge (rect + centered text). Returns { svg, width }. */
function svgPill(x, y, text, [txtCol, bgCol, brdCol], { fontSize = 9.5, h = 14 } = {}) {
  const w = Math.ceil(text.length * fontSize * 0.62) + 12;
  const svg =
    `<rect x="${round(x)}" y="${round(y)}" width="${w}" height="${h}" rx="${round(h / 2)}" fill="${bgCol}" stroke="${brdCol}" stroke-width="1" />` +
    `<text x="${round(x + w / 2)}" y="${round(y + h / 2 + fontSize * 0.34)}" text-anchor="middle" font-family="${CH.sans}" font-size="${fontSize}" font-weight="500" fill="${txtCol}">${esc(text)}</text>`;
  return { svg, width: w };
}

/** Anchor point on a node box for a given React Flow handle id. */
function anchorPoint(x, y, handle) {
  switch (handle) {
    case "t": return { x: x + NODE_W / 2, y };
    case "b": return { x: x + NODE_W / 2, y: y + NODE_H };
    case "l": return { x, y: y + NODE_H / 2 };
    case "r": return { x: x + NODE_W, y: y + NODE_H / 2 };
    default:  return { x: x + NODE_W / 2, y: y + NODE_H / 2 }; // center
  }
}

// Cubic-bezier edge geometry, replicating @xyflow/system's getBezierPath so the
// published edges have the same directional S-curve as the live canvas.
// RelationshipEdgeComponent calls getBezierPath with no curvature → default 0.25.
const CURVATURE = 0.25;

function controlOffset(distance) {
  return distance >= 0 ? 0.5 * distance : CURVATURE * 25 * Math.sqrt(-distance);
}

/**
 * A cubic control point, offset outward from an endpoint along its connection
 * side (t/l/b/r) — React Flow's getControlWithCurvature. (x1,y1) is this
 * endpoint; (x2,y2) is the opposite one.
 */
function bezierControl(handle, x1, y1, x2, y2) {
  switch (handle) {
    case "l": return [x1 - controlOffset(x1 - x2), y1];
    case "r": return [x1 + controlOffset(x2 - x1), y1];
    case "t": return [x1, y1 - controlOffset(y1 - y2)];
    case "b": return [x1, y1 + controlOffset(y2 - y1)];
    default:  return [x1, y1];
  }
}

/** Naive word-wrap into at most maxLines lines of ~maxChars, last line ellipsized. */
function wrapLabel(text, maxChars = 24, maxLines = 2) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  // If content still remains (truncated), ellipsize the last line.
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    if (last.length > maxChars - 1) last = last.slice(0, maxChars - 1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.length ? lines : [""];
}

function renderNode(node, clusterLookup) {
  const x = num(node.x);
  const y = num(node.y);
  const cluster = clusterLookup instanceof Map ? clusterLookup.get(node.cluster_id) : undefined;
  const subtype = cluster?.subtype;
  const [subText, subBg, subBorder] = subtypeColors(subtype);
  const name = resolveClusterName(node.cluster_id, clusterLookup);

  // Badge row: pill Type badge + optional Horizon pill — mirrors ClusterNode.
  let badges = "";
  let bx = x + 12;
  if (subtype) {
    const pill = svgPill(bx, y + 8, subtype, [subText, subBg, subBorder]);
    badges += pill.svg;
    bx += pill.width + 4;
  }
  const hz = horizonColors(cluster?.horizon);
  if (hz) badges += svgPill(bx, y + 8, cluster.horizon, hz, { fontSize: 8.5, h: 13 }).svg;

  const lines = wrapLabel(name);
  const nameSpans = lines
    .map(
      (ln, i) =>
        `<tspan x="${round(x + 12)}" ${i === 0 ? `y="${round(y + 37)}"` : `dy="13"`}>${esc(ln)}</tspan>`
    )
    .join("");

  // White card + neutral border + subtype-keyed left accent bar (ClusterNode).
  return `<g>
      <rect x="${round(x)}" y="${round(y)}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="#FFFFFF" stroke="${CH.cardBorder}" stroke-width="1.5" />
      <rect x="${round(x + 1.5)}" y="${round(y + 2)}" width="3" height="${NODE_H - 4}" rx="1.5" fill="${subBorder}" />
      ${badges}
      <text font-family="${CH.sans}" font-size="11" font-weight="500" fill="${CH.ink}">${nameSpans}</text>
    </g>`;
}

/**
 * The background template layer — a single SVG <image>, painted before edges/
 * nodes/text so it sits behind everything, matching the live canvas's z-order
 * (see BackgroundTemplateNode in ScenarioCanvas.jsx). Returns "" when no
 * background is set.
 */
function renderBackground(mapBackground) {
  if (!mapBackground?.assetUrl) return "";
  const scale = num(mapBackground.scale, 1);
  const w = BACKGROUND_BASE_W * scale;
  const h = BACKGROUND_BASE_H * scale;
  const x = num(mapBackground.positionX);
  const y = num(mapBackground.positionY);
  const opacity = num(mapBackground.opacity, 0.35);
  return `<image href="${esc(mapBackground.assetUrl)}" x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" opacity="${opacity}" preserveAspectRatio="xMidYMid meet" />`;
}

function renderTextNode(tn) {
  if (!tn || typeof tn.text !== "string" || tn.text.trim() === "") return "";
  const x = num(tn.x);
  const size = num(tn.font_size, 16);
  const y = num(tn.y) + size; // x/y is top-left; SVG text y is the baseline
  const family = esc(tn.font_family || CH.sans);
  const fill = esc(tn.color || CH.ink);
  const weight = tn.bold ? "700" : "400";
  const style = tn.italic ? "italic" : "normal";
  return `<text x="${round(x)}" y="${round(y)}" font-family="${family}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${fill}">${esc(tn.text)}</text>`;
}

function renderEdge(rel, placed, clusterLookup, usedColors) {
  const from = placed.get(rel.from_cluster_id);
  const to = placed.get(rel.to_cluster_id);
  if (!from || !to) return ""; // unplaced cluster → skip gracefully

  const a = anchorPoint(from.x, from.y, rel.source_handle);
  const b = anchorPoint(to.x, to.y, rel.target_handle);

  // Cubic bezier with two directional control points (React Flow's getBezierPath):
  // each control point offsets outward along its handle side, producing the same
  // flowing S-curve as the live canvas. Null handles fall back to Bottom/Top,
  // React Flow's own source/target defaults.
  const [c1x, c1y] = bezierControl(rel.source_handle || "b", a.x, a.y, b.x, b.y);
  const [c2x, c2y] = bezierControl(rel.target_handle || "t", b.x, b.y, a.x, a.y);

  // Label at the cubic t=0.5 point (React Flow's getBezierEdgeCenter).
  const lx = a.x * 0.125 + c1x * 0.375 + c2x * 0.375 + b.x * 0.125;
  const ly = a.y * 0.125 + c1y * 0.375 + c2y * 0.375 + b.y * 0.125;

  const { type, sentence } = resolveRelationship(rel, clusterLookup);
  const color = REL_COLORS[type] || DEFAULT_EDGE_COLOR;
  const dash = REL_DASH[type] ? ` stroke-dasharray="6,4"` : "";
  if (usedColors) usedColors.add(color);

  // Type label on a white rounded pill (bare text is illegible over a line),
  // matching the live canvas edge label; text in the edge's own color.
  let label = "";
  if (type) {
    const w = Math.ceil(type.length * 6) + 12;
    const h = 16;
    label =
      `<rect x="${round(lx - w / 2)}" y="${round(ly - h / 2)}" width="${w}" height="${h}" rx="3" fill="#FFFFFF" stroke="rgba(0,0,0,0.09)" stroke-width="0.5" />` +
      `<text x="${round(lx)}" y="${round(ly + 3.5)}" text-anchor="middle" font-family="${CH.sans}" font-size="10" font-weight="500" fill="${color}">${esc(type)}</text>`;
  }

  return `<g>
      <title>${esc(sentence)}</title>
      <path d="M${round(a.x)},${round(a.y)} C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(b.x)},${round(b.y)}" fill="none" stroke="${color}" stroke-width="2"${dash} marker-end="url(#arrow-${colorKey(color)})" />
      ${label}
    </g>`;
}

/**
 * Build the System Map section as an inline SVG string.
 * Returns "" when nothing is placed on the canvas AND no background is set
 * (an empty map with a background chosen still renders, showing the scaffold).
 */
export function renderSystemMap(canvasNodes, canvasTextNodes, relationships, clusterLookup, mapBackground) {
  const nodes = Array.isArray(canvasNodes) ? canvasNodes.filter((n) => n && n.cluster_id) : [];
  const textNodes = Array.isArray(canvasTextNodes) ? canvasTextNodes : [];
  const rels = Array.isArray(relationships) ? relationships : [];
  const hasBackground = Boolean(mapBackground?.assetUrl);

  if (nodes.length === 0 && textNodes.length === 0 && !hasBackground) return "";

  // Placed clusters, keyed by cluster_id — the source of truth for edge routing.
  const placed = new Map();
  for (const n of nodes) placed.set(n.cluster_id, { x: num(n.x), y: num(n.y) });

  const usedColors = new Set();
  // Background paints first (bottom), matching the live canvas's z-order.
  const backgroundSvg = renderBackground(mapBackground);
  const edgeSvg = rels.map((r) => renderEdge(r, placed, clusterLookup, usedColors)).join("");
  const nodeSvg = nodes.map((n) => renderNode(n, clusterLookup)).join("");
  const textSvg = textNodes.map(renderTextNode).join("");

  // Bounding box over everything drawn, including the background's own box —
  // matches PNG export, where the background is a real canvas node and
  // therefore always included in the exported frame (see the Pass 1 audit's
  // "Canvas rendering" finding: this is intentional, not incidental).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const extend = (x0, y0, x1, y1) => {
    minX = Math.min(minX, x0); minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1);
  };
  for (const n of nodes) extend(num(n.x), num(n.y), num(n.x) + NODE_W, num(n.y) + NODE_H);
  for (const tn of textNodes) {
    const size = num(tn.font_size, 16);
    const w = String(tn.text || "").length * size * 0.6;
    extend(num(tn.x), num(tn.y), num(tn.x) + w, num(tn.y) + size * 1.4);
  }
  if (hasBackground) {
    const scale = num(mapBackground.scale, 1);
    const bx = num(mapBackground.positionX);
    const by = num(mapBackground.positionY);
    extend(bx, by, bx + BACKGROUND_BASE_W * scale, by + BACKGROUND_BASE_H * scale);
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = NODE_W; maxY = NODE_H; }

  const vbX = round(minX - PAD);
  const vbY = round(minY - PAD);
  const vbW = round(maxX - minX + PAD * 2);
  const vbH = round(maxY - minY + PAD * 2);

  // One arrowhead marker per edge color actually used.
  const markers = [...usedColors]
    .map(
      (color) =>
        `<marker id="arrow-${colorKey(color)}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3 L0,6 Z" fill="${color}" /></marker>`
    )
    .join("");

  const svg = `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="width:100%; max-width:${vbW}px; height:auto; display:block; margin:0 auto;" role="img" aria-label="System map of ${nodes.length} clusters and their relationships">
      <defs>${markers}</defs>
      ${backgroundSvg}
      ${edgeSvg}
      ${nodeSvg}
      ${textSvg}
    </svg>`;

  // Section sits on the canvas background (#F7F6F2) so the white node cards and
  // white edge-label pills read as distinct surfaces instead of vanishing.
  return `<div style="padding:24px 32px 56px; border-bottom:1px solid ${CH.border}; background:${CH.canvasBg};">
      <p style="font-size:11px; letter-spacing:0.1em; color:${CH.faint}; text-transform:uppercase; text-align:center; margin:0 0 28px;">System map</p>
      ${svg}
    </div>`;
}

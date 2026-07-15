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

const CH = {
  ink: "#17171A",
  muted: "#5B5A56",
  faint: "#9A988F",
  border: "#E0DED7",
  edge: "#8C877F",
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
};

const NEUTRAL = [CH.muted, "#F2F1ED", CH.border];

/** Cluster Type → confirmed subtype token colors [text, bg, border]. */
function subtypeColors(subtype) {
  const map = {
    Trend: [c.dustyViolet700, c.dustyViolet50, c.dustyVioletBorder],
    Driver: [c.mutedTeal700, c.mutedTeal50, c.mutedTealBorder],
    Tension: [c.dustyRose700, c.dustyRose50, c.dustyRoseBorder],
  };
  return map[subtype] || NEUTRAL;
}

const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const round = (v) => Math.round(v * 10) / 10;

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
  const [text, bg, border] = subtypeColors(cluster?.subtype);
  const name = resolveClusterName(node.cluster_id, clusterLookup);
  const subtype = cluster?.subtype;

  const label = subtype
    ? `<text x="${round(x + 11)}" y="${round(y + 16)}" font-family="${CH.sans}" font-size="8.5" font-weight="600" letter-spacing="0.06em" fill="${text}">${esc(subtype.toUpperCase())}</text>`
    : "";

  const lines = wrapLabel(name);
  const nameSpans = lines
    .map(
      (ln, i) =>
        `<tspan x="${round(x + 11)}" ${i === 0 ? `y="${round(y + 33)}"` : `dy="13"`}>${esc(ln)}</tspan>`
    )
    .join("");

  return `<g>
      <rect x="${round(x)}" y="${round(y)}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="${bg}" stroke="${border}" stroke-width="1.5" />
      <rect x="${round(x)}" y="${round(y + 8)}" width="3" height="${NODE_H - 16}" rx="1.5" fill="${text}" />
      ${label}
      <text font-family="${CH.sans}" font-size="11" font-weight="500" fill="${CH.ink}">${nameSpans}</text>
    </g>`;
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

function renderEdge(rel, placed, clusterLookup) {
  const from = placed.get(rel.from_cluster_id);
  const to = placed.get(rel.to_cluster_id);
  if (!from || !to) return ""; // unplaced cluster → skip gracefully

  const a = anchorPoint(from.x, from.y, rel.source_handle);
  const b = anchorPoint(to.x, to.y, rel.target_handle);

  // Gentle curve: quadratic control offset perpendicular to the chord.
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.min(36, len * 0.12);
  const cx = mx - (dy / len) * off;
  const cy = my + (dx / len) * off;

  // Label at the bezier midpoint (t = 0.5).
  const lx = 0.25 * a.x + 0.5 * cx + 0.25 * b.x;
  const ly = 0.25 * a.y + 0.5 * cy + 0.25 * b.y;

  const { type, sentence } = resolveRelationship(rel, clusterLookup);
  const labelText = type ? esc(type) : "";
  const label = labelText
    ? `<text x="${round(lx)}" y="${round(ly)}" text-anchor="middle" font-family="${CH.sans}" font-size="10" font-weight="600" fill="${CH.muted}" style="paint-order:stroke; stroke:#FFFFFF; stroke-width:3px; stroke-linejoin:round;">${labelText}</text>`
    : "";

  return `<g>
      <title>${esc(sentence)}</title>
      <path d="M${round(a.x)},${round(a.y)} Q${round(cx)},${round(cy)} ${round(b.x)},${round(b.y)}" fill="none" stroke="${CH.edge}" stroke-width="1.5" marker-end="url(#fs-map-arrow)" />
      ${label}
    </g>`;
}

/**
 * Build the System Map section as an inline SVG string.
 * Returns "" when nothing is placed on the canvas (empty map).
 */
export function renderSystemMap(canvasNodes, canvasTextNodes, relationships, clusterLookup) {
  const nodes = Array.isArray(canvasNodes) ? canvasNodes.filter((n) => n && n.cluster_id) : [];
  const textNodes = Array.isArray(canvasTextNodes) ? canvasTextNodes : [];
  const rels = Array.isArray(relationships) ? relationships : [];

  if (nodes.length === 0 && textNodes.length === 0) return "";

  // Placed clusters, keyed by cluster_id — the source of truth for edge routing.
  const placed = new Map();
  for (const n of nodes) placed.set(n.cluster_id, { x: num(n.x), y: num(n.y) });

  const edgeSvg = rels.map((r) => renderEdge(r, placed, clusterLookup)).join("");
  const nodeSvg = nodes.map((n) => renderNode(n, clusterLookup)).join("");
  const textSvg = textNodes.map(renderTextNode).join("");

  // Bounding box over everything drawn.
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
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = NODE_W; maxY = NODE_H; }

  const vbX = round(minX - PAD);
  const vbY = round(minY - PAD);
  const vbW = round(maxX - minX + PAD * 2);
  const vbH = round(maxY - minY + PAD * 2);

  const svg = `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="width:100%; max-width:${vbW}px; height:auto; display:block; margin:0 auto;" role="img" aria-label="System map of ${nodes.length} clusters and their relationships">
      <defs>
        <marker id="fs-map-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L7,3 L0,6 Z" fill="${CH.edge}" />
        </marker>
      </defs>
      ${edgeSvg}
      ${nodeSvg}
      ${textSvg}
    </svg>`;

  return `<div style="padding:24px 32px 56px; border-bottom:1px solid ${CH.border};">
      <p style="font-size:11px; letter-spacing:0.1em; color:${CH.faint}; text-transform:uppercase; text-align:center; margin:0 0 28px;">System map</p>
      ${svg}
    </div>`;
}

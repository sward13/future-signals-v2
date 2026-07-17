import { test } from "node:test";
import assert from "node:assert/strict";

import { c } from "../styles/tokens.js";
import { buildClusterLookup } from "../../server-lib/resolve-references.js";
import { renderSystemMap } from "./systemMap.js";

// ─── Fixtures (DB / snake_case shapes, as the pipeline reads them) ──────────────

const clusters = [
  { id: "c1", name: "Pharmaceutical innovation is expanding treatment horizons", subtype: "Trend" },
  { id: "c2", name: "Societal values shift toward longevity", subtype: "Driver" },
  { id: "c3", name: "Pharma competition escalating", subtype: "Tension" },
];
const clusterLookup = buildClusterLookup(clusters);

const canvasNodes = [
  { cluster_id: "c1", x: 300, y: 240 },
  { cluster_id: "c2", x: 40, y: 60 },
  { cluster_id: "c3", x: 560, y: 60 },
];

const relationships = [
  { from_cluster_id: "c2", to_cluster_id: "c1", type: "Drives", source_handle: "b", target_handle: "t" },
  { from_cluster_id: "c3", to_cluster_id: "c1", type: "Inhibits", source_handle: "l", target_handle: "r" },
];

function assertClean(html) {
  assert.equal(typeof html, "string");
  assert.doesNotMatch(html, /undefined/);
  assert.doesNotMatch(html, /NaN/);
  assert.doesNotMatch(html, /\[object Object\]/);
}

/** Count non-overlapping occurrences of a substring. */
const count = (s, sub) => s.split(sub).length - 1;

// ─── Normal map ────────────────────────────────────────────────────────────────

test("renders a node per cluster, an edge per relationship, and resolved labels", () => {
  const html = renderSystemMap(canvasNodes, [], relationships, clusterLookup);
  assertClean(html);

  assert.match(html, /<svg/);
  assert.match(html, /System map/);
  // per-edge-color arrowhead markers (Drives #185FA5, Inhibits #854F0B)
  assert.match(html, /id="arrow-185fa5"/);
  assert.match(html, /id="arrow-854f0b"/);
  assert.equal(count(html, "marker-end="), 2); // one per relationship

  // node names present (wrapping splits long names across tspans, so match a fragment)
  assert.match(html, /Societal values/);
  assert.match(html, /Pharma competition/);

  // nodes are white cards with a subtype-keyed Type pill (not a tinted-box fill)
  assert.match(html, /fill="#FFFFFF"/); // white card
  assert.match(html, />Trend</);
  assert.match(html, />Driver</);
  assert.match(html, />Tension</);
  assert.match(html, new RegExp(c.dustyViolet50.replace("#", ""))); // Trend pill bg
  assert.match(html, new RegExp(c.dustyVioletBorder.replace("#", ""))); // Trend accent bar

  // edges are colored per relationship type, stroke + label text alike
  assert.match(html, /stroke="#185FA5"/); // Drives
  assert.match(html, /stroke="#854F0B"/); // Inhibits
  assert.match(html, /fill="#185FA5">Drives</); // label text in the edge color
  assert.match(html, /fill="#854F0B">Inhibits</);
  // full sentence used as the accessible <title>
  assert.match(html, /<title>Societal values shift toward longevity drives Pharmaceutical innovation is expanding treatment horizons<\/title>/);

  // section sits on the canvas background so white cards/labels contrast
  assert.match(html, /background:#F7F6F2/);
});

test("edge labels sit on a white pill so they stay legible over lines", () => {
  const html = renderSystemMap(canvasNodes, [], relationships, clusterLookup);
  // a white rounded rect precedes each label's text
  assert.match(html, /<rect[^>]*fill="#FFFFFF"[^>]*\/>\s*<text[^>]*>Drives</);
});

test("a feedback-loop edge is dashed", () => {
  const rels = [{ from_cluster_id: "c2", to_cluster_id: "c1", type: "Feedback Loop", source_handle: "b", target_handle: "t" }];
  const html = renderSystemMap(canvasNodes, [], rels, clusterLookup);
  assert.match(html, /stroke="#B45309"[^>]*stroke-dasharray="6,4"/);
});

/** Parse the first edge path's endpoints + cubic control points. */
function parsePath(html) {
  const m = html.match(
    /d="M([-\d.]+),([-\d.]+) C([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)"/
  );
  if (!m) return null;
  const n = m.slice(1).map(Number);
  return { mx: n[0], my: n[1], c1x: n[2], c1y: n[3], c2x: n[4], c2y: n[5], tx: n[6], ty: n[7] };
}

test("draws a cubic bezier (C) with directional control points matching getBezierPath, not a quadratic (Q)", () => {
  // c2(40,60) bottom → c1(300,240) top. Anchors: (118,116) and (378,240).
  // Control offset (dist 124 ≥ 0) = 62 → controls (118,178) and (378,178).
  const html = renderSystemMap(canvasNodes, [], [relationships[0]], clusterLookup);
  assert.match(html, /d="M118,116 C118,178 378,178 378,240"/);
  assert.doesNotMatch(html, /\bQ[-\d]/); // no quadratic curve anywhere
});

test("falls back to node center when handles are null", () => {
  const rels = [{ from_cluster_id: "c2", to_cluster_id: "c1", type: "Drives", source_handle: null, target_handle: null }];
  const html = renderSystemMap(canvasNodes, [], rels, clusterLookup);
  assertClean(html);
  // c2 center = (40 + 78, 60 + 28) = (118, 88)
  assert.match(html, /M118,88/);
});

test("control point offsets in the correct direction for each handle side (t/l/b/r)", () => {
  const clusters2 = [
    { id: "src", name: "Source", subtype: "Trend" },
    { id: "dst", name: "Dest", subtype: "Driver" },
  ];
  const lookup2 = buildClusterLookup(clusters2);
  const nodes2 = [
    { cluster_id: "src", x: 0, y: 0 },       // W156 H56
    { cluster_id: "dst", x: 400, y: 400 },
  ];
  const near = (a, b) => Math.abs(a - b) < 0.01;

  const cases = {
    r: (p) => p.c1x > p.mx && near(p.c1y, p.my), // offsets further right, y unchanged
    l: (p) => p.c1x < p.mx && near(p.c1y, p.my), // further left
    t: (p) => p.c1y < p.my && near(p.c1x, p.mx), // further up
    b: (p) => p.c1y > p.my && near(p.c1x, p.mx), // further down
  };

  for (const [handle, ok] of Object.entries(cases)) {
    const rels = [{ from_cluster_id: "src", to_cluster_id: "dst", type: "Drives", source_handle: handle, target_handle: "l" }];
    const p = parsePath(renderSystemMap(nodes2, [], rels, lookup2));
    assert.ok(p, `handle ${handle}: expected a cubic path`);
    assert.ok(ok(p), `handle ${handle}: control point offset in wrong direction (anchor ${p.mx},${p.my} → control ${p.c1x},${p.c1y})`);
  }
});

// ─── Empty map ───────────────────────────────────────────────────────────────

test("returns empty string when nothing is placed on the canvas", () => {
  assert.equal(renderSystemMap([], [], [], clusterLookup), "");
  assert.equal(renderSystemMap(undefined, undefined, undefined, clusterLookup), "");
});

// ─── Relationship to an unplaced cluster ───────────────────────────────────────

test("skips an edge whose cluster has no canvas node, without throwing", () => {
  const rels = [
    ...relationships,
    { from_cluster_id: "c1", to_cluster_id: "ghost", type: "Drives", source_handle: "r", target_handle: "l" },
  ];
  let html;
  assert.doesNotThrow(() => {
    html = renderSystemMap(canvasNodes, [], rels, clusterLookup);
  });
  assertClean(html);
  // still only the two routable edges are drawn, not three
  assert.equal(count(html, "marker-end="), 2);
});

test("draws nodes but no edges when a placed cluster has no relationships", () => {
  const html = renderSystemMap([{ cluster_id: "c1", x: 100, y: 100 }], [], [], clusterLookup);
  assertClean(html);
  assert.match(html, /<svg/);
  assert.equal(count(html, "marker-end="), 0);
  assert.match(html, /Pharmaceutical/); // long name wraps across tspans
});

// ─── Text nodes ──────────────────────────────────────────────────────────────

test("renders canvas text nodes with their persisted styling, escaping content", () => {
  const textNodes = [
    { text: "innovation timeline <x>", x: 200, y: 400, font_family: "Georgia, serif", font_size: 14, bold: true, italic: true, color: "#9A988F" },
  ];
  const html = renderSystemMap(canvasNodes, textNodes, [], clusterLookup);
  assertClean(html);
  assert.match(html, /innovation timeline &lt;x&gt;/);
  assert.match(html, /font-weight="700"/);
  assert.match(html, /font-style="italic"/);
  assert.match(html, /fill="#9A988F"/);
});

test("skips empty text nodes", () => {
  const html = renderSystemMap([{ cluster_id: "c1", x: 0, y: 0 }], [{ text: "   ", x: 10, y: 10, font_size: 12 }], [], clusterLookup);
  assertClean(html);
  assert.doesNotMatch(html, /<text[^>]*><\/text>/);
});

// ─── Deleted cluster referenced by a placed node ───────────────────────────────

test("a placed node whose cluster was deleted degrades to a fallback label", () => {
  const html = renderSystemMap([{ cluster_id: "gone", x: 0, y: 0 }], [], [], clusterLookup);
  assertClean(html);
  assert.match(html, /\[deleted cluster\]/);
});

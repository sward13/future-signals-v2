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
  assert.match(html, /id="fs-map-arrow"/); // arrowhead marker defined once
  assert.equal(count(html, "marker-end="), 2); // one per relationship

  // node names present (wrapping splits long names across tspans, so match a fragment)
  assert.match(html, /Societal values/);
  assert.match(html, /Pharma competition/);

  // subtype coloring uses confirmed tokens (labels + Trend/Driver/Tension fills)
  assert.match(html, /TREND/);
  assert.match(html, /DRIVER/);
  assert.match(html, /TENSION/);
  assert.match(html, new RegExp(c.dustyViolet50.replace("#", ""))); // Trend fill
  assert.match(html, new RegExp(c.mutedTeal50.replace("#", ""))); // Driver fill
  assert.match(html, new RegExp(c.dustyRose50.replace("#", ""))); // Tension fill

  // edge label text comes from resolveRelationship().type
  assert.match(html, />Drives</);
  assert.match(html, />Inhibits</);
  // full sentence used as the accessible <title>
  assert.match(html, /<title>Societal values shift toward longevity drives Pharmaceutical innovation is expanding treatment horizons<\/title>/);
});

test("uses handle-based side anchoring when handles are present", () => {
  // c2 bottom handle → (40 + 156/2, 60 + 56) = (118, 116); path should start there
  const html = renderSystemMap(canvasNodes, [], [relationships[0]], clusterLookup);
  assert.match(html, /M118,116/);
});

test("falls back to node center when handles are null", () => {
  const rels = [{ from_cluster_id: "c2", to_cluster_id: "c1", type: "Drives", source_handle: null, target_handle: null }];
  const html = renderSystemMap(canvasNodes, [], rels, clusterLookup);
  assertClean(html);
  // c2 center = (40 + 78, 60 + 28) = (118, 88)
  assert.match(html, /M118,88/);
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

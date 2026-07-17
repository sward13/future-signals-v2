import { test } from "node:test";
import assert from "node:assert/strict";

import { c } from "../styles/tokens.js";
import {
  buildClusterLookup,
  buildScenarioLookup,
} from "../../server-lib/resolve-references.js";
import {
  esc,
  renderHero,
  renderOverview,
  renderTimeHorizons,
  renderSystemAnalysis,
  renderScenario,
  renderPreferredFuture,
  renderStrategicOption,
  renderAppendix,
} from "./sections.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const project = {
  name: "The state of GLP-1s",
  question: "How might GLP-1 accessibility reshape longevity strategy through 2035?",
  domain: "Health & Life Sciences",
  geo: "United States",
  focus: "Access and affordability",
  audience: "Payers, health systems",
  stakeholders: "Patients, providers, insurers",
  assumptions: "Demand keeps growing through 2030",
  h1_start: "2026", h1_end: "2029",
  h2_start: "2029", h2_end: "2035",
  h3_start: "2035", h3_end: "2041",
};

const clusters = [
  { id: "c1", name: "Societal values shift toward longevity", subtype: "Trend", horizon: "H1", likelihood: "Plausible", description: "A cultural commitment to lifespan.", input_ids: ["i1", "i2"] },
  { id: "c2", name: "Pharma competition escalating", subtype: "Tension", horizon: "H1", likelihood: "Probable", description: "Manufacturers racing.", input_ids: ["i3"] },
];

const inputs = [
  { id: "i1", name: "Longevity clinics see growth", subtype: "Signal", signal_strength: "Moderate", source_confidence: "High", horizon: "H1", source_url: "https://www.longevity.technology/report" },
  { id: "i2", name: "Wellness reframes around metabolic health", subtype: "Issue", signal_strength: "Weak", source_confidence: "Medium", horizon: "H2", source_url: "https://www.mckinsey.com" },
  { id: "i3", name: "Three makers file next-gen GLP-1s", subtype: "Signal", signal_strength: "Strong", source_confidence: "High", horizon: "H1", source_url: "https://endpts.com" },
];

const scenarios = [
  { id: "s1", name: "Longevity for those who can pay", archetype: "Continuation", horizon: "H2", description: "Access concentrates among those able to pay.", narrative: "A widening gap.", driving_forces: ["c1", "c2"] },
];

const clusterLookup = buildClusterLookup(clusters);
const scenarioLookup = buildScenarioLookup(scenarios);

const analysis = {
  description: "Pharmaceutical innovation sits at the center.",
  key_dynamics: "Demand growth outpaces coverage policy.",
  critical_uncertainties: ["Whether payers move first", "How fast generics compress cost"],
  implications: "Early movers shape the norm.",
  confidence: "Moderate",
};

const preferredFuture = {
  name: "Equitable longevity access by 2035",
  description: "Protocols covered broadly within a decade.",
  desired_outcomes: "Benefits reach beyond the top bracket.",
  guiding_principles: ["Access should not lag innovation by more than one cycle"],
  scenario_ids: ["s1"],
};

const strategicOption = {
  name: "Partner with payers on tiered coverage",
  description: "Negotiate tiered pilots ahead of generic entry.",
  intended_outcome: "Widen access early.",
  actions: "Run regional pilots.",
  implications: "Reduces the access gap.",
  feasibility: "Moderate",
  resource_intensity: "High",
  reversibility: "Low",
  scenario_ids: ["s1"],
};

// ─── Shared assertions ───────────────────────────────────────────────────────

/** Every template must return a string that never leaks the literal "undefined". */
function assertClean(html) {
  assert.equal(typeof html, "string");
  assert.doesNotMatch(html, /undefined/);
  assert.doesNotMatch(html, /\bnull\b/);
  assert.doesNotMatch(html, /\[object Object\]/);
}

// ─── esc ─────────────────────────────────────────────────────────────────────

test("esc neutralizes HTML metacharacters", () => {
  assert.equal(esc(`<script>"x"&'y'`), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
});

// ─── Hero ────────────────────────────────────────────────────────────────────

test("renderHero: normal produces non-empty HTML with the project name", () => {
  const html = renderHero(project, { publishedAt: "2026-07-15" });
  assertClean(html);
  assert.match(html, /The state of GLP-1s/);
  assert.match(html, /A Future Signals project/);
  assert.match(html, /Published July 2026/);
});

test("renderHero: degrades when name and date are missing", () => {
  const html = renderHero({});
  assertClean(html);
  assert.match(html, /Untitled project/);
  assert.doesNotMatch(html, /Published/);
});

test("renderHero: escapes a name containing markup", () => {
  const html = renderHero({ name: "A <b>bold</b> future & more" });
  assertClean(html);
  assert.match(html, /A &lt;b&gt;bold&lt;\/b&gt; future &amp; more/);
});

// ─── Overview ────────────────────────────────────────────────────────────────

test("renderOverview: normal renders question, all meta fields, and horizons", () => {
  const html = renderOverview(project);
  assertClean(html);
  assert.match(html, /Key question/);
  assert.match(html, /Health &amp; Life Sciences/);
  assert.match(html, /Geography/);
  assert.match(html, /United States/);
  assert.match(html, />H1</);
  assert.match(html, /2026&ndash;2029/);
});

test("renderOverview: degrades with only a name (no question, meta, or horizons)", () => {
  const html = renderOverview({ name: "Bare project" });
  assertClean(html);
  assert.doesNotMatch(html, /Key question/);
  assert.doesNotMatch(html, /Geography/);
  assert.doesNotMatch(html, /Time horizons/);
});

// ─── Time horizons ───────────────────────────────────────────────────────────

test("renderTimeHorizons: widths are proportional to the real date spans", () => {
  const html = renderTimeHorizons(project);
  assertClean(html);
  // span 2026..2041 = 15y; H1 = 3/15 = 20%, H2 = 6/15 = 40%, H3 = 40%
  assert.match(html, /width:20%/);
  assert.match(html, /width:40%/);
});

test("renderTimeHorizons: returns empty string when horizons are not configured", () => {
  assert.equal(renderTimeHorizons({}), "");
  assert.equal(renderTimeHorizons({ h1_start: "" }), "");
});

// ─── System Analysis ─────────────────────────────────────────────────────────

test("renderSystemAnalysis: normal renders every field including a confidence badge", () => {
  const html = renderSystemAnalysis(analysis);
  assertClean(html);
  assert.match(html, /System analysis/);
  assert.match(html, /Key dynamics/);
  assert.match(html, /Critical uncertainties/);
  assert.match(html, /Whether payers move first/);
  assert.match(html, /Confidence: Moderate/);
});

test("renderSystemAnalysis: returns empty string when analysis is absent or empty", () => {
  assert.equal(renderSystemAnalysis(null), "");
  assert.equal(renderSystemAnalysis(undefined), "");
  assert.equal(renderSystemAnalysis({ critical_uncertainties: [] }), "");
});

test("renderSystemAnalysis: renders partial content without crashing", () => {
  const html = renderSystemAnalysis({ description: "Only a description." });
  assertClean(html);
  assert.match(html, /Only a description/);
  assert.doesNotMatch(html, /Key dynamics/);
});

// ─── Scenario ────────────────────────────────────────────────────────────────

test("renderScenario: resolves driving forces to cluster names, not ids", () => {
  const html = renderScenario(scenarios[0], clusterLookup);
  assertClean(html);
  assert.match(html, /Longevity for those who can pay/);
  assert.match(html, /Archetype: Continuation/);
  assert.match(html, /Informed by: Societal values shift toward longevity, Pharma competition escalating/);
  assert.doesNotMatch(html, /\bc1\b|\bc2\b/);
});

test("renderScenario: degrades with only a name and dangling driving forces", () => {
  const html = renderScenario({ name: "Sparse scenario", driving_forces: ["ghost"] }, clusterLookup);
  assertClean(html);
  assert.match(html, /Sparse scenario/);
  assert.doesNotMatch(html, /Informed by/); // all refs dangled → line omitted
});

// ─── Preferred Future ────────────────────────────────────────────────────────

test("renderPreferredFuture: renders principles and resolves scenario refs", () => {
  const html = renderPreferredFuture(preferredFuture, scenarioLookup);
  assertClean(html);
  assert.match(html, /Equitable longevity access by 2035/);
  assert.match(html, /Guiding principles/);
  assert.match(html, /Based on: Longevity for those who can pay/);
});

test("renderPreferredFuture: degrades with only a name", () => {
  const html = renderPreferredFuture({ name: "Bare PF" }, scenarioLookup);
  assertClean(html);
  assert.match(html, /Bare PF/);
  assert.doesNotMatch(html, /Based on/);
  assert.doesNotMatch(html, /Guiding principles/);
});

// ─── Strategic Option ────────────────────────────────────────────────────────

test("renderStrategicOption: renders badges and resolves 'Responds to' scenario refs", () => {
  const html = renderStrategicOption(strategicOption, scenarioLookup);
  assertClean(html);
  assert.match(html, /Partner with payers on tiered coverage/);
  assert.match(html, /Feasibility: Moderate/);
  assert.match(html, /Reversibility: Low/);
  assert.match(html, /Responds to: Longevity for those who can pay/);
});

test("renderStrategicOption: degrades with only a name", () => {
  const html = renderStrategicOption({ name: "Bare option" }, scenarioLookup);
  assertClean(html);
  assert.match(html, /Bare option/);
  assert.doesNotMatch(html, /Feasibility/);
  assert.doesNotMatch(html, /Responds to/);
});

// ─── Appendix ────────────────────────────────────────────────────────────────

test("renderAppendix: nests inputs under clusters with resolved badges and source links", () => {
  const html = renderAppendix(clusters, inputs);
  assertClean(html);
  // cluster + its nested inputs
  assert.match(html, /Societal values shift toward longevity/);
  assert.match(html, /Longevity clinics see growth/);
  assert.match(html, /Wellness reframes around metabolic health/);
  // likelihood badge uses the NEW warm-neutral token, not a horizon color
  assert.match(html, new RegExp(c.likelihoodPlausible700.replace("#", "")));
  assert.match(html, new RegExp(c.likelihoodProbable700.replace("#", "")));
  // input badges + source host (www stripped)
  assert.match(html, /Strength: Moderate/);
  assert.match(html, /Confidence: High/);
  assert.match(html, /longevity\.technology/);
  assert.match(html, /<details/);
});

test("renderAppendix: returns empty string when there are no clusters", () => {
  assert.equal(renderAppendix([], inputs), "");
  assert.equal(renderAppendix(undefined, undefined), "");
});

test("renderAppendix: a cluster with no linked inputs still renders its header", () => {
  const html = renderAppendix(
    [{ id: "cx", name: "Lonely cluster", subtype: "Driver", horizon: "H2", likelihood: "Possible", input_ids: [] }],
    inputs
  );
  assertClean(html);
  assert.match(html, /Lonely cluster/);
});

test("renderAppendix: an unsafe source URL is dropped, not rendered as a link", () => {
  const html = renderAppendix(
    [{ id: "cx", name: "C", subtype: "Trend", horizon: "H1", likelihood: "Possible", input_ids: ["ix"] }],
    [{ id: "ix", name: "Bad link input", subtype: "Signal", source_url: "javascript:alert(1)" }]
  );
  assertClean(html);
  assert.match(html, /Bad link input/);
  assert.doesNotMatch(html, /javascript:/);
});

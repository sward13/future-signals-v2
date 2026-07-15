/**
 * Web Publish — static HTML section templates (MVP).
 *
 * One pure function per section. Each takes already-resolved project data and
 * returns an HTML string; nothing here queries the database or renders React.
 * The publish pipeline (separate prompt) fetches rows, builds the resolution
 * lookups, calls these, and assembles the final page.
 *
 * ID → name resolution is delegated to server-lib/resolve-references.js — this
 * module never re-implements lookup logic. Cluster/scenario references in the
 * narrative sections go through resolveDrivingForces() / resolveScenarioRefs().
 *
 * Reading order (per web-export-spec.md), NOT build order:
 *   Hero → Overview → System Map → System Analysis → Scenarios →
 *   Preferred Futures → Strategic Options → Appendix (clusters + inputs).
 *
 * Schema is authoritative over the prototype. Confirmed field names used here:
 *   projects: name, question, domain, geo, focus, audience, stakeholders,
 *             assumptions, h1_start/h1_end/h2_start/h2_end/h3_start/h3_end
 *   analyses: description, key_dynamics, critical_uncertainties (text[]),
 *             implications, confidence
 *   scenarios: name, archetype, horizon, description, narrative, driving_forces
 *   preferred_futures: name, description, desired_outcomes,
 *             guiding_principles (jsonb[]), scenario_ids (jsonb[])
 *   strategic_options: name, description, intended_outcome, actions,
 *             implications, feasibility, resource_intensity, reversibility,
 *             scenario_ids (jsonb[])
 *   clusters: name, subtype, horizon, likelihood, description, input_ids
 *   inputs: name, subtype, signal_strength, source_confidence, horizon, source_url
 */

import { c } from "../styles/tokens.js";
import { sanitizeUrl } from "../utils/sanitizeUrl.js";
import {
  resolveDrivingForces,
  resolveScenarioRefs,
} from "../../server-lib/resolve-references.js";

// ─── Chrome palette ───────────────────────────────────────────────────────────
// Structural (non-badge) colors come from the prototype's warm-paper palette.
// Badge color families (Horizon, Cluster Type, Strength/Confidence, Likelihood)
// come from tokens.js `c` — those are the confirmed design tokens.
const CH = {
  ink: "#17171A",
  muted: "#5B5A56",
  faint: "#9A988F",
  border: "#E0DED7",
  canvas: "#F7F6F2",
  heroBg: "#FAEEDA",
  white: "#FFFFFF",
  serif: "Georgia,'Times New Roman',serif",
};

const NEUTRAL = [CH.muted, CH.canvas, CH.border];

// ─── HTML-safety helpers ────────────────────────────────────────────────────────

/** Escape text for safe interpolation into HTML (published pages are public). */
export function esc(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const hasText = (v) => typeof v === "string" && v.trim() !== "";
const asArray = (v) => (Array.isArray(v) ? v.filter((x) => hasText(x)) : []);

// ─── Badge color resolvers (from confirmed tokens) ──────────────────────────────

/** Signal Strength / Source Confidence / analysis + scenario confidence tiers.
 *  Normalizes both vocabularies: weak|low → rust, moderate|medium → tan,
 *  strong|high → sage. */
function tierColors(value) {
  const v = String(value || "").toLowerCase();
  if (v === "weak" || v === "low") return [c.rust700, c.rust50, c.rustBorder];
  if (v === "moderate" || v === "medium") return [c.tan700, c.tan50, c.tanBorder];
  if (v === "strong" || v === "high") return [c.sage700, c.sage50, c.sageBorder];
  return NEUTRAL;
}

function horizonColors(h) {
  const map = {
    H1: [c.green700, c.green50, c.greenBorder],
    H2: [c.blue700, c.blue50, c.blueBorder],
    H3: [c.amber700, c.amber50, c.amberBorder],
  };
  return map[h] || NEUTRAL;
}

function clusterTypeColors(sub) {
  const map = {
    Trend: [c.dustyViolet700, c.dustyViolet50, c.dustyVioletBorder],
    Driver: [c.mutedTeal700, c.mutedTeal50, c.mutedTealBorder],
    Tension: [c.dustyRose700, c.dustyRose50, c.dustyRoseBorder],
  };
  return map[sub] || NEUTRAL;
}

function likelihoodColors(l) {
  const map = {
    Possible: [c.likelihoodPossible700, c.likelihoodPossible50, c.likelihoodPossibleBorder],
    Plausible: [c.likelihoodPlausible700, c.likelihoodPlausible50, c.likelihoodPlausibleBorder],
    Probable: [c.likelihoodProbable700, c.likelihoodProbable50, c.likelihoodProbableBorder],
  };
  return map[l] || NEUTRAL;
}

/** A pill badge. `colors` is [text, bg, border]. */
function badge(label, colors) {
  if (!hasText(label)) return "";
  const [text, bg, border] = colors;
  return `<span style="font-size:10px; padding:2px 6px; border-radius:5px; background:${bg}; color:${text}; border:1px solid ${border}; white-space:nowrap;">${esc(label)}</span>`;
}

/** A neutral (untokened) pill — archetype, feasibility, input subtype, etc. */
function neutralPill(label, { size = 11 } = {}) {
  if (!hasText(label)) return "";
  const pad = size >= 11 ? "3px 8px" : "2px 6px";
  return `<span style="font-size:${size}px; padding:${pad}; border-radius:6px; background:${CH.canvas}; color:${CH.muted}; white-space:nowrap;">${esc(label)}</span>`;
}

// ─── Shared block helpers ───────────────────────────────────────────────────────

const EYEBROW = `font-size:11px; letter-spacing:0.1em; color:${CH.faint}; text-transform:uppercase; margin:0 0 12px;`;
const LABEL = `font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:${CH.faint}; margin:0 0 4px;`;
const BODY = `font-size:14px; line-height:1.7; color:${CH.ink}; margin:0 0 16px;`;
const REF = `font-size:12px; color:${CH.faint}; margin:0;`;

function eyebrow(text) {
  return `<p style="${EYEBROW}">${esc(text)}</p>`;
}

/** A labeled free-text paragraph, or "" when the value is blank. */
function labeledText(label, value) {
  if (!hasText(value)) return "";
  return `<p style="${LABEL}">${esc(label)}</p><p style="${BODY}">${esc(value)}</p>`;
}

/** A labeled bullet list from an array, or "" when empty. */
function labeledList(label, items) {
  const list = asArray(items);
  if (list.length === 0) return "";
  const lis = list
    .map((i) => `<li style="${BODY} margin:0 0 6px;">${esc(i)}</li>`)
    .join("");
  return `<p style="${LABEL}">${esc(label)}</p><ul style="margin:0 0 16px; padding-left:20px;">${lis}</ul>`;
}

/** A trailing "Label: names" reference line, or "" when no names resolved. */
function refLine(label, names) {
  if (!Array.isArray(names) || names.length === 0) return "";
  return `<p style="${REF}">${esc(label)}: ${names.map(esc).join(", ")}</p>`;
}

function section(inner, { border = true, maxWidth = 640 } = {}) {
  const bd = border ? `border-bottom:1px solid ${CH.border};` : "";
  return `<div style="padding:56px 32px; ${bd} max-width:${maxWidth}px; margin:0 auto;">${inner}</div>`;
}

// ─── 1. Hero ────────────────────────────────────────────────────────────────────

/** @param {object} project @param {{publishedAt?: string}} [opts] */
export function renderHero(project, opts = {}) {
  const name = hasText(project?.name) ? esc(project.name) : "Untitled project";
  let published = "";
  if (hasText(opts.publishedAt)) {
    const d = new Date(opts.publishedAt);
    if (!Number.isNaN(d.getTime())) {
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      published = `<p style="font-size:12px; color:${CH.faint}; margin:24px 0 0;">Published ${esc(label)}</p>`;
    }
  }
  return `<div style="padding:64px 32px 56px; text-align:center; background:${CH.heroBg};">
      <p style="font-size:11px; letter-spacing:0.12em; color:${CH.muted}; margin:0 0 18px; text-transform:uppercase;">A Future Signals project</p>
      <h1 style="font-family:${CH.serif}; font-weight:400; font-size:40px; line-height:1.2; margin:0 auto; max-width:520px;">${name}</h1>
      ${published}
    </div>`;
}

// ─── 2. Overview (key question, meta grid, time horizons) ────────────────────────

const OVERVIEW_FIELDS = [
  ["Domain", "domain"],
  ["Geography", "geo"],
  ["Focus", "focus"],
  ["Audience", "audience"],
  ["Stakeholders", "stakeholders"],
  ["Assumptions", "assumptions"],
];

export function renderOverview(project) {
  const p = project || {};

  const question = hasText(p.question)
    ? `<div style="max-width:760px; margin:0 auto 32px;">
        <p style="${LABEL}">Key question</p>
        <p style="font-family:${CH.serif}; font-style:italic; font-size:19px; line-height:1.5; margin:0; color:${CH.ink};">&ldquo;${esc(p.question.trim())}&rdquo;</p>
      </div>`
    : "";

  const cells = OVERVIEW_FIELDS
    .filter(([, key]) => hasText(p[key]))
    .map(
      ([label, key]) =>
        `<div style="flex:0 0 33.33%; max-width:33.33%; box-sizing:border-box; padding:0 18px 24px 0;">
          <p style="${LABEL}">${esc(label)}</p>
          <p style="font-size:13px; color:${CH.ink}; margin:0;">${esc(p[key])}</p>
        </div>`
    )
    .join("");
  const grid = cells
    ? `<div style="display:flex; flex-wrap:wrap; max-width:760px; margin:0 auto;">${cells}</div>`
    : "";

  return `<div style="padding:48px 32px 16px; text-align:center;">
      <p style="font-size:11px; letter-spacing:0.14em; color:${CH.faint}; text-transform:uppercase; margin:0;">Overview</p>
    </div>
    <div style="padding:24px 32px 56px; border-bottom:1px solid ${CH.border};">
      ${question}
      ${grid}
      ${renderTimeHorizons(p)}
    </div>`;
}

/** Proportional H1/H2/H3 band from real date ranges. Mirrors the in-app
 *  HorizonBar proportion math. Renders nothing when horizons aren't configured. */
export function renderTimeHorizons(project) {
  const p = project || {};
  const start = parseInt(p.h1_start, 10);
  if (!start) return "";

  const end = parseInt(p.h3_end, 10) || start + 15;
  const h1End = parseInt(p.h1_end, 10) || start + 3;
  const h2End = parseInt(p.h2_end, 10) || h1End + 5;
  const span = end - start || 15;

  const clamp = (n) => Math.max(0, Math.min(100, n));
  const h1Pct = clamp(((h1End - start) / span) * 100);
  const h2Pct = clamp(((h2End - start) / span) * 100);
  const widths = [h1Pct, Math.max(0, h2Pct - h1Pct), Math.max(0, 100 - h2Pct)];

  const bands = [
    ["H1", p.h1_start, p.h1_end, c.green700, c.green50],
    ["H2", p.h2_start, p.h2_end, c.blue700, c.blue50],
    ["H3", p.h3_start, p.h3_end, c.amber700, c.amber50],
  ];

  const cells = bands
    .map(([name, s, e, text, bg], i) => {
      const range = hasText(s) || hasText(e) ? `${esc(s || "")}&ndash;${esc(e || "")}` : "";
      return `<div style="width:${widths[i]}%; background:${bg}; padding:14px 8px; text-align:center; box-sizing:border-box;">
          <p style="font-size:14px; font-weight:700; color:${text}; margin:0 0 4px;">${name}</p>
          <p style="font-size:12px; color:${text}; margin:0;">${range}</p>
        </div>`;
    })
    .join("");

  return `<div style="max-width:760px; margin:32px auto 0;">
      <p style="${LABEL}">Time horizons</p>
      <div style="display:flex; border-radius:8px; overflow:hidden; border:1px solid ${CH.border};">${cells}</div>
    </div>`;
}

// ─── 3. System Map ────────────────────────────────────────────────────────────────
// renderSystemMap() lives in ./systemMap.js (inline-SVG reconstruction from the
// persisted canvas rows). It imports esc() from this module.

// ─── 4. System Analysis ──────────────────────────────────────────────────────────

export function renderSystemAnalysis(analysis) {
  const a = analysis || {};
  const hasContent =
    hasText(a.description) ||
    hasText(a.key_dynamics) ||
    asArray(a.critical_uncertainties).length > 0 ||
    hasText(a.implications) ||
    hasText(a.confidence);
  if (!hasContent) return "";

  const description = hasText(a.description)
    ? `<p style="${BODY} margin-bottom:24px;">${esc(a.description.trim())}</p>`
    : "";
  const confidence = hasText(a.confidence)
    ? badge(`Confidence: ${a.confidence}`, tierColors(a.confidence))
    : "";

  return `${section(
    `${eyebrow("System analysis")}
      ${description}
      ${labeledText("Key dynamics", a.key_dynamics)}
      ${labeledList("Critical uncertainties", a.critical_uncertainties)}
      ${labeledText("Implications", a.implications)}
      ${confidence}`
  )}`;
}

// ─── 5. Scenario ─────────────────────────────────────────────────────────────────

function narrativeHead(eyebrowText, name, badgesHtml) {
  const badges = badgesHtml
    ? `<p style="margin:0 0 18px; display:flex; gap:8px; flex-wrap:wrap;">${badgesHtml}</p>`
    : "";
  return `${eyebrow(eyebrowText)}
    <h3 style="font-family:${CH.serif}; font-weight:400; font-size:24px; margin:0 0 12px;">${esc(name || "Untitled")}</h3>
    ${badges}`;
}

export function renderScenario(scenario, clusterLookup) {
  const s = scenario || {};
  const badges = [
    hasText(s.archetype) ? neutralPill(`Archetype: ${s.archetype}`) : "",
    hasText(s.horizon) ? badge(s.horizon, horizonColors(s.horizon)) : "",
  ]
    .filter(Boolean)
    .join("");

  const description = hasText(s.description)
    ? `<p style="${BODY}">${esc(s.description.trim())}</p>`
    : "";
  const narrative = hasText(s.narrative)
    ? `<p style="${BODY}">${esc(s.narrative.trim())}</p>`
    : "";
  const informedBy = refLine("Informed by", resolveDrivingForces(s, clusterLookup));

  return section(
    `${narrativeHead("Scenario", s.name, badges)}${description}${narrative}${informedBy}`,
    { border: false }
  );
}

// ─── 6. Preferred Future ─────────────────────────────────────────────────────────

export function renderPreferredFuture(pf, scenarioLookup) {
  const p = pf || {};
  const description = hasText(p.description)
    ? `<p style="${BODY}">${esc(p.description.trim())}</p>`
    : "";
  const basedOn = refLine("Based on", resolveScenarioRefs(p.scenario_ids, scenarioLookup));

  return section(
    `${narrativeHead("Preferred future", p.name, "")}
      ${description}
      ${labeledText("Desired outcomes", p.desired_outcomes)}
      ${labeledList("Guiding principles", p.guiding_principles)}
      ${basedOn}`,
    { border: false }
  );
}

// ─── 7. Strategic Option ─────────────────────────────────────────────────────────

export function renderStrategicOption(option, scenarioLookup) {
  const o = option || {};
  const badges = [
    hasText(o.feasibility) ? neutralPill(`Feasibility: ${o.feasibility}`) : "",
    hasText(o.resource_intensity) ? neutralPill(`Resource intensity: ${o.resource_intensity}`) : "",
    hasText(o.reversibility) ? neutralPill(`Reversibility: ${o.reversibility}`) : "",
  ]
    .filter(Boolean)
    .join("");

  const description = hasText(o.description)
    ? `<p style="${BODY}">${esc(o.description.trim())}</p>`
    : "";
  const respondsTo = refLine("Responds to", resolveScenarioRefs(o.scenario_ids, scenarioLookup));

  return section(
    `${narrativeHead("Strategic option", o.name, badges)}
      ${description}
      ${labeledText("Intended outcome", o.intended_outcome)}
      ${labeledText("What this involves", o.actions)}
      ${labeledText("Implications", o.implications)}
      ${respondsTo}`,
    { border: false }
  );
}

// ─── 8. Appendix (clusters, each expandable to its linked inputs) ─────────────────

/** Hostname (minus www) for a source link, or "" if the URL is unsafe/absent. */
function sourceHost(url) {
  const safe = sanitizeUrl(url);
  if (safe === "#") return "";
  try {
    const u = new URL(safe);
    const path = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "";
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return "";
  }
}

function renderInput(input) {
  const i = input || {};
  const badges = [
    hasText(i.subtype) ? neutralPill(i.subtype, { size: 10 }) : "",
    hasText(i.signal_strength) ? badge(`Strength: ${i.signal_strength}`, tierColors(i.signal_strength)) : "",
    hasText(i.source_confidence) ? badge(`Confidence: ${i.source_confidence}`, tierColors(i.source_confidence)) : "",
    hasText(i.horizon) ? badge(i.horizon, horizonColors(i.horizon)) : "",
  ]
    .filter(Boolean)
    .join(" ");

  const host = sourceHost(i.source_url);
  const link = host
    ? `<div><a href="${esc(sanitizeUrl(i.source_url))}" style="font-size:12px; color:${CH.faint};">${esc(host)} &#8599;</a></div>`
    : "";

  return `<div>
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:4px;">
        <span style="font-size:12px; color:${CH.ink}; font-weight:500;">${esc(i.name || "Untitled input")}</span>
        <span style="display:flex; gap:4px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end;">${badges}</span>
      </div>
      ${link}
    </div>`;
}

function renderClusterDisclosure(cluster, inputs) {
  const cl = cluster || {};
  const badges = [
    hasText(cl.subtype) ? badge(cl.subtype, clusterTypeColors(cl.subtype)) : "",
    hasText(cl.horizon) ? badge(cl.horizon, horizonColors(cl.horizon)) : "",
    hasText(cl.likelihood) ? badge(cl.likelihood, likelihoodColors(cl.likelihood)) : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ids = Array.isArray(cl.input_ids) ? cl.input_ids : [];
  const linked = inputs.filter((i) => ids.includes(i.id));
  const description = hasText(cl.description)
    ? `<p style="font-size:12px; color:${CH.muted}; line-height:1.5; margin:12px 0 10px;">${esc(cl.description.trim())}</p>`
    : "";
  const inputsBlock = linked.length
    ? `<div style="border-top:1px solid ${CH.border}; padding-top:10px; display:flex; flex-direction:column; gap:10px;">${linked
        .map(renderInput)
        .join("")}</div>`
    : "";

  return `<details style="border:1px solid ${CH.border}; border-radius:8px; padding:12px 14px;">
      <summary style="cursor:pointer; list-style:none; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <span style="font-size:13px; font-weight:600; color:${CH.ink};">${esc(cl.name || "Untitled cluster")}</span>
        <span style="display:flex; gap:4px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end;">${badges}</span>
      </summary>
      ${description}
      ${inputsBlock}
    </details>`;
}

export function renderAppendix(clusters, inputs) {
  const cls = Array.isArray(clusters) ? clusters : [];
  const inps = Array.isArray(inputs) ? inputs : [];
  if (cls.length === 0) return "";

  const items = cls.map((cl) => renderClusterDisclosure(cl, inps)).join("");

  return `<details style="margin:0 32px 48px; border-top:1px solid ${CH.border}; padding-top:28px;">
      <summary style="cursor:pointer; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:${CH.faint}; outline:none;">Appendix &mdash; supporting clusters and signals</summary>
      <div style="padding:24px 0 8px; display:flex; flex-direction:column; gap:10px;">${items}</div>
    </details>`;
}

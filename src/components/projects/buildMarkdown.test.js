import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMarkdown } from "./buildMarkdown.js";

// Fixtures ---------------------------------------------------------------------
// Clusters/scenarios carry snake_case fields; relationships are camelCase, as
// mapped in useAppState — the builder must handle both.

const project = { id: "p1", name: "Test project", question: "What happens next?" };

const clusters = [
  { id: "c1", project_id: "p1", name: "AI regulation", subtype: "Driver", horizon: "H2", input_ids: [] },
  { id: "c2", project_id: "p1", name: "Insurance pricing models", subtype: "Trend", horizon: "H1", input_ids: [] },
];

const inputs = [];
const preferredFutures = [];
const strategicOptions = [];

// Helpers ----------------------------------------------------------------------

function section(md, heading) {
  const lines = md.split("\n");
  const start = lines.indexOf(`## ${heading}`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) { end = i; break; }
  }
  return lines.slice(start, end).join("\n");
}

// Driving forces ---------------------------------------------------------------

test("driving forces resolve to cluster names through the shared module", () => {
  const scenarios = [
    { id: "s1", project_id: "p1", name: "Scenario A", driving_forces: ["c1", "c2"] },
  ];
  const md = buildMarkdown(project, clusters, inputs, scenarios, preferredFutures, strategicOptions, []);
  assert.match(md, /\*\*Driving forces:\*\* AI regulation, Insurance pricing models/);
});

test("driving forces skip a dangling cluster id without emitting undefined or throwing", () => {
  const scenarios = [
    { id: "s1", project_id: "p1", name: "Scenario A", driving_forces: ["c1", "ghost"] },
  ];
  let md;
  assert.doesNotThrow(() => {
    md = buildMarkdown(project, clusters, inputs, scenarios, preferredFutures, strategicOptions, []);
  });
  assert.match(md, /\*\*Driving forces:\*\* AI regulation/);
  assert.doesNotMatch(md, /undefined/);
  assert.doesNotMatch(md, /ghost/);
});

// Relationships section --------------------------------------------------------

test("relationships render as resolved sentences under a Relationships heading, after Clusters and before Scenarios", () => {
  const scenarios = [{ id: "s1", project_id: "p1", name: "Scenario A", driving_forces: [] }];
  const relationships = [
    { id: "r1", projectId: "p1", fromClusterId: "c1", toClusterId: "c2", type: "Drives" },
  ];
  const md = buildMarkdown(project, clusters, inputs, scenarios, preferredFutures, strategicOptions, relationships);

  const rels = section(md, "Relationships");
  assert.ok(rels, "Relationships section should exist");
  assert.match(rels, /- AI regulation drives Insurance pricing models/);
  // Not raw IDs
  assert.doesNotMatch(rels, /c1|c2/);

  // Ordering: Clusters < Relationships < Scenarios
  assert.ok(md.indexOf("## Clusters") < md.indexOf("## Relationships"));
  assert.ok(md.indexOf("## Relationships") < md.indexOf("## Scenarios"));
});

test("a dangling relationship endpoint does not throw or produce undefined", () => {
  const relationships = [
    { id: "r1", projectId: "p1", fromClusterId: "c1", toClusterId: "gone", type: "Drives" },
  ];
  let md;
  assert.doesNotThrow(() => {
    md = buildMarkdown(project, clusters, inputs, [], preferredFutures, strategicOptions, relationships);
  });
  assert.match(md, /- AI regulation drives \[deleted cluster\]/);
  assert.doesNotMatch(md, /undefined/);
});

test("no Relationships section is emitted when the project has none", () => {
  const md = buildMarkdown(project, clusters, inputs, [], preferredFutures, strategicOptions, []);
  assert.doesNotMatch(md, /## Relationships/);
});

test("relationships are scoped to the project", () => {
  const relationships = [
    { id: "r1", projectId: "other", fromClusterId: "c1", toClusterId: "c2", type: "Drives" },
  ];
  const md = buildMarkdown(project, clusters, inputs, [], preferredFutures, strategicOptions, relationships);
  assert.doesNotMatch(md, /## Relationships/);
});

test("omitting the relationships argument is safe (backward compatible)", () => {
  assert.doesNotThrow(() => {
    buildMarkdown(project, clusters, inputs, [], preferredFutures, strategicOptions);
  });
});

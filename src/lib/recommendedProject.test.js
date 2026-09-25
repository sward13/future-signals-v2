import { test } from "node:test";
import assert from "node:assert/strict";
import { getRecommendedProject } from "./recommendedProject.js";

const projects = [
  { id: "p1", name: "Alpha", domain: "Technology & AI" },
  { id: "p2", name: "Beta", domain: "Climate & Energy" },
  { id: "p3", name: "Gamma", domain: "Health & Life Sciences" },
];

test("normal case: returns the highest-scoring live suggestion", () => {
  const suggested = [
    { id: "p2", name: "Beta", score: 91 },
    { id: "p1", name: "Alpha", score: 40 },
  ];
  const result = getRecommendedProject(suggested, projects);
  assert.equal(result.id, "p2");
  // Returns the live project object, not the metadata copy.
  assert.equal(result, projects[1]);
});

test("does not rely on array order — picks max score even if unsorted", () => {
  const suggested = [
    { id: "p1", name: "Alpha", score: 30 },
    { id: "p3", name: "Gamma", score: 88 },
    { id: "p2", name: "Beta", score: 55 },
  ];
  assert.equal(getRecommendedProject(suggested, projects).id, "p3");
});

test("top project deleted: falls through to the next live suggestion", () => {
  const suggested = [
    { id: "deleted", name: "Ghost", score: 99 },
    { id: "p2", name: "Beta", score: 60 },
  ];
  assert.equal(getRecommendedProject(suggested, projects).id, "p2");
});

test("all suggested projects deleted: returns null", () => {
  const suggested = [
    { id: "deleted-a", name: "GhostA", score: 99 },
    { id: "deleted-b", name: "GhostB", score: 80 },
  ];
  assert.equal(getRecommendedProject(suggested, projects), null);
});

test("empty array: returns null", () => {
  assert.equal(getRecommendedProject([], projects), null);
});

test("missing / null / undefined array: returns null", () => {
  assert.equal(getRecommendedProject(null, projects), null);
  assert.equal(getRecommendedProject(undefined, projects), null);
});

test("no live projects: returns null", () => {
  assert.equal(getRecommendedProject([{ id: "p1", score: 50 }], []), null);
  assert.equal(getRecommendedProject([{ id: "p1", score: 50 }], null), null);
});

test("suggestion without a score is treated as 0", () => {
  const suggested = [
    { id: "p1", name: "Alpha" },       // no score → 0
    { id: "p2", name: "Beta", score: 10 },
  ];
  assert.equal(getRecommendedProject(suggested, projects).id, "p2");
});

test("very long project name: resolves normally", () => {
  const longName = "A".repeat(300);
  const longProjects = [{ id: "pL", name: longName, domain: "Custom / Other" }];
  const suggested = [{ id: "pL", name: longName, score: 77 }];
  const result = getRecommendedProject(suggested, longProjects);
  assert.equal(result.id, "pL");
  assert.equal(result.name.length, 300);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectDomains,
  projectCustomDomain,
  projectDomainList,
  projectDomainLabel,
  projectHasDomain,
  legacyDomainValue,
  CUSTOM_DOMAIN_LABEL,
} from "./projectDomains.js";

test("projectDomains reads the domains array when present", () => {
  assert.deepEqual(
    projectDomains({ domains: ["Technology & AI", "Climate & Energy"] }),
    ["Technology & AI", "Climate & Energy"],
  );
});

test("projectDomains falls back to the legacy single domain", () => {
  assert.deepEqual(projectDomains({ domains: [], domain: "Media & Culture" }), ["Media & Culture"]);
  assert.deepEqual(projectDomains({ domain: "Media & Culture" }), ["Media & Culture"]);
});

test("projectDomains ignores the legacy Custom / Other sentinel", () => {
  assert.deepEqual(projectDomains({ domain: CUSTOM_DOMAIN_LABEL }), []);
});

test("projectDomains tolerates null / empty", () => {
  assert.deepEqual(projectDomains(null), []);
  assert.deepEqual(projectDomains({}), []);
});

test("projectCustomDomain trims and defaults to empty", () => {
  assert.equal(projectCustomDomain({ custom_domain: "  Space & Aerospace " }), "Space & Aerospace");
  assert.equal(projectCustomDomain({ custom_domain: null }), "");
  assert.equal(projectCustomDomain({}), "");
});

test("projectDomainList appends the custom domain after predefined ones", () => {
  assert.deepEqual(
    projectDomainList({ domains: ["Technology & AI"], custom_domain: "Space & Aerospace" }),
    ["Technology & AI", "Space & Aerospace"],
  );
  assert.deepEqual(projectDomainList({ domains: [], custom_domain: "Space & Aerospace" }), ["Space & Aerospace"]);
});

test("projectDomainLabel joins with a middot, empty when none", () => {
  assert.equal(
    projectDomainLabel({ domains: ["Technology & AI", "Climate & Energy"] }),
    "Technology & AI · Climate & Energy",
  );
  assert.equal(projectDomainLabel({ domains: [], custom_domain: null }), "");
});

test("projectHasDomain reflects predefined or custom presence", () => {
  assert.equal(projectHasDomain({ domains: ["Technology & AI"] }), true);
  assert.equal(projectHasDomain({ domains: [], custom_domain: "Space & Aerospace" }), true);
  assert.equal(projectHasDomain({ domains: [], custom_domain: null }), false);
  assert.equal(projectHasDomain({ domain: "Media & Culture" }), true); // legacy row
});

test("legacyDomainValue mirrors the old single-value behaviour", () => {
  assert.equal(legacyDomainValue(["Technology & AI", "Climate & Energy"], ""), "Technology & AI");
  assert.equal(legacyDomainValue([], "Space & Aerospace"), CUSTOM_DOMAIN_LABEL);
  assert.equal(legacyDomainValue([], ""), "");
});

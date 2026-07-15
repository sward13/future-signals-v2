// Shared reference-resolution layer for Future Signals v2.
//
// Clusters, scenarios, preferred_futures, strategic_options, and relationships
// all reference each other by UUID rather than by name. These pure helpers turn
// already-fetched rows + prebuilt lookup Maps into readable names / sentences,
// so a missing reference degrades gracefully instead of throwing.
//
// Every function here is pure: no DB calls, no side effects. Callers fetch the
// rows and build the lookups; these functions only read. That keeps the module
// usable from both the client (Report Export) and a future server-side Publish
// pipeline.
//
// Confirmed DB column names used here:
//   clusters.id, clusters.name
//   relationships.from_cluster_id, relationships.to_cluster_id, relationships.type
//   scenarios.id, scenarios.name, scenarios.driving_forces (jsonb array of cluster ids)
//   preferred_futures.scenario_ids / strategic_options.scenario_ids (jsonb arrays)

export const DELETED_CLUSTER = "[deleted cluster]";
export const DELETED_SCENARIO = "[deleted scenario]";

// ─── Cluster lookups ──────────────────────────────────────────────────────────

/**
 * Build a Map from cluster id → cluster row for O(1) lookup.
 * @param {Array<{id: string}>} clusters
 * @returns {Map<string, object>}
 */
export function buildClusterLookup(clusters) {
  const map = new Map();
  if (!Array.isArray(clusters)) return map;
  for (const cl of clusters) {
    if (cl && cl.id != null) map.set(cl.id, cl);
  }
  return map;
}

/**
 * Resolve a cluster id to its name. Never throws — returns a clear fallback when
 * the id doesn't resolve (deleted or dangling reference) or the row has no name.
 * @param {string} clusterId
 * @param {Map<string, object>} clusterLookup
 * @returns {string}
 */
export function resolveClusterName(clusterId, clusterLookup) {
  const row = clusterLookup instanceof Map ? clusterLookup.get(clusterId) : undefined;
  if (!row) return DELETED_CLUSTER;
  return row.name || DELETED_CLUSTER;
}

// ─── Relationships ──────────────────────────────────────────────────────────────

// Readable sentence phrasing per known relationship type. The stored `type` is
// either one of these ids or a free-text custom label ("Other"). Known verb
// types conjugate to third-person; "Feedback Loop" is a noun so it gets its own
// phrasing; any unknown/custom label is dropped in verbatim between the two
// names as a neutral fallback.
const REL_SENTENCE = {
  Drives: (f, t) => `${f} drives ${t}`,
  Enables: (f, t) => `${f} enables ${t}`,
  Accelerates: (f, t) => `${f} accelerates ${t}`,
  Inhibits: (f, t) => `${f} inhibits ${t}`,
  Blocks: (f, t) => `${f} blocks ${t}`,
  Displaces: (f, t) => `${f} displaces ${t}`,
  "Feedback Loop": (f, t) => `${f} forms a feedback loop with ${t}`,
};

/**
 * Resolve a relationship row to readable endpoint names and a natural-language
 * sentence. Never throws — unresolved endpoints fall back to DELETED_CLUSTER.
 * @param {{from_cluster_id: string, to_cluster_id: string, type: string}} relationshipRow
 * @param {Map<string, object>} clusterLookup
 * @returns {{fromName: string, toName: string, type: string, sentence: string}}
 */
export function resolveRelationship(relationshipRow, clusterLookup) {
  const row = relationshipRow || {};
  const fromName = resolveClusterName(row.from_cluster_id, clusterLookup);
  const toName = resolveClusterName(row.to_cluster_id, clusterLookup);
  const type = row.type || "";

  const phrase = REL_SENTENCE[type];
  const sentence = phrase
    ? phrase(fromName, toName)
    : type
      ? `${fromName} ${type} ${toName}` // custom / unknown label, dropped in as-is
      : `${fromName} → ${toName}`; // no type recorded

  return { fromName, toName, type, sentence };
}

// ─── Scenario driving forces (cluster ids) ──────────────────────────────────────

/**
 * Resolve a scenario's driving_forces (jsonb array of cluster ids) to cluster
 * names, skipping any that don't resolve. Never throws.
 * @param {{driving_forces?: Array<string|{id: string}>}} scenario
 * @param {Map<string, object>} clusterLookup
 * @returns {string[]}
 */
export function resolveDrivingForces(scenario, clusterLookup) {
  const forces = scenario?.driving_forces;
  if (!Array.isArray(forces)) return [];
  const names = [];
  for (const force of forces) {
    const id = typeof force === "string" ? force : force?.id;
    const row = clusterLookup instanceof Map ? clusterLookup.get(id) : undefined;
    if (row && row.name) names.push(row.name);
  }
  return names;
}

// ─── Scenario lookups ──────────────────────────────────────────────────────────

/**
 * Build a Map from scenario id → scenario row for O(1) lookup.
 * @param {Array<{id: string}>} scenarios
 * @returns {Map<string, object>}
 */
export function buildScenarioLookup(scenarios) {
  const map = new Map();
  if (!Array.isArray(scenarios)) return map;
  for (const sc of scenarios) {
    if (sc && sc.id != null) map.set(sc.id, sc);
  }
  return map;
}

/**
 * Resolve an array of scenario ids (e.g. preferred_futures.scenario_ids or
 * strategic_options.scenario_ids) to scenario titles, skipping any that don't
 * resolve. Never throws.
 * @param {Array<string|{id: string}>} idArray
 * @param {Map<string, object>} scenarioLookup
 * @returns {string[]}
 */
export function resolveScenarioRefs(idArray, scenarioLookup) {
  if (!Array.isArray(idArray)) return [];
  const titles = [];
  for (const ref of idArray) {
    const id = typeof ref === "string" ? ref : ref?.id;
    const row = scenarioLookup instanceof Map ? scenarioLookup.get(id) : undefined;
    if (row && row.name) titles.push(row.name);
  }
  return titles;
}

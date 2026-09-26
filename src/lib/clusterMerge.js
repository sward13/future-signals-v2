/**
 * clusterMerge — pure, testable state transform for merging one cluster into
 * another, mirroring the server-side `merge_clusters` RPC so the optimistic
 * local update matches what the database will do.
 *
 * The source cluster is absorbed into the target: the target inherits the
 * source's input memberships (de-duplicated), scenario references are repointed
 * to the target, the source's System Map node is dropped, and its edges are
 * repointed onto the target — skipping self-loops and duplicate edges, exactly
 * as the RPC does. The source cluster is removed. The target's own fields
 * (name/subtype/horizon/likelihood/description) are retained; the source's are
 * discarded ("target wins").
 *
 * Operates on the app's in-memory (camelCase) shapes:
 *   clusters:      { id, input_ids: string[], ... }
 *   scenarios:     { id, cluster_ids: string[], ... }
 *   relationships: { id, fromClusterId, toClusterId, type, ... }
 *   canvasNodes:   { id, clusterId, ... }
 *   connections:   { id, clusterId, ... }
 */

/**
 * Repoint edges from source→target, dropping edges that would become self-loops
 * or that would duplicate an edge already present on the target. Edges not
 * touching the source are kept untouched. Matches the RPC's manual dedupe:
 * edges not touching the source are recorded first, then source-touching edges
 * are repointed and kept only if they don't self-loop or collide.
 */
export function repointRelationships(relationships, sourceId, targetId) {
  const touchesSource = (r) => r.fromClusterId === sourceId || r.toClusterId === sourceId;

  const kept = relationships.filter((r) => !touchesSource(r));
  const seen = new Set(kept.map((r) => `${r.fromClusterId}|${r.toClusterId}|${r.type}`));

  for (const r of relationships.filter(touchesSource)) {
    const from = r.fromClusterId === sourceId ? targetId : r.fromClusterId;
    const to   = r.toClusterId   === sourceId ? targetId : r.toClusterId;
    if (from === to) continue;                       // self-loop → dropped (cascade)
    const key = `${from}|${to}|${r.type}`;
    if (seen.has(key)) continue;                     // duplicate of an existing edge → dropped
    seen.add(key);
    kept.push({ ...r, fromClusterId: from, toClusterId: to });
  }
  return kept;
}

/**
 * Compute the merged versions of every affected state array. Returns the same
 * shape it was given ({ clusters, scenarios, relationships, canvasNodes,
 * connections }). If either cluster is missing, returns the input unchanged
 * (with `merged: false`) so callers can bail without mutating state.
 */
export function computeClusterMerge(state, sourceId, targetId) {
  const { clusters = [], scenarios = [], relationships = [], canvasNodes = [], connections = [] } = state;

  if (!sourceId || !targetId || sourceId === targetId) {
    return { ...state, merged: false };
  }
  const source = clusters.find((c) => c.id === sourceId);
  const target = clusters.find((c) => c.id === targetId);
  if (!source || !target) {
    return { ...state, merged: false };
  }

  const mergedInputIds = [...new Set([...(target.input_ids || []), ...(source.input_ids || [])])];

  const nextClusters = clusters
    .filter((c) => c.id !== sourceId)
    .map((c) => (c.id === targetId ? { ...c, input_ids: mergedInputIds } : c));

  const nextScenarios = scenarios.map((s) =>
    (s.cluster_ids || []).includes(sourceId)
      ? { ...s, cluster_ids: [...new Set(s.cluster_ids.map((cid) => (cid === sourceId ? targetId : cid)))] }
      : s
  );

  const nextCanvasNodes = canvasNodes.filter((n) => n.clusterId !== sourceId);

  const nextRelationships = repointRelationships(relationships, sourceId, targetId);

  const nextConnections = connections.map((c) =>
    c.clusterId === sourceId ? { ...c, clusterId: targetId } : c
  );

  return {
    clusters: nextClusters,
    scenarios: nextScenarios,
    relationships: nextRelationships,
    canvasNodes: nextCanvasNodes,
    connections: nextConnections,
    merged: true,
    source,
    target,
  };
}

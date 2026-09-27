/**
 * clusterOverlap — pure ranking logic for "Find duplicates" (v2 Phase B).
 *
 * Given one name+description embedding per existing cluster, rank the most-similar
 * pairs so the practitioner can review and merge/dismiss them. No hard threshold
 * to mis-tune: a modest floor filters obvious non-matches, results are ranked
 * desc and capped, and the human decides each pair.
 *
 * I/O-free so it's node-testable AND importable by the Deno edge function
 * (supabase/functions/detect-cluster-overlaps/index.ts supplies the embeddings).
 */

export function cosineSim(a, b) {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma  += a[i] * a[i];
    mb  += b[i] * b[i];
  }
  const denom = Math.sqrt(ma) * Math.sqrt(mb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * @param {number[][]} embeddings  one embedding per cluster (index-aligned with the caller's cluster list)
 * @param {{ floor?: number, limit?: number }} opts
 * @returns {{ i:number, j:number, similarity:number }[]} pairs with similarity >= floor,
 *          sorted by similarity desc, capped to `limit`. i < j.
 */
export function rankClusterOverlaps(embeddings, { floor = 0.55, limit = 20 } = {}) {
  const pairs = [];
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSim(embeddings[i], embeddings[j]);
      if (similarity >= floor) pairs.push({ i, j, similarity });
    }
  }
  pairs.sort((a, b) => b.similarity - a.similarity);
  return pairs.slice(0, limit);
}

/**
 * clusterSuggestionDedup — pure decision logic for de-duplicating new-cluster
 * proposals produced by `compute-cluster-suggestions` (Phase A).
 *
 * I/O-free so it can be unit-tested under node:test AND imported by the Deno edge
 * function (`supabase/functions/compute-cluster-suggestions/index.ts` imports this
 * file directly and supplies the embeddings). Keep it dependency-free.
 *
 * Two things it decides, using name+description embeddings (which catch "same
 * idea, different source articles" that member centroids miss):
 *   1. Collapse near-identical proposals into one (union-find over pairs whose
 *      cosine ≥ threshold; survivor = the proposal with the most inputs).
 *   2. Route a surviving proposal that duplicates an EXISTING cluster to an
 *      assignment instead of creating a redundant new cluster.
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
 * @param {number[][]} proposalEmbeddings  name+description embedding per proposal
 * @param {string[][]} proposalInputIds    input ids per proposal (same order)
 * @param {number[][]} existingEmbeddings  name+description embedding per existing cluster
 * @param {number}     threshold           cosine at/above which two are "the same concept"
 * @returns {{ survivors: {index:number, inputIds:string[]}[],
 *             routes:    {index:number, existingIndex:number, inputIds:string[]}[] }}
 *   survivors — proposals to keep as new clusters (index into proposals; inputIds merged/deduped)
 *   routes    — proposals to assign to an existing cluster instead
 *   Every collapsed group yields exactly one survivor OR one route (never both).
 */
export function planNewClusterDedup(proposalEmbeddings, proposalInputIds, existingEmbeddings, threshold) {
  const P = proposalEmbeddings.length;

  // ── 1. Collapse near-identical proposals (union-find) ──
  const parent = Array.from({ length: P }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  for (let i = 0; i < P; i++) {
    for (let j = i + 1; j < P; j++) {
      if (cosineSim(proposalEmbeddings[i], proposalEmbeddings[j]) >= threshold) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < P; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }

  const survivors = [];
  const routes = [];

  for (const idxs of groups.values()) {
    // Survivor = most inputs, tiebreak lowest original index (stable).
    idxs.sort((a, b) => (proposalInputIds[b].length - proposalInputIds[a].length) || (a - b));
    const index = idxs[0];
    const inputIds = Array.from(new Set(idxs.flatMap((i) => proposalInputIds[i])));

    // ── 2. Route to an existing cluster if the survivor duplicates one ──
    let bestSim = -1, bestExisting = -1;
    for (let k = 0; k < existingEmbeddings.length; k++) {
      const s = cosineSim(proposalEmbeddings[index], existingEmbeddings[k]);
      if (s > bestSim) { bestSim = s; bestExisting = k; }
    }

    if (bestExisting >= 0 && bestSim >= threshold) {
      routes.push({ index, existingIndex: bestExisting, inputIds });
    } else {
      survivors.push({ index, inputIds });
    }
  }

  return { survivors, routes };
}

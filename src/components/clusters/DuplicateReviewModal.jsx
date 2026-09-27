/**
 * DuplicateReviewModal — "Find duplicates" review surface (v2 Phase B).
 * Lists the most-similar existing-cluster pairs (from detect-cluster-overlaps) and
 * lets the practitioner Merge (→ the existing MergeClusterDialog) or Dismiss each.
 * Never auto-merges. Pairs referencing a cluster that no longer exists (e.g. just
 * merged away) auto-drop; Dismiss is session-only.
 *
 * @param {{ pairs: object[], clusters: object[], loading: boolean, error: string|null,
 *           onMerge: (sourceId:string, targetId:string) => void, onClose: () => void }} props
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { c, btnSec } from "../../styles/tokens.js";
import { SubtypeTag } from "../shared/Tag.jsx";

function ClusterSide({ cluster }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <SubtypeTag sub={cluster.subtype} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cluster.name}
        </span>
      </div>
      <div style={{ fontSize: 11, color: c.hint }}>
        {cluster.input_ids?.length || 0} input{(cluster.input_ids?.length || 0) === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export function DuplicateReviewModal({ pairs = [], clusters = [], loading, error, onMerge, onClose }) {
  const [dismissed, setDismissed] = useState(() => new Set());

  const byId = new Map(clusters.map((cl) => [cl.id, cl]));
  const key = (p) => `${p.a.id}|${p.b.id}`;

  // Only show pairs whose both clusters still exist (a merge removes one) and
  // that haven't been dismissed this session.
  const visible = pairs.filter(
    (p) => byId.has(p.a.id) && byId.has(p.b.id) && !dismissed.has(key(p)),
  );

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 600 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 560, maxWidth: "92vw", maxHeight: "80vh", display: "flex", flexDirection: "column",
        background: c.white, borderRadius: 10, zIndex: 601,
        border: `1px solid ${c.borderMid}`, boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: c.ink }}>Possible duplicate clusters</div>
          <div style={{ fontSize: 12, color: c.muted, marginTop: 4, lineHeight: 1.5 }}>
            Pairs that look similar, most-similar first. Merge the true duplicates; dismiss the rest.
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "8px 24px 12px" }}>
          {loading && <div style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: c.muted }}>Finding duplicates…</div>}

          {!loading && error && (
            <div style={{ padding: "20px 0", fontSize: 13, color: c.red800 }}>Couldn’t check for duplicates: {error}</div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: c.muted }}>
              No likely duplicates found.
            </div>
          )}

          {!loading && !error && visible.map((p) => {
            const a = byId.get(p.a.id);
            const b = byId.get(p.b.id);
            // Default direction: absorb the smaller cluster into the larger (swappable in the dialog).
            const [source, target] = (a.input_ids?.length || 0) <= (b.input_ids?.length || 0) ? [a, b] : [b, a];
            return (
              <div key={key(p)} style={{
                border: `1px solid ${c.border}`, borderRadius: 8, padding: "12px 14px", marginTop: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ClusterSide cluster={a} />
                  <div style={{ flexShrink: 0, textAlign: "center", padding: "0 4px" }}>
                    <div style={{ fontSize: 10, color: c.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>similar</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.muted }}>{Math.round(p.similarity * 100)}%</div>
                  </div>
                  <ClusterSide cluster={b} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => setDismissed((prev) => new Set(prev).add(key(p)))}
                    style={{ ...btnSec, padding: "6px 12px", fontSize: 12 }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => onMerge(source.id, target.id)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: "none", background: c.brand, color: c.white, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Merge…
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSec}>Done</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

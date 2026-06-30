/**
 * ClusterDetailPanel — slides in from the right within the 320px ClustersPanel.
 * Uses position:absolute / translateX so the inputs panel stays fully visible.
 * @param {{ open: boolean, cluster: object|null, inputs: object[], onClose: () => void, onRemoveInput: (inputId, clusterId) => void, onDelete: (id) => void }} props
 */
import { useState, useEffect } from "react";
import { c, btnSec } from "../../styles/tokens.js";
import { SubtypeTag, HorizTag, Tag } from "../shared/Tag.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

function LikelihoodTag({ l }) {
  const map = {
    Probable:  [c.green700, c.green50,  c.greenBorder],
    Plausible: [c.blue700,  c.blue50,   c.blueBorder],
    Possible:  [c.amber700, c.amber50,  c.amberBorder],
  };
  const [col, bg, brd] = map[l] || [c.hint, "transparent", c.border];
  return <Tag label={l} color={col} bg={bg} border={brd} />;
}

export function ClusterDetailPanel({ open, cluster, inputs, onClose, onRemoveInput, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setConfirmDelete(false); }, [cluster?.id]);

  const linkedInputs = cluster ? inputs.filter((i) => cluster.input_ids?.includes(i.id)) : [];

  return (
    <>
      <div style={{
        position: "absolute",
        inset: 0,
        background: c.white,
        display: "flex",
        flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 220ms ease",
        zIndex: 10,
        borderLeft: `1px solid ${c.border}`,
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding: "11px 14px",
          borderBottom: `1px solid ${c.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, color: c.brand,
              padding: 0, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            ← Clusters
          </button>
          <button
            style={{
              background: "none", border: `1px solid ${c.borderMid}`,
              cursor: "pointer", fontFamily: "inherit", fontSize: 11,
              color: c.muted, padding: "4px 10px", borderRadius: 6,
            }}
          >
            Edit
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 10px" }}>

          {cluster && (
            <>
              {/* Badges */}
              <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                <SubtypeTag sub={cluster.subtype} />
                <HorizTag h={cluster.horizon} />
                {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
              </div>

              {/* Name */}
              <div style={{ fontSize: 16, fontWeight: 600, color: c.ink, marginBottom: 8, lineHeight: 1.3 }}>
                {cluster.name}
              </div>

              {/* Description */}
              <div style={{ fontSize: 12, color: cluster.description ? c.muted : c.hint, fontStyle: cluster.description ? "normal" : "italic", lineHeight: 1.65, marginBottom: 16 }}>
                {cluster.description || "No description."}
              </div>

              <div style={{ height: 1, background: c.border, marginBottom: 12 }} />

              {/* Linked inputs */}
              <div style={{ fontSize: 10, letterSpacing: "0.07em", color: c.hint, marginBottom: 8 }}>
                Linked inputs ({linkedInputs.length})
              </div>

              {linkedInputs.length === 0 ? (
                <div style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>No inputs linked yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {linkedInputs.map((inp) => (
                    <div key={inp.id} style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "7px 10px", background: c.surfaceAlt,
                      borderRadius: 7, border: `1px solid ${c.border}`,
                    }}>
                      <span style={{ fontSize: 8, color: c.hint, flexShrink: 0 }}>●</span>
                      <span style={{
                        fontSize: 12, color: c.ink, flex: 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {inp.name}
                      </span>
                      <button
                        onClick={() => onRemoveInput(inp.id, cluster.id)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 11, color: c.hint, padding: "0 2px",
                          fontFamily: "inherit", flexShrink: 0, lineHeight: 1,
                        }}
                        title="Remove from cluster"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 14px", borderTop: `1px solid ${c.border}`, flexShrink: 0 }}>
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              width: "100%", padding: "7px 0", borderRadius: 7,
              border: `1px solid ${c.redBorder}`, background: "transparent",
              color: c.red800, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Delete cluster
          </button>
        </div>
      </div>

      {confirmDelete && cluster && (
        <ConfirmDialog
          title={`Delete "${cluster.name}"?`}
          message="This will permanently delete the cluster. Inputs linked to it will not be deleted. This cannot be undone."
          onConfirm={() => { setConfirmDelete(false); onDelete(cluster.id); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

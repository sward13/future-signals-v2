/**
 * MergeClusterDialog — confirms merging one cluster (source) into another
 * (target). Destructive and irreversible, so it names exactly what is lost and
 * offers a Swap control to flip which cluster survives (OQ-1). Styled to match
 * ConfirmDialog (inline tokens).
 *
 * @param {{ source: object, target: object, onSwap: () => void,
 *           onConfirm: () => void, onClose: () => void }} props
 */
import { c, btnSec } from "../../styles/tokens.js";
import { SubtypeTag } from "../shared/Tag.jsx";

function ClusterChip({ cluster, role }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, border: `1px solid ${c.border}`, borderRadius: 8,
      background: c.surfaceAlt, padding: "8px 10px",
    }}>
      <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: c.faint, marginBottom: 4 }}>
        {role}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SubtypeTag sub={cluster.subtype} />
        <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cluster.name}
        </span>
      </div>
    </div>
  );
}

export function MergeClusterDialog({ source, target, onSwap, onConfirm, onClose }) {
  if (!source || !target) return null;
  const n = source.input_ids?.length || 0;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 700 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 440, background: c.white, borderRadius: 10, zIndex: 701,
        border: `1px solid ${c.borderMid}`, boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
        padding: "24px 26px 20px",
      }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: c.ink, marginBottom: 14 }}>Merge clusters?</div>

        {/* source → target, with swap */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 14 }}>
          <ClusterChip cluster={source} role="Merge (deleted)" />
          <button
            onClick={onSwap}
            title="Swap which cluster survives"
            style={{
              flexShrink: 0, alignSelf: "center", padding: "4px 8px", borderRadius: 7,
              border: `1px solid ${c.border}`, background: c.white, color: c.muted,
              cursor: "pointer", fontFamily: "inherit", fontSize: 14, lineHeight: 1,
            }}
          >
            ↔
          </button>
          <ClusterChip cluster={target} role="Into (survives)" />
        </div>

        <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.55, marginBottom: 22 }}>
          {n === 1 ? "1 input" : `${n} inputs`} from <b>{source.name}</b> will move to <b>{target.name}</b>.
          {" "}<b>{source.name}</b> — including its name, type, and description — will be deleted. This can’t be undone.
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSec}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: "none", background: c.brand, color: c.white,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Merge
          </button>
        </div>
      </div>
    </>
  );
}

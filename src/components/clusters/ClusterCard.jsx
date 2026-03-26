/**
 * ClusterCard — displays a single cluster. Stub for Pass 1.
 * @param {{ cluster: object }} props
 */
import { c } from "../../styles/tokens.js";
import { SubtypeTag, HorizTag } from "../shared/Tag.jsx";

export function ClusterCard({ cluster }) {
  return (
    <div style={{
      background: "#ffffff",
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <SubtypeTag sub={cluster.subtype} />
        <HorizTag h={cluster.horizon} />
        <span style={{ marginLeft: "auto", fontSize: 10, color: c.hint }}>
          {cluster.input_ids?.length || 0} inputs
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 5 }}>{cluster.name}</div>
      {cluster.description && (
        <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.6 }}>{cluster.description}</div>
      )}
    </div>
  );
}

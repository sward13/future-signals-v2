/**
 * ClusterCard — card-view item for a cluster inside the 320px ClustersPanel.
 * Shows type + horizon + likelihood badges, name, 2-line description, input count.
 */
import { useState } from "react";
import { c } from "../../styles/tokens.js";
import { SubtypeTag, HorizTag, Tag } from "../shared/Tag.jsx";

function LikelihoodTag({ l }) {
  const map = {
    Probable:  [c.green700, c.green50,  c.greenBorder],
    Plausible: [c.blue700,  c.blue50,   c.blueBorder],
    Possible:  [c.amber700, c.amber50,  c.amberBorder],
  };
  const [col, bg, brd] = map[l] || [c.hint, "transparent", c.border];
  return <Tag label={l} color={col} bg={bg} border={brd} />;
}

export function ClusterCard({ cluster, selected = false, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected ? "#EFF6FF" : c.white,
        border: `1px solid ${selected ? c.brand : hovered ? c.borderMid : c.border}`,
        borderRadius: 9,
        padding: "11px 13px",
        cursor: "pointer",
        boxShadow: hovered && !selected ? "0 2px 8px rgba(0,0,0,0.07)" : "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
      }}
    >
      {/* Top row: badges + input count */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
        <SubtypeTag sub={cluster.subtype} />
        <HorizTag h={cluster.horizon} />
        {cluster.likelihood && <LikelihoodTag l={cluster.likelihood} />}
        <span style={{ marginLeft: "auto", fontSize: 10, color: c.hint, flexShrink: 0 }}>
          {cluster.input_ids?.length || 0} inputs
        </span>
      </div>

      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: c.ink, marginBottom: 5, lineHeight: 1.35 }}>
        {cluster.name}
      </div>

      {/* Description — 2-line clamp */}
      {cluster.description && (
        <div style={{
          fontSize: 11, color: c.muted, lineHeight: 1.55,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {cluster.description}
        </div>
      )}
    </div>
  );
}

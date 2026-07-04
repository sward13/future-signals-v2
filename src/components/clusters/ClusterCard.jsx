/**
 * ClusterCard — card-view item for a cluster inside the ClustersPanel.
 * Layout: header row (type left / horizon right), name, description, footer (count / likelihood).
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

export function ClusterCard({ cluster, selected = false, onClick, isDropTarget = false, dropIsCopy = false, isSelected = false, onCheckboxClick = null, anySelected = false }) {
  const [hovered, setHovered] = useState(false);

  const showCheckbox = hovered || anySelected || isSelected;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDropTarget ? (dropIsCopy ? "#F0FDF4" : "#EFF6FF") : (isSelected || selected) ? "#EFF6FF" : c.white,
        border: `2px solid ${isDropTarget ? (dropIsCopy ? "#16a34a" : c.brand) : (isSelected || selected) ? c.brand : hovered ? c.borderMid : c.border}`,
        borderRadius: 9,
        padding: "11px 13px",
        cursor: "pointer",
        position: "relative",
        boxShadow: hovered && !isSelected && !selected && !isDropTarget ? "0 2px 8px rgba(0,0,0,0.07)" : "none",
        transition: "border-color 0.12s, box-shadow 0.12s, background 0.12s",
      }}
    >
      {/* Header row: checkbox + type badge left, horizon right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {onCheckboxClick && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              onClick={onCheckboxClick}
              style={{
                cursor: "pointer",
                accentColor: c.ink,
                width: 13, height: 13,
                flexShrink: 0,
                opacity: showCheckbox ? 1 : 0,
                transition: "opacity 0.12s",
              }}
            />
          )}
          <SubtypeTag sub={cluster.subtype} />
        </div>
        {cluster.horizon && <HorizTag h={cluster.horizon} />}
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

      {/* Footer row: input count left, likelihood right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        {isDropTarget ? (
          <span style={{
            fontSize: 10, fontWeight: 600,
            padding: "1px 7px", borderRadius: 4,
            background: dropIsCopy ? "#16a34a" : c.brand,
            color: "#fff",
          }}>
            {dropIsCopy ? "Copy" : "Move"}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: c.hint }}>
            {cluster.input_ids?.length || 0} inputs
          </span>
        )}
        {cluster.likelihood && !isDropTarget && <LikelihoodTag l={cluster.likelihood} />}
      </div>
    </div>
  );
}

/**
 * ClusterCard — card-view item for a cluster inside the ClustersPanel.
 * Layout: header row (type left / horizon right), name, description, footer (count / likelihood).
 */
import { useState } from "react";
import clsx from "clsx";
import { SubtypeTag, HorizTag } from "../shared/Tag.jsx";

// Local LikelihoodTag borrows the Horizon green/blue/amber family (matching
// ClustersPanel.jsx / ClusterDetailPanel.jsx) — deliberately NOT the warm-neutral
// Tag.LikelihoodTag, to preserve this card's existing appearance.
const LIKELIHOOD_CLASSES = {
  Probable:  "text-green-700 bg-green-50 border-green-border",
  Plausible: "text-blue-700 bg-blue-50 border-blue-border",
  Possible:  "text-amber-700 bg-amber-50 border-amber-border",
};

function LikelihoodTag({ l }) {
  if (!l) return null;
  return (
    <span className={clsx(
      "text-[10px] px-1.75 py-0.5 rounded-pill border whitespace-nowrap",
      LIKELIHOOD_CLASSES[l] || "text-hint border-border",
    )}>
      {l}
    </span>
  );
}

export function ClusterCard({ cluster, selected = false, onClick, isDropTarget = false, dropIsCopy = false, isSelected = false, onCheckboxClick = null, anySelected = false }) {
  const [hovered, setHovered] = useState(false);

  const showCheckbox = hovered || anySelected || isSelected;
  const activeSelected = isSelected || selected;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={clsx(
        // rounded-[9px]: no 9px radius token (rounded-container is 8px) — kept exact.
        "relative flex flex-col h-full box-border cursor-pointer rounded-[9px] border-2 px-[13px] py-[11px]",
        "transition-[background-color,border-color,box-shadow] duration-[120ms]",
        // Background
        isDropTarget ? (dropIsCopy ? "bg-green-25" : "bg-brand-bg")
          : activeSelected ? "bg-brand-bg" : "bg-white",
        // Border color
        isDropTarget ? (dropIsCopy ? "border-green-600" : "border-brand")
          : activeSelected ? "border-brand"
          : hovered ? "border-border-mid" : "border-border",
        // Hover lift shadow (0 2px 8px) — no matching shadow token (--shadow-hover is
        // 0 1px 6px) — kept exact.
        hovered && !activeSelected && !isDropTarget
          ? "shadow-[0_2px_8px_rgba(0,0,0,0.07)]" : "shadow-none",
      )}
    >
      {/* Header row: checkbox + type badge left, horizon right */}
      <div className="flex items-center justify-between mb-1.75">
        <div className="flex items-center gap-1.25">
          {onCheckboxClick && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              onClick={onCheckboxClick}
              className={clsx(
                "w-[13px] h-[13px] shrink-0 cursor-pointer accent-ink transition-opacity duration-[120ms]",
                showCheckbox ? "opacity-100" : "opacity-0",
              )}
            />
          )}
          <SubtypeTag sub={cluster.subtype} />
        </div>
        {cluster.horizon && <HorizTag h={cluster.horizon} />}
      </div>

      {/* Name */}
      <div className="text-ui font-semibold text-ink mb-1.25 leading-[1.35]">
        {cluster.name}
      </div>

      {/* Description — always rendered to reserve 2-line height */}
      <div className="text-[11px] text-muted leading-body min-h-[34px] line-clamp-2">
        {cluster.description}
      </div>

      {/* Footer row: input count left, likelihood right — pinned to bottom */}
      <div className="flex items-center justify-between mt-auto pt-2">
        {isDropTarget ? (
          <span className={clsx(
            "text-[10px] font-semibold py-px px-1.75 rounded text-white",
            dropIsCopy ? "bg-green-600" : "bg-brand",
          )}>
            {dropIsCopy ? "Copy" : "Move"}
          </span>
        ) : (
          <span className="text-[11px] text-hint">
            {cluster.input_ids?.length || 0} inputs
          </span>
        )}
        {cluster.likelihood && !isDropTarget && <LikelihoodTag l={cluster.likelihood} />}
      </div>
    </div>
  );
}

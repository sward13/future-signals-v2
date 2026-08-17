/**
 * DomainMultiSelect — shared multi-select domain picker.
 *
 * Onboarding renders it with allowCustom={false} (eight predefined domains,
 * single- or multi-select). New Project / Edit render it with allowCustom={true}
 * (adds a "Custom / Other" tile that reveals a required freeform name field,
 * independent of the predefined selections).
 *
 * Fully controlled. The parent owns:
 *   - `domains`        string[] of selected predefined labels
 *   - `customDomain`   the freeform custom name (only meaningful when custom is on)
 *   - `customSelected` whether the Custom / Other tile is toggled on
 * The parent tracks `customSelected` so it can enforce "custom name required
 * when the tile is on". Onboarding (allowCustom={false}) ignores it.
 */
import { c, inp } from "../../styles/tokens.js";
import { PREDEFINED_DOMAINS, CUSTOM_DOMAIN_LABEL } from "../../lib/projectDomains.js";

export function DomainMultiSelect({
  domains,
  customDomain = "",
  customSelected = false,
  onDomainsChange,
  onCustomDomainChange,
  onCustomSelectedChange,
  allowCustom = false,
  options = PREDEFINED_DOMAINS,
}) {
  const toggle = (label) => {
    if (domains.includes(label)) onDomainsChange(domains.filter((d) => d !== label));
    else onDomainsChange([...domains, label]);
  };

  const toggleCustom = () => {
    if (customSelected) {
      onCustomSelectedChange?.(false);
      onCustomDomainChange?.("");
    } else {
      onCustomSelectedChange?.(true);
    }
  };

  const tile = (label, active, onClick) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 13px",
        borderRadius: 8,
        border: `1px solid ${active ? c.brand : c.borderMid}`,
        background: active ? c.brandBg : c.white,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        color: active ? c.blue700 : c.ink,
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s, color 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {options.map((label) => tile(label, domains.includes(label), () => toggle(label)))}
        {allowCustom && tile(CUSTOM_DOMAIN_LABEL, customSelected, toggleCustom)}
      </div>
      {allowCustom && customSelected && (
        <div style={{ marginTop: 8 }}>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => onCustomDomainChange?.(e.target.value)}
            placeholder="Name your domain, e.g. Space & Aerospace"
            style={{ ...inp }}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

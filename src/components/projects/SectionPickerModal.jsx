/**
 * SectionPickerModal — choose which sections to publish, then publish that
 * selection. Overview and Appendix are always included (shown checked+disabled).
 * System Map / System Analysis are simple toggles. Future Models expands to
 * Scenarios / Preferred Futures / Strategic Options; a sub-type with >1 item
 * shows a per-item multi-select, a sub-type with 0 items isn't shown at all.
 *
 * Pure selection logic lives in ../../publish/selectionModel.js. Async submit
 * follows the same local busy/error pattern as AddSourceModal / ExportModal.
 *
 * @param {{
 *   available: { scenarios: object[], preferredFutures: object[], strategicOptions: object[] },
 *   currentSelection: object|null,
 *   onClose: () => void,
 *   onSubmit: (selection: object) => Promise<void>,
 * }} props
 */
import { useState } from "react";
import { c, btnP, btnSec } from "../../styles/tokens.js";
import {
  pickerStateFromSelection,
  selectionFromPickerState,
  visibleSubtypes,
} from "../../publish/selectionModel.js";

function Check({ label, checked, disabled, onChange, sub, muted }) {
  return (
    <label
      style={{
        display: "flex", alignItems: "center", gap: 9, cursor: disabled ? "default" : "pointer",
        padding: "5px 0", fontSize: sub ? 12 : 13, color: muted ? c.hint : c.ink,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={disabled ? undefined : onChange}
        style={{ width: 15, height: 15, accentColor: c.ink, cursor: disabled ? "default" : "pointer", margin: 0 }}
      />
      <span>{label}</span>
    </label>
  );
}

export function SectionPickerModal({ available, currentSelection, onClose, onSubmit }) {
  const [picker, setPicker] = useState(() => pickerStateFromSelection(currentSelection, available));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const subs = visibleSubtypes(available); // hides sub-types with zero items

  const setTop = (key) => () => setPicker((p) => ({ ...p, [key]: !p[key] }));
  const setSub = (key) => () =>
    setPicker((p) => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }));
  const toggleItem = (key, id) => () =>
    setPicker((p) => {
      const has = p[key].selectedIds.includes(id);
      const selectedIds = has ? p[key].selectedIds.filter((x) => x !== id) : [...p[key].selectedIds, id];
      return { ...p, [key]: { ...p[key], selectedIds } };
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(selectionFromPickerState(picker, available));
      onClose(); // success — parent has applied the result
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const indent = { marginLeft: 24 };

  return (
    <div
      onClick={busy ? undefined : onClose}
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: c.white, borderRadius: 12, width: 440, maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", overflow: "hidden" }}
      >
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: c.ink }}>Choose what to publish</div>
          <div style={{ fontSize: 11, color: c.hint, marginTop: 3 }}>Overview and the appendix are always included.</div>
        </div>

        <div style={{ padding: "12px 22px", overflowY: "auto" }}>
          <Check label="Overview" checked disabled muted />
          <Check label="System Map" checked={picker.systemMap} onChange={setTop("systemMap")} />
          <Check label="System Analysis" checked={picker.systemAnalysis} onChange={setTop("systemAnalysis")} />

          <Check label="Future Models" checked={picker.futureModels} onChange={setTop("futureModels")} />
          {picker.futureModels && subs.length > 0 && (
            <div style={indent}>
              {subs.map(({ key, label }) => {
                const items = available[key];
                const sub = picker[key];
                return (
                  <div key={key}>
                    <Check label={label} checked={sub.enabled} onChange={setSub(key)} sub />
                    {sub.enabled && items.length > 1 && (
                      <div style={indent}>
                        {items.map((it) => (
                          <Check
                            key={it.id}
                            label={it.name || it.title || "Untitled"}
                            checked={sub.selectedIds.includes(it.id)}
                            onChange={toggleItem(key, it.id)}
                            sub
                            muted
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Check label="Appendix" checked disabled muted />

          {error && <div style={{ fontSize: 11, color: c.red800, marginTop: 8 }}>{error}</div>}
        </div>

        <div style={{ padding: "12px 22px 16px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={{ ...btnSec, fontSize: 12, padding: "7px 16px" }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...btnP, fontSize: 12, padding: "8px 18px", opacity: busy ? 0.5 : 1 }}>
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

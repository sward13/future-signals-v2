/**
 * TemplatePickerModal — System Map background template picker.
 * Centered modal, matching AddSourceModal.jsx's shell (backdrop + centered
 * box, portal-based). Selecting a template applies it immediately — no
 * separate "apply" step, matching the app's low-friction interaction style
 * elsewhere (e.g. the Scenario builder's cluster force picker).
 */
import { createPortal } from "react-dom";
import { c, btnG } from "../../styles/tokens.js";

/** Group templates by category, preserving each group's first-seen order; null/blank category → "Other". */
function groupByCategory(templates) {
  const groups = new Map();
  for (const t of templates) {
    const key = t.category?.trim() || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups.entries()];
}

export function TemplatePickerModal({ open, onClose, templates, currentTemplateId, onSelect, onRemove }) {
  if (!open) return null;

  const grouped = groupByCategory(templates);

  const handleSelect = (templateId) => {
    onSelect(templateId);
    onClose();
  };

  const handleRemove = () => {
    onRemove();
    onClose();
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: c.white, borderRadius: 12, padding: "22px 26px 24px",
        boxShadow: "0 16px 48px rgba(0,0,0,0.18)", zIndex: 501, width: 640,
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        fontFamily: "inherit",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink }}>Background template</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: c.faint, fontSize: 16, padding: "0 2px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 11, color: c.hint, marginBottom: 16 }}>
          Pick a foresight-framework template to render behind your clusters as an organizing scaffold.
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, marginBottom: currentTemplateId ? 16 : 0 }}>
          {templates.length === 0 ? (
            <div style={{
              padding: "28px 16px", textAlign: "center", fontSize: 12, color: c.hint,
              border: `1px dashed ${c.border}`, borderRadius: 8,
            }}>
              No templates available yet. Check back soon.
            </div>
          ) : (
            grouped.map(([category, items]) => (
              <div key={category} style={{ marginBottom: 18 }}>
                {grouped.length > 1 && (
                  <div style={{
                    fontSize: 10, fontWeight: 500, color: c.hint,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    marginBottom: 8,
                  }}>
                    {category}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {items.map((t) => {
                    const active = t.id === currentTemplateId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelect(t.id)}
                        title={t.description || t.name}
                        style={{
                          display: "flex", flexDirection: "column", gap: 6,
                          padding: 8, borderRadius: 8, cursor: "pointer",
                          background: active ? c.brandBg : c.white,
                          border: `1.5px solid ${active ? c.brand : c.border}`,
                          fontFamily: "inherit", textAlign: "left",
                        }}
                      >
                        <div style={{
                          width: "100%", aspectRatio: "4 / 3", borderRadius: 5,
                          background: c.fieldBg, overflow: "hidden",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <img
                            src={t.thumbnail_url}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, lineHeight: 1.3 }}>
                          {t.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {currentTemplateId && (
          <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 14 }}>
            <button
              type="button"
              onClick={handleRemove}
              style={{ ...btnG, fontSize: 11, color: c.red800, padding: "5px 0" }}
            >
              Remove background
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

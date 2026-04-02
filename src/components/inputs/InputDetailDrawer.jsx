/**
 * InputDetailDrawer — right-side drawer showing full input detail with read/edit mode.
 * Read-only by default; clicking Edit makes all fields editable.
 * @param {{ inputId: string|null, inputs: object[], projects: object[], onClose: () => void, onSave: (id, fields) => void }} props
 */
import { useState, useEffect } from "react";
import { c, inp, ta, btnP, btnSec, btnG, fl } from "../../styles/tokens.js";
import { INPUT_TYPES, ThreeCardSelector, SteepleSelector, HorizonSelector, TypeSwitcherChip } from "./InputFormFields.jsx";
import { ConfirmDialog } from "../shared/ConfirmDialog.jsx";

const HORIZON_COLORS = {
  H1: [c.green700, c.green50, c.greenBorder],
  H2: [c.blue700,  c.blue50,  c.blueBorder],
  H3: [c.amber700, c.amber50, c.amberBorder],
};

function TypeChip({ typeId }) {
  const t = INPUT_TYPES.find((x) => x.id === typeId) || INPUT_TYPES[0];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 500,
      padding: "3px 10px", borderRadius: 20,
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
    }}>
      {t.icon} {t.label}
    </span>
  );
}

// Strength card options — same config as Add panel
const STRENGTH_CARD_OPTIONS = [
  { value: "Weak",     title: "Weak",     desc: "Single source, early emergence",           dotColor: c.red800 },
  { value: "Moderate", title: "Moderate", desc: "Multiple sources, visible in a community",  dotColor: c.amber700 },
  { value: "High",     title: "High",     desc: "Widespread, data-backed, mainstream",       dotColor: c.green700 },
];

const CONFIDENCE_CARD_OPTIONS = [
  { value: "Low",    title: "Low",    desc: "Blog, social media, or unverified source",       dotColor: c.red800 },
  { value: "Medium", title: "Medium", desc: "Quality journalism or industry report",           dotColor: c.amber700 },
  { value: "High",   title: "High",   desc: "Peer-reviewed research or official statistics",  dotColor: c.green700 },
];

export function InputDetailDrawer({ inputId, inputs, projects, clusters = [], onClose, onSave, onDelete }) {
  const input = inputs.find((i) => i.id === inputId) || null;

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (input) {
      setFields({
        name:              input.name              || "",
        description:       input.description       || "",
        source_url:        input.source_url        || "",
        subtype:           input.subtype           || "signal",
        steepled:          input.steepled          || [],
        strength:          input.strength          || null,
        horizon:           input.horizon           || null,
        source_confidence: input.source_confidence || null,
        project_id:        input.project_id        || "",
      });
    }
    setEditing(false);
  }, [inputId]);

  if (!input) return null;

  const set = (key, val) => setFields((f) => ({ ...f, [key]: val }));
  const toggleSteeple = (cat) => set("steepled", fields.steepled.includes(cat) ? fields.steepled.filter((x) => x !== cat) : [...fields.steepled, cat]);

  const handleSave = () => {
    onSave(input.id, fields);
    setEditing(false);
  };

  const handleCancel = () => {
    setFields({
      name: input.name || "", description: input.description || "",
      source_url: input.source_url || "", subtype: input.subtype || "signal",
      steepled: input.steepled || [], strength: input.strength || null,
      horizon: input.horizon || null, source_confidence: input.source_confidence || null,
      project_id: input.project_id || "",
    });
    setEditing(false);
  };

  const assignedProject  = projects.find((p) => p.id === (fields.project_id || input.project_id));
  const assignedClusters = clusters.filter((cl) => (cl.input_ids || []).includes(input.id));

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 300 }} />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 460,
        background: c.white, borderLeft: `1px solid ${c.border}`,
        zIndex: 301, display: "flex", flexDirection: "column",
        animation: "drawerSlideIn 0.28s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px 14px", borderBottom: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <TypeChip typeId={input.subtype} />
          <div style={{ flex: 1 }} />
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ ...btnSec, fontSize: 11, padding: "5px 14px" }}>
              Edit
            </button>
          )}
          {onDelete && !editing && (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ fontSize: 11, padding: "5px 14px", borderRadius: 8, border: `1px solid ${c.redBorder}`, background: "transparent", color: c.red800, cursor: "pointer", fontFamily: "inherit" }}
            >
              Delete
            </button>
          )}
          <button onClick={onClose} style={{ ...btnG, fontSize: 16, padding: "2px 6px", color: c.muted }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            {editing ? (
              <>
                <div style={fl}>Title</div>
                <input style={inp} value={fields.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </>
            ) : (
              <div style={{ fontSize: 17, fontWeight: 500, color: c.ink, lineHeight: 1.35 }}>{input.name}</div>
            )}
          </div>

          {/* Type switcher (edit only) — same chip+dropdown as Add panel */}
          {editing && (
            <>
              <TypeSwitcherChip selectedType={fields.subtype} onChange={(v) => set("subtype", v)} />
              {/* Description banner for selected type */}
              {(() => {
                const t = INPUT_TYPES.find((x) => x.id === fields.subtype);
                if (!t) return null;
                return (
                  <div style={{
                    padding: "10px 14px", borderRadius: 8,
                    background: t.bg, border: `1px solid ${t.border}`,
                    fontSize: 12, color: t.color, lineHeight: 1.55, marginBottom: 22,
                  }}>
                    {t.description}
                  </div>
                );
              })()}
            </>
          )}

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            {editing ? (
              <>
                <div style={fl}>Description</div>
                <textarea style={ta} rows={3} value={fields.description} onChange={(e) => set("description", e.target.value)} />
              </>
            ) : input.description ? (
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.65 }}>{input.description}</div>
            ) : (
              <div style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>No description.</div>
            )}
          </div>

          {/* Source URL */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>Source</div>
            {editing ? (
              <input style={inp} type="url" value={fields.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" />
            ) : input.source_url ? (
              <a href={input.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: c.blue700, wordBreak: "break-all" }}>
                {input.source_url}
              </a>
            ) : (
              <span style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>No source URL.</span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: c.border, margin: "16px 0" }} />

          {/* STEEPLED */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>STEEPLED</div>
            {editing ? (
              <SteepleSelector selected={fields.steepled} onToggle={toggleSteeple} />
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(input.steepled || []).length === 0 ? (
                  <span style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>None tagged.</span>
                ) : (
                  (input.steepled || []).map((t) => (
                    <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}` }}>{t}</span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Cluster membership — read-only; managed in Clustering screen */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>Cluster</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {assignedClusters.length === 0 ? (
                <span style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>Unassigned</span>
              ) : (
                assignedClusters.map((cl) => (
                  <span key={cl.id} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}` }}>
                    {cl.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Signal strength */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>Signal strength</div>
            {editing ? (
              <ThreeCardSelector
                label=""
                selected={fields.strength}
                onSelect={(v) => set("strength", v)}
                options={STRENGTH_CARD_OPTIONS}
              />
            ) : (
              <span style={{
                fontSize: 11, padding: "2px 9px", borderRadius: 10,
                background: input.strength === "High" ? c.green50 : input.strength === "Moderate" ? c.amber50 : input.strength === "Weak" ? c.red50 : c.surfaceAlt,
                color: input.strength === "High" ? c.green700 : input.strength === "Moderate" ? c.amber700 : input.strength === "Weak" ? c.red800 : c.hint,
                border: `1px solid ${input.strength === "High" ? c.greenBorder : input.strength === "Moderate" ? c.amberBorder : input.strength === "Weak" ? c.redBorder : c.border}`,
              }}>
                {input.strength || "Not set"}
              </span>
            )}
          </div>

          {/* Source confidence */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>Source confidence</div>
            {editing ? (
              <ThreeCardSelector
                label=""
                selected={fields.source_confidence}
                onSelect={(v) => set("source_confidence", v)}
                options={CONFIDENCE_CARD_OPTIONS}
              />
            ) : (
              <span style={{ fontSize: 12, color: input.source_confidence ? c.ink : c.hint, fontStyle: input.source_confidence ? "normal" : "italic" }}>
                {input.source_confidence || "Not set"}
              </span>
            )}
          </div>

          {/* Horizon */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>Horizon</div>
            {editing ? (
              <HorizonSelector selected={fields.horizon} onSelect={(v) => set("horizon", v)} />
            ) : (
              (() => {
                const h = input.horizon;
                const [col, bg, brd] = HORIZON_COLORS[h] || [c.hint, "transparent", c.border];
                return (
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 10, background: bg, color: col, border: `1px solid ${brd}` }}>
                    {h || "Not set"}
                  </span>
                );
              })()
            )}
          </div>

          {/* Project assignment */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 6 }}>Project</div>
            {editing ? (
              <select
                style={{ ...inp, appearance: "none" }}
                value={fields.project_id}
                onChange={(e) => set("project_id", e.target.value)}
              >
                <option value="">Inbox (unassigned)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <span style={{
                fontSize: 12, padding: "2px 9px", borderRadius: 8,
                background: assignedProject ? c.blue50 : c.surfaceAlt,
                color: assignedProject ? c.blue700 : c.hint,
                border: `1px solid ${assignedProject ? c.blueBorder : c.border}`,
              }}>
                {assignedProject ? assignedProject.name : "Inbox"}
              </span>
            )}
          </div>
        </div>

        {/* Footer (edit mode only) */}
        {editing && (
          <div style={{
            padding: "14px 24px 20px", borderTop: `1px solid ${c.border}`,
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0,
          }}>
            <button onClick={handleCancel} style={btnSec}>Cancel</button>
            <button onClick={handleSave} style={btnP}>Save changes</button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${input.name}"?`}
          message="This will permanently remove the input and unlink it from any clusters. This cannot be undone."
          onConfirm={onDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

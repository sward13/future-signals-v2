/**
 * Inbox screen — shows unassigned inputs (project_id === null).
 * Two tables: My Inputs (manual) and AI Suggested (scanner).
 * Three view densities (List / Compact / Card), full-text search,
 * inline filter panel (STEEPLED / Quality / Horizon), and multi-select
 * bulk actions (add to project, dismiss).
 * @param {{ appState: object }} props
 */
import { useState, useMemo } from "react";
import { c, inp, btnP, btnSm, btnSec, btnG } from "../../styles/tokens.js";
import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { HorizTag } from "../shared/Tag.jsx";

const STEEPLED_CATS = ["Social","Technological","Economic","Environmental","Political","Legal","Ethical","Demographic"];
const STEEPLED_ABB  = { Social:"Soc", Technological:"Tech", Economic:"Eco", Environmental:"Env", Political:"Pol", Legal:"Leg", Ethical:"Eth", Demographic:"Dem" };
const QUALITY_OPTS  = ["Emerging","Established","Confirmed"];
const HORIZON_OPTS  = ["H1","H2","H3"];

const EMPTY_FILTERS = { steepled: [], quality: [], horizon: [] };

const QUALITY_COLORS = {
  Emerging:    [c.amber700, c.amber50, c.amberBorder],
  Established: [c.blue700,  c.blue50,  c.blueBorder],
  Confirmed:   [c.green700, c.green50, c.greenBorder],
};

const AI_PREVIEW_COUNT = 10;

// Column widths for list/table layout
const COL = { actions: 310 };

function QualityPill({ value }) {
  if (!value) return <span style={{ fontSize: 10, color: c.hint }}>—</span>;
  const [col, bg, brd] = QUALITY_COLORS[value] || [c.hint, c.surfaceAlt, c.border];
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: bg, color: col, border: `1px solid ${brd}`, whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

function RowCheckbox({ checked, visible }) {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: 3, flexShrink: 0,
      border: `1.5px solid ${checked ? c.ink : visible ? c.borderMid : "rgba(0,0,0,0.12)"}`,
      background: checked ? c.ink : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "border-color 0.15s, background 0.15s",
      pointerEvents: "none",
    }}>
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 10px", borderRadius: 10, fontSize: 11,
      border: `1px solid ${active ? c.ink : c.border}`,
      background: active ? c.ink : c.white,
      color: active ? c.white : c.muted,
      cursor: "pointer", fontFamily: "inherit", fontWeight: active ? 500 : 400,
      whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

function FilterPanel({ filters, onChange, onClear, activeCount }) {
  const toggle = (key, val) => {
    const arr = filters[key];
    onChange({ ...filters, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] });
  };
  return (
    <div style={{
      padding: "12px 16px 14px", background: c.white,
      border: `1px solid ${c.border}`, borderRadius: 9, marginBottom: 14,
    }}>
      <div style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 7 }}>
          STEEPLED
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {STEEPLED_CATS.map((cat) => (
            <FilterPill key={cat} label={cat} active={filters.steepled.includes(cat)} onClick={() => toggle("steepled", cat)} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 28, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 7 }}>Signal Quality</div>
          <div style={{ display: "flex", gap: 5 }}>
            {QUALITY_OPTS.map((s) => (
              <FilterPill key={s} label={s} active={filters.quality.includes(s)} onClick={() => toggle("quality", s)} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, marginBottom: 7 }}>Horizon</div>
          <div style={{ display: "flex", gap: 5 }}>
            {HORIZON_OPTS.map((h) => (
              <FilterPill key={h} label={h} active={filters.horizon.includes(h)} onClick={() => toggle("horizon", h)} />
            ))}
          </div>
        </div>
        {activeCount > 0 && (
          <button onClick={onClear} style={{
            fontSize: 11, color: c.muted, background: "none", border: "none",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Project picker popover ───────────────────────────────────────────────────

function ProjectPickerPopover({ projects, onSelect, onClose, onCreateProject }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
      <div style={{
        position: "absolute", top: "100%", left: 0, marginTop: 4,
        background: c.white, border: `1px solid ${c.border}`,
        borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
        minWidth: 240, zIndex: 51, overflow: "hidden",
      }}>
        {projects.length === 0 ? (
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: c.hint, marginBottom: 8 }}>No projects yet.</div>
            <button onClick={() => { onClose(); onCreateProject(); }} style={{ fontSize: 11, color: c.blue700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              + Create project
            </button>
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {projects.map((p) => (
              <button key={p.id} onClick={() => onSelect(p)} style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 14px",
                background: "transparent", border: "none",
                textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                borderBottom: `1px solid ${c.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: c.hint }}>{p.domain}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${c.border}` }}>
          <button onClick={onClose} style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Single-input project picker modal ───────────────────────────────────────

function ProjectPickerModal({ projects, onSelect, onClose, onCreateProject }) {
  const [hovered, setHovered] = useState(null);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 400 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 401, width: 360, background: c.white, borderRadius: 12,
        border: `1px solid ${c.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.16)", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, marginBottom: 2 }}>Save to project</div>
          <div style={{ fontSize: 11, color: c.muted }}>Select a project to assign this input to.</div>
        </div>
        {projects.length === 0 ? (
          <div style={{ padding: "28px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: c.muted, marginBottom: 12 }}>No projects yet.</div>
            <button onClick={() => { onClose(); onCreateProject(); }} style={{ fontSize: 12, color: c.blue700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              + Create project
            </button>
          </div>
        ) : (
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {projects.map((p) => (
              <div key={p.id} onClick={() => onSelect(p)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 20px", cursor: "pointer",
                  background: hovered === p.id ? c.surfaceAlt : c.white,
                  borderBottom: `1px solid ${c.border}`,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: c.muted }}>{p.domain}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ fontSize: 11, color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Table section header ─────────────────────────────────────────────────────

function SectionHeader({ title, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>{title}</div>
      {count > 0 && (
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 10,
          background: "rgba(0,0,0,0.06)", color: c.muted, fontWeight: 500,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ─── List table header ────────────────────────────────────────────────────────

function ListHeader() {
  const cell = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: c.hint, flexShrink: 0 };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 14px", height: 30,
      borderBottom: "0.5px solid rgba(0,0,0,0.09)",
    }}>
      <div style={{ width: 15, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, ...cell }}>Title</div>
      <div style={{ width: COL.actions, flexShrink: 0 }} />
    </div>
  );
}

// ─── List row (flat single-row) ────────────────────────────────────────────────

function ListRow({ input, isScannerSuggested, suggestedProjects, onSaveToProject, onAccept, onDismissSuggested, onOpen, selected, onToggle, anySelected }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 14px", minHeight: 38,
        background: selected ? c.surfaceAlt : hovered ? "rgba(0,0,0,0.02)" : c.white,
        borderBottom: `1px solid ${c.border}`,
        cursor: "pointer",
        transition: "background 0.08s",
      }}
    >
      <div onClick={(e) => { e.stopPropagation(); onToggle(input.id); }} style={{ cursor: "pointer", flexShrink: 0 }}>
        <RowCheckbox checked={selected} visible={anySelected || hovered} />
      </div>

      {/* Title + suggested projects hint */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: 8 }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: c.ink,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {input.name}
        </div>
        {isScannerSuggested && suggestedProjects.length > 0 && (
          <div style={{ fontSize: 11, color: c.hint, marginTop: 2 }}>
            Suggested for: {suggestedProjects.slice(0, 2).map((p) => p.name).join(", ")}
          </div>
        )}
      </div>

      {/* Date + actions */}
      <div style={{ width: COL.actions, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: c.hint }}>{formatDate(input.created_at)}</span>
        {isScannerSuggested && suggestedProjects.length > 0 ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              style={{ ...btnSm, fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }}
            >
              Accept →
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }}
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 7, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              Add to project →
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDismissSuggested(); }}
              style={{ fontSize: 10, padding: "3px 6px", background: "none", border: "none", color: c.hint, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              Dismiss
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }}
            style={{ ...btnSm, fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }}
          >
            Add to project →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Compact card (2-col grid) ────────────────────────────────────────────────

function CompactCard({ input, isSeeded, isScannerSuggested, suggestedProjects, projects, savedProjectId, onSaveToProject, onAccept, onDismissSuggested, onOpen, selected, onToggle, anySelected }) {
  const [hovered, setHovered] = useState(false);
  const project = savedProjectId ? projects.find((p) => p.id === savedProjectId) : null;
  const steepled = input.steepled || [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: c.white,
        border: `1px solid ${selected ? c.borderMid : c.border}`,
        borderRadius: 9, padding: "11px 13px",
        cursor: "pointer", transition: "border-color 0.12s",
      }}
    >
      {/* Top: checkbox + quality + date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div onClick={(e) => { e.stopPropagation(); onToggle(input.id); }} style={{ cursor: "pointer" }}>
            <RowCheckbox checked={selected} visible={anySelected || hovered} />
          </div>
          <QualityPill value={input.signal_quality} />
        </div>
        <span style={{ fontSize: 10, color: c.hint }}>{formatDate(input.created_at)}</span>
      </div>

      {/* Title */}
      <div
        onClick={() => anySelected ? onToggle(input.id) : onOpen()}
        style={{
          fontSize: 12, fontWeight: 500, color: c.ink, lineHeight: 1.4, marginBottom: 3,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}
      >
        {input.name}
      </div>

      {isScannerSuggested && suggestedProjects.length > 0 && (
        <div style={{ fontSize: 11, color: c.hint, marginBottom: 5 }}>
          Suggested for: {suggestedProjects.slice(0, 2).map((p) => p.name).join(", ")}
        </div>
      )}

      {/* Description snippet */}
      {(input.description || input.desc) && (
        <div style={{
          fontSize: 11, color: c.muted, lineHeight: 1.5, marginBottom: 8,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {input.description || input.desc}
        </div>
      )}

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 8 }}>
        {steepled.slice(0, 3).map((t) => (
          <span key={t} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#f0f0ee", color: c.muted }}>
            {STEEPLED_ABB[t] || t}
          </span>
        ))}
        {steepled.length > 3 && <span style={{ fontSize: 9, color: c.hint }}>+{steepled.length - 3}</span>}
        <HorizTag h={input.horizon} />
      </div>

      {/* Actions */}
      {!anySelected && (
        savedProjectId ? (
          <span style={{ fontSize: 10, color: c.green700 }}>✓ {project?.name || "Saved"}</span>
        ) : isScannerSuggested && suggestedProjects.length > 0 ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, background: c.ink, color: c.white, border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Accept →
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }}
              style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, cursor: "pointer", fontFamily: "inherit" }}
            >
              Add to project →
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDismissSuggested(); }}
              style={{ fontSize: 10, padding: "3px 6px", background: "none", border: "none", color: c.hint, cursor: "pointer", fontFamily: "inherit" }}
            >
              Dismiss
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }}
            style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, background: c.ink, color: c.white, border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Add to project →
          </button>
        )
      )}
    </div>
  );
}

// ─── Full card (Card view) ────────────────────────────────────────────────────

function FullCard({ input, isScannerSuggested, suggestedProjects, projects, savedProjectId, onSaveToProject, onAccept, onDismissSuggested, onDismiss, onOpen, selected, onToggle, anySelected }) {
  const [hovered, setHovered] = useState(false);
  const project = savedProjectId ? projects.find((p) => p.id === savedProjectId) : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: c.white,
        border: `1px solid ${selected ? c.borderMid : c.border}`,
        borderRadius: 10, padding: "14px 16px",
        transition: "border-color 0.15s",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}
    >
      <div onClick={(e) => { e.stopPropagation(); onToggle(input.id); }} style={{ paddingTop: 2, flexShrink: 0, cursor: "pointer" }}>
        <RowCheckbox checked={selected} visible={anySelected || hovered} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          {input.subtype && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f0f0ee", color: c.faint }}>
              {input.subtype}
            </span>
          )}
          <span style={{ marginLeft: "auto" }}><QualityPill value={input.signal_quality} /></span>
        </div>

        <div
          onClick={(e) => { e.stopPropagation(); onToggle(input.id); }}
          style={{ fontSize: 13, fontWeight: 500, color: c.ink, lineHeight: 1.35, marginBottom: isScannerSuggested && suggestedProjects.length > 0 ? 2 : 5, cursor: "pointer" }}
        >
          {input.name}
        </div>

        {isScannerSuggested && suggestedProjects.length > 0 && (
          <div style={{ fontSize: 11, color: c.hint, marginBottom: 8 }}>
            Suggested for: {suggestedProjects.slice(0, 2).map((p) => p.name).join(", ")}
          </div>
        )}

        {(input.description || input.desc) && (
          <div
            onClick={anySelected ? undefined : onOpen}
            style={{ fontSize: 11, color: c.muted, lineHeight: 1.6, marginBottom: 10, cursor: anySelected ? "default" : "pointer" }}
          >
            {input.description || input.desc}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(input.steepled || []).map((cat) => (
            <span key={cat} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f0f0ee", color: c.muted }}>
              {cat}
            </span>
          ))}
          <HorizTag h={input.horizon} />
          <span style={{ fontSize: 10, color: c.hint }}>{formatDate(input.created_at)}</span>

          {!anySelected && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {savedProjectId ? (
                <span style={{ fontSize: 11, color: c.green700, background: c.green50, border: `1px solid ${c.greenBorder}`, borderRadius: 6, padding: "3px 9px" }}>
                  ✓ Saved to {project?.name || "project"}
                </span>
              ) : isScannerSuggested && suggestedProjects.length > 0 ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onDismissSuggested(); }} style={{ ...btnG, fontSize: 11, padding: "4px 8px", color: c.hint }}>
                    Dismiss
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onAccept(); }} style={{ padding: "4px 12px", borderRadius: 7, background: c.ink, color: c.white, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    Accept →
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }} style={{ padding: "4px 12px", borderRadius: 7, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    Add to project →
                  </button>
                </>
              ) : (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onDismiss(input.id); }} style={{ ...btnG, fontSize: 11, padding: "4px 8px", color: c.hint }}>
                    Dismiss
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onSaveToProject(input.id); }} style={{ padding: "4px 12px", borderRadius: 7, background: c.ink, color: c.white, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    Add to project →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared filter function ────────────────────────────────────────────────────

function applyFilters(items, search, filters) {
  return items.filter((inp) => {
    if (search) {
      const q = search.toLowerCase();
      const inTitle = (inp.name || "").toLowerCase().includes(q);
      const inDesc  = (inp.description || inp.desc || "").toLowerCase().includes(q);
      if (!inTitle && !inDesc) return false;
    }
    if (filters.steepled.length > 0 && !filters.steepled.some((s) => (inp.steepled || []).includes(s))) return false;
    if (filters.quality.length  > 0 && !filters.quality.includes(inp.signal_quality))                   return false;
    if (filters.horizon.length  > 0 && !filters.horizon.includes(inp.horizon))                          return false;
    return true;
  });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Inbox({ appState }) {
  const {
    inputs, projects,
    addInput, dismissInput, dismissSuggestedInput, deleteInput,
    saveInputToProject, saveInputsToProject,
    showToast, openInputDetail, openProjectModal,
  } = appState;

  const [drawerOpen,        setDrawerOpen]        = useState(false);
  const [viewMode,          setViewMode]          = useState("list");
  const [search,            setSearch]            = useState("");
  const [filtersOpen,       setFiltersOpen]       = useState(false);
  const [filters,           setFilters]           = useState(EMPTY_FILTERS);
  const [savedToProject,    setSavedToProject]    = useState({});
  const [savingInputId,     setSavingInputId]     = useState(null);
  const [selectedInputIds,  setSelectedInputIds]  = useState([]);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [aiExpanded,        setAiExpanded]        = useState(false);

  const anySelected = selectedInputIds.length > 0;

  // All inbox inputs (base list — used for total count + selection reference)
  const allInboxInputs = useMemo(() =>
    [...inputs.filter((i) =>
      i.project_id === null &&
      !(i.is_seeded && i.metadata?.source === "scanner" && i.metadata?.dismissed)
    )].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [inputs]
  );

  // Split into manual vs AI suggested
  const manualInputs = useMemo(
    () => allInboxInputs.filter((i) => !(i.is_seeded && i.metadata?.source === "scanner")),
    [allInboxInputs]
  );
  const aiInputs = useMemo(
    () => allInboxInputs.filter((i) => i.is_seeded && i.metadata?.source === "scanner"),
    [allInboxInputs]
  );

  const activeFilterCount = filters.steepled.length + filters.quality.length + filters.horizon.length;
  const hasActiveSearch = search.length > 0 || activeFilterCount > 0;

  // Apply search + filters independently
  const filteredManual = useMemo(() => applyFilters(manualInputs, search, filters), [manualInputs, search, filters]);
  const filteredAI     = useMemo(() => applyFilters(aiInputs, search, filters),     [aiInputs, search, filters]);

  // AI items to display (collapsed = first 10)
  const visibleAI = aiExpanded ? filteredAI : filteredAI.slice(0, AI_PREVIEW_COUNT);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = (fields) => {
    addInput(fields);
    showToast("Input saved to Inbox");
    setDrawerOpen(false);
  };

  const handleDismiss = (id) => {
    dismissInput(id);
    showToast("Input dismissed");
  };

  const handleDismissSuggested = (inp) => {
    dismissSuggestedInput(inp);
    showToast("Signal dismissed");
  };

  const toggleSelect = (id) => {
    setSelectedInputIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const clearSelection = () => { setSelectedInputIds([]); setProjectPickerOpen(false); };

  const handleBulkAddToProject = (project) => {
    saveInputsToProject(selectedInputIds, project.id);
    const n = selectedInputIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} added to "${project.name}"`);
    clearSelection();
  };

  const handleBulkAccept = () => {
    const selectedInputs = allInboxInputs.filter((i) => selectedInputIds.includes(i.id));
    selectedInputs.forEach((inp) => {
      const topProject = inp.metadata?.suggested_projects?.[0];
      if (!topProject) return;
      saveInputToProject(inp.id, topProject.id);
      setSavedToProject((prev) => ({ ...prev, [inp.id]: topProject.id }));
    });
    const n = selectedInputs.length;
    showToast(`${n} signal${n !== 1 ? "s" : ""} accepted`);
    clearSelection();
  };

  const handleBulkDismiss = () => {
    const selectedInputs = allInboxInputs.filter((i) => selectedInputIds.includes(i.id));
    selectedInputs.forEach((inp) => {
      if (inp.is_seeded && inp.metadata?.source === "scanner") {
        dismissSuggestedInput(inp);
      } else {
        dismissInput(inp.id);
      }
    });
    const n = selectedInputs.length;
    showToast(`${n} signal${n !== 1 ? "s" : ""} dismissed`);
    clearSelection();
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const handleAccept = (inp) => {
    const topProject = inp.metadata?.suggested_projects?.[0];
    if (!topProject) return;
    saveInputToProject(inp.id, topProject.id);
    setSavedToProject((prev) => ({ ...prev, [inp.id]: topProject.id }));
    showToast(`Added to "${topProject.name}"`);
  };

  // Shared item props builder
  const itemProps = (inp) => ({
    key: inp.id,
    input: inp,
    isSeeded: !!inp.is_seeded,
    isScannerSuggested: !!(inp.is_seeded && inp.metadata?.source === "scanner"),
    suggestedProjects: inp.metadata?.suggested_projects || [],
    projects,
    savedProjectId: savedToProject[inp.id],
    onSaveToProject: (id) => setSavingInputId(id),
    onAccept: () => handleAccept(inp),
    onDismissSuggested: () => handleDismissSuggested(inp),
    onDismiss: handleDismiss,
    onOpen: () => openInputDetail(inp.id),
    selected: selectedInputIds.includes(inp.id),
    onToggle: toggleSelect,
    anySelected,
  });

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderList = (items) => (
    <div style={{ background: c.white, border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden" }}>
      <ListHeader />
      {items.map((inp) => <ListRow {...itemProps(inp)} />)}
    </div>
  );

  const renderCompact = (items) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {items.map((inp) => <CompactCard {...itemProps(inp)} />)}
    </div>
  );

  const renderCards = (items) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((inp) => <FullCard {...itemProps(inp)} />)}
    </div>
  );

  const renderItems = (items) => {
    if (viewMode === "list")    return renderList(items);
    if (viewMode === "compact") return renderCompact(items);
    return renderCards(items);
  };

  return (
    <>
      <div style={{ padding: "24px 32px", background: c.bg, minHeight: "100%" }}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
              Workspace
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Inbox</div>
              {allInboxInputs.length > 0 && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(0,0,0,0.06)", color: c.muted, fontWeight: 500 }}>
                  {allInboxInputs.length}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* View toggle */}
            <div style={{ display: "flex", border: `1px solid ${c.border}`, borderRadius: 7, overflow: "hidden" }}>
              {["List", "Compact", "Card"].map((v, i) => {
                const active = viewMode === v.toLowerCase();
                return (
                  <button
                    key={v}
                    onClick={() => setViewMode(v.toLowerCase())}
                    style={{
                      padding: "5px 11px", fontSize: 11,
                      background: active ? c.ink : c.white,
                      color: active ? c.white : c.muted,
                      border: "none",
                      borderLeft: i > 0 ? `1px solid ${c.border}` : "none",
                      fontWeight: active ? 500 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setDrawerOpen(true)} style={btnP}>Add an input</button>
          </div>
        </div>

        {/* ── Search + Filter bar ──────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: filtersOpen ? 10 : 16, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or description…"
              style={{
                width: "100%", padding: "8px 32px 8px 10px",
                border: `1px solid ${c.borderMid}`, borderRadius: 8,
                background: c.white, color: c.ink, fontSize: 12,
                fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: c.hint, fontSize: 15, lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>

          <button
            onClick={() => setFiltersOpen((s) => !s)}
            style={{
              ...btnSec, fontSize: 11, padding: "7px 12px",
              background: filtersOpen ? c.surfaceAlt : "transparent",
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            }}
          >
            Filter
            {activeFilterCount > 0 && (
              <span style={{
                fontSize: 10, padding: "1px 5px", borderRadius: 8,
                background: c.ink, color: c.white, fontWeight: 600,
                minWidth: 16, textAlign: "center",
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Inline filter panel ──────────────────────────────── */}
        {filtersOpen && (
          <FilterPanel filters={filters} onChange={setFilters} onClear={clearFilters} activeCount={activeFilterCount} />
        )}

        {/* ── Bulk selection action bar ────────────────────────── */}
        {anySelected && (() => {
          const selectedInputs = allInboxInputs.filter((i) => selectedInputIds.includes(i.id));
          const allAiSuggested = selectedInputs.every((i) => i.is_seeded && i.metadata?.source === "scanner" && (i.metadata?.suggested_projects?.length > 0));
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", background: c.white,
              border: `1px solid ${c.borderMid}`, borderRadius: 9, marginBottom: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, flex: 1 }}>
                {selectedInputIds.length} input{selectedInputIds.length !== 1 ? "s" : ""} selected
              </span>
              {allAiSuggested && (
                <button onClick={handleBulkAccept} style={{ ...btnSm, fontSize: 11 }}>
                  Accept suggestions →
                </button>
              )}
              <div style={{ position: "relative" }}>
                <button onClick={() => setProjectPickerOpen((s) => !s)} style={{ ...(allAiSuggested ? { padding: "7px 16px", borderRadius: 7, background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`, fontSize: 11, cursor: "pointer", fontFamily: "inherit" } : { ...btnSm, fontSize: 11 }) }}>
                  Add to project →
                </button>
                {projectPickerOpen && (
                  <ProjectPickerPopover
                    projects={projects}
                    onSelect={handleBulkAddToProject}
                    onClose={() => setProjectPickerOpen(false)}
                    onCreateProject={() => { clearSelection(); openProjectModal(); }}
                  />
                )}
              </div>
              <button onClick={handleBulkDismiss} style={{ ...btnG, fontSize: 11, color: c.muted }}>
                Dismiss
              </button>
              <button onClick={clearSelection} style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Clear selection
              </button>
            </div>
          );
        })()}

        {/* ── My Inputs table ──────────────────────────────────── */}
        <SectionHeader title="My Inputs" count={filteredManual.length} />

        {manualInputs.length === 0 ? (
          <div style={{ marginBottom: 36 }}>
            <EmptyState
              icon="◎"
              title="No inputs yet"
              body="Add your first input manually, or use the Chrome extension to capture signals from the web."
              ctaLabel="Add an input"
              onCta={() => setDrawerOpen(true)}
            />
          </div>
        ) : filteredManual.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0 36px", color: c.hint, fontSize: 13 }}>
            No inputs match your {search ? "search" : "filters"}.{" "}
            <button
              onClick={() => { setSearch(""); clearFilters(); }}
              style={{ color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
            >
              Clear {hasActiveSearch ? "all" : ""}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 36 }}>
            {renderItems(filteredManual)}
          </div>
        )}

        {/* ── AI Suggested table ───────────────────────────────── */}
        {aiInputs.length > 0 && (
          <>
            <SectionHeader title="AI Suggested" count={filteredAI.length} />

            {filteredAI.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: c.hint, fontSize: 13 }}>
                No AI suggestions match your {search ? "search" : "filters"}.{" "}
                <button
                  onClick={() => { setSearch(""); clearFilters(); }}
                  style={{ color: c.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
                >
                  Clear {hasActiveSearch ? "all" : ""}
                </button>
              </div>
            ) : (
              <>
                {renderItems(visibleAI)}
                {!aiExpanded && filteredAI.length > AI_PREVIEW_COUNT && (
                  <button
                    onClick={() => setAiExpanded(true)}
                    style={{
                      display: "block", width: "100%", marginTop: 8,
                      padding: "9px 0", borderRadius: 8, fontSize: 12,
                      background: "transparent", border: `1px solid ${c.border}`,
                      color: c.muted, cursor: "pointer", fontFamily: "inherit",
                      textAlign: "center",
                    }}
                  >
                    Show all {filteredAI.length} →
                  </button>
                )}
              </>
            )}
          </>
        )}

      </div>

      <InputDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        projects={projects}
      />

      {savingInputId && (
        <ProjectPickerModal
          projects={projects}
          onClose={() => setSavingInputId(null)}
          onCreateProject={openProjectModal}
          onSelect={(project) => {
            saveInputToProject(savingInputId, project.id);
            setSavedToProject((prev) => ({ ...prev, [savingInputId]: project.id }));
            showToast(`Input added to "${project.name}"`);
            setSavingInputId(null);
          }}
        />
      )}
    </>
  );
}

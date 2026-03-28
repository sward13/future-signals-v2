/**
 * Inbox screen — shows unassigned inputs (project_id === null).
 * Supports multi-select with bulk actions: add to project, dismiss.
 * @param {{ appState: object }} props
 */
import { useState } from "react";
import { c, btnP, btnSm, btnSec, btnG } from "../../styles/tokens.js";
import { InputDrawer } from "../inputs/InputDrawer.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { StrengthDot, HorizTag } from "../shared/Tag.jsx";

const FILTER_OPTIONS = ["All", "H1", "H2", "H3", "High", "Moderate", "Weak"];

// ─── Inline checkbox ──────────────────────────────────────────────────────────

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
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
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
            <button
              onClick={() => { onClose(); onCreateProject(); }}
              style={{ fontSize: 11, color: c.blue700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              + Create project
            </button>
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 14px",
                  background: "transparent", border: "none",
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  borderBottom: `1px solid ${c.border}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 10, color: c.hint }}>{p.domain}</div>
                </div>
                <span style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 8, flexShrink: 0,
                  background: p.mode === "deep_analysis" ? c.violet50 : c.surfaceAlt,
                  color: p.mode === "deep_analysis" ? c.violet700 : c.hint,
                  border: `1px solid ${p.mode === "deep_analysis" ? c.violetBorder : c.border}`,
                }}>
                  {p.mode === "deep_analysis" ? "Deep" : "Quick"}
                </span>
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

// ─── Seeded signal row ────────────────────────────────────────────────────────

function SeededRow({ input, projects, onSave, onDismiss, savedProjectId, onOpen, selected, onToggle, anySelected }) {
  const [hovered, setHovered] = useState(false);
  const project = projects.find((p) => p.id === (savedProjectId || input.project_id));
  const checkboxVisible = anySelected || hovered;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: c.white,
        border: `1px solid ${selected ? c.borderMid : savedProjectId ? c.greenBorder : c.border}`,
        borderRadius: 10, padding: "14px 16px",
        transition: "border-color 0.15s", cursor: "pointer",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(input.id); }}
        style={{ paddingTop: 2, flexShrink: 0, cursor: "pointer" }}
      >
        <RowCheckbox checked={selected} visible={checkboxVisible} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top: curated badge + strength */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: c.hint }}>Curated · {input.domain}</span>
          <span style={{ marginLeft: "auto" }}>
            <StrengthDot str={input.strength} />
          </span>
        </div>

        {/* Name — click always toggles selection */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(input.id); }}
          style={{ fontSize: 13, fontWeight: 500, color: c.ink, lineHeight: 1.35, marginBottom: 5, cursor: "pointer" }}
        >
          {input.name}
        </div>

        {/* Description */}
        {(input.description || input.desc) && (
          <div
            onClick={anySelected ? undefined : onOpen}
            style={{ fontSize: 11, color: c.muted, lineHeight: 1.6, marginBottom: 10, cursor: anySelected ? "default" : "pointer" }}
          >
            {input.description || input.desc}
          </div>
        )}

        {/* Tags + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(input.steepled || []).map((cat) => (
            <span key={cat} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f0f0ee", color: c.muted }}>
              {cat}
            </span>
          ))}
          <HorizTag h={input.horizon} />

          {!anySelected && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {savedProjectId ? (
                <span style={{
                  fontSize: 11, color: c.green700, background: c.green50,
                  border: `1px solid ${c.greenBorder}`, borderRadius: 6, padding: "3px 9px",
                }}>
                  ✓ Saved to {project?.name || "project"}
                </span>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                    style={{ ...btnG, fontSize: 11, padding: "4px 8px", color: c.hint }}
                  >
                    Dismiss
                  </button>
                  {projects.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSave(); }}
                      style={{ padding: "4px 12px", borderRadius: 7, background: c.ink, color: c.white, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Save to project
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manual input row (with checkbox) ────────────────────────────────────────

function ManualInputRow({ input, onOpen, onDismiss, selected, onToggle, anySelected }) {
  const [hovered, setHovered] = useState(false);
  const checkboxVisible = anySelected || hovered;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        background: c.white,
        border: `1px solid ${selected ? c.borderMid : c.border}`,
        borderRadius: 10, padding: "14px 16px",
        cursor: "pointer", transition: "border-color 0.15s",
      }}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(input.id); }}
        style={{ paddingTop: 2, flexShrink: 0, cursor: "pointer" }}
      >
        <RowCheckbox checked={selected} visible={checkboxVisible} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top meta */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {input.subtype && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f0f0ee", color: c.faint }}>
              {input.subtype}
            </span>
          )}
          <span style={{ marginLeft: "auto" }}>
            <StrengthDot str={input.strength} />
          </span>
        </div>

        {/* Name — click always toggles selection */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(input.id); }}
          style={{ fontSize: 13, fontWeight: 500, color: c.ink, lineHeight: 1.35, marginBottom: 5, cursor: "pointer" }}
        >
          {input.name}
        </div>

        {/* Description */}
        {input.description && (
          <div
            onClick={anySelected ? undefined : onOpen}
            style={{ fontSize: 11, color: c.muted, lineHeight: 1.6, marginBottom: 10, cursor: anySelected ? "default" : "pointer" }}
          >
            {input.description}
          </div>
        )}

        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(input.steepled || []).map((cat) => (
            <span key={cat} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f0f0ee", color: c.muted }}>
              {cat}
            </span>
          ))}
          <HorizTag h={input.horizon} />
          <span style={{ fontSize: 10, color: c.hint, marginLeft: 2 }}>{input.created_at}</span>

          {!anySelected && (
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(input.id); }}
                style={{ ...btnG, fontSize: 11, padding: "4px 8px", color: c.hint }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
        zIndex: 401, width: 360,
        background: c.white, borderRadius: 12,
        border: `1px solid ${c.border}`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.16)",
        overflow: "hidden",
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
              <div
                key={p.id}
                onClick={() => onSelect(p)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 20px", cursor: "pointer",
                  background: hovered === p.id ? c.surfaceAlt : c.white,
                  borderBottom: `1px solid ${c.border}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: c.muted }}>{p.domain}</div>
                </div>
                <span style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 8,
                  background: p.mode === "deep_analysis" ? c.violet50 : c.surfaceAlt,
                  color: p.mode === "deep_analysis" ? c.violet700 : c.hint,
                  border: `1px solid ${p.mode === "deep_analysis" ? c.violetBorder : c.border}`,
                  flexShrink: 0,
                }}>
                  {p.mode === "deep_analysis" ? "Deep" : "Quick"}
                </span>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Inbox({ appState }) {
  const {
    inputs, projects,
    addInput, dismissInput, saveInputToProject, saveInputsToProject,
    openDrawer, showToast, openInputDetail, openProjectModal,
  } = appState;

  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [filter,          setFilter]          = useState("All");
  const [savedToProject,  setSavedToProject]  = useState({});
  const [savingInputId,   setSavingInputId]   = useState(null);

  // Multi-select state
  const [selectedInputIds,  setSelectedInputIds]  = useState([]);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const anySelected = selectedInputIds.length > 0;

  const handleSave = (fields) => {
    addInput(fields);
    showToast("Input saved to Inbox");
    setDrawerOpen(false);
  };

  const handleDismiss = (id) => {
    dismissInput(id);
    showToast("Input dismissed", "success");
  };

  const handleSaveToProject = (id) => {
    setSavingInputId(id);
  };

  const toggleSelect = (id) => {
    setSelectedInputIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedInputIds([]);
    setProjectPickerOpen(false);
  };

  // Bulk: add to project
  const handleBulkAddToProject = (project) => {
    saveInputsToProject(selectedInputIds, project.id);
    const n = selectedInputIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} added to "${project.name}"`);
    clearSelection();
  };

  // Bulk: dismiss
  const handleBulkDismiss = () => {
    selectedInputIds.forEach((id) => dismissInput(id));
    const n = selectedInputIds.length;
    showToast(`${n} input${n !== 1 ? "s" : ""} dismissed`);
    clearSelection();
  };

  // Inbox = inputs not yet assigned to a project
  const inboxInputs = inputs.filter((inp) => inp.project_id === null);

  // Apply filter
  const filteredInputs = inboxInputs.filter((inp) => {
    if (filter === "All") return true;
    if (["H1", "H2", "H3"].includes(filter)) return inp.horizon === filter;
    if (["High", "Moderate", "Weak"].includes(filter)) return inp.strength === filter;
    return true;
  });

  const seededInputs = filteredInputs.filter((inp) => inp.is_seeded);
  const manualInputs = filteredInputs.filter((inp) => !inp.is_seeded);
  const totalCount   = inboxInputs.length;

  return (
    <>
      <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 24,
        }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
              Workspace
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Inbox</div>
              {totalCount > 0 && (
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 10,
                  background: "rgba(0,0,0,0.06)", color: c.muted, fontWeight: 500,
                }}>
                  {totalCount}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: c.muted, marginTop: 2, lineHeight: 1.5 }}>
              Signals you've collected, ready to assign to a project.
            </div>
          </div>
          <button onClick={() => setDrawerOpen(true)} style={btnP}>
            Add an input
          </button>
        </div>

        {/* Filter bar */}
        {inboxInputs.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  style={{
                    padding: "5px 12px", borderRadius: 16, fontSize: 11,
                    border: `1px solid ${active ? c.ink : c.border}`,
                    background: active ? c.ink : c.white,
                    color: active ? c.white : c.muted,
                    cursor: "pointer", fontFamily: "inherit", fontWeight: active ? 500 : 400,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {inboxInputs.length === 0 && (
          <EmptyState
            icon="◎"
            title="No inputs yet"
            body="No inputs yet — add one to get started."
            ctaLabel="Add an input"
            onCta={() => setDrawerOpen(true)}
          />
        )}

        {/* ── Bulk selection action bar ─────────────────── */}
        {anySelected && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px",
            background: c.white, border: `1px solid ${c.borderMid}`,
            borderRadius: 9, marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: c.ink, flex: 1 }}>
              {selectedInputIds.length} input{selectedInputIds.length !== 1 ? "s" : ""} selected
            </span>

            {/* Add to project */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setProjectPickerOpen((s) => !s)}
                style={{ ...btnSm, fontSize: 11 }}
              >
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

            {/* Dismiss */}
            <button
              onClick={handleBulkDismiss}
              style={{ ...btnG, fontSize: 11, color: c.muted }}
            >
              Dismiss
            </button>

            {/* Clear */}
            <button
              onClick={clearSelection}
              style={{ fontSize: 11, color: c.hint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Curated / seeded section */}
        {seededInputs.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Curated for you</div>
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 10,
                  background: c.amber50, color: c.amber700, border: `1px solid ${c.amberBorder}`,
                }}>
                  {seededInputs.length} signal{seededInputs.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ fontSize: 11, color: c.muted }}>
                Drawn from your domains. Save what's relevant, dismiss the rest.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {seededInputs.map((inp) => (
                <SeededRow
                  key={inp.id}
                  input={inp}
                  projects={projects}
                  onSave={() => setSavingInputId(inp.id)}
                  onDismiss={() => handleDismiss(inp.id)}
                  savedProjectId={savedToProject[inp.id]}
                  onOpen={() => openInputDetail(inp.id)}
                  selected={selectedInputIds.includes(inp.id)}
                  onToggle={toggleSelect}
                  anySelected={anySelected}
                />
              ))}
            </div>
          </div>
        )}

        {/* Manual inputs section */}
        {manualInputs.length > 0 && (
          <div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Your inputs</div>
              <div style={{ fontSize: 11, color: c.hint }}>{manualInputs.length} added</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {manualInputs.map((inp) => (
                <ManualInputRow
                  key={inp.id}
                  input={inp}
                  onOpen={() => openInputDetail(inp.id)}
                  onDismiss={handleDismiss}
                  selected={selectedInputIds.includes(inp.id)}
                  onToggle={toggleSelect}
                  anySelected={anySelected}
                />
              ))}
            </div>
          </div>
        )}

        {/* No results after filter */}
        {inboxInputs.length > 0 && filteredInputs.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: c.hint, fontSize: 13 }}>
            No inputs match this filter.{" "}
            <button onClick={() => setFilter("All")} style={{ color: c.blue700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              Clear filter
            </button>
          </div>
        )}
      </div>

      <InputDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        projects={projects}
      />

      {/* Single-input project picker modal (for seeded row "Save to project") */}
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

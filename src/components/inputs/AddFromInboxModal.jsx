/**
 * AddFromInboxModal — modal for pulling unassigned Inbox inputs into the active project.
 * Shows a searchable, filterable, multi-select list of inputs where project_id is null.
 * @param {{ open: boolean, onClose: () => void, onConfirm: (ids: string[]) => void, inboxInputs: object[], projectName: string, onCreateNew: () => void }} props
 */
import { useState, useMemo } from "react";
import { c, inp, btnP, btnSec, btnG } from "../../styles/tokens.js";
import { StrengthDot, HorizTag, SubtypeTag } from "../shared/Tag.jsx";

const STRENGTHS = ["High", "Moderate", "Weak"];
const HORIZONS  = ["H1", "H2", "H3"];

const SUBTYPE_ICONS = {
  signal: "◎", issue: "▲", projection: "◆", plan: "◉", obstacle: "▲", source: "◻",
};

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 11px",
        borderRadius: 20,
        border: `1px solid ${active ? c.ink : c.border}`,
        background: active ? c.ink : "transparent",
        color: active ? c.white : c.muted,
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: active ? 500 : 400,
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

export function AddFromInboxModal({ open, onClose, onConfirm, inboxInputs = [], projectName, onCreateNew }) {
  const [search, setSearch] = useState("");
  const [strengthFilter, setStrengthFilter] = useState(null);
  const [horizonFilter, setHorizonFilter] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const reset = () => {
    setSearch("");
    setStrengthFilter(null);
    setHorizonFilter(null);
    setSelected(new Set());
  };

  const handleClose = () => { reset(); onClose(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inboxInputs.filter((inp) => {
      if (strengthFilter && inp.strength !== strengthFilter) return false;
      if (horizonFilter  && inp.horizon  !== horizonFilter)  return false;
      if (q) {
        const matchesName    = inp.name?.toLowerCase().includes(q);
        const matchesSteep   = inp.steepled?.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesSteep) return false;
      }
      return true;
    });
  }, [inboxInputs, search, strengthFilter, horizonFilter]);

  const toggleAll = () => {
    if (filtered.every((i) => selected.has(i.id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...filtered.map((i) => i.id)]));
    }
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm([...selected]);
    reset();
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.32)",
          zIndex: 400,
        }}
      />

      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 401,
          width: "100%",
          maxWidth: 580,
          maxHeight: "80vh",
          background: c.white,
          borderRadius: 14,
          border: `1px solid ${c.border}`,
          boxShadow: "0 16px 56px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modalIn 0.18s ease",
        }}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: c.ink }}>Add from Inbox</div>
            <span style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 8,
              background: inboxInputs.length > 0 ? c.ink : "rgba(0,0,0,0.07)",
              color: inboxInputs.length > 0 ? c.white : c.muted,
              fontWeight: 500,
            }}>
              {inboxInputs.length} available
            </span>
          </div>
          <div style={{ fontSize: 12, color: c.muted }}>
            Select inputs to pull into <em>{projectName}</em>.
          </div>
        </div>

        {inboxInputs.length === 0 ? (
          /* ── Empty state ──────────────────────────────────────── */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 28, opacity: 0.12, marginBottom: 12 }}>◎</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: c.muted, marginBottom: 6 }}>Your inbox is empty</div>
            <div style={{ fontSize: 12, color: c.hint, lineHeight: 1.6, marginBottom: 20 }}>
              All inputs are already assigned to projects.
            </div>
            <button onClick={() => { handleClose(); onCreateNew(); }} style={btnP}>
              + Create new input
            </button>
          </div>
        ) : (
          <>
            {/* ── Filters ─────────────────────────────────────────── */}
            <div style={{ padding: "14px 24px 12px", borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
              <input
                style={{
                  ...inp,
                  marginBottom: 10,
                  fontSize: 12,
                }}
                type="text"
                placeholder="Search by name or STEEPLED tag…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STRENGTHS.map((s) => (
                  <FilterPill
                    key={s}
                    label={s}
                    active={strengthFilter === s}
                    onClick={() => setStrengthFilter(strengthFilter === s ? null : s)}
                  />
                ))}
                <span style={{ width: 1, height: 20, background: c.border, alignSelf: "center" }} />
                {HORIZONS.map((h) => (
                  <FilterPill
                    key={h}
                    label={h}
                    active={horizonFilter === h}
                    onClick={() => setHorizonFilter(horizonFilter === h ? null : h)}
                  />
                ))}
                {(strengthFilter || horizonFilter || search) && (
                  <button
                    onClick={() => { setStrengthFilter(null); setHorizonFilter(null); setSearch(""); }}
                    style={{ ...btnG, fontSize: 11, padding: "4px 8px" }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* ── List ────────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "32px 24px", textAlign: "center", fontSize: 12, color: c.hint }}>
                  No inputs match your filters.
                </div>
              ) : (
                <>
                  {/* Select-all row */}
                  <div
                    onClick={toggleAll}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 24px",
                      borderBottom: `1px solid ${c.border}`,
                      cursor: "pointer",
                      background: c.surfaceAlt,
                    }}
                  >
                    <Checkbox checked={allFilteredSelected} />
                    <span style={{ fontSize: 11, color: c.muted, fontWeight: 500 }}>
                      {allFilteredSelected ? "Deselect all" : `Select all (${filtered.length})`}
                    </span>
                  </div>

                  {filtered.map((item) => (
                    <InboxRow
                      key={item.id}
                      input={item}
                      checked={selected.has(item.id)}
                      onToggle={() => toggle(item.id)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────────────── */}
            <div style={{
              padding: "14px 24px",
              borderTop: `1px solid ${c.border}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}>
              <div style={{ flex: 1, fontSize: 12, color: selected.size > 0 ? c.ink : c.hint, fontWeight: selected.size > 0 ? 500 : 400 }}>
                {selected.size > 0 ? `${selected.size} selected` : "None selected"}
              </div>
              <button onClick={handleClose} style={btnSec}>Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                style={{ ...btnP, opacity: selected.size > 0 ? 1 : 0.35, cursor: selected.size > 0 ? "pointer" : "default" }}
              >
                Add to project
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 10px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Checkbox({ checked }) {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
      border: `1.5px solid ${checked ? c.ink : c.borderMid}`,
      background: checked ? c.ink : c.white,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function InboxRow({ input, checked, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "12px 24px",
        borderBottom: `1px solid ${c.border}`,
        cursor: "pointer",
        background: checked ? "rgba(0,0,0,0.015)" : c.white,
        transition: "background 0.1s",
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>
        <Checkbox checked={checked} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{input.name}</span>
          {input.subtype && <SubtypeTag sub={input.subtype === "signal" ? "signal" : input.subtype} />}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
          {input.steepled?.map((t) => (
            <span key={t} style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 8,
              background: c.surfaceAlt, color: c.muted, border: `1px solid ${c.border}`,
            }}>
              {t}
            </span>
          ))}
          {input.strength && <StrengthDot str={input.strength} />}
          {input.horizon  && <HorizTag    h={input.horizon} />}
        </div>
      </div>
    </div>
  );
}

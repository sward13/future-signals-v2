/**
 * InputDrawer — slide-over drawer for creating a new input.
 * Features a type-switcher chip at the top that swaps type-specific fields.
 * Common fields (Title, Description, Source URL) are always shown.
 * @param {{ open: boolean, onClose: () => void, onSave: (fields: object) => void, projects: object[] }} props
 */
import { useState } from "react";
import { c, inp, ta, sel, btnP, btnG, fl, fh, badg } from "../../styles/tokens.js";
import { Drawer } from "../layout/Drawer.jsx";
import { STEEPLED } from "../../data/seeds.js";

// ─── Input type definitions ────────────────────────────────────────────────────

const INPUT_TYPES = [
  {
    id: "signal",
    label: "Signal",
    category: "Most common",
    categoryColor: c.green700,
    categoryBg: c.green50,
    categoryBorder: c.greenBorder,
    icon: "◎",
    color: c.green700,
    bg: c.green50,
    border: c.greenBorder,
    description: "A concrete, observable piece of evidence — an event, data point, or article that points toward change.",
  },
  {
    id: "issue",
    label: "Issue",
    category: "Analytical",
    categoryColor: c.red800,
    categoryBg: c.red50,
    categoryBorder: c.redBorder,
    icon: "▲",
    color: c.red800,
    bg: c.red50,
    border: c.redBorder,
    description: "A structural tension, conflict, or ongoing problem that creates friction in the system.",
  },
  {
    id: "projection",
    label: "Projection",
    category: "Analytical",
    categoryColor: c.blue700,
    categoryBg: c.blue50,
    categoryBorder: c.blueBorder,
    icon: "◆",
    color: c.blue700,
    bg: c.blue50,
    border: c.blueBorder,
    description: "A quantitative or qualitative forecast — growth rates, scenario outputs, demographic estimates.",
  },
  {
    id: "plan",
    label: "Plan",
    category: "Contextual",
    categoryColor: c.violet700,
    categoryBg: c.violet50,
    categoryBorder: c.violetBorder,
    icon: "◉",
    color: c.violet700,
    bg: c.violet50,
    border: c.violetBorder,
    description: "An announced strategy, policy, roadmap, or intended action by an actor in the system.",
  },
  {
    id: "obstacle",
    label: "Obstacle",
    category: "Contextual",
    categoryColor: c.amber700,
    categoryBg: c.amber50,
    categoryBorder: c.amberBorder,
    icon: "▲",
    color: c.amber700,
    bg: c.amber50,
    border: c.amberBorder,
    description: "A barrier — regulatory, technical, social, or economic — that constrains a trend or plan.",
  },
  {
    id: "source",
    label: "Source",
    category: "Reference",
    categoryColor: c.muted,
    categoryBg: c.surfaceAlt,
    categoryBorder: c.border,
    icon: "◻",
    color: c.muted,
    bg: c.surfaceAlt,
    border: c.border,
    description: "A publication, database, expert, or institution to return to repeatedly. Not a single item.",
  },
];

// ─── Shared field sub-components ───────────────────────────────────────────────

function ThreeCardSelector({ label, options, selected, onSelect }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {options.map(({ value, title, desc, dotColor }) => {
          const on = selected === value;
          return (
            <button
              key={value}
              onClick={() => onSelect(on ? null : value)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${on ? c.ink : c.border}`,
                background: on ? "rgba(0,0,0,0.02)" : c.white,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? (dotColor || c.ink) : c.hint, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: on ? 500 : 400, color: c.ink }}>{title}</span>
                {on && <span style={{ fontSize: 10, marginLeft: "auto", color: c.ink }}>✓</span>}
              </div>
              <div style={{ fontSize: 10, color: c.muted, lineHeight: 1.45 }}>{desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SteepleSelector({ selected, onToggle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>STEEPLED category</div>
      <div style={fh}>Select all that apply.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {STEEPLED.map((cat) => {
          const on = selected.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              style={{
                padding: "6px 8px",
                borderRadius: 7,
                fontSize: 11,
                border: `1px solid ${on ? c.ink : c.border}`,
                background: on ? "rgba(0,0,0,0.05)" : c.white,
                color: on ? c.ink : c.muted,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: on ? 500 : 400,
                textAlign: "center",
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>{label}</div>
      <div style={{ position: "relative" }}>
        <select style={sel} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder || "Select…"}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: c.hint, pointerEvents: "none" }}>▾</span>
      </div>
    </div>
  );
}

function HorizonSelector({ selected, onSelect }) {
  const map = { H1: [c.green700, c.green50, c.greenBorder], H2: [c.blue700, c.blue50, c.blueBorder], H3: [c.amber700, c.amber50, c.amberBorder] };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>Time horizon</div>
      <div style={{ display: "flex", gap: 8 }}>
        {["H1", "H2", "H3"].map((h) => {
          const on = selected === h;
          const [col] = map[h];
          return (
            <button
              key={h}
              onClick={() => onSelect(on ? null : h)}
              style={{
                padding: "7px 22px",
                borderRadius: 7,
                fontSize: 12,
                border: `1px solid ${on ? c.ink : c.border}`,
                background: on ? "rgba(0,0,0,0.04)" : c.white,
                color: on ? c.ink : c.muted,
                cursor: "pointer",
                fontWeight: on ? 500 : 400,
                fontFamily: "inherit",
              }}
            >
              {h} {on && "✓"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Type-specific field blocks ────────────────────────────────────────────────

function SignalFields({ fields, setField }) {
  return (
    <>
      <FieldSectionHeader />
      <SteepleSelector selected={fields.steepled} onToggle={(cat) => setField("steepled", fields.steepled.includes(cat) ? fields.steepled.filter((c) => c !== cat) : [...fields.steepled, cat])} />
      <ThreeCardSelector
        label="Signal strength"
        selected={fields.strength}
        onSelect={(v) => setField("strength", v)}
        options={[
          { value: "Weak",     title: "Weak",     desc: "Single source, early emergence",          dotColor: c.red800 },
          { value: "Moderate", title: "Moderate", desc: "Multiple sources, visible in a community", dotColor: c.amber700 },
          { value: "High",     title: "High",     desc: "Widespread, data-backed, mainstream",      dotColor: c.green700 },
        ]}
      />
      <ThreeCardSelector
        label="Source confidence"
        selected={fields.source_confidence}
        onSelect={(v) => setField("source_confidence", v)}
        options={[
          { value: "Low",    title: "Low",    desc: "Blog, social media, or unverified source",         dotColor: c.red800 },
          { value: "Medium", title: "Medium", desc: "Quality journalism or industry report",             dotColor: c.amber700 },
          { value: "High",   title: "High",   desc: "Peer-reviewed research or official statistics",    dotColor: c.green700 },
        ]}
      />
      <HorizonSelector selected={fields.horizon} onSelect={(v) => setField("horizon", v)} />
    </>
  );
}

function IssueFields({ fields, setField }) {
  return (
    <>
      <FieldSectionHeader />
      <SteepleSelector selected={fields.steepled} onToggle={(cat) => setField("steepled", fields.steepled.includes(cat) ? fields.steepled.filter((c) => c !== cat) : [...fields.steepled, cat])} />
      <div style={{ marginBottom: 16 }}>
        <div style={fl}>Affected domain</div>
        <div style={fh}>Who or what does this create friction for?</div>
        <input style={inp} type="text" value={fields.metadata.affected_domain || ""} onChange={(e) => setField("metadata", { ...fields.metadata, affected_domain: e.target.value })} placeholder="e.g. Renewable energy operators" />
      </div>
      <ThreeCardSelector
        label="Signal strength"
        selected={fields.strength}
        onSelect={(v) => setField("strength", v)}
        options={[
          { value: "Weak",     title: "Weak",     desc: "Single source, early emergence",          dotColor: c.red800 },
          { value: "Moderate", title: "Moderate", desc: "Multiple sources, visible in a community", dotColor: c.amber700 },
          { value: "High",     title: "High",     desc: "Widespread, data-backed, mainstream",      dotColor: c.green700 },
        ]}
      />
      <ThreeCardSelector
        label="Source confidence"
        selected={fields.source_confidence}
        onSelect={(v) => setField("source_confidence", v)}
        options={[
          { value: "Low",    title: "Low",    desc: "Blog, social media, or unverified source",         dotColor: c.red800 },
          { value: "Medium", title: "Medium", desc: "Quality journalism or industry report",             dotColor: c.amber700 },
          { value: "High",   title: "High",   desc: "Peer-reviewed research or official statistics",    dotColor: c.green700 },
        ]}
      />
      <HorizonSelector selected={fields.horizon} onSelect={(v) => setField("horizon", v)} />
    </>
  );
}

function ProjectionFields({ fields, setField }) {
  return (
    <>
      <FieldSectionHeader />
      <SteepleSelector selected={fields.steepled} onToggle={(cat) => setField("steepled", fields.steepled.includes(cat) ? fields.steepled.filter((c) => c !== cat) : [...fields.steepled, cat])} />
      <SelectField label="Projection type" value={fields.metadata.projection_type || ""} onChange={(v) => setField("metadata", { ...fields.metadata, projection_type: v })} options={["Quantitative", "Qualitative"]} placeholder="Select type…" />
      <HorizonSelector selected={fields.horizon} onSelect={(v) => setField("horizon", v)} />
      <SelectField label="Confidence level" value={fields.metadata.confidence_level || ""} onChange={(v) => setField("metadata", { ...fields.metadata, confidence_level: v })} options={["Low", "Medium", "High"]} placeholder="Select confidence…" />
    </>
  );
}

function PlanFields({ fields, setField }) {
  return (
    <>
      <FieldSectionHeader />
      <div style={{ marginBottom: 16 }}>
        <div style={fl}>Actor</div>
        <div style={fh}>Who announced or owns this plan?</div>
        <input style={inp} type="text" value={fields.metadata.actor || ""} onChange={(e) => setField("metadata", { ...fields.metadata, actor: e.target.value })} placeholder="e.g. European Commission" />
      </div>
      <SelectField label="Plan status" value={fields.metadata.plan_status || ""} onChange={(v) => setField("metadata", { ...fields.metadata, plan_status: v })} options={["Proposed", "Announced", "In progress", "Completed", "Abandoned"]} placeholder="Select status…" />
      <SteepleSelector selected={fields.steepled} onToggle={(cat) => setField("steepled", fields.steepled.includes(cat) ? fields.steepled.filter((c) => c !== cat) : [...fields.steepled, cat])} />
      <HorizonSelector selected={fields.horizon} onSelect={(v) => setField("horizon", v)} />
    </>
  );
}

function ObstacleFields({ fields, setField }) {
  return (
    <>
      <FieldSectionHeader />
      <SelectField label="Obstacle type" value={fields.metadata.obstacle_type || ""} onChange={(v) => setField("metadata", { ...fields.metadata, obstacle_type: v })} options={["Regulatory", "Technical", "Social", "Economic", "Political"]} placeholder="Select type…" />
      <SteepleSelector selected={fields.steepled} onToggle={(cat) => setField("steepled", fields.steepled.includes(cat) ? fields.steepled.filter((c) => c !== cat) : [...fields.steepled, cat])} />
      <ThreeCardSelector
        label="Signal strength"
        selected={fields.strength}
        onSelect={(v) => setField("strength", v)}
        options={[
          { value: "Weak",     title: "Weak",     desc: "Single source, early emergence",          dotColor: c.red800 },
          { value: "Moderate", title: "Moderate", desc: "Multiple sources, visible in a community", dotColor: c.amber700 },
          { value: "High",     title: "High",     desc: "Widespread, data-backed, mainstream",      dotColor: c.green700 },
        ]}
      />
      <HorizonSelector selected={fields.horizon} onSelect={(v) => setField("horizon", v)} />
    </>
  );
}

function SourceFields({ fields, setField }) {
  return (
    <>
      <FieldSectionHeader />
      <SelectField label="Source type" value={fields.metadata.source_type || ""} onChange={(v) => setField("metadata", { ...fields.metadata, source_type: v })} options={["Report", "Academic paper", "Dataset", "Expert", "Institution", "Other"]} placeholder="Select source type…" />
      <div style={{ marginBottom: 16 }}>
        <div style={fl}>Author / Publisher</div>
        <input style={inp} type="text" value={fields.metadata.author_publisher || ""} onChange={(e) => setField("metadata", { ...fields.metadata, author_publisher: e.target.value })} placeholder="e.g. IPCC, McKinsey Global Institute" />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={fl}>Publication date</div>
        <input style={inp} type="date" value={fields.metadata.publication_date || ""} onChange={(e) => setField("metadata", { ...fields.metadata, publication_date: e.target.value })} />
      </div>
    </>
  );
}

function FieldSectionHeader() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
      marginTop: 4,
    }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, whiteSpace: "nowrap" }}>
        Type fields
      </div>
      <div style={{ flex: 1, height: 1, background: c.border }} />
    </div>
  );
}

// ─── Main drawer component ─────────────────────────────────────────────────────

const EMPTY_FIELDS = {
  title: "",
  description: "",
  source_url: "",
  steepled: [],
  strength: null,
  source_confidence: null,
  horizon: null,
  metadata: {},
};

export function InputDrawer({ open, onClose, onSave, projects = [], defaultProjectId = "" }) {
  const [selectedType, setSelectedType] = useState("signal");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [titleError, setTitleError] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId);

  const typeData = INPUT_TYPES.find((t) => t.id === selectedType);

  const setField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setTypeDropdownOpen(false);
    // Clear type-specific fields, preserve common fields
    setFields((prev) => ({
      ...EMPTY_FIELDS,
      title: prev.title,
      description: prev.description,
      source_url: prev.source_url,
    }));
  };

  const handleSave = () => {
    if (!fields.title.trim()) {
      setTitleError(true);
      return;
    }
    onSave({
      name: fields.title.trim(),
      description: fields.description,
      source_url: fields.source_url,
      subtype: selectedType,
      steepled: fields.steepled,
      strength: fields.strength,
      horizon: fields.horizon,
      source_confidence: fields.source_confidence,
      metadata: fields.metadata,
      project_id: projectId || null,
    });
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setSelectedType("signal");
    setTypeDropdownOpen(false);
    setFields(EMPTY_FIELDS);
    setTitleError(false);
    setProjectId(defaultProjectId);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const renderTypeFields = () => {
    const props = { fields, setField };
    switch (selectedType) {
      case "signal":     return <SignalFields     {...props} />;
      case "issue":      return <IssueFields      {...props} />;
      case "projection": return <ProjectionFields {...props} />;
      case "plan":       return <PlanFields       {...props} />;
      case "obstacle":   return <ObstacleFields   {...props} />;
      case "source":     return <SourceFields     {...props} />;
      default:           return <SignalFields     {...props} />;
    }
  };

  return (
    <Drawer open={open} onClose={handleClose} title="New input" width={520}>
      <div style={{ padding: "20px 24px 32px" }}>

        {/* ── Type chip + dropdown ─────────────────────────────────────── */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <button
            onClick={() => setTypeDropdownOpen((o) => !o)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 12px 6px 10px",
              borderRadius: 20,
              border: `1px solid ${typeData.border}`,
              background: typeData.bg,
              color: typeData.color,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 11 }}>{typeData.icon}</span>
            {typeData.label}
            <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>▾</span>
          </button>

          {/* Dropdown backdrop */}
          {typeDropdownOpen && (
            <div
              onClick={() => setTypeDropdownOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 10 }}
            />
          )}

          {/* Dropdown panel */}
          {typeDropdownOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 11,
              background: c.white,
              border: `1px solid ${c.borderMid}`,
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              minWidth: 300,
              overflow: "hidden",
            }}>
              {INPUT_TYPES.map((t) => {
                const active = selectedType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTypeSelect(t.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      width: "100%",
                      background: active ? "rgba(0,0,0,0.03)" : "transparent",
                      border: "none",
                      borderBottom: `1px solid ${c.border}`,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: t.bg,
                      border: `1px solid ${t.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: t.color,
                      flexShrink: 0,
                    }}>
                      {t.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>{t.label}</span>
                        <span style={{
                          fontSize: 9,
                          padding: "1px 6px",
                          borderRadius: 8,
                          background: t.categoryBg,
                          color: t.categoryColor,
                          border: `1px solid ${t.categoryBorder}`,
                        }}>
                          {t.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.4, marginTop: 1 }}>{t.description}</div>
                    </div>
                    {active && <span style={{ fontSize: 11, color: c.ink, flexShrink: 0 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Type description banner ──────────────────────────────────── */}
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: typeData.bg,
          border: `1px solid ${typeData.border}`,
          fontSize: 12,
          color: typeData.color,
          lineHeight: 1.55,
          marginBottom: 22,
        }}>
          {typeData.description}
        </div>

        {/* ── Common fields ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div style={fl}>
            Title <span style={badg}>required</span>
          </div>
          <input
            style={{ ...inp, borderColor: titleError ? c.redBorder : undefined }}
            type="text"
            value={fields.title}
            onChange={(e) => { setField("title", e.target.value); setTitleError(false); }}
            placeholder={`Name this ${typeData.label.toLowerCase()}…`}
            autoFocus
          />
          {titleError && (
            <div style={{ fontSize: 11, color: c.red800, marginTop: 4 }}>Title is required.</div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={fl}>Description</div>
          <div style={fh}>What makes this relevant to your investigation?</div>
          <textarea
            style={ta}
            rows={3}
            value={fields.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Describe what you've noticed and why it might matter…"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={fl}>Source URL</div>
          <input
            style={inp}
            type="url"
            value={fields.source_url}
            onChange={(e) => setField("source_url", e.target.value)}
            placeholder="https://…"
          />
        </div>

        {/* ── Type-specific fields ─────────────────────────────────────── */}
        {renderTypeFields()}

        {/* ── Project assignment ───────────────────────────────────────── */}
        {projects.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={fl}>Assign to project</div>
            <div style={{ position: "relative" }}>
              <select
                style={sel}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Leave in Inbox</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: c.hint, pointerEvents: "none" }}>▾</span>
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingTop: 18,
          borderTop: `1px solid ${c.border}`,
          marginTop: 8,
        }}>
          <button
            onClick={handleSave}
            style={{ ...btnP, opacity: fields.title.trim() ? 1 : 0.4 }}
          >
            Add input
          </button>
          <button onClick={handleClose} style={btnG}>Cancel</button>
          <span style={{ marginLeft: "auto", fontSize: 11, color: c.hint }}>
            Saving as {typeData.label}
          </span>
        </div>
      </div>
    </Drawer>
  );
}

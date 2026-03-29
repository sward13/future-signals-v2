/**
 * InputDrawer — slide-over drawer for creating a new input.
 * Features a type-switcher chip at the top that swaps type-specific fields.
 * Common fields (Title, Description, Source URL) are always shown.
 * @param {{ open: boolean, onClose: () => void, onSave: (fields: object) => void, projects: object[] }} props
 */
import { useState } from "react";
import { c, inp, ta, sel, btnP, btnG, fl, fh, badg } from "../../styles/tokens.js";
import { Drawer } from "../layout/Drawer.jsx";
import { INPUT_TYPES, ThreeCardSelector, SteepleSelector, HorizonSelector, TypeSwitcherChip } from "./InputFormFields.jsx";

// ─── Local helpers (not shared) ────────────────────────────────────────────────

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
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [titleError, setTitleError] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId);

  const typeData = INPUT_TYPES.find((t) => t.id === selectedType);

  const setField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
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
        <TypeSwitcherChip selectedType={selectedType} onChange={handleTypeSelect} />

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

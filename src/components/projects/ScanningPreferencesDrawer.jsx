import { useState, useMemo } from "react";
import { Drawer } from "../layout/Drawer.jsx";
import { AddSourceModal } from "../shared/AddSourceModal.jsx";
import { c } from "../../styles/tokens.js";

const lbl = {
  fontSize: 11,
  fontWeight: 600,
  color: c.faint,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  marginBottom: 4,
};

const val = { fontSize: 12, color: c.muted, lineHeight: 1.5 };

function Toggle({ on, disabled, onClick, title }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{
        flexShrink: 0,
        width: 34, height: 19, borderRadius: 10,
        background: on && !disabled ? c.ink : c.hint,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        position: "relative",
        transition: "background 0.2s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: "absolute",
        top: 2,
        left: on && !disabled ? 17 : 2,
        width: 15, height: 15, borderRadius: "50%",
        background: c.white,
        transition: "left 0.2s",
      }} />
    </button>
  );
}

function SourceRow({ ps, onToggle }) {
  const src = ps.sources || {};
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "7px 0",
      borderTop: `1px solid ${c.border}`,
    }}>
      <Toggle
        on={ps.opted_in}
        onClick={() => onToggle(ps.id, !ps.opted_in)}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, color: c.ink,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {src.name || "Unknown source"}
        </div>
        {src.domain && (
          <div style={{ fontSize: 10, color: c.hint, marginTop: 1 }}>{src.domain}</div>
        )}
      </div>
    </div>
  );
}

export function ScanningPreferencesDrawer({
  open,
  onClose,
  project,
  projectSources,
  workspaceScanningEnabled,
  updateProject,
  updateProjectSource,
  addSource,
  addProjectSource,
  workspaceId,
  showToast,
}) {
  // Hooks must run unconditionally — early return moved to after all useMemo calls
  // to prevent React error #310 (hook count mismatch between renders).
  // Neither memo depends on project; they only need projectSources.
  const [addOpen, setAddOpen] = useState(false);

  const curated = useMemo(
    () => (projectSources || []).filter((ps) => ps.sources?.source_type === "curated"),
    [projectSources]
  );
  const userAdded = useMemo(
    () => (projectSources || []).filter((ps) => ps.sources?.source_type !== "curated"),
    [projectSources]
  );

  if (!project) return null;

  const scanningEnabled = project.scanning_enabled !== false;
  const hasDomain = !!project.domain?.trim();

  const hasSources = (projectSources || []).length > 0;

  const scopeIn = project.scope_in || [];
  const scopeOut = project.scope_out || [];

  async function handleAdded(fields) {
    setAddOpen(false);
    try {
      const source = await addSource(fields);
      await addProjectSource({ source_id: source.id, project_id: project.id, source });
    } catch {
      showToast("Failed to add source", "error");
    }
  }

  function handleSourceToggle(id, nextOptedIn) {
    updateProjectSource(id, { opted_in: nextOptedIn });
  }

  function handleScanningToggle() {
    if (!scanningEnabled && !hasDomain) {
      showToast("A domain is required to enable signal scanning. Add one in Project Settings.", "error");
      return;
    }
    updateProject(project.id, { scanning_enabled: !scanningEnabled });
  }

  const footerStatus = !workspaceScanningEnabled
    ? "Disabled workspace-wide"
    : !hasDomain
    ? "Set a domain to enable scanning"
    : scanningEnabled
    ? "Active for this project"
    : "Paused for this project";

  return (
    <Drawer open={open} onClose={onClose} title="Scanning preferences" width={340}>
      {/* Scrollable body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Sources */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ ...lbl, marginBottom: 0 }}>Sources</div>
            <button
              onClick={() => setAddOpen(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11.5, color: c.brand, fontFamily: "inherit",
                padding: 0, fontWeight: 500,
              }}
            >
              + Add source
            </button>
          </div>
          {!hasSources ? (
            <div style={{ fontSize: 12, color: c.hint, fontStyle: "italic" }}>
              No sources configured for this project.
            </div>
          ) : (
            <>
              {curated.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: c.hint, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                    Curated
                  </div>
                  {curated.map((ps) => (
                    <SourceRow key={ps.id} ps={ps} onToggle={handleSourceToggle} />
                  ))}
                </div>
              )}
              {userAdded.length > 0 && (
                <div style={{ marginTop: curated.length > 0 ? 10 : 0 }}>
                  <div style={{ fontSize: 10, color: c.hint, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                    Added by you
                  </div>
                  {userAdded.map((ps) => (
                    <SourceRow key={ps.id} ps={ps} onToggle={handleSourceToggle} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Project context fields — read-only reference */}
        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.5, marginBottom: 12 }}>
            The scanner uses these fields to evaluate signal relevance for this project.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={lbl}>Key question</div>
              {project.question
                ? <div style={{ ...val, fontStyle: "italic" }}>{project.question}</div>
                : <div style={{ ...val, color: c.faint, fontStyle: "italic" }}>Not set</div>}
            </div>
            <div>
              <div style={lbl}>Focus</div>
              {project.focus
                ? <div style={val}>{project.focus}</div>
                : <div style={{ ...val, color: c.faint, fontStyle: "italic" }}>Not set</div>}
            </div>
            <div>
              <div style={lbl}>Geography</div>
              {project.geo
                ? <div style={val}>{project.geo}</div>
                : <div style={{ ...val, color: c.faint, fontStyle: "italic" }}>Not set</div>}
            </div>
            <div>
              <div style={lbl}>In scope</div>
              {scopeIn.length > 0
                ? <div style={val}>{scopeIn.join(", ")}</div>
                : <div style={{ ...val, color: c.faint, fontStyle: "italic" }}>Not set</div>}
            </div>
            <div>
              <div style={lbl}>Out of scope</div>
              {scopeOut.length > 0
                ? <div style={val}>{scopeOut.join(", ")}</div>
                : <div style={{ ...val, color: c.faint, fontStyle: "italic" }}>Not set</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Pinned footer — per-project scanning toggle */}
      <div style={{
        position: "sticky",
        bottom: 0,
        padding: "12px 16px",
        borderTop: `1px solid ${c.border}`,
        background: c.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: c.ink }}>Signal scanning</div>
          <div style={{ fontSize: 10.5, color: c.hint, marginTop: 1 }}>{footerStatus}</div>
        </div>
        <Toggle
          on={scanningEnabled}
          disabled={!workspaceScanningEnabled || !hasDomain}
          onClick={handleScanningToggle}
          title={!workspaceScanningEnabled ? undefined : !hasDomain ? "Set a domain for this project to enable signal scanning" : undefined}
        />
      </div>
      <AddSourceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
        defaultDomain={project.domain ?? null}
      />
    </Drawer>
  );
}

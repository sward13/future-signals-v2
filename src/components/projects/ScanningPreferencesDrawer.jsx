import { useMemo } from "react";
import { Drawer } from "../layout/Drawer.jsx";
import { c } from "../../styles/tokens.js";

const lbl = {
  fontSize: 11,
  fontWeight: 600,
  color: c.faint,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
};

const val = { fontSize: 12, color: c.muted, lineHeight: 1.5 };

function Toggle({ on, disabled, onClick }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
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
}) {
  if (!project) return null;

  const scanningEnabled = project.scanning_enabled !== false;

  const curated = useMemo(
    () => (projectSources || []).filter((ps) => ps.sources?.source_type === "curated"),
    [projectSources]
  );
  const userAdded = useMemo(
    () => (projectSources || []).filter((ps) => ps.sources?.source_type !== "curated"),
    [projectSources]
  );

  const hasSources = (projectSources || []).length > 0;

  const scopeIn = project.scope_in || [];
  const scopeOut = project.scope_out || [];

  function handleSourceToggle(id, nextOptedIn) {
    updateProjectSource(id, { opted_in: nextOptedIn });
  }

  function handleScanningToggle() {
    updateProject(project.id, { scanning_enabled: !scanningEnabled });
  }

  const footerStatus = !workspaceScanningEnabled
    ? "Disabled workspace-wide"
    : scanningEnabled
    ? "Active for this project"
    : "Paused for this project";

  return (
    <Drawer open={open} onClose={onClose} title="Scanning preferences" width={340}>
      {/* Scrollable body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Sources */}
        <div>
          <div style={lbl}>Sources</div>
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
          disabled={!workspaceScanningEnabled}
          onClick={handleScanningToggle}
        />
      </div>
    </Drawer>
  );
}

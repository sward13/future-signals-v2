/**
 * ClusterSuggestions — Suggested mode panel for the 320px ClustersPanel.
 * Adapts the AI suggestion system from Clustering.jsx for the panel context.
 * Props:
 *   projectId       — required; used for DB queries and edge function call
 *   projectClusters — clusters already in this project (for name lookups)
 *   inputs          — all workspace inputs (for title lookups by id)
 *   onAssignInput   — (inputId, clusterId) => void   [optional: no-op if omitted]
 *   onCreateCluster — (fields) => void               [optional: no-op if omitted]
 *   showToast       — (msg) => void
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { WandSparkles, Info } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { invokeEdge } from "../../lib/invokeEdge.js";
import { track } from "../../lib/analytics.js";
import { c, btnG, inp, ta } from "../../styles/tokens.js";
import { SubtypeTag } from "../shared/Tag.jsx";
import { PanelButton } from "../shared/PanelButton.jsx";
import { ROW_ACTION_LINK } from "../shared/RowActionButton.jsx";

// Copy shown under the Grouping sensitivity control, keyed by the sensitivity
// value sent to compute-cluster-suggestions (see SENSITIVITY_THRESHOLDS in
// that edge function: tight=0.75 similarity/more+smaller clusters, exploratory
// =0.50/fewer+broader clusters). Edit freely — this is the only place the copy lives.
const SENSITIVITY_DESCRIPTIONS = {
  tight: "Requires strong similarity between inputs — produces more, smaller clusters with higher confidence.",
  balanced: "A balanced similarity threshold — the default for most projects.",
  exploratory: "Allows looser similarity between inputs — produces fewer, broader clusters that can surface weaker patterns.",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function overlapRatio(idsA, idsB) {
  if (!idsA?.length || !idsB?.length) return 0;
  const setB = new Set(idsB);
  return idsA.filter((id) => setB.has(id)).length / Math.max(idsA.length, idsB.length);
}

const CONF_STYLE = {
  high:     { background: c.green50,  color: c.green700,  border: `1px solid ${c.greenBorder}` },
  moderate: { background: c.amber50,  color: c.amber700,  border: `1px solid ${c.amberBorder}` },
};

// ── Assignment card — "Add to existing cluster" ───────────────────────────────

const MATCH_COL_WIDTH = 84;

function AssignCard({ group, inputs, fadingIds, onAcceptAll, onDismissOne }) {
  const { targetClusterId, clusterName, sugs } = group;
  const visibleSugs = sugs.filter((s) => !fadingIds.has(s.id));
  const [expanded, setExpanded] = useState(false);
  if (visibleSugs.length === 0) return null;

  const totalCount = sugs.length;
  const remaining = totalCount - 3;
  const displayedSugs = expanded ? sugs : sugs.slice(0, 3);

  return (
    <div style={{
      background: c.white, border: `1px solid ${c.border}`, borderRadius: 9,
      overflow: "hidden", marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 6px" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>
          Add to <span style={{ color: c.brand }}>{clusterName}</span>
        </span>
        <span style={{ fontSize: 12, color: c.muted }}>
          {totalCount} input{totalCount !== 1 ? "s" : ""}
        </span>
        {visibleSugs.length > 1 && (
          <button
            onClick={() => onAcceptAll(targetClusterId)}
            style={{ ...btnG, fontSize: 11, color: c.brand, padding: "2px 4px", marginLeft: "auto" }}
          >
            Accept all
          </button>
        )}
      </div>

      {/* Column headers */}
      <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px 3px" }}>
        <span style={{ width: 9, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 11.5, color: c.hint }}>Input</span>
        <span
          style={{ width: MATCH_COL_WIDTH, flexShrink: 0, fontSize: 11.5, color: c.hint }}
          title="How closely this input matches the cluster"
        >
          Match
        </span>
      </div>

      {/* Input rows */}
      <div style={{ padding: "2px 12px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
        {displayedSugs.map((sug) => {
          const inputId = (sug.input_ids || [])[0];
          const input = inputs.find((i) => i.id === inputId);
          if (!input) return null;
          const conf = sug.confidence ? CONF_STYLE[sug.confidence] : null;
          const confLabel = sug.confidence === "high" ? "High" : sug.confidence === "moderate" ? "Moderate" : null;
          return (
            <div
              key={sug.id}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 8px",
                background: c.surfaceAlt, borderRadius: 6,
                opacity: fadingIds.has(sug.id) ? 0 : 1, transition: "opacity 0.25s",
              }}
            >
              <span style={{ color: c.hint, fontSize: 9, flexShrink: 0, alignSelf: "flex-start", marginTop: 3 }}>•</span>
              <span style={{ flex: 1, fontSize: 11, color: c.ink, lineHeight: 1.4 }}>
                {input.name}
              </span>
              <span style={{ width: MATCH_COL_WIDTH, flexShrink: 0 }}>
                {confLabel === "High" && (
                  <>
                    <span aria-hidden="true" style={{ fontSize: 11, color: c.muted }}>High</span>
                    <span className="sr-only">Match: High</span>
                  </>
                )}
                {confLabel === "Moderate" && (
                  <>
                    <span
                      aria-hidden="true"
                      style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 500, display: "inline-block", ...conf }}
                    >
                      Moderate
                    </span>
                    <span className="sr-only">Match: Moderate</span>
                  </>
                )}
              </span>
              <button
                onClick={() => onDismissOne(sug.id)}
                style={{ ...btnG, fontSize: 10, padding: "0 3px", flexShrink: 0, color: c.hint }}
              >
                ✕
              </button>
            </div>
          );
        })}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="text-[11px] text-muted bg-transparent border-none cursor-pointer font-[inherit] p-0 self-start hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 rounded-btn"
          >
            {expanded ? "Show fewer" : `Show ${remaining} more`}
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px 10px" }}>
        <PanelButton variant="primary" onClick={() => onAcceptAll(targetClusterId)}>
          Accept
        </PanelButton>
        <button
          onClick={() => visibleSugs.forEach((s) => onDismissOne(s.id))}
          className={ROW_ACTION_LINK}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── New cluster suggestion card ───────────────────────────────────────────────

function NewClusterCard({ sug, inputs, isFading, onAccept, onDismiss }) {
  const isLowRelevance = sug.relevance === "low";
  const [editMode,      setEditMode]      = useState(false);
  const [editName,      setEditName]      = useState(sug.name);
  const [editDesc,      setEditDesc]      = useState(sug.description || "");
  const [localIds,      setLocalIds]      = useState(sug.input_ids || []);
  // Low-relevance cards start with the rationale open — it's the one-sentence
  // explanation of *why* this was deprioritized, so it shouldn't be hidden
  // behind an extra click.
  const [showRationale, setShowRationale] = useState(isLowRelevance);
  const [expanded,      setExpanded]      = useState(false);

  const subtype      = sug.subtype ? sug.subtype.charAt(0).toUpperCase() + sug.subtype.slice(1) : "Trend";
  const visibleInputs = localIds.map((id) => inputs.find((i) => i.id === id)).filter(Boolean);
  const noInputs      = visibleInputs.length === 0;
  const remaining     = visibleInputs.length - 3;
  const displayedInputs = expanded ? visibleInputs : visibleInputs.slice(0, 3);

  const handleCancel = () => {
    setEditMode(false);
    setEditName(sug.name);
    setEditDesc(sug.description || "");
    setLocalIds(sug.input_ids || []);
  };

  return (
    <div style={{
      background: isLowRelevance ? c.surfaceAlt : c.white,
      border: `1px solid ${c.border}`, borderRadius: 9,
      overflow: "hidden", opacity: isFading ? 0 : (isLowRelevance ? 0.85 : 1),
      transition: "opacity 0.25s", marginBottom: 8,
    }}>
      <div style={{ padding: "11px 12px" }}>

        {/* Header: name + type badge */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editMode ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ ...inp, fontSize: 12, fontWeight: 500, padding: "4px 8px", borderRadius: 5 }}
              />
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, color: c.ink, lineHeight: 1.4 }}>{sug.name}</div>
            )}
          </div>
          <div style={{ flexShrink: 0, paddingTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            {isLowRelevance && (
              <span style={{
                fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 3,
                background: c.surfaceHover, color: c.hint, border: `1px solid ${c.border}`,
                whiteSpace: "nowrap",
              }}>
                Low relevance
              </span>
            )}
            <SubtypeTag sub={subtype} />
          </div>
        </div>

        {/* Description */}
        {editMode ? (
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            style={{ ...ta, fontSize: 11, marginBottom: 8, resize: "vertical" }}
          />
        ) : sug.description ? (
          <div className="max-w-[68ch]" style={{
            fontSize: 11, color: c.muted, lineHeight: 1.55, marginBottom: 8,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {sug.description}
          </div>
        ) : null}

        {/* · Why this cluster? */}
        {sug.rationale && (
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setShowRationale((s) => !s)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11, color: c.muted, padding: 0, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 3,
              }}
            >
              <span style={{ fontSize: 9 }}>{showRationale ? "▾" : "▸"}</span>
              {isLowRelevance ? "Why low relevance?" : "Why this cluster?"}
            </button>
            {showRationale && (
              <div className="max-w-[68ch]" style={{
                marginTop: 6, padding: "7px 10px",
                background: c.surfaceAlt, border: `1px solid ${c.border}`,
                borderRadius: 5, fontSize: 11, color: c.muted,
                lineHeight: 1.55, fontStyle: "italic",
              }}>
                {sug.rationale}
              </div>
            )}
          </div>
        )}

        {/* Input list */}
        {visibleInputs.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: c.muted, marginBottom: 4 }}>
              {visibleInputs.length} input{visibleInputs.length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
              {displayedInputs.map((input) => (
                <div
                  key={input.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "4px 8px", background: c.surfaceAlt, borderRadius: 5,
                  }}
                >
                  <span style={{ color: c.hint, fontSize: 9, flexShrink: 0 }}>•</span>
                  <span style={{
                    flex: 1, fontSize: 11, color: c.ink,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {input.name}
                  </span>
                  <button
                    onClick={() => setLocalIds((prev) => prev.filter((x) => x !== input.id))}
                    style={{ ...btnG, fontSize: 10, padding: "0 3px", flexShrink: 0, color: c.hint }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  aria-expanded={expanded}
                  className="text-[11px] text-muted bg-transparent border-none cursor-pointer font-[inherit] p-0 self-start hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 rounded-btn"
                >
                  {expanded ? "Show fewer" : `Show ${remaining} more`}
                </button>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {editMode ? (
            <>
              <PanelButton
                variant="primary"
                onClick={() => onAccept(sug, editName.trim() || sug.name, editDesc, localIds)}
                disabled={noInputs}
              >
                Create cluster
              </PanelButton>
              <button
                onClick={handleCancel}
                style={{
                  background: "none", border: `1px solid ${c.borderStrong}`,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11, color: c.muted, padding: "4px 10px", borderRadius: 6,
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <PanelButton
                variant="primary"
                onClick={() => onAccept(sug, sug.name, sug.description || "", localIds)}
                disabled={noInputs}
              >
                Create cluster
              </PanelButton>
              <PanelButton variant="secondary" onClick={() => setEditMode(true)}>
                Edit
              </PanelButton>
              <button onClick={() => onDismiss(sug.id)} className={ROW_ACTION_LINK}>
                Dismiss
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ClusterSuggestions({
  projectId,
  projectClusters = [],
  inputs = [],
  onAssignInput,
  onCreateCluster,
  showToast,
}) {
  const [tightness,   setTightness]   = useState("balanced");
  const [running,     setRunning]     = useState(false);
  const [error,       setError]       = useState(null);
  const [hasRun,      setHasRun]      = useState(false);
  // The sensitivity that produced the suggestions currently on screen. Only
  // known once a run completes in this session — cluster_suggestions rows
  // loaded from a prior session don't record which sensitivity made them, so
  // this stays null until a fresh run, and the stale-settings message below
  // is intentionally suppressed until then (see isStale).
  const [lastRunSensitivity, setLastRunSensitivity] = useState(null);

  const [assignSugs,  setAssignSugs]  = useState([]);
  const [assignFading,setAssignFading]= useState(new Set());
  const [newSugs,     setNewSugs]     = useState([]);
  const [newFading,   setNewFading]   = useState(new Set());
  const [dismissed,    setDismissed]    = useState([]);
  const [lastRunEmpty, setLastRunEmpty] = useState(false);

  // Derives unassigned input count using the same logic as ClusterScreen:
  // inputs in clusters may not have project_id set (assignment doesn't update it),
  // so we join via cluster membership first.
  const clusterInputIds = useMemo(
    () => new Set(projectClusters.flatMap((cl) => cl.input_ids || [])),
    [projectClusters],
  );
  const unassignedCount = useMemo(
    () => inputs.filter(
      (i) => (i.project_id === projectId || clusterInputIds.has(i.id)) && !clusterInputIds.has(i.id),
    ).length,
    [inputs, projectId, clusterInputIds],
  );

  const loadSuggestions = useCallback(async () => {
    if (!projectId) return [];
    try {
      const { data, error } = await supabase
        .from("cluster_suggestions")
        .select("*")
        .eq("project_id", projectId)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      const all = data || [];
      // hasRun reflects whether the edge function has ever been called for this
      // project, not whether pending rows exist. Accepted/dismissed rows count.
      if (all.length > 0) setHasRun(true);
      const pending = all.filter((s) => s.status === "pending");
      setAssignSugs(pending.filter((s) => s.type === "assignment"));
      setNewSugs(pending.filter((s) => s.type !== "assignment"));
      return pending;
    } catch {
      // silent — surface errors only on active runs
      return [];
    }
  }, [projectId]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  // ── Run ──────────────────────────────────────────────────────────────────────

  const handleRun = async () => {
    if (!projectId || running) return;
    setRunning(true);
    setError(null);
    track("suggest_clustering_run", { sensitivity: tightness });
    const { error } = await invokeEdge("compute-cluster-suggestions", {
      body: { project_id: projectId, mode: "combined", clustering_sensitivity: tightness },
      timeoutMs: 60000,
      fallbackMessage: "Failed to generate suggestions.",
    });
    if (error) {
      setError(error.message);
      setRunning(false);
      return;
    }
    setDismissed([]);
    const loaded = await loadSuggestions();
    setHasRun(true);
    setLastRunEmpty(loaded.length === 0);
    setLastRunSensitivity(tightness);
    setRunning(false);
  };

  // ── Assignment handlers ──────────────────────────────────────────────────────

  const handleAcceptAll = (targetClusterId) => {
    const pending = assignSugs.filter((s) => s.target_cluster_id === targetClusterId && !assignFading.has(s.id));
    pending.forEach((sug) => {
      (sug.input_ids || []).forEach((inputId) => onAssignInput?.(inputId, targetClusterId));
      supabase.from("cluster_suggestions")
        .update({ status: "accepted", acted_on_at: new Date().toISOString() })
        .eq("id", sug.id).then();
    });
    setAssignSugs((prev) => prev.filter((s) => s.target_cluster_id !== targetClusterId));
    const cl = projectClusters.find((c) => c.id === targetClusterId);
    const n = pending.reduce((acc, s) => acc + (s.input_ids || []).length, 0);
    track("cluster_suggestion_accepted", { type: "assignment", count: n });
    showToast?.(`${n} input${n !== 1 ? "s" : ""} assigned to "${cl?.name || "cluster"}"`);
  };

  const handleDismissAssignment = (id) => {
    track("cluster_suggestion_dismissed", { type: "assignment" });
    setAssignFading((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setAssignSugs((prev) => prev.filter((s) => s.id !== id));
      setAssignFading((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 280);
    supabase.from("cluster_suggestions")
      .update({ status: "dismissed", acted_on_at: new Date().toISOString() })
      .eq("id", id).then();
  };

  // ── New cluster handlers ─────────────────────────────────────────────────────

  const handleAcceptNewCluster = (sug, name, desc, inputIds) => {
    track("cluster_suggestion_accepted", { type: "new_cluster" });
    const finalName = name?.trim() || sug.name;
    const subtype   = sug.subtype ? sug.subtype.charAt(0).toUpperCase() + sug.subtype.slice(1) : "Trend";
    onCreateCluster?.({
      name: finalName, subtype, horizon: "H1", likelihood: "Plausible",
      description: desc, project_id: projectId, input_ids: inputIds,
    });
    supabase.from("cluster_suggestions")
      .update({ status: "accepted", acted_on_at: new Date().toISOString() })
      .eq("id", sug.id).then();
    setNewSugs((prev) => prev.filter((s) => s.id !== sug.id));
    const n = inputIds.length;
    showToast?.(`Cluster "${finalName}" created with ${n} input${n !== 1 ? "s" : ""}`);
  };

  const handleDismissNewCluster = (id) => {
    track("cluster_suggestion_dismissed", { type: "new_cluster" });
    const sug = newSugs.find((s) => s.id === id);
    if (sug) setDismissed((prev) => [...prev, { id: sug.id, input_ids: sug.input_ids || [] }]);
    setNewFading((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setNewSugs((prev) => prev.filter((s) => s.id !== id));
      setNewFading((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 280);
    supabase.from("cluster_suggestions")
      .update({ status: "dismissed", acted_on_at: new Date().toISOString() })
      .eq("id", id).then();
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const assignGroups = useMemo(() => {
    const groups = new Map();
    for (const sug of assignSugs) {
      const key = sug.target_cluster_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sug);
    }
    return [...groups.entries()].map(([targetClusterId, sugs]) => ({
      targetClusterId,
      clusterName: projectClusters.find((cl) => cl.id === targetClusterId)?.name || "cluster",
      sugs,
    }));
  }, [assignSugs, projectClusters]);

  const visibleNewSugs = useMemo(() =>
    newSugs.filter((sug) => {
      if (newFading.has(sug.id)) return true;
      return !dismissed.some((dis) => overlapRatio(sug.input_ids, dis.input_ids) > 0.8);
    }),
    [newSugs, dismissed, newFading]
  );

  // Groups whose only real tie to the project is generic domain overlap (per
  // compute-cluster-suggestions' relevance check) are shown separately,
  // collapsed by default, rather than as equal-weight cluster suggestions.
  const coreNewSugs = useMemo(
    () => visibleNewSugs.filter((sug) => sug.relevance !== "low"),
    [visibleNewSugs],
  );
  const lowRelevanceSugs = useMemo(
    () => visibleNewSugs.filter((sug) => sug.relevance === "low"),
    [visibleNewSugs],
  );
  const [showLowRelevance, setShowLowRelevance] = useState(false);

  const hasAnything = assignGroups.length > 0 || visibleNewSugs.length > 0;

  // Suggestions on screen were produced by a different sensitivity than the one
  // currently selected. Only flagged once lastRunSensitivity is known (see its
  // declaration above) — never on suggestions carried over from a prior session.
  const isStale = hasAnything && lastRunSensitivity !== null && tightness !== lastRunSensitivity;
  const sensitivityDescription = isStale
    ? "Settings changed. Run again to update."
    : SENSITIVITY_DESCRIPTIONS[tightness];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Toolbar — Grouping sensitivity + Suggest clustering, grouped into one settings card */}
      <div style={{
        padding: "8px 12px", flexShrink: 0,
        borderBottom: `1px solid ${c.border}`,
        background: c.white,
      }}>
        <div className="max-w-3xl border-[0.5px] border-border bg-white rounded-container py-3.5 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Sensitivity toggle — compact padding so "Exploratory" fits at 320px */}
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-muted">Grouping</span>
              <div
                role="group"
                aria-label="Grouping sensitivity"
                style={{ display: "inline-flex", border: `1px solid ${c.borderStrong}`, borderRadius: 6, overflow: "hidden" }}
              >
                {[["tight", "Tight"], ["balanced", "Balanced"], ["exploratory", "Exploratory"]].map(([key, label], idx) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={tightness === key}
                    onClick={() => setTightness(key)}
                    style={{
                      padding: "3px 5px", fontSize: 10, fontFamily: "inherit",
                      cursor: "pointer", border: "none",
                      borderLeft: idx > 0 ? `1px solid ${c.borderStrong}` : "none",
                      background: tightness === key ? c.ink : "transparent",
                      color: tightness === key ? c.white : c.muted,
                      fontWeight: tightness === key ? 500 : 400,
                      transition: "background 0.12s, color 0.12s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Suggest button */}
            <PanelButton variant="secondary" onClick={handleRun} disabled={running || !projectId} className="gap-1.5">
              {running ? (
                <>
                  <span style={{
                    display: "inline-block", width: 9, height: 9, borderRadius: "50%",
                    border: `1.5px solid ${c.border}`, borderTopColor: c.muted,
                    animation: "spin 0.7s linear infinite",
                  }} />
                  Suggesting…
                </>
              ) : <><WandSparkles size={11} strokeWidth={1.75} /> Suggest clustering</>}
            </PanelButton>
          </div>

          {/* Live description of the selected sensitivity, or a stale-settings notice */}
          <div className="flex items-start gap-1.5 mt-2.5" aria-live="polite">
            <Info size={16} className="shrink-0 text-hint" />
            <span className="text-[13px] text-muted leading-[1.4]">{sensitivityDescription}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
      <div className="max-w-3xl">

        {error && (
          <div style={{
            padding: "9px 12px", marginBottom: 10,
            background: "#FEE2E2", border: "1px solid #FCA5A5",
            borderRadius: 7, fontSize: 11, color: "#991B1B",
          }}>
            {error}
          </div>
        )}

        {running ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0", gap: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              border: `2px solid ${c.border}`, borderTopColor: c.ink,
              animation: "spin 0.7s linear infinite",
            }} />
            <span style={{ fontSize: 12, color: c.muted }}>Finding suggestions…</span>
          </div>

        ) : hasAnything ? null : unassignedCount === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 12px", textAlign: "center", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.muted }}>All inputs are assigned</div>
            <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.6 }}>
              Suggestions will reappear when you add new ones.
            </div>
          </div>

        ) : unassignedCount < 2 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 12px", textAlign: "center", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.muted }}>Not enough unassigned inputs</div>
            <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.6 }}>
              Add at least 2 unassigned inputs to generate suggestions.
            </div>
          </div>

        ) : !hasRun ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 12px", textAlign: "center", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.muted }}>No suggestions yet</div>
            <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.6 }}>
              Click "✦ Suggest clustering" to check for patterns.
            </div>
          </div>

        ) : lastRunEmpty ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 12px", textAlign: "center", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.muted }}>No suggestions found</div>
            <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.6 }}>
              Try a looser sensitivity setting, or add more inputs on this topic.
            </div>
          </div>

        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 12px", textAlign: "center", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.muted }}>All suggestions resolved</div>
            <div style={{ fontSize: 11, color: c.hint, lineHeight: 1.6 }}>
              Run "✦ Suggest clustering" again for fresh recommendations.
            </div>
          </div>

        )}

        {hasAnything && (
          <>
            {assignGroups.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.hint, letterSpacing: "0.02em", marginBottom: 8 }}>
                  Add to existing clusters
                </div>
                {assignGroups.map((group) => (
                  <AssignCard
                    key={group.targetClusterId}
                    group={group}
                    inputs={inputs}
                    fadingIds={assignFading}
                    onAcceptAll={handleAcceptAll}
                    onDismissOne={handleDismissAssignment}
                  />
                ))}
              </div>
            )}

            {coreNewSugs.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.hint, letterSpacing: "0.02em", marginBottom: 8 }}>
                  New cluster suggestions
                </div>
                {coreNewSugs.map((sug) => (
                  <NewClusterCard
                    key={sug.id}
                    sug={sug}
                    inputs={inputs}
                    isFading={newFading.has(sug.id)}
                    onAccept={handleAcceptNewCluster}
                    onDismiss={handleDismissNewCluster}
                  />
                ))}
              </div>
            )}

            {lowRelevanceSugs.length > 0 && (
              <div style={{ marginTop: coreNewSugs.length > 0 ? 14 : 0 }}>
                <button
                  onClick={() => setShowLowRelevance((s) => !s)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600, color: c.hint, letterSpacing: "0.02em",
                    padding: 0, fontFamily: "inherit", marginBottom: 8,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <span style={{ fontSize: 9 }}>{showLowRelevance ? "▾" : "▸"}</span>
                  Lower-relevance suggestions ({lowRelevanceSugs.length})
                </button>
                {showLowRelevance && lowRelevanceSugs.map((sug) => (
                  <NewClusterCard
                    key={sug.id}
                    sug={sug}
                    inputs={inputs}
                    isFading={newFading.has(sug.id)}
                    onAccept={handleAcceptNewCluster}
                    onDismiss={handleDismissNewCluster}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

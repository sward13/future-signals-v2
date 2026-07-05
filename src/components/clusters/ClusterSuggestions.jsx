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
import { supabase } from "../../lib/supabase.js";
import { c, btnSm, btnG, inp, ta } from "../../styles/tokens.js";
import { SubtypeTag } from "../shared/Tag.jsx";

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

function AssignCard({ group, inputs, fadingIds, onAcceptAll, onDismissOne }) {
  const { targetClusterId, clusterName, sugs } = group;
  const visibleSugs = sugs.filter((s) => !fadingIds.has(s.id));
  if (visibleSugs.length === 0) return null;

  return (
    <div style={{
      background: c.white, border: `1px solid ${c.border}`, borderRadius: 9,
      overflow: "hidden", marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 6px" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>
          Add to <span style={{ color: c.brand }}>{clusterName}</span>
        </span>
        {visibleSugs.length > 1 && (
          <button
            onClick={() => onAcceptAll(targetClusterId)}
            style={{ ...btnG, fontSize: 11, color: c.brand, padding: "2px 4px" }}
          >
            Accept all
          </button>
        )}
      </div>

      {/* Input rows */}
      <div style={{ padding: "2px 12px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
        {sugs.map((sug) => {
          const inputId = (sug.input_ids || [])[0];
          const input = inputs.find((i) => i.id === inputId);
          if (!input) return null;
          const conf = sug.confidence ? CONF_STYLE[sug.confidence] : null;
          return (
            <div
              key={sug.id}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 8px",
                background: c.surfaceAlt, borderRadius: 6,
                opacity: fadingIds.has(sug.id) ? 0 : 1, transition: "opacity 0.25s",
              }}
            >
              <span style={{ color: c.hint, fontSize: 9, flexShrink: 0 }}>•</span>
              <span style={{
                flex: 1, fontSize: 11, color: c.ink,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {input.name}
              </span>
              {conf && (
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 500, flexShrink: 0, ...conf }}>
                  {sug.confidence === "high" ? "High" : "Moderate"}
                </span>
              )}
              <button
                onClick={() => onDismissOne(sug.id)}
                style={{ ...btnG, fontSize: 10, padding: "0 3px", flexShrink: 0, color: c.hint }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px 10px" }}>
        <button
          onClick={() => onAcceptAll(targetClusterId)}
          style={{ ...btnSm, fontSize: 11, padding: "4px 10px" }}
        >
          Accept
        </button>
        <button
          onClick={() => visibleSugs.forEach((s) => onDismissOne(s.id))}
          style={{ ...btnG, fontSize: 11 }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── New cluster suggestion card ───────────────────────────────────────────────

function NewClusterCard({ sug, inputs, isFading, onAccept, onDismiss }) {
  const [editMode,      setEditMode]      = useState(false);
  const [editName,      setEditName]      = useState(sug.name);
  const [editDesc,      setEditDesc]      = useState(sug.description || "");
  const [localIds,      setLocalIds]      = useState(sug.input_ids || []);
  const [showRationale, setShowRationale] = useState(false);

  const subtype      = sug.subtype ? sug.subtype.charAt(0).toUpperCase() + sug.subtype.slice(1) : "Trend";
  const visibleInputs = localIds.map((id) => inputs.find((i) => i.id === id)).filter(Boolean);
  const noInputs      = visibleInputs.length === 0;

  const handleCancel = () => {
    setEditMode(false);
    setEditName(sug.name);
    setEditDesc(sug.description || "");
    setLocalIds(sug.input_ids || []);
  };

  return (
    <div style={{
      background: c.white, border: `1px solid ${c.border}`, borderRadius: 9,
      overflow: "hidden", opacity: isFading ? 0 : 1, transition: "opacity 0.25s", marginBottom: 8,
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
          <div style={{ flexShrink: 0, paddingTop: 2 }}>
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
          <div style={{
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
              · Why this cluster?
            </button>
            {showRationale && (
              <div style={{
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
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
            {visibleInputs.map((input) => (
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
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {editMode ? (
            <>
              <button
                onClick={() => onAccept(sug, editName.trim() || sug.name, editDesc, localIds)}
                disabled={noInputs}
                style={{ ...btnSm, fontSize: 11, padding: "4px 10px", ...(noInputs ? { opacity: 0.5, cursor: "default" } : {}) }}
              >
                Create cluster
              </button>
              <button
                onClick={handleCancel}
                style={{
                  background: "none", border: `1px solid ${c.borderMid}`,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11, color: c.muted, padding: "4px 10px", borderRadius: 6,
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onAccept(sug, sug.name, sug.description || "", localIds)}
                disabled={noInputs}
                style={{ ...btnSm, fontSize: 11, padding: "4px 10px", ...(noInputs ? { opacity: 0.5, cursor: "default" } : {}) }}
              >
                Create cluster
              </button>
              <button
                onClick={() => setEditMode(true)}
                style={{
                  background: "none", border: `1px solid ${c.borderMid}`,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11, color: c.muted, padding: "4px 10px", borderRadius: 6,
                }}
              >
                Edit
              </button>
              <button onClick={() => onDismiss(sug.id)} style={{ ...btnG, fontSize: 11 }}>
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
    try {
      const { error } = await supabase.functions.invoke("compute-cluster-suggestions", {
        body: { project_id: projectId, mode: "combined", clustering_sensitivity: tightness },
      });
      if (error) throw new Error(error.message);
      setDismissed([]);
      const loaded = await loadSuggestions();
      setHasRun(true);
      setLastRunEmpty(loaded.length === 0);
    } catch (err) {
      setError(err.message || "Failed to generate suggestions.");
    } finally {
      setRunning(false);
    }
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
    showToast?.(`${n} input${n !== 1 ? "s" : ""} assigned to "${cl?.name || "cluster"}"`);
  };

  const handleDismissAssignment = (id) => {
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

  const hasAnything = assignGroups.length > 0 || visibleNewSugs.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Toolbar */}
      <div style={{
        padding: "8px 12px", flexShrink: 0,
        borderBottom: `1px solid ${c.border}`,
        display: "flex", alignItems: "center", gap: 4,
        background: c.white,
      }}>
        {/* Sensitivity toggle — compact padding so "Exploratory" fits at 320px */}
        <div style={{ display: "inline-flex", flexShrink: 0, border: `1px solid ${c.borderMid}`, borderRadius: 6, overflow: "hidden" }}>
          {[["tight", "Tight"], ["balanced", "Balanced"], ["exploratory", "Exploratory"]].map(([key, label], idx) => (
            <button
              key={key}
              onClick={() => setTightness(key)}
              style={{
                padding: "3px 5px", fontSize: 10, fontFamily: "inherit",
                cursor: "pointer", border: "none",
                borderLeft: idx > 0 ? `1px solid ${c.borderMid}` : "none",
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

        {/* Suggest button */}
        <button
          onClick={handleRun}
          disabled={running || !projectId}
          style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 9px", borderRadius: 6,
            border: `1px solid ${c.borderMid}`,
            background: "transparent",
            color: running || !projectId ? c.muted : c.ink,
            opacity: !projectId ? 0.5 : 1,
            fontSize: 11, fontWeight: 500,
            cursor: running || !projectId ? "default" : "pointer",
            fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          {running ? (
            <>
              <span style={{
                display: "inline-block", width: 9, height: 9, borderRadius: "50%",
                border: `1.5px solid ${c.border}`, borderTopColor: c.muted,
                animation: "spin 0.7s linear infinite",
              }} />
              Suggesting…
            </>
          ) : "✦ Suggest clustering"}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>

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
                <div style={{ fontSize: 10, fontWeight: 600, color: c.hint, letterSpacing: "0.07em", marginBottom: 8 }}>
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

            {visibleNewSugs.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: c.hint, letterSpacing: "0.07em", marginBottom: 8 }}>
                  New cluster suggestions
                </div>
                {visibleNewSugs.map((sug) => (
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

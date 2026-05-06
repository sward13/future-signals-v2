import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import { c, btnP } from "../../styles/tokens.js";
import logoLight from "../../assets/logo_light.svg";

interface Props {
  projectId: string;
  projectName: string;
  workspaceId: string;
  promotedInputIds: string[];
  onComplete: () => void;
  onBack?: () => void;
}

interface ClusterSuggestion {
  id: string;
  name: string;
  description: string | null;
  subtype: string | null;
  input_ids: string[];
}

type Phase = "loading" | "done";

const STEP_DOT   = 4;
const TOTAL_DOTS = 5;
const MIN_LOADING_MS  = 2000;
const EMBED_TIMEOUT_MS = 20_000;

const TYPE_CONFIG: Record<string, {
  cardBg: string; cardBorder: string;
  pillBg: string; pillColor: string;
  def: string;
}> = {
  Trend: {
    cardBg: "#FAF8FF", cardBorder: "#DDD6FE",
    pillBg: "#EDE9FE", pillColor: "#5B21B6",
    def: "A pattern of change visible across multiple signals.",
  },
  Driver: {
    cardBg: "#EFF8FF", cardBorder: "#BFDBFE",
    pillBg: "#DBEAFE", pillColor: "#1E40AF",
    def: "An underlying force shaping how the trend plays out.",
  },
  Tension: {
    cardBg: "#FFFBEB", cardBorder: "#FDE68A",
    pillBg: "#FEF3C7", pillColor: "#92400E",
    def: "A contradiction or pressure point between competing forces.",
  },
};

const capitalize = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

// ── Wait for all promoted inputs to have embeddings ────────────────────────────
//
// ScannerInboxStep fires embed-input non-blocking and calls onComplete
// immediately. We poll until all inputs are embedded (or time out) before
// running clustering so compute-cluster-suggestions finds actual embeddings.

async function waitForEmbeddings(inputIds: string[], timeoutMs: number): Promise<void> {
  if (inputIds.length === 0) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("inputs")
      .select("id, embedding")
      .in("id", inputIds);
    const ready = (data ?? []).filter((i: { embedding: unknown }) => i.embedding != null);
    if (ready.length >= inputIds.length) return;
    await new Promise<void>((r) => setTimeout(r, 1500));
  }
  // Timeout — proceed with however many embeddings are ready
}

// ── Promote cluster suggestions to real, persisted clusters ───────────────────
//
// compute-cluster-suggestions writes to cluster_suggestions (status=pending).
// This function promotes each suggestion into the clusters table and its
// cluster_inputs junction rows, matching the pattern in useAppState.addCluster.

async function promoteClusters(
  clusterList: ClusterSuggestion[],
  projectId: string,
  workspaceId: string,
): Promise<void> {
  const now = new Date().toISOString();
  for (const suggestion of clusterList) {
    const clusterId = crypto.randomUUID();
    const subtype   = capitalize(suggestion.subtype ?? "trend");

    const { error: clusterError } = await supabase.from("clusters").insert({
      id:           clusterId,
      workspace_id: workspaceId,
      project_id:   projectId,
      name:         suggestion.name,
      subtype,
      horizon:      "H1",
      likelihood:   "Plausible",
      description:  suggestion.description ?? "",
      created_at:   now,
    });

    if (clusterError) {
      console.error("[onboarding] cluster insert failed:", clusterError);
      continue;
    }

    if (suggestion.input_ids.length > 0) {
      await supabase.from("cluster_inputs").insert(
        suggestion.input_ids.map((input_id) => ({
          workspace_id: workspaceId,
          cluster_id:   clusterId,
          input_id,
        }))
      );
    }

    // Mark suggestion as accepted (fire-and-forget)
    supabase
      .from("cluster_suggestions")
      .update({ status: "accepted", acted_on_at: now })
      .eq("id", suggestion.id)
      .then();
  }
}

// ── Shared chrome ─────────────────────────────────────────────────────────────

function StepDots() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: TOTAL_DOTS }, (_, i) => (
        <div key={i} style={{
          width:        i === STEP_DOT ? 20 : 6,
          height:       6,
          borderRadius: 3,
          background:   i === STEP_DOT
            ? c.brand
            : i < STEP_DOT
              ? "rgba(59,130,246,0.4)"
              : "rgba(0,0,0,0.15)",
          transition: "all 0.2s",
        }} />
      ))}
    </div>
  );
}

function TopBar() {
  return (
    <div style={{
      background: c.white,
      borderBottom: "0.5px solid rgba(0,0,0,0.09)",
      padding: "0 32px",
      height: 52,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 10,
      boxSizing: "border-box",
    }}>
      <img src={logoLight} alt="Future Signals" style={{ width: 130, height: "auto", display: "block" }} />
      <StepDots />
    </div>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: c.bg,
      fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
      fontSize: 13,
      lineHeight: 1.5,
      WebkitFontSmoothing: "antialiased",
    }}>
      <TopBar />
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 24px 32px",
      }}>
        <div style={{
          background: c.white,
          border: "0.5px solid rgba(0,0,0,0.09)",
          borderRadius: 12,
          padding: "32px 36px",
          width: "100%",
          maxWidth: wide ? 740 : 520,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          boxSizing: "border-box",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── State A — zero inputs ─────────────────────────────────────────────────────

function ZeroInputsState({ onComplete }: { onComplete: () => void }) {
  return (
    <Shell>
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div style={{ fontSize: 28, marginBottom: 16 }}>◎</div>
        <h2 style={{
          fontFamily: "'Roboto', -apple-system, sans-serif",
          fontSize: 18, fontWeight: 500, color: c.ink,
          margin: "0 0 9px",
        }}>
          Your project is ready
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 24px", lineHeight: 1.6 }}>
          You skipped signal selection for now — you can discover signals from the Scanner tab inside your project.
        </p>
        <button onClick={onComplete} style={{ ...btnP, fontSize: 13, padding: "10px 24px" }}>
          Open my project
        </button>
      </div>
    </Shell>
  );
}

// ── State B — loading ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <>
      <style>{`@keyframes crs-spin { to { transform: rotate(360deg); } }`}</style>
      <Shell>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{
            width: 44, height: 44,
            border: "3px solid #DBEAFE",
            borderTopColor: "#3B82F6",
            borderRadius: "50%",
            animation: "crs-spin 0.9s linear infinite",
            margin: "0 auto 18px",
          }} />
          <h2 style={{
            fontFamily: "'Roboto', -apple-system, sans-serif",
            fontSize: 18, fontWeight: 500, color: c.ink,
            margin: "0 0 9px",
          }}>
            Finding patterns in your signals…
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>
            AI is grouping your signals into clusters. This takes a few seconds.
          </p>
        </div>
      </Shell>
    </>
  );
}

// ── State C sub-state — 0 clusters returned ───────────────────────────────────

function NoClustersState({ onComplete, onBack }: { onComplete: () => void; onBack?: () => void }) {
  return (
    <Shell>
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div style={{ fontSize: 28, marginBottom: 16 }}>◈</div>
        <h2 style={{
          fontFamily: "'Roboto', -apple-system, sans-serif",
          fontSize: 18, fontWeight: 500, color: c.ink,
          margin: "0 0 9px",
        }}>
          Your signals are ready
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 24px", lineHeight: 1.6 }}>
          We couldn't suggest clusters right now — you can run clustering any time from your project.
        </p>
        <button onClick={onComplete} style={{ ...btnP, fontSize: 13, padding: "10px 24px" }}>
          Open my project
        </button>
        {onBack && (
          <div style={{ marginTop: 12 }}>
            <button onClick={onBack} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "#6B7280", fontFamily: "inherit", padding: 0,
            }}>
              ← Back to signal selection
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── State C — results ─────────────────────────────────────────────────────────

function ClusterCard({
  cluster,
  inputNameMap,
}: {
  cluster: ClusterSuggestion;
  inputNameMap: Record<string, string>;
}) {
  const typeKey = capitalize(cluster.subtype ?? "");
  const config  = TYPE_CONFIG[typeKey] ?? TYPE_CONFIG.Trend;

  return (
    <div style={{
      borderRadius: 10,
      padding: "16px 18px",
      marginBottom: 10,
      border: `1px solid ${config.cardBorder}`,
      background: config.cardBg,
    }}>
      {/* Pill + signal count */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, marginBottom: 8,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 500,
          textTransform: "uppercase", letterSpacing: "0.06em",
          padding: "2px 7px", borderRadius: 4,
          background: config.pillBg, color: config.pillColor,
          display: "inline-block",
        }}>
          {typeKey || cluster.subtype}
        </span>
        <span style={{ fontSize: 10, color: "#9CA3AF", whiteSpace: "nowrap" }}>
          {cluster.input_ids.length} {cluster.input_ids.length === 1 ? "signal" : "signals"}
        </span>
      </div>

      {/* Cluster name */}
      <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A1A", marginBottom: 5 }}>
        {cluster.name}
      </div>

      {/* AI summary */}
      {cluster.description && (
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, marginBottom: 8 }}>
          {cluster.description}
        </div>
      )}

      {/* Signal list */}
      {cluster.input_ids.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {cluster.input_ids.map((id) => (
            <div key={id} style={{
              fontSize: 11, color: "#6B7280",
              display: "flex", alignItems: "flex-start", gap: 6,
              lineHeight: 1.45,
            }}>
              <span style={{ color: "#9CA3AF", flexShrink: 0 }}>↳</span>
              {inputNameMap[id] ?? id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsState({
  clusters,
  inputNameMap,
  projectName,
  onConfirm,
  confirming,
  onBack,
}: {
  clusters: ClusterSuggestion[];
  inputNameMap: Record<string, string>;
  projectName: string;
  onConfirm: () => void;
  confirming: boolean;
  onBack?: () => void;
}) {
  // Only show type explainers for types that actually appear in results
  const presentTypes = [...new Set(
    clusters.map((cl) => capitalize(cl.subtype ?? "")).filter(Boolean)
  )];

  return (
    <Shell wide>
      {/* Success banner */}
      <div style={{
        background: "#F0FDF4",
        border: "1px solid #BBF7D0",
        borderRadius: 8,
        padding: "11px 15px",
        marginBottom: 20,
        fontSize: 12, color: "#065F46",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        ✓&nbsp;&nbsp;{clusters.length} {clusters.length === 1 ? "cluster" : "clusters"} found in {projectName}
      </div>

      {/* Card header */}
      <div style={{
        fontSize: 10, fontWeight: 500,
        textTransform: "uppercase", letterSpacing: "0.07em",
        color: c.brand, marginBottom: 8,
      }}>
        Your first clusters
      </div>
      <h2 style={{
        fontFamily: "'Roboto', -apple-system, sans-serif",
        fontSize: 20, fontWeight: 500, color: c.ink,
        margin: "0 0 6px",
      }}>
        Here are the patterns in your signals
      </h2>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 18px", lineHeight: 1.6 }}>
        Each cluster is named and typed by AI. Review them here — once you open your project you can rename, merge, or reassign signals.
      </p>

      {/* Cluster cards */}
      {clusters.map((cl) => (
        <ClusterCard key={cl.id} cluster={cl} inputNameMap={inputNameMap} />
      ))}

      {/* Cluster type explainer — shown for each type that appears */}
      {presentTypes.length > 0 && (
        <div style={{
          marginTop: 8, marginBottom: 20,
          padding: "14px 16px",
          background: "#F9FAFB",
          border: "0.5px solid rgba(0,0,0,0.09)",
          borderRadius: 8,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "0.07em",
            color: c.faint, marginBottom: 10,
          }}>
            What these types mean
          </div>
          {presentTypes.map((type) => {
            const config = TYPE_CONFIG[type];
            if (!config) return null;
            return (
              <div key={type} style={{ display: "flex", gap: 10, marginBottom: 7 }}>
                <span style={{
                  fontSize: 9, fontWeight: 500,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  padding: "2px 6px", borderRadius: 3,
                  background: config.pillBg, color: config.pillColor,
                  flexShrink: 0, alignSelf: "flex-start", marginTop: 1,
                }}>
                  {type}
                </span>
                <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                  {config.def}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: onBack ? "space-between" : "flex-end" }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "#6B7280", fontFamily: "inherit", padding: "4px 0",
          }}>
            ← Back
          </button>
        )}
        <button
          onClick={onConfirm}
          disabled={confirming}
          style={{
            ...btnP, fontSize: 13, padding: "10px 22px",
            opacity: confirming ? 0.6 : 1,
            cursor: confirming ? "default" : "pointer",
          }}
        >
          {confirming ? "Opening…" : "Open my project →"}
        </button>
      </div>
    </Shell>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function ClusteringResultsStep({
  projectId,
  projectName,
  workspaceId,
  promotedInputIds,
  onComplete,
  onBack,
}: Props) {
  const [phase,        setPhase]        = useState<Phase>("loading");
  const [clusters,     setClusters]     = useState<ClusterSuggestion[]>([]);
  const [inputNameMap, setInputNameMap] = useState<Record<string, string>>({});
  const [confirming,   setConfirming]   = useState(false);

  useEffect(() => {
    if (promotedInputIds.length === 0) return;

    const run = async () => {
      const minDelay = new Promise<void>((resolve) =>
        setTimeout(resolve, MIN_LOADING_MS)
      );

      const doWork = async () => {
        // Wait for all promoted inputs to be embedded before clustering.
        // ScannerInboxStep fires embed-input non-blocking so embeddings may
        // still be in-flight when this runs.
        await waitForEmbeddings(promotedInputIds, EMBED_TIMEOUT_MS);

        // Trigger clustering
        const { error: fnError } = await supabase.functions.invoke(
          "compute-cluster-suggestions",
          {
            body: {
              project_id:             projectId,
              mode:                   "new_clusters",
              clustering_sensitivity: "balanced",
            },
          }
        );
        if (fnError) {
          console.error("[onboarding] clustering invocation failed:", fnError);
          return { clusters: [] as ClusterSuggestion[], inputNameMap: {} as Record<string, string> };
        }

        // Fetch the written suggestions
        const { data: suggestions } = await supabase
          .from("cluster_suggestions")
          .select("id, name, description, subtype, input_ids")
          .eq("project_id", projectId)
          .eq("status", "pending")
          .order("generated_at", { ascending: false });

        const rows = (suggestions ?? []) as ClusterSuggestion[];

        // Fetch input names for the signal lists
        const allIds = [...new Set(rows.flatMap((r) => r.input_ids))];
        let nameMap: Record<string, string> = {};
        if (allIds.length > 0) {
          const { data: inputs } = await supabase
            .from("inputs")
            .select("id, name")
            .in("id", allIds);
          nameMap = Object.fromEntries(
            (inputs ?? []).map((i: { id: string; name: string }) => [i.id, i.name])
          );
        }

        return { clusters: rows, inputNameMap: nameMap };
      };

      const [{ clusters: c, inputNameMap: m }] = await Promise.all([
        doWork(),
        minDelay,
      ]);

      setClusters(c);
      setInputNameMap(m);
      setPhase("done");
    };

    run();
  }, []); // Intentionally empty — runs once on mount

  // Promote pending suggestions to real clusters then hand off.
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      if (clusters.length > 0) {
        await promoteClusters(clusters, projectId, workspaceId);
      }
    } catch (err) {
      console.error("[onboarding] cluster promotion failed:", err);
    }
    onComplete();
  };

  // State A — user skipped signal selection
  if (promotedInputIds.length === 0) {
    return <ZeroInputsState onComplete={onComplete} />;
  }

  // State B — clustering in progress
  if (phase === "loading") {
    return <LoadingState />;
  }

  // State C — 0 clusters returned
  if (clusters.length === 0) {
    return <NoClustersState onComplete={onComplete} onBack={onBack} />;
  }

  // State C — results
  return (
    <ResultsState
      clusters={clusters}
      inputNameMap={inputNameMap}
      projectName={projectName}
      onConfirm={handleConfirm}
      confirming={confirming}
      onBack={onBack}
    />
  );
}

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import { c, btnP } from "../../styles/tokens.js";
import logoLight from "../../assets/logo_light.svg";

interface Props {
  projectId: string;
  projectName: string;
  promotedInputIds: string[];
  onComplete: () => void;
}

interface ClusterSuggestion {
  id: string;
  name: string;
  description: string | null;
  subtype: string | null;
  input_ids: string[];
}

type Phase = "loading" | "done";

// Dot index 4 (0-indexed, final dot)
const STEP_DOT   = 4;
const TOTAL_DOTS = 5;
const MIN_LOADING_MS = 1500;

const TYPE_CONFIG: Record<string, {
  cardBg: string; cardBorder: string;
  pillBg: string; pillColor: string;
  def: string;
}> = {
  Trend: {
    cardBg: "#FAF8FF", cardBorder: "#DDD6FE",
    pillBg: "#EDE9FE", pillColor: "#5B21B6",
    def: "A pattern of change already underway and gathering momentum.",
  },
  Driver: {
    cardBg: "#EFF8FF", cardBorder: "#BFDBFE",
    pillBg: "#DBEAFE", pillColor: "#1E40AF",
    def: "A force actively shaping how this trend develops — accelerating, directing, or enabling change.",
  },
  Tension: {
    cardBg: "#FFFBEB", cardBorder: "#FDE68A",
    pillBg: "#FEF3C7", pillColor: "#92400E",
    def: "A friction point where competing forces, values, or interests are pulling against each other.",
  },
};

const capitalize = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

// "a Trend, a Driver, and a Tension" from an array of cluster suggestions
function formatTypeList(clusters: ClusterSuggestion[]): string {
  const types = [...new Set(
    clusters.map(cl => capitalize(cl.subtype ?? ""))
        .filter(Boolean)
  )];
  if (!types.length) return "";
  if (types.length === 1) return `a ${types[0]}`;
  const last = types[types.length - 1];
  const rest = types.slice(0, -1).map(t => `a ${t}`).join(", ");
  return `${rest}, and a ${last}`;
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
      <div style={{ display: "flex", alignItems: "center" }}>
        <img src={logoLight} alt="Future Signals" style={{ width: 130, height: "auto", display: "block" }} />
      </div>
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
            Finding patterns…
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

function NoClustersState({ onComplete }: { onComplete: () => void }) {
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
          Your signals are ready — run AI clustering any time from your project to find patterns.
        </p>
        <button onClick={onComplete} style={{ ...btnP, fontSize: 13, padding: "10px 24px" }}>
          Open my project
        </button>
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
      padding: "18px 20px",
      marginBottom: 12,
      border: `1px solid ${config.cardBorder}`,
      background: config.cardBg,
    }}>
      {/* Row 1: pill + type definition + signal count */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", gap: 12, marginBottom: 9,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "2px 7px", borderRadius: 4,
            background: config.pillBg, color: config.pillColor,
            display: "inline-block",
          }}>
            {typeKey || cluster.subtype}
          </span>
          {config.def && (
            <span style={{
              fontSize: 10, fontStyle: "italic",
              lineHeight: 1.4, maxWidth: 380,
              color: config.pillColor,
            }}>
              {config.def}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: "#9CA3AF", whiteSpace: "nowrap", marginTop: 2 }}>
          {cluster.input_ids.length} {cluster.input_ids.length === 1 ? "signal" : "signals"}
        </span>
      </div>

      {/* Row 2: cluster name */}
      <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A1A", marginBottom: 5 }}>
        {cluster.name}
      </div>

      {/* Row 3: AI summary */}
      {cluster.description && (
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, marginBottom: 9 }}>
          {cluster.description}
        </div>
      )}

      {/* Row 4: signal list */}
      {cluster.input_ids.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
  onComplete,
}: {
  clusters: ClusterSuggestion[];
  inputNameMap: Record<string, string>;
  projectName: string;
  onComplete: () => void;
}) {
  const typeList = formatTypeList(clusters);

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
        {typeList ? ` — ${typeList}` : ""}
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
        Clusters come in three types — each tells you something different about how change is
        unfolding in your domain. These are AI suggestions: rename, merge, or reassign signals
        as you see fit.
      </p>

      {/* Cluster cards */}
      {clusters.map((cl) => (
        <ClusterCard key={cl.id} cluster={cl} inputNameMap={inputNameMap} />
      ))}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginTop: 8,
      }}>
        <button
          onClick={onComplete}
          style={{
            background: "none", border: "none",
            color: "#6B7280", fontSize: 12,
            cursor: "pointer", fontFamily: "inherit",
            padding: "4px 0",
          }}
        >
          I'll refine these later
        </button>
        <button
          onClick={onComplete}
          style={{ ...btnP, fontSize: 13, padding: "10px 22px" }}
        >
          Open my project
        </button>
      </div>
    </Shell>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function ClusteringResultsStep({
  projectId,
  projectName,
  promotedInputIds,
  onComplete,
}: Props) {
  const [phase,        setPhase]        = useState<Phase>("loading");
  const [clusters,     setClusters]     = useState<ClusterSuggestion[]>([]);
  const [inputNameMap, setInputNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (promotedInputIds.length === 0) return; // State A — no async work needed

    const run = async () => {
      const minDelay = new Promise<void>((resolve) =>
        setTimeout(resolve, MIN_LOADING_MS)
      );

      const doWork = async () => {
        // Trigger clustering
        const { error: fnError } = await supabase.functions.invoke(
          "compute-cluster-suggestions",
          {
            body: {
              project_id:              projectId,
              mode:                    "new_clusters",
              clustering_sensitivity:  "balanced",
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

      // Both conditions must be met before leaving the loading state
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
    return <NoClustersState onComplete={onComplete} />;
  }

  // State C — results
  return (
    <ResultsState
      clusters={clusters}
      inputNameMap={inputNameMap}
      projectName={projectName}
      onComplete={onComplete}
    />
  );
}

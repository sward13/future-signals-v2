import { useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { c, btnP } from "../../styles/tokens.js";
import logoLight from "../../assets/logo_light.svg";

// Dot index 3 active (0-indexed)
const STEP_DOT = 3;
const TOTAL_DOTS = 5;

// Threshold for "unlock AI clustering" messaging
const CLUSTER_THRESHOLD = 10;

const CREDIBILITY_TO_SIGNAL_QUALITY = {
  institutional: "Established",
  specialist:    "Emerging",
  general:       "Emerging",
};

function StepDots() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: TOTAL_DOTS }, (_, i) => {
        const isActive = i === STEP_DOT;
        const isDone   = i  < STEP_DOT;
        return (
          <div
            key={i}
            style={{
              width:        isActive ? 20 : 6,
              height:       6,
              borderRadius: 3,
              background:   isActive
                ? c.brand
                : isDone
                  ? "rgba(59,130,246,0.4)"
                  : "rgba(0,0,0,0.15)",
              transition: "all 0.2s",
            }}
          />
        );
      })}
    </div>
  );
}

function CredibilityBadge({ credibility }) {
  const isInstitutional = credibility === "institutional";
  return (
    <span
      style={{
        fontSize: 9,
        padding: "1px 5px",
        borderRadius: 3,
        background: isInstitutional ? "#D1FAE5" : "#FEF3C7",
        color:      isInstitutional ? "#065F46" : "#92400E",
        fontWeight: 500,
      }}
    >
      {isInstitutional ? "Institutional" : "Specialist"}
    </span>
  );
}

function CandidateCard({ candidate, selected, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: selected ? "#F8FBFF" : c.white,
        border: `1px solid ${selected ? c.brand : "#E5E7EB"}`,
        borderRadius: 8,
        padding: "11px 12px",
        cursor: "pointer",
        position: "relative",
        transition: "border-color 0.15s, background 0.15s",
        userSelect: "none",
      }}
    >
      {/* Checkbox */}
      <div
        style={{
          position: "absolute",
          top: 10, right: 10,
          width: 15, height: 15,
          borderRadius: 4,
          border: selected
            ? `1.5px solid ${c.brand}`
            : "1.5px solid rgba(0,0,0,0.18)",
          background: selected ? c.brand : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9,
          color: c.white,
          transition: "all 0.15s",
          flexShrink: 0,
        }}
      >
        {selected && "✓"}
      </div>

      {/* Source + credibility */}
      <div
        style={{
          fontSize: 10, color: "#9CA3AF",
          marginBottom: 3,
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        {candidate.source_name}
        <CredibilityBadge credibility={candidate.source_credibility} />
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 11.5, fontWeight: 500, color: c.ink,
          marginBottom: 4,
          lineHeight: 1.4,
          paddingRight: 20,
        }}
      >
        {candidate.title}
      </div>

      {/* Summary */}
      <div
        style={{
          fontSize: 11, color: "#6B7280",
          lineHeight: 1.5,
          marginBottom: 6,
        }}
      >
        {candidate.summary_ai}
      </div>

      {/* STEEPLED tags */}
      {candidate.steepled_tags?.length > 0 && (
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {candidate.steepled_tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 3,
                background: "#F3F4F6",
                color: "#6B7280",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ScannerInboxStep — onboarding scanner inbox showing seeded candidates.
 *
 * @param {{
 *   candidates: object[],
 *   projectId: string,
 *   workspaceId: string,
 *   projectName: string,
 *   domain: string,
 *   keyQuestion: string,
 *   onComplete: (promotedInputIds: string[]) => void,
 * }} props
 */
export function ScannerInboxStep({
  candidates,
  projectId,
  workspaceId,
  projectName,
  domain,
  keyQuestion,
  onComplete,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [promoting, setPromoting] = useState(false);

  const n = selectedIds.size;
  const totalCandidates = candidates.length;
  const belowThreshold = totalCandidates < CLUSTER_THRESHOLD;
  const fillPct = Math.min((n / CLUSTER_THRESHOLD) * 100, 100);

  const allSelected = totalCandidates > 0 && n === totalCandidates;

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(candidates.map((c) => c.id)));
  };

  const handleSkip = () => onComplete([]);

  const handleAdd = async () => {
    if (n === 0 || promoting) return;
    setPromoting(true);

    const selected = candidates.filter((c) => selectedIds.has(c.id));
    const now = new Date().toISOString();

    const results = await Promise.allSettled(
      selected.map((candidate) => {
        const signalQuality =
          CREDIBILITY_TO_SIGNAL_QUALITY[candidate.source_credibility] ?? "Emerging";

        return supabase
          .from("inputs")
          .insert({
            id:           crypto.randomUUID(),
            workspace_id: workspaceId,
            project_id:   projectId,
            name:         candidate.title,
            description:  candidate.summary_ai || "",
            source_url:   candidate.source_url,
            subtype:      "Signal",
            steepled:     candidate.steepled_tags || [],
            signal_quality: signalQuality,
            is_seeded:    true,
            metadata: {
              source:       "onboarding_scanner",
              candidate_id: candidate.id,
            },
            created_at: now,
          })
          .select("id")
          .single();
      })
    );

    const promotedIds = results
      .filter((r) => r.status === "fulfilled" && !r.value.error && r.value.data?.id)
      .map((r) => r.value.data.id);

    // Fire embed-input for each inserted input — parallel, non-blocking.
    // Embeddings must exist before compute-cluster-suggestions runs.
    Promise.allSettled(
      promotedIds.map((id) =>
        supabase.functions.invoke("embed-input", { body: { input_id: id } })
      )
    ).then((embedResults) => {
      embedResults.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error("[onboarding] embed-input failed for", promotedIds[i], r.reason);
        }
      });
    });

    onComplete(promotedIds);
  };

  const progressText = () => {
    if (n === 0) return "Select signals to add to your project";
    if (belowThreshold) return "Select all signals that look relevant";
    if (n >= CLUSTER_THRESHOLD)
      return <span style={{ color: "#065F46" }}><strong>{n} selected — ready to cluster</strong></span>;
    return <span><strong>{n}</strong> selected — add <strong>{CLUSTER_THRESHOLD - n}</strong> more to unlock AI clustering</span>;
  };

  if (totalCandidates === 0) {
    return (
      <EmptyState onComplete={onComplete} domain={domain} />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: c.bg,
        fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
        fontSize: 13,
        lineHeight: 1.5,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: c.white,
          borderBottom: "0.5px solid rgba(0,0,0,0.09)",
          padding: "0 32px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logoLight} alt="Future Signals" style={{ width: 130, height: "auto", display: "block" }} />
        </div>
        <StepDots />
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "40px 24px 32px",
        }}
      >
        <div
          style={{
            background: c.white,
            border: "0.5px solid rgba(0,0,0,0.09)",
            borderRadius: 12,
            padding: "32px 36px",
            width: "100%",
            maxWidth: 740,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            boxSizing: "border-box",
          }}
        >
          {/* Tag */}
          <div
            style={{
              fontSize: 10, fontWeight: 500,
              textTransform: "uppercase", letterSpacing: "0.07em",
              color: c.brand, marginBottom: 8,
            }}
          >
            Your scanner found signals
          </div>

          {/* Title */}
          <h2
            style={{
              fontFamily: "'Roboto', -apple-system, sans-serif",
              fontSize: 22, fontWeight: 500, color: c.ink,
              margin: "0 0 5px",
            }}
          >
            Signals arrived while you were setting up
          </h2>

          {/* Sub */}
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 14px", lineHeight: 1.6 }}>
            We scanned <strong>{domain}</strong> sources for signals matching your key question.
            Select the ones that look relevant — you can review the rest from the Scanner tab any time.
          </p>

          {/* KQ callout */}
          <div
            style={{
              padding: "9px 14px",
              borderLeft: "2px solid #3B82F6",
              background: "#F0F7FF",
              borderRadius: "0 7px 7px 0",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 9, fontWeight: 500,
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: "#3B82F6", marginBottom: 3,
              }}
            >
              Matched to — {projectName}
            </div>
            <div
              style={{
                fontSize: 12, fontStyle: "italic",
                color: "#374151", lineHeight: 1.55,
              }}
            >
              {keyQuestion}
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              background: c.white,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                flex: 1, height: 5,
                background: "#E5E7EB",
                borderRadius: 3, overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: c.brand,
                  borderRadius: 3,
                  width: `${fillPct}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11, color: "#6B7280",
                whiteSpace: "nowrap",
                minWidth: 200,
                textAlign: "right",
              }}
            >
              {progressText()}
            </div>
          </div>

          {/* Select all / Deselect all */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <button
              type="button"
              onClick={toggleAll}
              style={{
                background: "none", border: "none", padding: 0,
                fontSize: 11, color: c.brand, cursor: "pointer",
                fontFamily: "inherit", fontWeight: 500,
              }}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          {/* Candidate grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 9,
              marginBottom: 14,
              maxHeight: 340,
              overflowY: "auto",
              paddingRight: 2,
            }}
          >
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                selected={selectedIds.has(candidate.id)}
                onToggle={() => toggle(candidate.id)}
              />
            ))}
          </div>

          {/* Footer actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={handleSkip}
              disabled={promoting}
              style={{
                background: "none", border: "none",
                color: "#6B7280", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
                padding: "4px 0",
              }}
            >
              Skip — review from the Scanner tab later
            </button>

            <button
              onClick={handleAdd}
              disabled={n === 0 || promoting}
              style={{
                ...btnP,
                opacity: n > 0 && !promoting ? 1 : 0.4,
                cursor: n > 0 && !promoting ? "pointer" : "default",
                minWidth: 180,
              }}
            >
              {promoting
                ? "Adding…"
                : n > 0
                  ? `Add ${n} signal${n !== 1 ? "s" : ""} to my project`
                  : "Select signals to add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onComplete, domain }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: c.bg,
        fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
        fontSize: 13,
        lineHeight: 1.5,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div
        style={{
          background: c.white,
          borderBottom: "0.5px solid rgba(0,0,0,0.09)",
          padding: "0 32px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logoLight} alt="Future Signals" style={{ width: 130, height: "auto", display: "block" }} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {Array.from({ length: TOTAL_DOTS }, (_, i) => (
            <div
              key={i}
              style={{
                width: i === STEP_DOT ? 20 : 6,
                height: 6, borderRadius: 3,
                background: i === STEP_DOT
                  ? c.brand
                  : i < STEP_DOT
                    ? "rgba(59,130,246,0.4)"
                    : "rgba(0,0,0,0.15)",
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            background: c.white,
            border: "0.5px solid rgba(0,0,0,0.09)",
            borderRadius: 12,
            padding: "40px 36px",
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 16 }}>◎</div>
          <h2
            style={{
              fontFamily: "'Roboto', -apple-system, sans-serif",
              fontSize: 18, fontWeight: 500, color: c.ink,
              margin: "0 0 9px",
            }}
          >
            We're still building signals for this topic
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 24px", lineHeight: 1.6 }}>
            Your scanner will start surfacing relevant signals overnight. In the meantime, you can add your own inputs manually from your project.
          </p>
          <button
            onClick={() => onComplete([])}
            style={{ ...btnP, fontSize: 13, padding: "10px 24px" }}
          >
            Go to my project →
          </button>
        </div>
      </div>
    </div>
  );
}

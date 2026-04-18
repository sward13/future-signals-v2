/**
 * check-scanner-health — nightly diagnostics for the RSS scanner pipeline.
 * Runs after scoring completes. Queries existing tables (no API calls), computes
 * per-source health metrics, upserts into source_health, then emails an admin digest.
 *
 * Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 *                   RESEND_API_KEY, ADMIN_EMAIL
 *
 * Status values: 'healthy' | 'degraded' | 'dead' | 'noisy'
 *   dead      — last_fetched_at > 7 days ago AND no candidates in last 7 days
 *   degraded  — avg(length(summary_raw)) < 20 chars in last 30 days (thin feeds)
 *   noisy     — > 30 new candidates in last 24 h (fire-hose feeds)
 *   healthy   — everything else
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Types ───────────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "degraded" | "dead" | "noisy";

interface SourceRow {
  id: string;
  name: string;
  last_fetched_at: string | null;
}

interface HealthRow {
  source_id: string;
  source_name: string;
  status: HealthStatus;
  consecutive_failures: number;
  items_last_fetch: number;
  avg_summary_length: number | null;
  avg_score_across_projects: number | null;
  promotion_rate: number | null;
  last_successful_fetch: string | null;
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), { status: 401 });
  }

  try {
    const summary = await runHealthCheck();
    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Health check failed:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// ── Health check logic ──────────────────────────────────────────────────────

async function runHealthCheck() {
  const now = new Date();
  const oneDayAgo    = new Date(now.getTime() -  1 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Active sources
  const { data: sources, error: srcErr } = await supabase
    .from("sources")
    .select("id, name, last_fetched_at")
    .eq("active", true);
  if (srcErr) throw srcErr;
  if (!sources?.length) return { sources_checked: 0 };

  // 2. Existing health rows — needed to carry over consecutive_failures
  const { data: existingHealth } = await supabase
    .from("source_health")
    .select("source_id, consecutive_failures, last_successful_fetch");
  const priorHealth = new Map(
    (existingHealth || []).map((h) => [h.source_id, h]),
  );

  // 3. Recent candidates (last 30 days) — single bulk fetch
  const { data: recentCandidates } = await supabase
    .from("candidates")
    .select("id, source_id, summary_raw, created_at")
    .gte("created_at", thirtyDaysAgo.toISOString());

  // Index by source_id
  const bySrc = new Map<string, typeof recentCandidates>();
  for (const c of recentCandidates || []) {
    if (!bySrc.has(c.source_id)) bySrc.set(c.source_id, []);
    bySrc.get(c.source_id)!.push(c);
  }

  // 4. Project-candidate scores for avg_score (bulk, chunked to avoid URL length limits)
  const allCandidateIds = (recentCandidates || []).map((c) => c.id);
  const pcScoreMap = new Map<string, number[]>();
  if (allCandidateIds.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < allCandidateIds.length; i += CHUNK) {
      const chunk = allCandidateIds.slice(i, i + CHUNK);
      const { data: pcRows } = await supabase
        .from("project_candidates")
        .select("candidate_id, score")
        .in("candidate_id", chunk);
      for (const pc of pcRows || []) {
        if (!pcScoreMap.has(pc.candidate_id)) pcScoreMap.set(pc.candidate_id, []);
        pcScoreMap.get(pc.candidate_id)!.push(pc.score);
      }
    }
  }

  // 5. Scanner-promoted inputs for promotion_rate
  //    promotion = input accepted by user (project_id IS NOT NULL)
  const { data: scannerInputs } = await supabase
    .from("inputs")
    .select("project_id, metadata")
    .eq("is_seeded", true)
    .filter("metadata->>source", "eq", "scanner")
    .gte("created_at", thirtyDaysAgo.toISOString());

  // candidate_id → was accepted?
  const candidateAccepted = new Map<string, boolean>();
  for (const inp of scannerInputs || []) {
    const cid = inp.metadata?.candidate_id;
    if (cid) candidateAccepted.set(cid, inp.project_id !== null);
  }

  // 6. Compute per-source metrics
  const healthRows: HealthRow[] = sources.map((src: SourceRow) => {
    const candidates = bySrc.get(src.id) || [];
    const prior      = priorHealth.get(src.id);

    // Items in last 24 h (proxy for "last fetch" volume)
    const itemsLastFetch = candidates.filter(
      (c) => new Date(c.created_at) >= oneDayAgo,
    ).length;

    // Items in last 7 days (for dead detection)
    const itemsLast7d = candidates.filter(
      (c) => new Date(c.created_at) >= sevenDaysAgo,
    ).length;

    // Avg summary length (only consider candidates with a summary)
    const withSummary = candidates.filter((c) => (c.summary_raw?.length ?? 0) > 0);
    const avgSummaryLength = withSummary.length >= 5
      ? Math.round(
          withSummary.reduce((s, c) => s + c.summary_raw!.length, 0) / withSummary.length,
        )
      : null; // not enough data to judge

    // Avg score from project_candidates
    const scores = candidates.flatMap((c) => pcScoreMap.get(c.id) ?? []);
    const avgScore = scores.length
      ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length)
      : null;

    // Promotion rate — how many scanner-surfaced candidates were accepted by users
    const surfacedToUsers = candidates.filter((c) => candidateAccepted.has(c.id));
    const promotionRate = surfacedToUsers.length
      ? Math.round(
          (surfacedToUsers.filter((c) => candidateAccepted.get(c.id)).length /
            surfacedToUsers.length) *
            100,
        ) / 100
      : null;

    // Status logic
    const lastFetchedAt = src.last_fetched_at ? new Date(src.last_fetched_at) : null;
    const isDead      = (!lastFetchedAt || lastFetchedAt < sevenDaysAgo) && itemsLast7d === 0;
    const isDegraded  = avgSummaryLength !== null && avgSummaryLength < 20;
    const isNoisy     = itemsLastFetch > 30;

    let status: HealthStatus = "healthy";
    let consecutiveFailures  = prior?.consecutive_failures ?? 0;

    if (isDead) {
      status = "dead";
      consecutiveFailures++;
    } else if (isNoisy) {
      status = "noisy";
    } else if (isDegraded) {
      status = "degraded";
    } else {
      status = "healthy";
      consecutiveFailures = 0;
    }

    const lastSuccessfulFetch = status !== "dead"
      ? src.last_fetched_at
      : (prior?.last_successful_fetch ?? null);

    return {
      source_id:                src.id,
      source_name:              src.name,
      status,
      consecutive_failures:     consecutiveFailures,
      items_last_fetch:         itemsLastFetch,
      avg_summary_length:       avgSummaryLength,
      avg_score_across_projects: avgScore,
      promotion_rate:           promotionRate,
      last_successful_fetch:    lastSuccessfulFetch,
    };
  });

  // 7. Upsert into source_health
  const upsertRows = healthRows.map((r) => ({
    source_id:                r.source_id,
    status:                   r.status,
    consecutive_failures:     r.consecutive_failures,
    items_last_fetch:         r.items_last_fetch,
    avg_summary_length:       r.avg_summary_length,
    avg_score_across_projects: r.avg_score_across_projects,
    promotion_rate:           r.promotion_rate,
    last_successful_fetch:    r.last_successful_fetch,
    checked_at:               now.toISOString(),
  }));

  const { error: upsertErr } = await supabase
    .from("source_health")
    .upsert(upsertRows, { onConflict: "source_id" });
  if (upsertErr) throw upsertErr;

  // 8. Email digest
  await sendDigest(healthRows, now);

  const counts = {
    dead:     healthRows.filter((r) => r.status === "dead").length,
    degraded: healthRows.filter((r) => r.status === "degraded").length,
    noisy:    healthRows.filter((r) => r.status === "noisy").length,
    healthy:  healthRows.filter((r) => r.status === "healthy").length,
  };

  return { sources_checked: sources.length, ...counts };
}

// ── Email digest ────────────────────────────────────────────────────────────

async function sendDigest(rows: HealthRow[], now: Date) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const ADMIN_EMAIL    = Deno.env.get("ADMIN_EMAIL");
  if (!RESEND_API_KEY || !ADMIN_EMAIL) return;

  const dead     = rows.filter((r) => r.status === "dead");
  const degraded = rows.filter((r) => r.status === "degraded");
  const noisy    = rows.filter((r) => r.status === "noisy");
  const healthy  = rows.filter((r) => r.status === "healthy");

  const hasIssues = dead.length > 0 || degraded.length > 0 || noisy.length > 0;
  const isMonday  = now.getDay() === 1;

  // Send only on issues or Monday all-clear
  if (!hasIssues && !isMonday) return;

  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const lines: string[] = [`Scanner Health Report — ${dateStr}`, ""];

  if (!hasIssues) {
    lines.push(`All ${healthy.length} source${healthy.length !== 1 ? "s" : ""} healthy — no action needed.`);
  } else {
    if (dead.length > 0) {
      lines.push(`🔴 DEAD (${dead.length}):`);
      for (const r of dead) {
        const days = r.last_successful_fetch
          ? Math.floor(
              (now.getTime() - new Date(r.last_successful_fetch).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;
        const failNote = r.consecutive_failures > 1
          ? ` (${r.consecutive_failures} consecutive failures)`
          : "";
        lines.push(
          days != null
            ? `- ${r.source_name} — no new items in ${days} days${failNote}`
            : `- ${r.source_name} — never fetched successfully${failNote}`,
        );
      }
      lines.push("");
    }

    if (degraded.length > 0) {
      lines.push(`🟡 DEGRADED (${degraded.length}):`);
      for (const r of degraded) {
        lines.push(`- ${r.source_name} — thin descriptions (avg ${r.avg_summary_length} chars)`);
      }
      lines.push("");
    }

    if (noisy.length > 0) {
      lines.push(`🟡 NOISY (${noisy.length}):`);
      for (const r of noisy) {
        lines.push(`- ${r.source_name} — ${r.items_last_fetch} items in last fetch`);
      }
      lines.push("");
    }

    lines.push(`🟢 HEALTHY: ${healthy.length} source${healthy.length !== 1 ? "s" : ""}`);
    lines.push("");

    // Bottom 3 by promotion rate (sources with enough signal)
    const withRate = rows
      .filter((r) => r.promotion_rate !== null)
      .sort((a, b) => (a.promotion_rate ?? 0) - (b.promotion_rate ?? 0))
      .slice(0, 3);

    if (withRate.length > 0) {
      lines.push("📊 Lowest promotion rates (bottom 3):");
      for (const r of withRate) {
        lines.push(`- ${r.source_name}: ${Math.round((r.promotion_rate ?? 0) * 100)}% (last 30 days)`);
      }
      lines.push("");
    }
  }

  const text = lines.join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    "scanner@resend.dev",
      to:      ADMIN_EMAIL,
      subject: `Scanner Health Report — ${dateStr}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Resend error:", res.status, body);
  }
}

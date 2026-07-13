// send-weekly-digest — cron-triggered. Sends one personalised digest email
// per eligible workspace, surfacing recently-promoted Inbox signals grouped
// by STEEPLED category.
//
// Eligibility (per user/workspace):
//   - account is at least 7 days old
//   - user_preferences.digest_unsubscribed is not true
//   - workspace_settings.scanning_enabled is not false (absent row = enabled)
//   - at least one of the workspace's projects has scanning_enabled = true
//
// Signal pool (per workspace):
//   - inputs where project_id IS NULL and metadata.candidate_id is set
//   - joined candidates: status = 'promoted', ingested_at within the last
//     7 days, and last_digest_at is null or more than 14 days ago
//   - one signal per STEEPLED category, ranked by metadata.top_score,
//     each candidate used at most once
//   - workspaces with fewer than 3 qualifying categories are skipped
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
//                     RESEND_API_KEY (consumed by send-email), UNSUBSCRIBE_SECRET,
//                     EMAIL_RELAY_SECRET
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateDigestEmail, generateDigestSubject, type DigestSignal, type DigestMeta } from "./digest-template.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const STEEPLED = ["Social", "Technological", "Economic", "Environmental", "Political", "Legal", "Ethical", "Demographic"];
const MIN_CATEGORIES = 3;
const RECENCY_DAYS = 7;
const REPEAT_SUPPRESSION_DAYS = 14;
const MIN_ACCOUNT_AGE_DAYS = 7;
const LIST_USERS_PAGE_SIZE = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

serve(async (req: Request) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), { status: 401 });
  }

  try {
    const summary = await runDigest();
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[digest] failed:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function runDigest() {
  const now = new Date();
  const recencyCutoff = new Date(now.getTime() - RECENCY_DAYS * DAY_MS);
  const repeatCutoff = new Date(now.getTime() - REPEAT_SUPPRESSION_DAYS * DAY_MS);
  const accountAgeCutoff = new Date(now.getTime() - MIN_ACCOUNT_AGE_DAYS * DAY_MS);

  const users = await listAllUsers();
  const eligibleUsers = users.filter((u) => new Date(u.created_at) <= accountAgeCutoff);
  if (eligibleUsers.length === 0) return { sent: 0, skipped: 0, candidates_marked: 0 };

  const userIds = eligibleUsers.map((u) => u.id);

  const { data: workspaces, error: wsErr } = await supabase
    .from("workspaces")
    .select("id, user_id")
    .in("user_id", userIds);
  if (wsErr) throw wsErr;

  const workspaceByUser = new Map((workspaces ?? []).map((w) => [w.user_id, w.id]));
  const workspaceIds = (workspaces ?? []).map((w) => w.id);

  const { data: wsSettings, error: wsSettingsErr } = await supabase
    .from("workspace_settings")
    .select("workspace_id, scanning_enabled")
    .in("workspace_id", workspaceIds);
  if (wsSettingsErr) throw wsSettingsErr;

  const disabledWorkspaces = new Set(
    (wsSettings ?? []).filter((s) => s.scanning_enabled === false).map((s) => s.workspace_id),
  );

  const { data: allProjects, error: projErr } = await supabase
    .from("projects")
    .select("id, workspace_id, domain, scanning_enabled")
    .in("workspace_id", workspaceIds);
  if (projErr) throw projErr;

  const projectsByWorkspace = new Map<string, typeof allProjects>();
  for (const p of allProjects ?? []) {
    if (!projectsByWorkspace.has(p.workspace_id)) projectsByWorkspace.set(p.workspace_id, []);
    projectsByWorkspace.get(p.workspace_id)!.push(p);
  }

  const { data: prefs, error: prefsErr } = await supabase
    .from("user_preferences")
    .select("user_id, digest_unsubscribed")
    .in("user_id", userIds);
  if (prefsErr) throw prefsErr;

  const unsubscribed = new Set((prefs ?? []).filter((p) => p.digest_unsubscribed).map((p) => p.user_id));

  let sent = 0;
  let skipped = 0;
  const sentCandidateIds = new Set<string>();
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(now);
  const subject = generateDigestSubject(now);

  for (const user of eligibleUsers) {
    if (unsubscribed.has(user.id)) {
      skipped++;
      continue;
    }

    const workspaceId = workspaceByUser.get(user.id);
    if (!workspaceId || disabledWorkspaces.has(workspaceId)) {
      skipped++;
      continue;
    }

    const wsProjects = projectsByWorkspace.get(workspaceId) ?? [];
    const scanningProjects = wsProjects.filter((p) => p.scanning_enabled);
    if (scanningProjects.length === 0) {
      skipped++;
      continue;
    }

    const signals = await buildDigestSignals(workspaceId, recencyCutoff, repeatCutoff);
    if (!signals) {
      console.warn(`[digest] skipping user ${user.id} — fewer than ${MIN_CATEGORIES} qualifying STEEPLED categories`);
      skipped++;
      continue;
    }

    const domains = [...new Set(scanningProjects.map((p) => p.domain).filter(Boolean))] as string[];

    const meta: DigestMeta = {
      userEmail: user.email,
      domains,
      unsubscribeUrl: await buildUnsubscribeUrl(user.id),
      date: dateLabel,
    };

    const html = generateDigestEmail(signals, meta);
    const ok = await sendEmail(user.email, subject, html);
    if (!ok) {
      skipped++;
      continue;
    }

    for (const s of signals) sentCandidateIds.add(s.candidate_id);
    sent++;
  }

  if (sentCandidateIds.size > 0) {
    await markDigested([...sentCandidateIds], now);
  }

  return { sent, skipped, candidates_marked: sentCandidateIds.size };
}

async function buildDigestSignals(
  workspaceId: string,
  recencyCutoff: Date,
  repeatCutoff: Date,
): Promise<DigestSignal[] | null> {
  const { data: inboxInputs, error } = await supabase
    .from("inputs")
    .select("id, metadata")
    .eq("workspace_id", workspaceId)
    .is("project_id", null);
  if (error) throw error;

  const refs = (inboxInputs ?? [])
    .map((i) => ({
      candidateId: i.metadata?.candidate_id as string | undefined,
      topScore: (i.metadata?.top_score as number | undefined) ?? 0,
    }))
    .filter((r): r is { candidateId: string; topScore: number } => !!r.candidateId);

  if (refs.length === 0) return null;

  const candidateIds = [...new Set(refs.map((r) => r.candidateId))];
  const scoreByCandidate = new Map(refs.map((r) => [r.candidateId, r.topScore]));

  // Chunked to keep the `.in()` filter under PostgREST's URL/header size limits —
  // workspaces can accumulate hundreds of Inbox candidates over time.
  const CHUNK = 200;
  const candidates: { id: string; title: string; summary_ai: string | null; summary_raw: string | null; url: string; steepled: string[] | null; status: string; ingested_at: string; last_digest_at: string | null }[] = [];
  for (let i = 0; i < candidateIds.length; i += CHUNK) {
    const chunk = candidateIds.slice(i, i + CHUNK);
    const { data, error: candErr } = await supabase
      .from("candidates")
      .select("id, title, summary_ai, summary_raw, url, steepled, status, ingested_at, last_digest_at")
      .in("id", chunk);
    if (candErr) throw candErr;
    candidates.push(...(data ?? []));
  }

  const eligible = candidates.filter((c) => {
    if (c.status !== "promoted") return false;
    if (new Date(c.ingested_at) < recencyCutoff) return false;
    if (c.last_digest_at && new Date(c.last_digest_at) >= repeatCutoff) return false;
    return true;
  });

  const used = new Set<string>();
  const signals: DigestSignal[] = [];

  for (const category of STEEPLED) {
    const pick = eligible
      .filter((c) => !used.has(c.id) && (c.steepled ?? []).includes(category))
      .sort((a, b) => (scoreByCandidate.get(b.id) ?? 0) - (scoreByCandidate.get(a.id) ?? 0))[0];

    if (!pick) continue;

    used.add(pick.id);
    signals.push({
      candidate_id: pick.id,
      title: pick.title,
      summary: pick.summary_ai || pick.summary_raw || "",
      source_url: pick.url,
      steepled_category: category,
    });
  }

  return signals.length >= MIN_CATEGORIES ? signals : null;
}

async function listAllUsers(): Promise<{ id: string; email: string; created_at: string }[]> {
  const all: { id: string; email: string; created_at: string }[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: LIST_USERS_PAGE_SIZE });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) all.push({ id: u.id, email: u.email, created_at: u.created_at });
    }
    if (data.users.length < LIST_USERS_PAGE_SIZE) break;
    page++;
  }
  return all;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "x-relay-secret": Deno.env.get("EMAIL_RELAY_SECRET") ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, subject, html }),
    });
    if (!res.ok) {
      console.error(`[digest] send-email failed for ${to}: ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[digest] send-email error for ${to}:`, err);
    return false;
  }
}

async function markDigested(candidateIds: string[], now: Date) {
  const CHUNK = 200;
  for (let i = 0; i < candidateIds.length; i += CHUNK) {
    const chunk = candidateIds.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("candidates")
      .update({ last_digest_at: now.toISOString() })
      .in("id", chunk);
    if (error) console.error("[digest] failed to update last_digest_at:", error.message);
  }
}

async function buildUnsubscribeUrl(userId: string): Promise<string> {
  const token = await signUserId(userId);
  // Token format: "<userId>:<hmac>" — allows O(1) verification without scanning all users.
  // URL routes through the app domain (APP_URL) to avoid exposing the Supabase project ID in emails.
  return `${Deno.env.get("APP_URL")}/api/unsubscribe?token=${encodeURIComponent(`${userId}:${token}`)}`;
}

async function signUserId(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("UNSUBSCRIBE_SECRET")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

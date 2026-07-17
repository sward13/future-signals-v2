/**
 * PublishSection — the publish management surface at the bottom of Project
 * Settings. Shows publish status, the live link (with copy), and three actions:
 *   - Publish   (only when never published) — one click, omits the selection so
 *     the backend defaults to the whole project.
 *   - Republish (only once published) — one click, re-fetches the current
 *     sections_included and resends it unchanged (never resets to everything).
 *   - Customize — opens the section-picker modal (pre-populated from the current
 *     selection, or all-checked when never published).
 * Plus Unpublish once published.
 *
 * Orchestration lives in ../../publish/publishActions.js; talks to /api/publish
 * (GET status, POST { action, selection? }) with the getSession()+fetch pattern
 * from AddSourceModal / InputDrawer.
 *
 * @param {{ project: object, appState?: object, showToast?: Function }} props
 */
import { useState, useEffect } from "react";
import { c } from "../../styles/tokens.js";
import { supabase } from "../../lib/supabase.js";
import { doFirstPublish, doRepublish, doCustomize } from "../../publish/publishActions.js";
import { SectionPickerModal } from "./SectionPickerModal.jsx";

async function bearer() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  return session.access_token;
}

export function PublishSection({ project, appState, showToast }) {
  const [status, setStatus] = useState(null); // null while loading, then 'published' | 'unpublished'
  const [everPublished, setEverPublished] = useState(false); // published at least once (published_at set)
  const [pub, setPub] = useState({ slug: null, publicUrl: null });
  const [sectionsIncluded, setSectionsIncluded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Future Models items for this project, from already-loaded app data (no fetch).
  const available = {
    scenarios: (appState?.scenarios || []).filter((s) => s.project_id === project.id),
    preferredFutures: (appState?.preferredFutures || []).filter((p) => p.project_id === project.id),
    strategicOptions: (appState?.strategicOptions || []).filter((o) => o.project_id === project.id),
  };

  // ── API wrappers (injected into the publishActions orchestrators) ──
  const getStatus = async () => {
    const token = await bearer();
    const res = await fetch(`/api/publish?projectId=${encodeURIComponent(project.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load publish status");
    return data;
  };
  // selection === undefined → omitted from the body (whole-project default).
  const postPublish = async (selection) => {
    const token = await bearer();
    const body = { projectId: project.id, action: "publish" };
    if (selection !== undefined) body.selection = selection;
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Publish failed");
    return data;
  };
  const postUnpublish = async () => {
    const token = await bearer();
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId: project.id, action: "unpublish" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unpublish failed");
    return data;
  };

  const applyResult = (data) => {
    setStatus(data.status);
    if (data.status === "published") setEverPublished(true);
    setPub({ slug: data.slug, publicUrl: data.publicUrl });
    if (data.sectionsIncluded !== undefined) setSectionsIncluded(data.sectionsIncluded);
  };

  const runAction = async (fn, successMsg) => {
    setBusy(true);
    setError(null);
    try {
      applyResult(await fn());
      showToast?.(successMsg, "success");
    } catch (e) {
      setError(e.message);
      showToast?.(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getStatus();
        if (!cancelled) {
          setStatus(data.status);
          setEverPublished(data.publishedAt != null || data.status === "published");
          setPub({ slug: data.slug, publicUrl: data.publicUrl });
          setSectionsIncluded(data.sectionsIncluded ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Modal submit: publish exactly the constructed selection. Throws on error so
  // the modal shows it; on success the modal closes itself.
  const onCustomizeSubmit = async (selection) => {
    const data = await doCustomize({ postPublish, selection });
    applyResult(data);
    showToast?.("Project published.", "success");
  };

  const copyLink = async () => {
    if (!pub.publicUrl) return;
    try {
      await navigator.clipboard?.writeText(pub.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast?.("Couldn't copy link", "error");
    }
  };

  const published = status === "published";

  const cardStyle = { padding: "14px 16px", background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 9, marginTop: 14 };
  const primaryBtn = {
    fontSize: 12, fontWeight: 500, padding: "7px 14px", borderRadius: 7,
    background: c.ink, color: c.white, border: "none",
    cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.5 : 1,
  };
  const ghostBtn = {
    fontSize: 12, padding: "7px 14px", borderRadius: 7,
    background: "transparent", color: c.muted, border: `1px solid ${c.borderMid}`,
    cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.5 : 1,
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: c.ink }}>Publish to the web</div>
        {!loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: published ? c.green700 : c.hint }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: published ? c.green600 : c.hint }} />
            {published ? "Published" : "Not published"}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.5, marginBottom: 12 }}>
        {published
          ? "Anyone with the link can view a read-only page of this project."
          : "Create a shareable, read-only web page of this project."}
      </div>

      {loading ? (
        <div style={{ fontSize: 11, color: c.hint }}>Loading…</div>
      ) : (
        <>
          {published && pub.publicUrl && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
              padding: "6px 8px 6px 10px", background: c.white, border: `1px solid ${c.border}`, borderRadius: 7,
            }}>
              <a
                href={pub.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, fontSize: 11, color: c.brand, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {pub.publicUrl.replace(/^https?:\/\//, "")}
              </a>
              <button
                onClick={copyLink}
                style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: `1px solid ${c.borderMid}`, background: "transparent", color: c.muted, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {everPublished ? (
              // Once published (even if since unpublished), Republish resends the
              // last curated selection — never omit, never reset to everything.
              <button onClick={() => runAction(() => doRepublish({ getStatus, postPublish }), "Project republished.")} disabled={busy} style={primaryBtn}>
                {busy ? "Working…" : "Republish"}
              </button>
            ) : (
              // True first publish: omit the selection → backend defaults to the
              // whole project.
              <button onClick={() => runAction(() => doFirstPublish({ postPublish }), "Project published.")} disabled={busy} style={primaryBtn}>
                {busy ? "Publishing…" : "Publish"}
              </button>
            )}
            <button onClick={() => setPickerOpen(true)} disabled={busy} style={ghostBtn}>Customize</button>
            {published && (
              <button onClick={() => runAction(() => postUnpublish(), "Project unpublished.")} disabled={busy} style={ghostBtn}>Unpublish</button>
            )}
          </div>

          {error && <div style={{ fontSize: 11, color: c.red800, marginTop: 8 }}>{error}</div>}
        </>
      )}

      {pickerOpen && (
        <SectionPickerModal
          available={available}
          currentSelection={sectionsIncluded}
          onClose={() => setPickerOpen(false)}
          onSubmit={onCustomizeSubmit}
        />
      )}
    </div>
  );
}

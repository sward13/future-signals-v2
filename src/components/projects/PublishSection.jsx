/**
 * PublishSection — the publish management surface at the bottom of Project
 * Settings. Shows the current publish status, the live public link (with a copy
 * action) when published, and Publish / Republish / Unpublish actions.
 *
 * Whole-project publish only for v1 — no section picker. Talks to /api/publish
 * (GET status, POST { action }), authed with the current session's bearer token,
 * following the same getSession()+fetch pattern as AddSourceModal / InputDrawer.
 *
 * @param {{ project: object, showToast?: (msg: string, type?: string) => void }} props
 */
import { useState, useEffect } from "react";
import { c } from "../../styles/tokens.js";
import { supabase } from "../../lib/supabase.js";

async function bearer() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  return session.access_token;
}

export function PublishSection({ project, showToast }) {
  const [status, setStatus] = useState(null); // null while loading, then 'published' | 'unpublished'
  const [pub, setPub] = useState({ slug: null, publicUrl: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await bearer();
        const res = await fetch(`/api/publish?projectId=${encodeURIComponent(project.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load publish status");
        if (!cancelled) {
          setStatus(data.status);
          setPub({ slug: data.slug, publicUrl: data.publicUrl });
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [project.id]);

  const act = async (action) => {
    setBusy(true);
    setError(null);
    try {
      const token = await bearer();
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: project.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setStatus(data.status);
      setPub({ slug: data.slug, publicUrl: data.publicUrl });
      showToast?.(action === "unpublish" ? "Project unpublished." : "Project published.", "success");
    } catch (e) {
      setError(e.message);
      showToast?.(e.message, "error");
    } finally {
      setBusy(false);
    }
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

  const cardStyle = {
    padding: "14px 16px",
    background: c.surfaceAlt,
    border: `1px solid ${c.border}`,
    borderRadius: 9,
    marginTop: 14,
  };
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
              padding: "6px 8px 6px 10px", background: c.white,
              border: `1px solid ${c.border}`, borderRadius: 7,
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

          <div style={{ display: "flex", gap: 8 }}>
            {published ? (
              <>
                <button onClick={() => act("publish")} disabled={busy} style={primaryBtn}>
                  {busy ? "Working…" : "Republish"}
                </button>
                <button onClick={() => act("unpublish")} disabled={busy} style={ghostBtn}>
                  Unpublish
                </button>
              </>
            ) : (
              <button onClick={() => act("publish")} disabled={busy} style={primaryBtn}>
                {busy ? "Publishing…" : "Publish"}
              </button>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 11, color: c.red800, marginTop: 8 }}>{error}</div>
          )}
        </>
      )}
    </div>
  );
}

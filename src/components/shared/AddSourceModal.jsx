import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { c, inp, btnSm, btnSec, fl } from "../../styles/tokens.js";
import { DOMAINS } from "../../data/seeds.js";
import { supabase } from "../../lib/supabase.js";

function validateUrl(raw) {
  if (!raw.trim()) return "URL is required.";
  let u;
  try { u = new URL(raw.trim()); } catch { return "Enter a valid URL."; }
  if (u.protocol !== "https:") return "Only HTTPS URLs are supported.";
  return null;
}

export function AddSourceModal({ open, onClose, onAdded, defaultDomain = null }) {
  const [url,        setUrl]        = useState("");
  const [name,       setName]       = useState("");
  const [domain,     setDomain]     = useState(defaultDomain ?? "");
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview,    setPreview]    = useState(null); // { feedTitle, items }

  // Tracks the URL that was last fetched so we skip re-fetching the same URL on
  // repeated blurs, matching the pattern in InputDrawer's handleUrlBlur.
  const lastFetchedUrl   = useRef("");
  // True once the practitioner has typed in the Name field so auto-populate
  // doesn't overwrite a manual entry.
  const nameEditedByUser = useRef(false);

  // Reset form each time the modal opens
  useEffect(() => {
    if (open) {
      setUrl("");
      setName("");
      setDomain(defaultDomain ?? "");
      setErrors({});
      setSubmitting(false);
      setPreviewing(false);
      setPreview(null);
      lastFetchedUrl.current   = "";
      nameEditedByUser.current = false;
    }
  }, [open, defaultDomain]);

  if (!open) return null;

  async function fetchPreview(rawUrl) {
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed === lastFetchedUrl.current) return;
    if (validateUrl(trimmed)) return; // client-side invalid — don't bother

    lastFetchedUrl.current = trimmed;
    setPreviewing(true);
    setPreview(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/validate-feed?url=${encodeURIComponent(trimmed)}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) { setPreviewing(false); return; }
      const data = await res.json();
      setPreview(data);
      // Auto-populate name only if practitioner hasn't manually typed in the field
      if (!nameEditedByUser.current && !name && data.feedTitle) {
        setName(data.feedTitle);
      }
    } catch {
      // Silent fail — preview is an enhancement, not a gate
    } finally {
      setPreviewing(false);
    }
  }

  function handleUrlChange(e) {
    const val = e.target.value;
    setUrl(val);
    setErrors(p => ({ ...p, url: undefined }));
    // URL changed: allow the next blur to auto-populate name again
    if (val.trim() !== lastFetchedUrl.current) {
      nameEditedByUser.current = false;
      setPreview(null);
    }
  }

  function validate() {
    const errs = {};
    const urlErr = validateUrl(url);
    if (urlErr) errs.url = urlErr;
    if (!name.trim()) errs.name = "Name is required.";
    if (!domain) errs.domain = "Select a domain.";
    return errs;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    onAdded({ url: url.trim(), name: name.trim(), domain });
  }

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: c.white, borderRadius: 12, padding: "24px 28px",
        boxShadow: "0 16px 48px rgba(0,0,0,0.18)", zIndex: 501, width: 440,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: c.ink }}>Add a source</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: c.faint, fontSize: 16, padding: "0 2px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* URL */}
        <div style={{ marginBottom: 14 }}>
          <div style={fl}>RSS or Atom feed URL</div>
          <input
            style={{ ...inp, borderColor: errors.url ? c.redBorder : undefined }}
            type="url"
            placeholder="https://example.com/feed.xml"
            value={url}
            onChange={handleUrlChange}
            onBlur={e => fetchPreview(e.target.value)}
            autoFocus
          />
          {errors.url ? (
            <div style={{ fontSize: 11, color: c.red800, marginTop: 3 }}>{errors.url}</div>
          ) : previewing ? (
            <div style={{ fontSize: 11, color: c.hint, marginTop: 3 }}>Checking feed…</div>
          ) : (
            <div style={{ fontSize: 11, color: c.hint, marginTop: 3 }}>Paste the URL of any RSS or Atom feed.</div>
          )}

          {/* Preview items */}
          {preview?.items?.length > 0 && (
            <div style={{
              marginTop: 8,
              padding: "8px 10px",
              background: c.surfaceAlt,
              border: `0.5px solid ${c.border}`,
              borderRadius: 6,
            }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: c.faint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Recent items
              </div>
              {preview.items.map((title, i) => (
                <div key={i} style={{
                  fontSize: 11, color: c.muted, lineHeight: 1.45,
                  paddingLeft: 10, position: "relative",
                  marginBottom: i < preview.items.length - 1 ? 3 : 0,
                }}>
                  <span style={{ position: "absolute", left: 0, color: c.faint }}>·</span>
                  {title}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={fl}>Source name</div>
          <input
            style={{ ...inp, borderColor: errors.name ? c.redBorder : undefined }}
            type="text"
            placeholder="e.g. MIT Technology Review"
            value={name}
            onChange={e => {
              setName(e.target.value);
              nameEditedByUser.current = true;
              setErrors(p => ({ ...p, name: undefined }));
            }}
          />
          {errors.name && <div style={{ fontSize: 11, color: c.red800, marginTop: 3 }}>{errors.name}</div>}
        </div>

        {/* Domain */}
        <div style={{ marginBottom: 22 }}>
          <div style={fl}>Domain</div>
          <div style={{ position: "relative" }}>
            <select
              style={{
                ...inp,
                appearance: "none",
                borderColor: errors.domain ? c.redBorder : undefined,
                paddingRight: 28,
                color: domain ? c.ink : c.faint,
              }}
              value={domain}
              onChange={e => { setDomain(e.target.value); setErrors(p => ({ ...p, domain: undefined })); }}
            >
              <option value="" disabled>Select a domain…</option>
              {DOMAINS.filter(d => d !== "Custom / Other").map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              pointerEvents: "none", color: c.faint, fontSize: 10,
            }}>▾</span>
          </div>
          {errors.domain ? (
            <div style={{ fontSize: 11, color: c.red800, marginTop: 3 }}>{errors.domain}</div>
          ) : (
            <div style={{ fontSize: 11, color: c.hint, marginTop: 3 }}>
              Scopes this source to matching projects. Required.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...btnSec, fontSize: 12, padding: "7px 16px" }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...btnSm, fontSize: 12, padding: "7px 16px", opacity: submitting ? 0.6 : 1 }}
          >
            Add source
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

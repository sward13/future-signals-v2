import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { c, inp, btnSm, btnSec, fl } from "../../styles/tokens.js";
import { DOMAINS } from "../../data/seeds.js";

function validateUrl(raw) {
  if (!raw.trim()) return "URL is required.";
  let u;
  try { u = new URL(raw.trim()); } catch { return "Enter a valid URL."; }
  if (u.protocol !== "https:") return "Only HTTPS URLs are supported.";
  return null;
}

export function AddSourceModal({ open, onClose, onAdded, defaultDomain = null }) {
  const [url,       setUrl]       = useState("");
  const [name,      setName]      = useState("");
  const [domain,    setDomain]    = useState(defaultDomain ?? "");
  const [errors,    setErrors]    = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form each time the modal opens
  useEffect(() => {
    if (open) {
      setUrl("");
      setName("");
      setDomain(defaultDomain ?? "");
      setErrors({});
      setSubmitting(false);
    }
  }, [open, defaultDomain]);

  if (!open) return null;

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
            onChange={e => { setUrl(e.target.value); setErrors(p => ({ ...p, url: undefined })); }}
            autoFocus
          />
          {errors.url
            ? <div style={{ fontSize: 11, color: c.red800, marginTop: 3 }}>{errors.url}</div>
            : <div style={{ fontSize: 11, color: c.hint, marginTop: 3 }}>Paste the URL of any RSS or Atom feed.</div>
          }
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={fl}>Source name</div>
          <input
            style={{ ...inp, borderColor: errors.name ? c.redBorder : undefined }}
            type="text"
            placeholder="e.g. MIT Technology Review"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
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
          {errors.domain
            ? <div style={{ fontSize: 11, color: c.red800, marginTop: 3 }}>{errors.domain}</div>
            : <div style={{ fontSize: 11, color: c.hint, marginTop: 3 }}>
                Scopes this source to matching projects. Required.
              </div>
          }
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

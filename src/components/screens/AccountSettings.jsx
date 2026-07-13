import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../../lib/supabase.js";
import { c, inp, btnSm, btnSec, btnG, fl, fh, fontHeading } from "../../styles/tokens.js";
import { ConfirmModal } from "../shared/ConfirmModal.jsx";
import { AddSourceModal } from "../shared/AddSourceModal.jsx";

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 2px",
        fontSize: 12,
        cursor: "pointer",
        fontFamily: "inherit",
        background: "transparent",
        color: active ? c.ink : c.muted,
        border: "none",
        borderBottom: active ? `2px solid ${c.brand}` : "2px solid transparent",
        fontWeight: active ? 500 : 400,
        marginRight: 14,
        marginBottom: -1,
        transition: "color 0.1s, border-color 0.1s",
      }}
    >
      {label}
    </button>
  );
}

const CRED_LABELS = {
  institutional: "Institutional",
  specialist:    "Specialist",
  general:       "General",
  unvetted:      "Unvetted",
};

function CredBadge({ credibility }) {
  const label = CRED_LABELS[credibility] ?? credibility;
  const isInstitutional = credibility === "institutional";
  const isSpecialist    = credibility === "specialist";
  const bg    = isInstitutional ? c.green50  : isSpecialist ? c.amber50  : "rgba(0,0,0,0.05)";
  const color = isInstitutional ? c.green700 : isSpecialist ? c.amber700 : c.muted;
  return (
    <span style={{
      fontSize: 9, padding: "1px 5px", borderRadius: 3,
      background: bg, color, fontWeight: 500, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─── Sources section ──────────────────────────────────────────────────────────

function SourcesSection({ workspaceId, addSource, deleteSource, showToast }) {
  const [sources,     setSources]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("all");   // "all" | "curated" | "user"
  const [search,      setSearch]      = useState("");
  const [addOpen,     setAddOpen]     = useState(false);
  // { source: <row>, optInCount: number } when confirm modal is open, else null
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Set of domain keys the user has manually collapsed; ignored while searching
  const [collapsedDomains, setCollapsedDomains] = useState(() => new Set());
  const isSearching = search.trim().length > 0;

  function toggleDomain(domain) {
    setCollapsedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("sources")
          .select("id, name, url, domain, source_type, credibility, active, owner_id")
          .eq("active", true)
          .or(`owner_id.is.null,owner_id.eq.${workspaceId}`)
          .order("name");
        if (error) throw error;
        if (!cancelled) setSources(data ?? []);
      } catch {
        // non-fatal — degrade to empty list
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const filtered = useMemo(() => {
    let list = sources;
    if (filter === "curated") list = list.filter(s => s.source_type === "curated");
    if (filter === "user")    list = list.filter(s => s.source_type !== "curated");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) || s.domain?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [sources, filter, search]);

  // Group by domain; unnamed domains sorted last
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(s => {
      const key = s.domain || "";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return Object.entries(map).sort(([a], [b]) => {
      if (!a && b)  return 1;
      if (a  && !b) return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const curatedCount = sources.filter(s => s.source_type === "curated").length;
  const userCount    = sources.filter(s => s.source_type !== "curated").length;

  async function handleDeleteClick(src) {
    const { data } = await supabase
      .from("project_sources")
      .select("id")
      .eq("source_id", src.id)
      .eq("opted_in", true);
    const optInCount = data?.length ?? 0;
    setConfirmDelete({ source: src, optInCount });
  }

  async function handleDeleteConfirm() {
    const { source } = confirmDelete;
    setConfirmDelete(null);
    setSources(prev => prev.filter(s => s.id !== source.id));
    try {
      await deleteSource(source.id);
    } catch {
      setSources(prev => [...prev, source].sort((a, b) => a.name.localeCompare(b.name)));
      showToast("Failed to delete source", "error");
    }
  }

  async function handleAdded(fields) {
    setAddOpen(false);
    try {
      const row = await addSource(fields);
      setSources(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      showToast("Failed to add source", "error");
    }
  }

  return (
    <div>
      {/* Filter tabs + search row */}
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: `1px solid ${c.border}`,
        marginBottom: 12,
      }}>
        <SectionTab label="All"        active={filter === "all"}     onClick={() => setFilter("all")} />
        <SectionTab label="Curated"    active={filter === "curated"} onClick={() => setFilter("curated")} />
        <SectionTab label="My sources" active={filter === "user"}    onClick={() => setFilter("user")} />
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setAddOpen(true)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 11.5, color: c.brand, fontFamily: "inherit",
            padding: "0 8px 6px 0", fontWeight: 500,
          }}
        >
          + Add source
        </button>
        <input
          style={{
            ...inp,
            width: 130, padding: "4px 9px", fontSize: 11.5,
            marginBottom: 6,
          }}
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: c.hint, padding: "12px 0" }}>Loading sources…</div>
      )}

      {!loading && grouped.length === 0 && (
        <div style={{ fontSize: 12, color: c.hint, fontStyle: "italic", padding: "12px 0" }}>
          {search || filter !== "all" ? "No sources match your filter." : "No sources found."}
        </div>
      )}

      {!loading && grouped.map(([domain, rows]) => {
        const isOpen = isSearching || !collapsedDomains.has(domain);
        return (
        <div key={domain || "_none"} style={{ marginBottom: 14 }}>
          {/* Group header */}
          <button
            onClick={() => toggleDomain(domain)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", marginBottom: 2,
              background: "none", border: "none", borderBottom: `1px solid ${c.border}`,
              cursor: "pointer", fontFamily: "inherit", padding: "0 0 5px 0", textAlign: "left",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                fontSize: 9, color: c.faint,
                transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s", display: "inline-block", width: 8,
              }}>
                ▶
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: c.muted }}>
                {domain || "No domain"}
              </span>
            </span>
            <span style={{ fontSize: 11, color: c.faint }}>{rows.length}</span>
          </button>

          {isOpen && rows.map(src => (
            <div key={src.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 0",
              borderBottom: `0.5px solid ${c.border}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12.5, color: c.ink }}>{src.name}</span>
                  {src.source_type !== "curated" && (
                    <span style={{
                      fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
                      background: "rgba(0,0,0,0.05)", color: c.muted,
                    }}>
                      My source
                    </span>
                  )}
                </div>
                {src.url && (
                  <div style={{
                    fontSize: 11, color: c.hint, marginTop: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {src.url}
                  </div>
                )}
              </div>
              <CredBadge credibility={src.credibility} />
              {src.owner_id !== null && (
                <button
                  onClick={() => handleDeleteClick(src)}
                  title="Delete source"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "2px 4px", color: c.faint, fontSize: 14, lineHeight: 1,
                    flexShrink: 0, fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = c.faint; }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        );
      })}

      {/* Footer count */}
      {!loading && sources.length > 0 && (
        <div style={{ fontSize: 11, color: c.faint, paddingTop: 6 }}>
          {curatedCount} curated · {userCount} added by you
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          message={
            confirmDelete.optInCount > 0
              ? `Delete "${confirmDelete.source.name}"? It's currently active in ${confirmDelete.optInCount} project${confirmDelete.optInCount !== 1 ? "s" : ""} and will be removed from their scanning sources.`
              : `Delete "${confirmDelete.source.name}"?`
          }
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <AddSourceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
        defaultDomain={null}
      />
    </div>
  );
}

// ─── Password input with show/hide toggle ─────────────────────────────────────

function PasswordInput({ label, hint, value, onChange, error, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fl}>{label}</div>
      {hint && <div style={fh}>{hint}</div>}
      <div style={{ position: "relative" }}>
        <input
          style={{ ...inp, paddingRight: 54, borderColor: error ? c.redBorder : undefined }}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder || ""}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: c.hint, fontSize: 11, fontFamily: "inherit", padding: "2px 4px", lineHeight: 1,
          }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: c.red800, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function validateEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function SectionCard({ children }) {
  return (
    <div style={{
      background: c.white,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: "20px 24px",
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function AccountSettings({ appState, onSignOut }) {
  const { user, workspaceId, projects, workspaceScanningEnabled, updateWorkspaceScanningEnabled, updateProject, showToast, deleteSource, addSource } = appState;

  // ── Timeout cleanup ─────────────────────────────────────────────────────────

  const profileTimerRef  = useRef(null);
  const passwordTimerRef = useRef(null);
  useEffect(() => () => {
    clearTimeout(profileTimerRef.current);
    clearTimeout(passwordTimerRef.current);
  }, []);

  // ── Profile section ─────────────────────────────────────────────────────────

  const [profileEditing,        setProfileEditing]        = useState(false);
  const [displayName,           setDisplayName]           = useState(user.name || "");
  const [email,                 setEmail]                 = useState(user.email || "");
  const [profileSaving,         setProfileSaving]         = useState(false);
  const [profileSuccess,        setProfileSuccess]        = useState(false);
  const [profileErrors,         setProfileErrors]         = useState({});
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

  const handleProfileEdit = () => {
    setDisplayName(user.name || "");
    setEmail(user.email || "");
    setProfileErrors({});
    setEmailConfirmationSent(false);
    setProfileSuccess(false);
    setProfileEditing(true);
  };

  const handleProfileCancel = () => {
    setProfileEditing(false);
    setProfileErrors({});
    setEmailConfirmationSent(false);
  };

  const handleProfileSave = async () => {
    const errors = {};
    if (!displayName.trim()) errors.displayName = "Display name is required.";
    if (!email.trim())       errors.email = "Email is required.";
    else if (!validateEmail(email)) errors.email = "Enter a valid email address.";
    if (Object.keys(errors).length) { setProfileErrors(errors); return; }

    setProfileSaving(true);
    try {
      const updates = { data: { full_name: displayName.trim() } };
      const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();
      if (emailChanged) updates.email = email.trim();

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      if (emailChanged) {
        setEmailConfirmationSent(true);
        setProfileEditing(false);
      } else {
        setProfileSuccess(true);
        profileTimerRef.current = setTimeout(() => { setProfileSuccess(false); setProfileEditing(false); }, 2000);
      }
    } catch (err) {
      const msg = err.message || "Failed to update profile.";
      if (msg.toLowerCase().includes("email")) {
        setProfileErrors({ email: msg });
      } else {
        setProfileErrors({ general: msg });
      }
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Signal Scanning section — weekly digest toggle ──────────────────────────

  const [digestSubscribed, setDigestSubscribed] = useState(true);

  useEffect(() => {
    if (!user.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("digest_unsubscribed")
        .eq("user_id", user.id)
        .maybeSingle();
      setDigestSubscribed(data ? !data.digest_unsubscribed : true);
    })();
  }, [user.id]);

  const handleDigestToggle = async () => {
    if (!workspaceScanningEnabled) return;
    const next = !digestSubscribed;
    setDigestSubscribed(next);
    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        digest_unsubscribed: !next,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (error) {
      setDigestSubscribed(!next);
      showToast("Failed to update digest preference", "error");
    }
  };

  // ── Security / password section ─────────────────────────────────────────────

  const [passwordOpen,     setPasswordOpen]     = useState(false);
  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [passwordSaving,   setPasswordSaving]   = useState(false);
  const [passwordSuccess,  setPasswordSuccess]  = useState(false);
  const [passwordErrors,   setPasswordErrors]   = useState({});

  const handlePasswordToggle = () => {
    setPasswordOpen((s) => !s);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setPasswordErrors({}); setPasswordSuccess(false);
  };

  const handlePasswordSave = async () => {
    const errors = {};
    if (!currentPassword) errors.currentPassword = "Current password is required.";
    if (!newPassword)     errors.newPassword = "New password is required.";
    else if (newPassword.length < 8) errors.newPassword = "Password must be at least 8 characters.";
    if (!confirmPassword) errors.confirmPassword = "Please confirm your new password.";
    else if (newPassword && confirmPassword && newPassword !== confirmPassword)
      errors.confirmPassword = "Passwords do not match.";
    if (Object.keys(errors).length) { setPasswordErrors(errors); return; }

    setPasswordSaving(true);
    try {
      // Verify current password by re-authenticating
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (authError) {
        setPasswordErrors({ currentPassword: "Current password is incorrect." });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordSuccess(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      passwordTimerRef.current = setTimeout(() => { setPasswordSuccess(false); setPasswordOpen(false); }, 2000);
    } catch (err) {
      setPasswordErrors({ general: err.message || "Failed to update password." });
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px 32px", background: c.bg, minHeight: "100%" }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.02em", color: c.hint, marginBottom: 3 }}>
          Workspace
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, fontFamily: fontHeading }}>Account Settings</div>
      </div>

      <div style={{ maxWidth: 520 }}>

        {/* ── Profile section ─────────────────────────────────────── */}
        <SectionCard>

          {/* Section header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>Profile</div>
            {!profileEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {profileSuccess && (
                  <span style={{ fontSize: 12, color: c.green700 }}>Saved ✓</span>
                )}
                {emailConfirmationSent && (
                  <span style={{ fontSize: 11, color: c.blue700 }}>Confirmation sent</span>
                )}
                <button onClick={handleProfileEdit} style={{ ...btnSec, fontSize: 11, padding: "5px 14px" }}>
                  Edit
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={handleProfileCancel} style={{ ...btnG, fontSize: 11 }}>Cancel</button>
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  style={{ ...btnSm, fontSize: 11, padding: "5px 14px", opacity: profileSaving ? 0.6 : 1 }}
                >
                  {profileSaving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* Display name */}
          <div style={{ marginBottom: 16 }}>
            <div style={fl}>Display name</div>
            {profileEditing ? (
              <>
                <input
                  style={{ ...inp, borderColor: profileErrors.displayName ? c.redBorder : undefined }}
                  type="text"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setProfileErrors((p) => ({ ...p, displayName: undefined })); }}
                  placeholder="Your name"
                  autoFocus
                />
                {profileErrors.displayName && (
                  <div style={{ fontSize: 11, color: c.red800, marginTop: 4 }}>{profileErrors.displayName}</div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: c.ink, padding: "9px 0", borderBottom: `1px solid ${c.border}` }}>
                {user.name}
              </div>
            )}
          </div>

          {/* Email */}
          <div style={{ marginBottom: profileErrors.general || emailConfirmationSent ? 12 : 0 }}>
            <div style={fl}>Email</div>
            {profileEditing ? (
              <>
                <input
                  style={{ ...inp, borderColor: profileErrors.email ? c.redBorder : undefined }}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setProfileErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder="you@example.com"
                />
                {profileErrors.email && (
                  <div style={{ fontSize: 11, color: c.red800, marginTop: 4 }}>{profileErrors.email}</div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: c.ink, padding: "9px 0", borderBottom: `1px solid ${c.border}` }}>
                {user.email}
              </div>
            )}
          </div>

          {profileErrors.general && (
            <div style={{ fontSize: 11, color: c.red800, marginBottom: 4 }}>{profileErrors.general}</div>
          )}

          {emailConfirmationSent && (
            <div style={{
              fontSize: 12, color: c.blue700,
              background: c.blue50, border: `1px solid ${c.blueBorder}`,
              borderRadius: 7, padding: "10px 14px",
            }}>
              A confirmation link has been sent to your new email address. Please check your inbox.
            </div>
          )}

        </SectionCard>

        {/* ── Signal Scanning section ──────────────────────────────── */}
        <SectionCard>
          <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 14 }}>Signal Scanning</div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: c.ink, marginBottom: 3 }}>Enable signal scanning</div>
              <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.5 }}>
                When off, the AI signal scanner will pause for all projects in your workspace.
              </div>
              {!workspaceScanningEnabled && (
                <div style={{ fontSize: 11, color: c.amber700, marginTop: 6 }}>
                  Scanning paused for all projects.
                </div>
              )}
            </div>
            {/* Toggle */}
            <button
              role="switch"
              aria-checked={workspaceScanningEnabled}
              onClick={() => updateWorkspaceScanningEnabled(!workspaceScanningEnabled)}
              style={{
                flexShrink: 0,
                width: 40, height: 22, borderRadius: 11,
                background: workspaceScanningEnabled ? c.ink : c.hint,
                border: "none", cursor: "pointer", padding: 0,
                position: "relative", transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute",
                top: 3, left: workspaceScanningEnabled ? 21 : 3,
                width: 16, height: 16, borderRadius: "50%",
                background: c.white, transition: "left 0.2s",
              }} />
            </button>
          </div>

          {/* ── Per-project scanning ── */}
          {workspaceScanningEnabled && projects.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 11, color: c.muted, marginBottom: 10 }}>
                {projects.filter((p) => p.scanning_enabled !== false).length} of {projects.length} project{projects.length !== 1 ? "s" : ""} scanning
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {projects.map((p, i) => {
                  const hasDomain = !!p.domain?.trim();
                  const isOn = p.scanning_enabled !== false;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                        padding: "9px 0",
                        borderTop: i > 0 ? `1px solid ${c.border}` : "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        {p.domain
                          ? <div style={{ fontSize: 10, color: c.hint, marginTop: 1 }}>{p.domain}</div>
                          : <div style={{ fontSize: 10, color: c.amber700, marginTop: 1 }}>No domain set — scanning unavailable</div>}
                      </div>
                      <button
                        role="switch"
                        aria-checked={isOn}
                        disabled={!hasDomain}
                        title={!hasDomain ? "Set a domain for this project to enable signal scanning" : undefined}
                        onClick={() => {
                          if (!isOn && !hasDomain) {
                            showToast("A domain is required to enable signal scanning. Add one in Project Settings.", "error");
                            return;
                          }
                          updateProject(p.id, { scanning_enabled: !isOn });
                        }}
                        style={{
                          flexShrink: 0,
                          width: 34, height: 19, borderRadius: 10,
                          background: isOn ? c.ink : c.hint,
                          border: "none", cursor: hasDomain ? "pointer" : "not-allowed", padding: 0,
                          position: "relative", transition: "background 0.2s",
                          opacity: hasDomain ? 1 : 0.5,
                        }}
                      >
                        <span style={{
                          position: "absolute",
                          top: 2, left: isOn ? 17 : 2,
                          width: 15, height: 15, borderRadius: "50%",
                          background: c.white, transition: "left 0.2s",
                        }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
            marginTop: 18, paddingTop: 18, borderTop: `1px solid ${c.border}`,
          }}>
            <div>
              <div style={{ fontSize: 13, color: workspaceScanningEnabled ? c.ink : c.hint, marginBottom: 3 }}>
                Weekly signal digest
              </div>
              <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.5 }}>
                Receive a weekly email of signals from the scanner relevant to your active projects.
              </div>
            </div>
            {/* Toggle */}
            <button
              role="switch"
              aria-checked={workspaceScanningEnabled && digestSubscribed}
              disabled={!workspaceScanningEnabled}
              onClick={handleDigestToggle}
              style={{
                flexShrink: 0,
                width: 40, height: 22, borderRadius: 11,
                background: workspaceScanningEnabled && digestSubscribed ? c.ink : c.hint,
                border: "none",
                cursor: workspaceScanningEnabled ? "pointer" : "default",
                padding: 0, position: "relative", transition: "background 0.2s",
                opacity: workspaceScanningEnabled ? 1 : 0.5,
              }}
            >
              <span style={{
                position: "absolute",
                top: 3, left: workspaceScanningEnabled && digestSubscribed ? 21 : 3,
                width: 16, height: 16, borderRadius: "50%",
                background: c.white, transition: "left 0.2s",
              }} />
            </button>
          </div>
        </SectionCard>

        {/* ── Sources section ──────────────────────────────────────── */}
        <SectionCard>
          <div style={{ fontSize: 13, fontWeight: 500, color: c.ink, marginBottom: 14 }}>Sources</div>
          <SourcesSection workspaceId={workspaceId} addSource={addSource} deleteSource={deleteSource} showToast={showToast} />
        </SectionCard>

        {/* ── Security section ─────────────────────────────────────── */}
        <SectionCard>

          {/* Section header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: passwordOpen ? 18 : 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>Security</div>
            <button
              onClick={handlePasswordToggle}
              style={{ ...btnSec, fontSize: 11, padding: "5px 14px" }}
            >
              {passwordOpen ? "Cancel" : "Change password"}
            </button>
          </div>

          {passwordOpen && (
            <>
              <PasswordInput
                label="Current password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPasswordErrors((p) => ({ ...p, currentPassword: undefined })); }}
                error={passwordErrors.currentPassword}
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
              <PasswordInput
                label="New password"
                hint="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordErrors((p) => ({ ...p, newPassword: undefined, confirmPassword: undefined })); }}
                error={passwordErrors.newPassword}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                error={passwordErrors.confirmPassword}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />

              {passwordErrors.general && (
                <div style={{ fontSize: 11, color: c.red800, marginBottom: 12 }}>{passwordErrors.general}</div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
                <button
                  onClick={handlePasswordSave}
                  disabled={passwordSaving}
                  style={{ ...btnSm, fontSize: 11, padding: "5px 14px", opacity: passwordSaving ? 0.6 : 1 }}
                >
                  {passwordSaving ? "Saving…" : "Save password"}
                </button>
                {passwordSuccess && (
                  <span style={{ fontSize: 12, color: c.green700 }}>Password updated ✓</span>
                )}
              </div>
            </>
          )}

        </SectionCard>

        {/* ── Sign out ─────────────────────────────────────────────── */}
        {onSignOut && (
          <div style={{ paddingTop: 8, paddingBottom: 8 }}>
            <button
              onClick={onSignOut}
              style={{
                fontSize: 12, padding: "7px 16px", borderRadius: 7,
                background: "transparent",
                border: `1px solid ${c.redBorder}`,
                color: c.red800,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Sign out
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

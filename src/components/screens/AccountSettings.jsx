/**
 * AccountSettings screen — edit profile (display name, email) and change password.
 * Profile and security sections save independently.
 * @param {{ appState: object }} props
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase.js";
import { c, inp, btnSm, btnSec, btnG, fl, fh } from "../../styles/tokens.js";

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

export default function AccountSettings({ appState }) {
  const { user } = appState;

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
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: c.hint, marginBottom: 3 }}>
          Workspace
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: c.ink }}>Account Settings</div>
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

      </div>
    </div>
  );
}

/**
 * AuthScreen — full-page login / sign-up / forgot-password / reset-password screen.
 * Handles email + password auth via Supabase. Toggles between
 * sign-in, sign-up, forgot-password, and reset-password modes.
 * On success, onAuthStateChange in App.jsx handles the transition automatically.
 */
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { c, inp, btnP } from "../../styles/tokens.js";
import logoLight from "../../assets/logo_light.svg";

const linkBtn = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 12, color: c.ink, fontFamily: "inherit",
  fontWeight: 500, textDecoration: "underline", padding: 0,
};

const mutedLink = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 11, color: c.muted, fontFamily: "inherit",
  padding: 0, textDecoration: "none",
};

export function AuthScreen({ initialMode = "signin" }) {
  const [mode,            setMode]            = useState(initialMode); // "signin" | "signup" | "forgot" | "reset"
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error,           setError]           = useState(null);
  const [info,            setInfo]            = useState(null);
  const [loading,         setLoading]         = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  // ── Sign in / Sign up ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        switchMode("confirm");
      }
    }

    setLoading(false);
  };

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setInfo("Check your email for a reset link.");
    }

    setLoading(false);
  };

  // ── Reset password ────────────────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setInfo("Password updated. You can now sign in.");
      setPassword("");
      setConfirmPassword("");
      switchMode("signin");
    }

    setLoading(false);
  };

  // ── Headings per mode ─────────────────────────────────────────────────────
  const HEADINGS = {
    signin:  ["Sign in",           "Enter your email and password to continue."],
    signup:  ["Welcome to Future Signals", "The structured foresight workspace for strategic practitioners."],
    forgot:  ["Reset password",    "Enter your email and we'll send a reset link."],
    reset:   ["Choose a new password", "Enter and confirm your new password."],
  };
  const [heading, subheading] = HEADINGS[mode] ?? ["", ""];

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: c.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
      fontSize: 14,
      WebkitFontSmoothing: "antialiased",
    }}>
      <div style={{
        width: 360,
        background: c.white,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: "36px 32px 32px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28 }}>
          <img src={logoLight} alt="Future Signals" style={{ width: 160, height: "auto", display: "block" }} />
        </div>

        {/* Confirmation screen — shown after successful sign-up */}
        {mode === "confirm" && (
          <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✉</div>
            <div style={{ fontSize: 17, fontWeight: 500, color: c.ink, marginBottom: 10 }}>
              Check your email
            </div>
            <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.65, marginBottom: 28 }}>
              We've sent a confirmation link to <strong style={{ color: c.ink }}>{email}</strong>.
              Click it to activate your account, then come back to sign in.
            </div>
            <button
              onClick={() => switchMode("signin")}
              style={{ ...mutedLink, fontSize: 13 }}
            >
              Back to sign in
            </button>
          </div>
        )}

        {/* Back link (forgot / reset) */}
        {(mode === "forgot" || mode === "reset") && (
          <button
            onClick={() => switchMode("signin")}
            style={{ ...mutedLink, marginBottom: 16, display: "block" }}
          >
            ← Back to sign in
          </button>
        )}

        {/* Heading — not shown for confirm mode */}
        {mode !== "confirm" && (
          <>
            <div style={{ fontSize: 18, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
              {heading}
            </div>
            <div style={{ fontSize: 12, color: c.muted, marginBottom: 24 }}>
              {subheading}
            </div>
          </>
        )}

        {/* Info banner */}
        {info && (
          <div style={{
            padding: "10px 14px", marginBottom: 16, borderRadius: 7,
            background: "#EAF3DE", border: `1px solid ${c.greenBorder}`,
            fontSize: 12, color: c.green700, lineHeight: 1.5,
          }}>
            {info}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{
            padding: "10px 14px", marginBottom: 16, borderRadius: 7,
            background: "#FCEBEB", border: `1px solid ${c.redBorder}`,
            fontSize: 12, color: c.red800, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* ── Sign in / Sign up form ───────────────────────────────────── */}
        {(mode === "signin" || mode === "signup") && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={{ ...inp, fontSize: 13 }}
              />
            </div>

            <div style={{ marginBottom: mode === "signin" ? 6 : 24 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>Password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : ""}
                required
                style={{ ...inp, fontSize: 13 }}
              />
            </div>

            {/* Forgot password link — sign in only */}
            {mode === "signin" && (
              <div style={{ marginBottom: 20, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  style={{ ...mutedLink, fontSize: 11 }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...btnP, width: "100%", justifyContent: "center",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading
                ? (mode === "signin" ? "Signing in…" : "Creating account…")
                : (mode === "signin" ? "Sign in" : "Create account")}
            </button>
          </form>
        )}

        {/* ── Forgot password form ─────────────────────────────────────── */}
        {mode === "forgot" && (
          <form onSubmit={handleForgot}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={{ ...inp, fontSize: 13 }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                ...btnP, width: "100%", justifyContent: "center",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        {/* ── Reset password form ──────────────────────────────────────── */}
        {mode === "reset" && (
          <form onSubmit={handleReset}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>New password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoFocus
                style={{ ...inp, fontSize: 13 }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>Confirm password</div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                style={{ ...inp, fontSize: 13 }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                ...btnP, width: "100%", justifyContent: "center",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {/* ── Sign in / Sign up toggle ─────────────────────────────────── */}
        {(mode === "signin" || mode === "signup") && (
          <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: c.muted }}>
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              style={linkBtn}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

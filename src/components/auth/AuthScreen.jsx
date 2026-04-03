/**
 * AuthScreen — full-page login / sign-up screen.
 * Handles email + password auth via Supabase. Toggles between
 * sign-in and sign-up modes. On success, onAuthStateChange in App.jsx
 * handles the transition automatically.
 */
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { c, inp, btnP } from "../../styles/tokens.js";

export function AuthScreen() {
  const [mode,     setMode]     = useState("signin"); // "signin" | "signup"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [info,     setInfo]     = useState(null);
  const [loading,  setLoading]  = useState(false);

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
        setInfo("Check your email for a confirmation link, then sign in.");
        setMode("signin");
      }
    }

    setLoading(false);
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.ink }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: c.ink }}>Future Signals</span>
          </div>
          <div style={{ fontSize: 11, color: c.hint, paddingLeft: 14 }}>Strategic Foresight</div>
        </div>

        {/* Heading */}
        <div style={{ fontSize: 18, fontWeight: 500, color: c.ink, marginBottom: 6 }}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </div>
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 24 }}>
          {mode === "signin"
            ? "Enter your email and password to continue."
            : "Enter your details to get started."}
        </div>

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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>
              Email
            </div>
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

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: c.ink, marginBottom: 5 }}>
              Password
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : ""}
              required
              style={{ ...inp, fontSize: 13 }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...btnP,
              width: "100%",
              justifyContent: "center",
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading
              ? (mode === "signin" ? "Signing in…" : "Creating account…")
              : (mode === "signin" ? "Sign in" : "Create account")}
          </button>
        </form>

        {/* Toggle */}
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: c.muted }}>
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: c.ink, fontFamily: "inherit",
              fontWeight: 500, textDecoration: "underline", padding: 0,
            }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

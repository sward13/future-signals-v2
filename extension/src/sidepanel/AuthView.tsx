import { useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/types/database.types";
import { c, inp, btnP } from "../../../src/styles/tokens.js";
import { Topbar } from "./Topbar";

const mutedLink = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 11,
  color: c.muted,
  fontFamily: "inherit",
  padding: 0,
  textDecoration: "underline",
} as const;

type Mode = "signin" | "forgot" | "reset";
type Props = { supabase: SupabaseClient<Database>; appOrigin: string; initialMode?: Mode };

export function AuthView({ supabase, appOrigin, initialMode = "signin" }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "signin") {
      const { error: er } = await supabase.auth.signInWithPassword({ email, password });
      if (er) setError(er.message);
    }

    setLoading(false);
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const redirectTo =
      typeof chrome !== "undefined" && chrome.runtime?.id != null
        ? `chrome-extension://${chrome.runtime.id}/sidepanel.html`
        : undefined;
    const { error: er } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (er) setError(er.message);
    else setInfo("If this email is registered, a reset link was sent.");
    setLoading(false);
  };

  const handleReset = async (e: FormEvent) => {
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
    const { error: er } = await supabase.auth.updateUser({ password });
    if (er) {
      setError(er.message);
    } else {
      setInfo("Password updated. You can now sign in.");
      setPassword("");
      setConfirmPassword("");
      setMode("signin");
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />

      <div style={{ padding: "20px 16px", flex: 1, overflowY: "auto" }}>

        {mode === "reset" ? (
          <form onSubmit={handleReset}>
            <Label>New password</Label>
            <input
              style={{ ...inp, marginBottom: 14 }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoFocus
              required
            />
            <Label>Confirm password</Label>
            <input
              style={inp}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
            {error ? <Banner kind="error" text={error} /> : null}
            {info  ? <Banner kind="info"  text={info}  /> : null}
            <div style={{ marginTop: 14 }}>
              <button
                type="submit"
                style={{ ...btnP, width: "100%", opacity: loading ? 0.7 : 1 }}
                disabled={loading}
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        ) : mode === "forgot" ? (
          <form onSubmit={handleForgot}>
            <Label>Email</Label>
            <input
              style={{ ...inp, marginBottom: 0 }}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              required
            />
            {error ? <Banner kind="error" text={error} /> : null}
            {info  ? <Banner kind="info"  text={info}  /> : null}
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="submit"
                style={{ ...btnP, opacity: loading ? 0.7 : 1 }}
                disabled={loading}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <button
                type="button"
                style={{ ...mutedLink, fontSize: 12 }}
                onClick={() => setMode("signin")}
              >
                ← Back to sign in
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <Label>Email</Label>
            <input
              style={{ ...inp, marginBottom: 14 }}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              required
            />
            <Label>Password</Label>
            <input
              style={inp}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error ? <Banner kind="error" text={error} /> : null}
            {info  ? <Banner kind="info"  text={info}  /> : null}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="submit"
                style={{ ...btnP, width: "100%", opacity: loading ? 0.7 : 1 }}
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                style={mutedLink}
                onClick={() => { setMode("forgot"); setError(null); setInfo(null); }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {mode === "signin" ? (
          <div style={{ marginTop: 20, fontSize: 12, color: c.muted, textAlign: "center" }}>
            New to Future Signals? Create your account in the app, then sign in here.{" "}
            <a
              href={`${appOrigin}/?ref=extension`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...mutedLink, display: "inline" }}
            >
              Create an account
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 500, color: c.ink, marginBottom: 5 }}>
      {children}
    </div>
  );
}

function Banner({ kind, text }: { kind: "error" | "info"; text: string }) {
  const palette =
    kind === "error"
      ? { bg: "#FEE2E2", border: "#F7C1C1", color: "#791F1F" }
      : { bg: "#EFF6FF", border: "#B5D4F4", color: "#185FA5" };
  return (
    <div
      role="alert"
      style={{
        marginTop: 10,
        padding: "8px 10px",
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.5,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
      }}
    >
      {text}
    </div>
  );
}

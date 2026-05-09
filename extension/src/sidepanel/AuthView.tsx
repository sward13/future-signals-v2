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

type Props = { supabase: SupabaseClient<Database> };

export function AuthView({ supabase }: Props) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } else if (mode === "signup") {
      const { error: er } = await supabase.auth.signUp({ email, password });
      if (er) setError(er.message);
      else setInfo("Check your inbox to confirm your email, then sign in.");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />

      <div style={{ padding: "20px 16px", flex: 1, overflowY: "auto" }}>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setInfo(null); }}
              style={{
                fontSize: 12,
                padding: "6px 14px",
                borderRadius: 6,
                border: `1px solid ${mode === m ? c.brand : c.borderMid}`,
                background: mode === m ? "#EFF6FF" : c.white,
                color: mode === m ? c.brand : c.muted,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: mode === m ? 500 : 400,
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        {mode === "forgot" ? (
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
                {mode === "signin"
                  ? (loading ? "Signing in…"      : "Sign in")
                  : (loading ? "Creating account…" : "Create account")}
              </button>
              {mode === "signin" ? (
                <button
                  type="button"
                  style={mutedLink}
                  onClick={() => { setMode("forgot"); setError(null); setInfo(null); }}
                >
                  Forgot password?
                </button>
              ) : null}
            </div>
          </form>
        )}
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

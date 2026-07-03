import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { c } from "../../../src/styles/tokens.js";
import { requireExtensionEnv } from "../env.js";
import { createExtensionSupabase } from "../lib/createSupabase.js";
import { fetchProjects, fetchWorkspaceIdForUser } from "../lib/workspace.js";
import type { ProjectRow } from "../lib/workspace.js";
import { AuthView } from "./AuthView";
import { CaptureForm } from "./CaptureForm";

export function App() {
  let env: ReturnType<typeof requireExtensionEnv>;
  try {
    env = requireExtensionEnv();
  } catch {
    return (
      <div style={{ padding: 14, fontSize: 13, color: c.ink }}>
        Configure <strong>.env</strong> in <code>/extension</code> with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and
        VITE_APP_ORIGIN. Re-run <code>npm run build</code>.
      </div>
    );
  }

  const supabase = useMemo(
    () => createExtensionSupabase(env.supabaseUrl, env.supabaseAnonKey),
    [env.supabaseUrl, env.supabaseAnonKey],
  );

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session?.user) {
      setWorkspaceId(null);
      setProjects([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoadError(null);
    (async () => {
      const ws = await fetchWorkspaceIdForUser(supabase, session.user.id);
      if (cancelled) return;
      if (!ws) {
        setWorkspaceId(null);
        setLoadError("No workspace found for this account.");
        return;
      }
      setWorkspaceId(ws);
      const pw = await fetchProjects(supabase, ws);
      if (cancelled) return;
      setProjects(pw);
    })();

    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  if (session === undefined) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: c.muted, fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return <AuthView supabase={supabase} />;
  }

  if (loadError) {
    return (
      <div style={{ padding: 14, fontSize: 13, color: c.ink }}>
        <p style={{ margin: "0 0 8px" }}>{loadError}</p>
        <button
          type="button"
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${c.borderMid}`,
            background: c.white,
            cursor: "pointer",
            fontSize: 12,
          }}
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div style={{ padding: 14, fontSize: 13, color: c.muted }}>
        Preparing workspace…
      </div>
    );
  }

  return (
    <CaptureForm
      supabase={supabase}
      workspaceId={workspaceId}
      projects={projects}
      appOrigin={env.appOrigin}
      onSignOut={() => void supabase.auth.signOut()}
    />
  );
}

/**
 * ErrorBoundary — catches render/lifecycle errors in its subtree so a component
 * crash degrades to a friendly fallback instead of white-screening the app.
 * See docs/error-handling-hardening-spec.md (P0 — there was previously no error
 * boundary anywhere in src/).
 *
 * Usage:
 *   <ErrorBoundary> … </ErrorBoundary>                          // default full-page fallback
 *   <ErrorBoundary fallback={({ reset }) => <Panel …/>}> … </>  // custom fallback (render-prop or node)
 *
 * Tip: give a screen-level boundary `key={activeScreen}` so navigating to another
 * screen remounts it and clears a prior error automatically.
 */
import { Component } from "react";
import { c, btnP, btnSec } from "../../styles/tokens.js";
import { track } from "../../lib/analytics.js";

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`, error, info?.componentStack);
    track("app_error", { boundary: this.props.label || "root", message: String(error?.message || error).slice(0, 200) });
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === "function") return fallback({ error, reset: this.reset });
    if (fallback) return fallback;
    return <FullPageFallback />;
  }
}

// Full-page fallback — last resort (top-level boundary). Reload is the reliable
// recovery when we can't know what state got corrupted.
function FullPageFallback() {
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, fontFamily: "inherit", padding: 24 }}>
      <div style={{ width: 400, maxWidth: "90vw", background: c.white, border: `1px solid ${c.border}`, borderRadius: 12, padding: "32px 28px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: c.ink, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.6, marginBottom: 24 }}>
          The app hit an unexpected error. Reloading usually fixes it — if it keeps happening, let us know.
        </div>
        <button onClick={() => window.location.reload()} style={{ ...btnP, width: "100%", justifyContent: "center" }}>
          Reload
        </button>
      </div>
    </div>
  );
}

// Content-area fallback — keeps the surrounding chrome (e.g. the sidebar) so the
// user can navigate to another screen instead of losing the whole app.
export function ScreenErrorFallback({ reset }) {
  return (
    <div style={{ height: "100%", minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, padding: 24 }}>
      <div style={{ width: 380, maxWidth: "90vw", background: c.white, border: `1px solid ${c.border}`, borderRadius: 12, padding: "28px 26px", textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: c.ink, marginBottom: 8 }}>This screen ran into a problem</div>
        <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.6, marginBottom: 20 }}>
          You can try again, pick another screen from the sidebar, or reload the page.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={reset} style={{ ...btnP, justifyContent: "center" }}>Try again</button>
          <button onClick={() => window.location.reload()} style={btnSec}>Reload</button>
        </div>
      </div>
    </div>
  );
}

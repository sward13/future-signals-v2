/**
 * analytics — thin GA4 (gtag) wrapper for the activation funnel.
 * See docs/ga4-activation-tracking-spec.md.
 *
 * No-ops entirely until initAnalytics(id) runs with a measurement id
 * (VITE_GA_MEASUREMENT_ID). Unset in dev/test → silent, so we never pollute GA.
 * Node-safe: guards on window/document so the guard logic is unit-testable.
 *
 * Reuses the marketing site's measurement id + cross-domain linker so
 * futuresignals.io → app.futuresignals.io counts as one journey. Unlike the
 * static marketing page, the app sets send_page_view:false and fires page_view
 * manually (state-driven nav — see pageView / the SPA gotcha in the spec).
 */

const CROSS_DOMAINS = ["futuresignals.io", "app.futuresignals.io"];

let measurementId = null;

export function initAnalytics(id) {
  if (!id || measurementId) return;                 // unset, or already initialized
  measurementId = id;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id, {
    send_page_view: false,                          // SPA: page_view fired manually
    linker: { domains: CROSS_DOMAINS },
  });
}

/** Fire a GA event. Returns true if it was sent (analytics enabled), false if no-op. */
export function track(event, params = {}) {
  if (!measurementId || typeof window === "undefined" || !window.gtag) return false;
  window.gtag("event", event, params);
  return true;
}

/** Fire a manual page_view for a state-driven screen. */
export function pageView(screen) {
  return track("page_view", { page_title: screen, page_path: `/${screen}` });
}

export function isAnalyticsEnabled() {
  return !!measurementId;
}

// Test-only: reset module state between unit tests.
export function __resetAnalyticsForTest() {
  measurementId = null;
}

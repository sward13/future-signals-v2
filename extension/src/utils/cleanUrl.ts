/** Params removed from saved source_url — plus any key starting with `utm_`. */
const TRACKING_PARAM_NAMES = new Set([
  "fbclid",
  "gclid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
  "spm",
  "ved",
  "si",
]);

/**
 * Strips known tracking/query parameters from URLs while preserving meaningful query strings.
 */
export function cleanUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    const keys = [...u.searchParams.keys()];
    for (const key of keys) {
      const low = key.toLowerCase();
      if (low.startsWith("utm_") || TRACKING_PARAM_NAMES.has(low)) {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return s;
  }
}

/**
 * Input subtype ids persisted to Postgres — lowercase, aligned with InputFormFields / main app.
 * Display labels mirror product terminology ("Signal → signal").
 */
export const INPUT_SUBTYPE_OPTIONS = [
  { id: "signal", label: "Signal" },
  { id: "issue", label: "Issue" },
  { id: "projection", label: "Projection" },
  { id: "plan", label: "Plan" },
  { id: "obstacle", label: "Obstacle" },
  { id: "source", label: "Source" },
] as const;

export const DEFAULT_SUBTYPE = "signal";

export type InputSubtypeId = (typeof INPUT_SUBTYPE_OPTIONS)[number]["id"];

/**
 * Mirrors SIGNAL_STRENGTH_OPTIONS / SOURCE_CONFIDENCE_OPTIONS in
 * src/components/inputs/InputDrawer.jsx. Both fields are optional and
 * default to null — there is no "default" tier here, unlike subtype.
 */
export const SIGNAL_STRENGTH_OPTIONS = [
  { id: "weak", label: "Weak", desc: "Single source, edge case, or very early emergence" },
  { id: "moderate", label: "Moderate", desc: "Multiple sources or visible within a specific community" },
  { id: "strong", label: "Strong", desc: "Widespread, data-backed, or reported by mainstream sources" },
] as const;

export type SignalStrengthId = (typeof SIGNAL_STRENGTH_OPTIONS)[number]["id"];

export const SOURCE_CONFIDENCE_OPTIONS = [
  { id: "low", label: "Low", desc: "Social media, blogs, unverified sources" },
  { id: "medium", label: "Medium", desc: "Quality journalism, industry reports, expert commentary" },
  { id: "high", label: "High", desc: "Peer-reviewed research, official statistics, established institutions" },
] as const;

export type SourceConfidenceId = (typeof SOURCE_CONFIDENCE_OPTIONS)[number]["id"];

export const DRAFT_STORAGE_KEY = "fs_extension_capture_draft_v1";

export const PAGE_QUERY_MESSAGE_TYPE      = "FS_GET_PAGE_DATA"      as const;
export const SELECTION_CHANGED_MESSAGE_TYPE = "FS_SELECTION_CHANGED" as const;

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

export const DRAFT_STORAGE_KEY = "fs_extension_capture_draft_v1";

export const PAGE_QUERY_MESSAGE_TYPE      = "FS_GET_PAGE_DATA"      as const;
export const SELECTION_CHANGED_MESSAGE_TYPE = "FS_SELECTION_CHANGED" as const;

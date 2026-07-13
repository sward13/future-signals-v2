import type { InputSubtypeId } from "../constants.js";
import { DEFAULT_SUBTYPE, INPUT_SUBTYPE_OPTIONS } from "../constants.js";

export function normalizeSubtypeId(raw: string | undefined | null): InputSubtypeId {
  const s = (raw ?? "").trim().toLowerCase();
  const match = INPUT_SUBTYPE_OPTIONS.find((o) => o.id === s);
  return match?.id ?? DEFAULT_SUBTYPE;
}

import type { InputSubtypeId } from "../constants.js";
import { DRAFT_STORAGE_KEY } from "../constants.js";
import { normalizeSubtypeId } from "./subtype.js";

export type CaptureDraft = {
  name: string;
  description: string;
  source_url: string;
  subtype: InputSubtypeId;
  /** null = Inbox (default). Set only when user picks a project. */
  project_id: string | null;
  updatedAt: string;
};

export async function loadDraft(): Promise<CaptureDraft | null> {
  const result = await chrome.storage.local.get(DRAFT_STORAGE_KEY);
  const raw = result[DRAFT_STORAGE_KEY];
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<CaptureDraft>;
  if (typeof d.name !== "string" || typeof d.description !== "string" || typeof d.source_url !== "string") {
    return null;
  }
  if (typeof d.subtype !== "string") return null;
  if (d.project_id != null && typeof d.project_id !== "string") return null;
  return {
    name: d.name,
    description: d.description,
    source_url: d.source_url,
    subtype: normalizeSubtypeId(d.subtype),
    project_id: d.project_id ?? null,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date().toISOString(),
  };
}

export async function saveDraft(draft: CaptureDraft): Promise<void> {
  await chrome.storage.local.set({
    [DRAFT_STORAGE_KEY]: { ...draft, updatedAt: new Date().toISOString() },
  });
}

export async function clearDraft(): Promise<void> {
  await chrome.storage.local.remove(DRAFT_STORAGE_KEY);
}

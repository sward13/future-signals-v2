import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/types/database.types";
import { c, inp, ta, sel, btnP, btnSec, fl } from "../../../src/styles/tokens.js";
import {
  DEFAULT_SUBTYPE,
  SELECTION_CHANGED_MESSAGE_TYPE,
  SIGNAL_STRENGTH_OPTIONS,
  SOURCE_CONFIDENCE_OPTIONS,
} from "../constants.js";
import type { InputSubtypeId, SignalStrengthId, SourceConfidenceId } from "../constants.js";
import { Topbar } from "./Topbar";
import { SubtypePicker } from "./SubtypePicker";
import { ThreeCardSelector } from "./ThreeCardSelector";
import { debugLogPageExtraction, fetchActiveTabPage } from "../lib/activeTabPage.js";
import { resolveBestDescription, resolveMetaDescription } from "../lib/metadata.js";
import type { ProjectRow } from "../lib/workspace.js";
import { insertInputAndRequestEmbed } from "../lib/insertInput.js";
import { clearDraft, loadDraft, saveDraft } from "../utils/draft.js";
import { cleanUrl } from "../utils/cleanUrl.js";
import { normalizeSubtypeId } from "../utils/subtype.js";

type Props = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  projects: ProjectRow[];
  appOrigin: string;
  onSignOut: () => void;
};

type ReloadStatus = "reloaded" | "selection_updated" | "no_change" | null;

const RELOAD_STATUS_COPY: Record<NonNullable<ReloadStatus>, string> = {
  reloaded:          "Page details reloaded.",
  selection_updated: "Description updated from selected text.",
  no_change:         "No new page details found.",
};

/** Maps raw Supabase/network error strings to user-safe copy. */
function sanitizeSaveError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("jwt") || lower.includes("unauthorized") || lower.includes("session expired")) {
    return "Session expired — please sign out and sign back in.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network")) {
    return "Could not reach Future Signals. Check your connection and try again.";
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "Permission denied. You may not have access to save here.";
  }
  return "Failed to save. Please try again.";
}

export function CaptureForm({ supabase, workspaceId, projects, appOrigin, onSignOut }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [subtype, setSubtype] = useState<InputSubtypeId>(DEFAULT_SUBTYPE);
  const [projectId, setProjectId] = useState<string>(""); // "" → Inbox (null)
  const [signalStrength, setSignalStrength] = useState<SignalStrengthId | null>(null);
  const [sourceConfidence, setSourceConfidence] = useState<SourceConfidenceId | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [reloadStatus, setReloadStatus] = useState<ReloadStatus>(null);
  const [nameDirty, setNameDirty] = useState(false);
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [sourceUrlDirty, setSourceUrlDirty] = useState(false);

  // Tracks how the current Description value was last set.
  // Used to populate metadata.selected_text_used / meta_description_used.
  type DescriptionSource = "selection" | "meta" | "manual" | "draft";
  const [descriptionSource, setDescriptionSource] = useState<DescriptionSource>("draft");

  // Refs give the stable runtime-message listener access to current state
  // without needing to re-register the listener on every state change.
  const sourceUrlRef        = useRef(sourceUrl);
  const savedIdRef          = useRef(savedId);
  const pageCanonicalUrlRef = useRef(""); // latest canonical URL from page data
  useEffect(() => { sourceUrlRef.current = sourceUrl; }, [sourceUrl]);
  useEffect(() => { savedIdRef.current   = savedId;   }, [savedId]);

  // ── Runtime message listener — automatic selection push ────────────────────
  // Receives FS_SELECTION_CHANGED from the content script and updates
  // Description without requiring the user to click "Reload from active tab".
  useEffect(() => {
    const handleMessage = async (message: unknown) => {
      if (!message || typeof message !== "object") return;
      const msg = message as {
        type?: string;
        selectedText?: string;
        currentUrl?: string;
        canonicalUrl?: string;
      };
      if (msg.type !== SELECTION_CHANGED_MESSAGE_TYPE) return;

      const selectedText = msg.selectedText?.trim() ?? "";
      if (!selectedText) return; // empty selection — do nothing

      // Don't update the form while a successful save is being displayed.
      if (savedIdRef.current) return;

      const msgCleanUrl  = cleanUrl(msg.canonicalUrl || msg.currentUrl || "");
      const formCleanUrl = cleanUrl(sourceUrlRef.current);
      const isDifferentPage = Boolean(msgCleanUrl && formCleanUrl && msgCleanUrl !== formCleanUrl);

      if (isDifferentPage) {
        // Message came from a different page — fetch full metadata and apply
        // as a new capture context (same logic as "Reload" on a different URL).
        const page = await fetchActiveTabPage();
        if (!page) return;
        if (page.canonicalUrl) pageCanonicalUrlRef.current = page.canonicalUrl;
        setName(page.title || "");
        setNameDirty(false);
        setSourceUrl(page.cleanedUrl);
        setSourceUrlDirty(false);
        setDescription(selectedText);
        setDescriptionDirty(false);
      } else {
        // Same page — update Description only.
        setDescription(selectedText);
        setDescriptionDirty(false);
      }
      setDescriptionSource("selection");
      setReloadStatus("selection_updated");
    };

    const listener = (message: unknown) => { void handleMessage(message); };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Applies extracted page data to form fields.
   *
   * forceFull — bypasses all dirty-field guards and overwrites everything.
   *   Used when the active tab URL is different from the current form URL,
   *   so a stale draft or manual edits from a previous page don't block
   *   the new page's data from coming through.
   *
   * explicitReload — user pressed "Reload from active tab"; controls whether
   *   a status string is returned and whether the meta description overwrites
   *   a manually edited description (only when not dirty or forceFull).
   */
  const applyPageData = (
    page: Awaited<ReturnType<typeof fetchActiveTabPage>>,
    options: { explicitReload: boolean; forceFull?: boolean },
  ): ReloadStatus => {
    if (!page) return null;
    debugLogPageExtraction(page);
    const { explicitReload, forceFull = false } = options;
    const selected = page.selectionText.trim();

    // Keep canonical URL in sync for metadata at save time.
    if (page.canonicalUrl) pageCanonicalUrlRef.current = page.canonicalUrl;
    const metaDescription = resolveMetaDescription(page);
    const bestDescription = resolveBestDescription(page);

    let somethingUpdated = false;

    // Title: update unless manually edited, or forced.
    if (!nameDirty || forceFull) {
      setName(page.title || "");
      somethingUpdated = true;
    }

    // Source URL: update unless manually edited, or forced.
    if (!sourceUrlDirty || forceFull) {
      setSourceUrl(page.cleanedUrl);
      somethingUpdated = true;
    }

    // Reset dirty flags when forcing a full refresh so subsequent user
    // interactions start from a clean baseline for this page.
    if (forceFull) {
      setNameDirty(false);
      setSourceUrlDirty(false);
    }

    // Selected text always wins regardless of dirty state.
    if (selected) {
      setDescription(bestDescription);
      setDescriptionDirty(false);
      setDescriptionSource("selection");
      return "selection_updated";
    }

    // No selected text — decide whether to fill from meta description.
    if (!explicitReload && !forceFull) {
      // Auto-load on panel open or "Capture another": only fill if not dirty.
      if (!descriptionDirty) {
        setDescription(metaDescription);
        setDescriptionSource("meta");
      }
      return null; // no status on auto-load
    }

    // Explicit reload or force: overwrite if not manually edited, blank, or forced.
    const canOverwriteDescription = forceFull || !descriptionDirty || description.trim() === "";
    if (canOverwriteDescription) {
      setDescription(metaDescription);
      setDescriptionDirty(false);
      setDescriptionSource("meta");
      somethingUpdated = true;
    }

    return somethingUpdated ? "reloaded" : "no_change";
  };

  // ── Mount: compare draft URL against current tab before deciding to restore ──
  // If the stored draft belongs to a different page, load from the current tab
  // instead so a stale draft never silently hijacks the form.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [draft, page] = await Promise.all([loadDraft(), fetchActiveTabPage()]);
      if (cancelled) return;

      const currentUrl = page?.cleanedUrl ?? "";
      const draftUrl   = draft?.source_url ? cleanUrl(draft.source_url) : "";

      // A draft matches when both URLs are present and equal, or when either
      // side is unknown (no active tab data or draft has no URL yet).
      const draftMatchesPage = !currentUrl || !draftUrl || draftUrl === currentUrl;

      if (draft && draftMatchesPage) {
        // Same page: restore the draft so in-progress work isn't lost.
        setName(draft.name);
        setDescription(draft.description);
        setSourceUrl(draft.source_url);
        setSubtype(normalizeSubtypeId(draft.subtype));
        setProjectId(draft.project_id ?? "");
        setSignalStrength(draft.signal_strength);
        setSourceConfidence(draft.source_confidence);
        setNameDirty(Boolean(draft.name.trim()));
        setDescriptionDirty(Boolean(draft.description.trim()));
        setSourceUrlDirty(Boolean(draft.source_url.trim()));
      } else if (page) {
        // Different page or no draft: populate from the current tab.
        // The stale draft (if any) will be overwritten by the auto-save
        // effect once the form settles with the new page's data.
        applyPageData(page, { explicitReload: false });
      }

      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft on every field change (after hydration, before save success).
  useEffect(() => {
    if (!hydrated || savedId) return;
    void saveDraft({
      name,
      description,
      source_url: sourceUrl,
      subtype,
      project_id: projectId || null,
      signal_strength: signalStrength,
      source_confidence: sourceConfidence,
      updatedAt: new Date().toISOString(),
    });
  }, [hydrated, savedId, name, description, sourceUrl, subtype, projectId, signalStrength, sourceConfidence]);

  // ── Reload from tab ─────────────────────────────────────────────────────────
  // Detects page changes: if the fetched URL differs from the form's current
  // source URL, forces a full overwrite (bypassing dirty flags) so stale data
  // from a previous page is replaced without the user needing to "Start over".
  const reloadFromTab = async () => {
    setErrorBanner(null);
    setReloadStatus(null);
    const page = await fetchActiveTabPage();
    if (!page) {
      setErrorBanner(
        "Could not read this page. Use a normal http(s) tab, or reload the page and try again.",
      );
      return;
    }

    // Force a full refresh when the active tab has navigated to a new URL.
    const currentFormUrl = cleanUrl(sourceUrl);
    const newPageUrl     = page.cleanedUrl;
    const isDifferentPage = Boolean(newPageUrl && currentFormUrl && newPageUrl !== currentFormUrl);

    const status = applyPageData(page, { explicitReload: true, forceFull: isDifferentPage });
    setReloadStatus(status);
  };

  // ── Start over ──────────────────────────────────────────────────────────────
  // Explicitly clears the stored draft, resets all dirty flags, and reloads
  // everything from the current active tab.
  const startOver = async () => {
    await clearDraft();
    setSavedId(null);
    setSavedProjectId(null);
    setErrorBanner(null);
    setReloadStatus(null);
    setSubtype(DEFAULT_SUBTYPE);
    setProjectId("");
    setSignalStrength(null);
    setSourceConfidence(null);
    setNameDirty(false);
    setDescriptionDirty(false);
    setSourceUrlDirty(false);
    const page = await fetchActiveTabPage();
    if (page) {
      applyPageData(page, { explicitReload: true, forceFull: true });
    } else {
      setName("");
      setDescription("");
      setSourceUrl("");
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const submit = async () => {
    setErrorBanner(null);
    setReloadStatus(null);
    const title = name.trim();
    if (!title) {
      setErrorBanner("Please add a title (name).");
      return;
    }
    setSaving(true);
    const effectiveProjectId = projectId.trim() ? projectId.trim() : null;

    let extensionVersion: string | null = null;
    try { extensionVersion = chrome.runtime.getManifest?.()?.version ?? null; } catch { /* ignore */ }

    const metadata: Record<string, unknown> = {
      capture_source:        "chrome_extension",
      captured_at:           new Date().toISOString(),
      tab_title:             title,
      tab_url:               sourceUrl || null,
      source_url:            cleanUrl(sourceUrl) || null,
      selected_text_used:    descriptionSource === "selection",
      canonical_url:         pageCanonicalUrlRef.current || null,
      meta_description_used: descriptionSource === "meta",
      extension_version:     extensionVersion,
    };

    const result = await insertInputAndRequestEmbed(supabase, {
      workspaceId,
      name: title,
      description,
      sourceUrlRaw: sourceUrl,
      subtype: normalizeSubtypeId(subtype),
      projectId: effectiveProjectId,
      signalStrength,
      sourceConfidence,
      metadata,
    });

    setSaving(false);
    if (!result.ok) {
      setErrorBanner(sanitizeSaveError(result.message));
      return;
    }

    await clearDraft();
    setSavedId(result.inputId);
    setSavedProjectId(effectiveProjectId);
    setDescription("");
    setSourceUrl("");
  };

  // ── Capture another ─────────────────────────────────────────────────────────
  const captureAnother = async () => {
    setSavedId(null);
    setSavedProjectId(null);
    setErrorBanner(null);
    setReloadStatus(null);
    setSubtype(DEFAULT_SUBTYPE);
    setProjectId("");
    setSignalStrength(null);
    setSourceConfidence(null);
    setNameDirty(false);
    setDescriptionDirty(false);
    setSourceUrlDirty(false);
    const page = await fetchActiveTabPage();
    if (page) {
      applyPageData(page, { explicitReload: false, forceFull: true });
    } else {
      setName("");
      setDescription("");
      setSourceUrl("");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  // ── Sign out button (placed in Topbar) ────────────────────────────────────────

  const signOutBtn = (
    <button
      type="button"
      style={{
        background: "none",
        border: `1px solid ${c.borderMid}`,
        borderRadius: 6,
        padding: "5px 10px",
        fontSize: 11,
        color: c.muted,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
      onClick={onSignOut}
    >
      Sign out
    </button>
  );

  // ── Loading ────────────────────────────────────────────────────────────────

  if (!hydrated) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Topbar right={signOutBtn} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: c.muted, fontSize: 12 }}>
          Loading…
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (savedId) {
    const savedProject = savedProjectId ? projects.find((p) => p.id === savedProjectId) : null;
    const savedMessage  = savedProject ? `Saved to ${savedProject.name}.` : "Saved to Inbox.";
    const ctaLabel      = savedProject ? "Open Project" : "Open Future Signals";
    const ctaHref       = savedProject ? `${appOrigin}/projects/${savedProject.id}` : `${appOrigin}/`;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Topbar right={signOutBtn} />
        <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
          <div style={{
            padding: "12px 14px", borderRadius: 8,
            background: "#DCFCE7", border: "1px solid #BBF7D0",
            color: "#166534", fontSize: 13, marginBottom: 14, lineHeight: 1.5,
          }}>
            {savedMessage}
          </div>
          <a
            href={ctaHref}
            target="_blank"
            rel="noreferrer"
            style={{ ...btnP, display: "block", textAlign: "center", textDecoration: "none", marginBottom: 10 }}
          >
            {ctaLabel}
          </a>
          <button type="button" style={{ ...btnSec, width: "100%" }} onClick={() => void captureAnother()}>
            Capture another
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar right={signOutBtn} />

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

        {errorBanner ? (
          <div
            role="alert"
            style={{
              marginBottom: 14, padding: "9px 12px", borderRadius: 7,
              fontSize: 12, lineHeight: 1.5,
              background: "#FEE2E2", border: "1px solid #F7C1C1", color: "#791F1F",
            }}
          >
            {errorBanner}
          </div>
        ) : null}

        <div style={{ marginBottom: 12 }}>
          <div style={fl}>Title</div>
          <input
            style={inp}
            value={name}
            onChange={(e) => { setName(e.target.value); setNameDirty(true); }}
            placeholder="Page title or your label"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={fl}>Description</div>
          <textarea
            style={{ ...ta, minHeight: 84 }}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDescriptionDirty(true); setDescriptionSource("manual"); }}
            placeholder="Optional — selected text or notes"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={fl}>Source URL</div>
          <input
            style={inp}
            value={sourceUrl}
            onChange={(e) => { setSourceUrl(e.target.value); setSourceUrlDirty(true); }}
            placeholder="https://…"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={fl}>Input type</div>
          <SubtypePicker
            value={subtype}
            onChange={(id) => setSubtype(normalizeSubtypeId(id))}
          />
        </div>

        <ThreeCardSelector
          label="Signal strength"
          options={SIGNAL_STRENGTH_OPTIONS}
          value={signalStrength}
          onChange={(id) => setSignalStrength(id as SignalStrengthId | null)}
        />

        <ThreeCardSelector
          label="Source confidence"
          options={SOURCE_CONFIDENCE_OPTIONS}
          value={sourceConfidence}
          onChange={(id) => setSourceConfidence(id as SourceConfidenceId | null)}
        />

        <div style={{ marginBottom: 16 }}>
          <div style={fl}>Project</div>
          <select style={sel} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Inbox (default)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            style={{ ...btnP, width: "100%", opacity: saving ? 0.65 : 1 }}
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : "Save to Future Signals"}
          </button>
          <button type="button" style={{ ...btnSec, width: "100%" }} onClick={() => void reloadFromTab()}>
            Reload from active tab
          </button>
          {reloadStatus && (
            <div style={{ fontSize: 11, color: c.muted, textAlign: "center" }}>
              {RELOAD_STATUS_COPY[reloadStatus]}
            </div>
          )}
          <button
            type="button"
            style={{
              background: "none", border: "none", padding: "2px 0",
              fontSize: 11, color: c.faint, cursor: "pointer",
              fontFamily: "inherit", textAlign: "center",
            }}
            onClick={() => void startOver()}
          >
            Start over
          </button>
        </div>

      </div>
    </div>
  );
}

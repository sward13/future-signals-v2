import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/types/database.types";
import { c, inp, ta, sel, btnP, btnSec, fl } from "../../../src/styles/tokens.js";
import { DEFAULT_SUBTYPE, INPUT_SUBTYPE_OPTIONS } from "../constants.js";
import type { InputSubtypeId } from "../constants.js";
import { debugLogPageExtraction, fetchActiveTabPage } from "../lib/activeTabPage.js";
import { resolveBestDescription, resolveMetaDescription } from "../lib/metadata.js";
import type { ProjectRow } from "../lib/workspace.js";
import { insertInputAndRequestEmbed } from "../lib/insertInput.js";
import { clearDraft, loadDraft, saveDraft } from "../utils/draft.js";
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

  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [reloadStatus, setReloadStatus] = useState<ReloadStatus>(null);
  const [nameDirty, setNameDirty] = useState(false);
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [sourceUrlDirty, setSourceUrlDirty] = useState(false);

  const applyPageData = (
    page: Awaited<ReturnType<typeof fetchActiveTabPage>>,
    options: { explicitReload: boolean },
  ): ReloadStatus => {
    if (!page) return null;
    debugLogPageExtraction(page);
    const explicitReload = options.explicitReload;
    const selected = page.selectionText.trim();
    const metaDescription = resolveMetaDescription(page);
    const bestDescription = resolveBestDescription(page);

    let somethingUpdated = false;

    // Title: update from page metadata unless manually edited.
    if (!nameDirty) {
      setName(page.title || "");
      somethingUpdated = true;
    }

    // Source URL: update from active tab/canonical URL unless manually edited.
    if (!sourceUrlDirty) {
      setSourceUrl(page.cleanedUrl);
      somethingUpdated = true;
    }

    if (selected) {
      // Explicitly selected text always wins on refresh.
      setDescription(bestDescription);
      setDescriptionDirty(false);
      return "selection_updated";
    }

    // No selected text:
    // - Initial/auto load: use meta fallback.
    // - Explicit reload: only use meta fallback when description is empty or not manually edited.
    if (!explicitReload) {
      if (!descriptionDirty) {
        setDescription(metaDescription);
      }
      return null; // not user-initiated — no status to report
    }

    const canOverwriteWithMeta = !descriptionDirty || description.trim() === "";
    if (canOverwriteWithMeta) {
      setDescription(metaDescription);
      setDescriptionDirty(false);
      somethingUpdated = true;
    }

    return somethingUpdated ? "reloaded" : "no_change";
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadDraft();
      const page = await fetchActiveTabPage();
      if (cancelled) return;
      if (draft) {
        setName(draft.name);
        setDescription(draft.description);
        setSourceUrl(draft.source_url);
        setSubtype(normalizeSubtypeId(draft.subtype));
        setProjectId(draft.project_id ?? "");
        setNameDirty(Boolean(draft.name.trim()));
        setDescriptionDirty(Boolean(draft.description.trim()));
        setSourceUrlDirty(Boolean(draft.source_url.trim()));
      } else if (page) {
        applyPageData(page, { explicitReload: false });
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || savedId) return;
    void saveDraft({
      name,
      description,
      source_url: sourceUrl,
      subtype,
      project_id: projectId || null,
      updatedAt: new Date().toISOString(),
    });
  }, [hydrated, savedId, name, description, sourceUrl, subtype, projectId]);

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
    const status = applyPageData(page, { explicitReload: true });
    setReloadStatus(status);
  };

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
    const result = await insertInputAndRequestEmbed(supabase, {
      workspaceId,
      name: title,
      description,
      sourceUrlRaw: sourceUrl,
      subtype: normalizeSubtypeId(subtype),
      projectId: effectiveProjectId,
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

  const captureAnother = async () => {
    setSavedId(null);
    setSavedProjectId(null);
    setErrorBanner(null);
    setReloadStatus(null);
    setSubtype(DEFAULT_SUBTYPE);
    setProjectId("");
    setNameDirty(false);
    setDescriptionDirty(false);
    setSourceUrlDirty(false);
    const page = await fetchActiveTabPage();
    if (page) {
      applyPageData(page, { explicitReload: false });
    } else {
      setName("");
    }
  };

  if (!hydrated) {
    return (
      <div style={{ padding: 20, fontSize: 13, color: c.muted, textAlign: "center" }}>
        Loading draft…
      </div>
    );
  }

  if (savedId) {
    const savedProject = savedProjectId ? projects.find((p) => p.id === savedProjectId) : null;
    const savedMessage = savedProject ? `Saved to ${savedProject.name}.` : "Saved to Inbox.";
    const ctaLabel = savedProject ? "Open Project" : "Open Future Signals";
    const ctaHref = savedProject ? `${appOrigin}/projects/${savedProject.id}` : `${appOrigin}/`;
    return (
      <div style={{ padding: 14 }}>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "#DCFCE7",
            color: "#166534",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
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
    );
  }

  return (
    <div style={{ padding: 14, maxWidth: 420, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.ink }}>Capture input</div>
        <button type="button" style={{ ...btnSec, padding: "6px 12px", fontSize: 11 }} onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <p style={{ fontSize: 12, color: c.muted, margin: "0 0 12px", lineHeight: 1.45 }}>
        Defaults to your <strong>Inbox</strong> unless you pick a project. Source URL is cleaned of common tracking
        parameters.
      </p>

      {errorBanner ? (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: "8px 10px",
            borderRadius: 6,
            fontSize: 12,
            background: "#FEE2E2",
            color: "#991B1B",
          }}
        >
          {errorBanner}
        </div>
      ) : null}

      <div style={{ marginBottom: 10 }}>
        <div style={fl}>Title</div>
        <input
          style={inp}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameDirty(true);
          }}
          placeholder="Page title or your label"
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={fl}>Description</div>
        <textarea
          style={{ ...ta, minHeight: 88 }}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setDescriptionDirty(true);
          }}
          placeholder="Optional notes or selected text"
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={fl}>Source URL</div>
        <input
          style={inp}
          value={sourceUrl}
          onChange={(e) => {
            setSourceUrl(e.target.value);
            setSourceUrlDirty(true);
          }}
          placeholder="https://…"
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={fl}>Subtype</div>
        <select style={sel} value={subtype} onChange={(e) => setSubtype(normalizeSubtypeId(e.target.value))}>
          {INPUT_SUBTYPE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={fl}>Project</div>
        <select style={sel} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Inbox (default)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" style={{ ...btnP, width: "100%", opacity: saving ? 0.65 : 1 }} disabled={saving} onClick={() => void submit()}>
          {saving ? "Saving…" : "Save to Future Signals"}
        </button>
        <button type="button" style={{ ...btnSec, width: "100%" }} onClick={() => void reloadFromTab()}>
          Reload from active tab
        </button>
        {reloadStatus && (
          <div style={{ fontSize: 11, color: c.muted, textAlign: "center", marginTop: -2 }}>
            {RELOAD_STATUS_COPY[reloadStatus]}
          </div>
        )}
      </div>
    </div>
  );
}

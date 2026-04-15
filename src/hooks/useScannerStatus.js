import { useState, useEffect, useMemo } from 'react';

/**
 * Three-state scanner banner logic:
 *
 *   'scanning' — project was created < 2 min ago and no candidates have
 *                surfaced yet.  Shows spinner.  Only fires on project creation,
 *                never on a nightly cron wakeup.
 *
 *   'found'    — unreviewed scanner candidates exist AND either the banner was
 *                never dismissed or newer candidates arrived after dismissal.
 *                Static — no spinner.
 *
 *   'idle'     — no banner.
 *
 * Dismissal is persisted to localStorage so it survives navigation and refresh.
 * If the nightly scan delivers fresh candidates after dismissal, the banner
 * reappears automatically.
 *
 * @param {object|null} project  — the active project object (needs id, created_at)
 * @param {Array}       inputs   — full inputs array from appState
 */

const SCAN_WINDOW_MS = 120_000; // 2 minutes

const dismissedKey = (id) => `fs_banner_dismissed_${id}`;

function readDismissedAt(projectId) {
  try { return localStorage.getItem(dismissedKey(projectId)) || null; }
  catch { return null; }
}

export function useScannerStatus(project, inputs) {
  const projectId = project?.id ?? null;

  // Initialise from localStorage; re-read whenever the active project changes.
  const [dismissedAt, setDismissedAt] = useState(() =>
    projectId ? readDismissedAt(projectId) : null
  );

  useEffect(() => {
    setDismissedAt(projectId ? readDismissedAt(projectId) : null);
  }, [projectId]);

  // Unactioned = in Inbox, from scanner, suggested for this project, not dismissed
  const { unactionedCount, newestCandidateAt } = useMemo(() => {
    if (!projectId) return { unactionedCount: 0, newestCandidateAt: null };
    const candidates = inputs.filter((i) =>
      i.is_seeded &&
      i.metadata?.source === 'scanner' &&
      i.metadata?.suggested_projects?.some((p) => p.id === projectId) &&
      i.project_id === null &&
      !i.metadata?.dismissed
    );
    const newestAt = candidates.reduce(
      (max, i) => (i.created_at > max ? i.created_at : max),
      ''
    );
    return { unactionedCount: candidates.length, newestCandidateAt: newestAt || null };
  }, [inputs, projectId]);

  // Re-show after dismissal if newer candidates have arrived since.
  const hasNewSinceDismissal = !!(
    dismissedAt && newestCandidateAt && newestCandidateAt > dismissedAt
  );

  const showFound = unactionedCount > 0 && (!dismissedAt || hasNewSinceDismissal);

  // Spinner only for genuinely in-flight scans — project created < 2 min ago
  // with no candidates yet.  A nightly cron will never trigger this because
  // the project will be hours/days old by then.
  const isRecentlyCreated = project?.created_at
    ? Date.now() - new Date(project.created_at).getTime() < SCAN_WINDOW_MS
    : false;

  const showScanning =
    !showFound && unactionedCount === 0 && isRecentlyCreated && !dismissedAt;

  let status;
  if (showFound)       status = 'found';
  else if (showScanning) status = 'scanning';
  else                 status = 'idle';

  const dismiss = () => {
    if (!projectId) return;
    const ts = new Date().toISOString();
    try { localStorage.setItem(dismissedKey(projectId), ts); } catch { /* ignore */ }
    setDismissedAt(ts);
  };

  return { status, foundCount: unactionedCount, dismiss };
}

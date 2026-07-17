// Orchestration for the three Publish entry points. Pure/injectable (takes the
// API calls as deps) so the critical "omit vs resend the selection" distinction
// is unit-testable without a DOM. PublishSection.jsx supplies getStatus/postPublish
// closures that wrap the authed fetch.
//
// The backend treats an OMITTED selection as "publish everything". That's only
// correct for a true first publish — Republish must resend the last curated
// selection, never omit it (which would silently reset to everything).

/** First-ever publish: omit the selection → backend defaults to everything. */
export function doFirstPublish({ postPublish }) {
  return postPublish(); // no argument → selection omitted from the POST body
}

/**
 * Republish: fetch the current sections_included and resend it verbatim. Never
 * omits the selection, so a curated publish isn't reset to everything.
 */
export async function doRepublish({ getStatus, postPublish }) {
  const status = await getStatus();
  return postPublish(status?.sectionsIncluded ?? null); // present (not omitted), even if null
}

/** Customize: publish exactly the selection the modal constructed. */
export function doCustomize({ postPublish, selection }) {
  return postPublish(selection);
}

/**
 * scannerSuggestionGroups — how the Scan screen's Scanner Suggestions tab
 * groups scanner-promoted inputs for the active project.
 *
 * The `classification` on metadata.suggested_projects[] is set once by
 * api/score.js at scoring time: `reinforcing` = similar to the project's
 * INPUTS at that moment (avg embedding similarity >= 0.3), `emerging` =
 * relevant but unlike them. It is not a comparison against clusters, and it is
 * never recomputed — so on a project with only a handful of inputs the split
 * is driven by those few items and isn't meaningful. Below
 * MIN_INPUTS_FOR_GROUPING we show one ungrouped list instead.
 */

export const MIN_INPUTS_FOR_GROUPING = 5;

/** The active project's classification for a scanner input, or undefined. */
export function suggestionClassification(input, projectId) {
  return (input?.metadata?.suggested_projects || []).find((p) => p.id === projectId)?.classification;
}

/**
 * @param {object[]} suggestions        already filtered/sorted scanner inputs for this project
 * @param {string}   projectId
 * @param {number}   projectInputCount  inputs currently in the project
 * @returns {{ grouped: boolean, emerging: object[], reinforcing: object[], other: object[] }}
 *   When `grouped` is false, every suggestion is in `other` (render as one list).
 *   When true, `other` holds any suggestion without a known classification, so
 *   nothing is ever dropped from the list.
 */
export function groupScannerSuggestions(suggestions, projectId, projectInputCount) {
  const list = suggestions || [];
  if ((projectInputCount ?? 0) < MIN_INPUTS_FOR_GROUPING) {
    return { grouped: false, emerging: [], reinforcing: [], other: list };
  }
  const emerging = [], reinforcing = [], other = [];
  for (const s of list) {
    const cls = suggestionClassification(s, projectId);
    if (cls === "emerging") emerging.push(s);
    else if (cls === "reinforcing") reinforcing.push(s);
    else other.push(s);
  }
  return { grouped: true, emerging, reinforcing, other };
}

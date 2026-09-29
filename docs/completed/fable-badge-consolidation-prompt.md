# Fable Prompt — Badge/Chip Consolidation Work Plan

## Context to give Fable

A badge/chip audit across the workspace-refactor branch found:

- One real shared primitive exists: `src/components/shared/Tag.jsx`, rendering `Tag`,
  `StrengthDot`, `HorizTag`, `ArchTag`, `SubtypeTag`, `ConfidenceBadge`. Spec: font-size
  10px, padding 2px 7px, border-radius 10px, 1px solid border, no font-weight.
- Root cause of most drift: `StrengthDot`/`ConfidenceBadge` expect Title-Case keys
  (`Weak`/`Moderate`/`High`), but the actual database fields (`signal_strength`,
  `source_confidence`) are lowercase (`weak`/`moderate`/`high`, `low`/`medium`/`high`).
  Because of this mismatch, every screen displaying real data reimplements its own inline
  badge instead of using the shared component.
- Signal Strength currently has two contradictory color scales live in production
  simultaneously (shared component vs. inline copies across Inbox/ProjectDetail/
  Dashboard/ClusterScreen).
- Cluster Subtype's "Driver" is cyan in the shared component but blue in
  `ScenarioCanvas.jsx`'s local version — colliding with the H2 horizon tint.
- STEEPLED tags have at least 4 distinct visual treatments (radius 4 and radius 8,
  differing padding/border even within the same radius).
- Several fields render as plain text in some tables and as badges in others for the
  same data (System Map relationships table; Inbox's main table row vs. its own card
  view; ProjectDetail's AI-suggested table vs. its main Inputs table).
- A separate, lower-priority family of count/number badges (unread counts, "N
  available," filter-tab counts) also varies in radius and padding but is visually
  adjacent, not part of the core categorical-badge fix.

## Decisions already locked — do not re-derive these

- **Canonical badge shape:** radius 10px, padding 2px 7px, border 1px solid, font-size
  10px — matching the existing `Tag.jsx` primitive. This becomes the standard every
  other badge instance converts to.
- **Badges, not plain text**, is the standard treatment for Horizon, Likelihood, and
  similar categorical values in every table, including the System Map relationships
  table.
- **Signal Strength color scale:**
  - Weak — background `#EFE1DC`, text `#A05F4E`
  - Moderate — background `#EFE6D3`, text `#9C7A3C`
  - High — background `#DEE6D6`, text `#5C7A52`
- **Source Confidence** uses the identical scale and values as Signal Strength,
  intentionally — the two fields are meant to look related.
- **Cluster Subtype color scale:**
  - Trend — background `#E6E1EA`, text `#6B5B7E` (dusty violet)
  - Driver — background `#DCE6E4`, text `#4E7A73` (muted teal)
  - Tension — background `#EAE0E1`, text `#8A5560` (dusty rose)

## Prompt to give Fable

```
Draft a phased implementation work plan for consolidating badge/chip styling across
the app, based on the completed badge audit (shared Tag.jsx primitive, the
Title-Case/lowercase key mismatch, the two conflicting Signal Strength scales, the
Subtype color collision with H2, the STEEPLED variants, and the plain-text-vs-badge
table inconsistencies) and the decisions already locked since:

- Canonical badge shape: radius 10px, padding 2px 7px, 1px solid border, 10px font —
  matching the existing Tag.jsx component.
- Signal Strength scale: Weak #EFE1DC/#A05F4E, Moderate #EFE6D3/#9C7A3C, High
  #DEE6D6/#5C7A52.
- Source Confidence uses the identical scale and values as Signal Strength.
- Subtype scale: Trend #E6E1EA/#6B5B7E, Driver #DCE6E4/#4E7A73, Tension
  #EAE0E1/#8A5560.
- Badges (not plain text) are the standard for all categorical table values.

This plan needs to be executable by a different model, at a different point in time,
with no memory of this conversation. Every phase must be self-contained: reference
exact file paths, functions, and line numbers from the completed audit rather than
describing things abstractly. Each phase should be independently completable and
testable on its own, with explicit dependencies on prior phases stated up front.

Structure as:

1. Root-cause fix — correct the Title-Case/lowercase key mismatch in Tag.jsx's
   StrengthDot and ConfidenceBadge so the shared component can actually receive real
   signal_strength/source_confidence data. This unblocks every later phase that
   migrates an inline badge onto the shared component.

2. Color-scale migration — apply the locked Signal Strength, Source Confidence, and
   Subtype color values to the shared component and every inline instance found in
   the audit, retiring the conflicting scales.

3. Shape normalization — migrate every inline badge/chip instance to the canonical
   radius/padding/border spec, grouped by field type (Signal Strength, Source
   Confidence, STEEPLED, Subtype, Archetype, Likelihood) so each sub-phase is
   independently shippable.

4. Plain-text-to-badge conversion — convert the specific table cells identified in
   the audit (System Map relationships table's Relationship Type and Confidence
   columns, the Clusters sub-table's Horizon and Likelihood columns, Inbox's main
   table row, ProjectDetail's AI-suggested table's STEEPLED column) to use the
   now-consolidated badge component.

5. Count-badge family — lowest priority. Normalize the separate family of
   count/number badges (unread counts, "N available," filter-tab counts) to one
   consistent radius/padding, flagged as optional/deferred if time-constrained.

For each phase, write it as a ready-to-use Claude Code prompt following the
one-concern-per-prompt, explicit-do-not-touch-list convention already in use on this
project, so it can be handed off directly when the time comes. Flag any point where a
phase's scope depends on a judgment call not yet made, rather than guessing.
```

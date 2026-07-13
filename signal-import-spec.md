# Signal Import — Feature Spec

## Overview

Users can bulk-import inputs into a project via CSV upload. Import is project-scoped: the user initiates the flow from within a specific project, so all imported inputs land in that project automatically. No project column is needed.

---

## CSV Template

### Fields

| Column | Required | Accepted Values |
|---|---|---|
| `title` | **Yes** | Any non-empty string |
| `type` | No | `Signal`, `Issue`, `Trend`, `Development`, `Data Point` (match existing Input types) |
| `description` | No | Any string |
| `source_url` | No | Any string (URL format not enforced on import) |
| `steepled` | No | One or more of: `Soc`, `Tech`, `Eco`, `Env`, `Pol`, `Leg`, `Eth`, `Dem` — comma-separated within the cell, up to 8 |
| `signal_quality` | No | `Emerging`, `Established`, `Confirmed` |
| `time_horizon` | No | `H1`, `H2`, `H3` |

### Template notes
- Header row is required and must match column names exactly (case-insensitive)
- Column order does not matter
- Extra/unknown columns are silently ignored
- The downloadable template includes a header row and one example row that is clearly marked as an example (e.g. prefixed with `#EXAMPLE` or provided as a separate "instructions" sheet if format allows)

---

## UI Flow

1. User navigates to a project → Inputs screen
2. "Import CSV" button appears alongside existing "Add an input" controls
3. Clicking opens an import modal with two actions:
   - **Download template** — downloads `future-signals-import-template.csv` pre-populated with the correct headers and one example row
   - **Upload CSV** — file picker, accepts `.csv` only
4. On upload, the file is parsed client-side and a **preview table** is shown before committing:
   - Displays the first 5 rows (or all rows if fewer than 5)
   - Row count shown: "X inputs ready to import"
   - Validation errors flagged inline (see below)
5. User confirms → inputs are written to the database and assigned to the current project
6. Modal closes; Inputs list refreshes with a success toast: "X inputs imported"

---

## Validation

### Hard errors (block import)
- No `title` column present in the file
- File is empty (header only, no data rows)
- File is not valid CSV

### Row-level errors (skip row, continue import)
- `title` is empty or whitespace-only → row skipped
- All other field errors (unrecognized values) → field left blank, row still imports

### Unrecognized values — handling
| Field | Unrecognized value behavior |
|---|---|
| `type` | Import as blank; do not attempt to map |
| `steepled` | Drop unrecognized categories; retain any valid ones in the same cell |
| `signal_quality` | Import as blank |
| `time_horizon` | Import as blank |

### Pre-import error summary
If any rows have errors, the preview state shows a warning: "X rows will be skipped (missing title)" with the option to proceed or cancel. No partial-row silencing — the user sees exactly what will and won't import before confirming.

---

## Duplicate Handling

- No duplicate detection in v1 — the same row can be imported multiple times
- A note in the UI ("Duplicate check not performed — review your file before importing") sets expectations
- Deduplication logic (by title + source URL match) is a candidate for a later iteration

---

## Error States

| Scenario | Behavior |
|---|---|
| Wrong file type | "Please upload a .csv file" — file rejected immediately |
| File too large (>5MB) | "File exceeds the 5MB limit" — file rejected |
| All rows skipped (no valid titles) | "No valid inputs found. Check that your Title column is populated." — import blocked |
| Network/DB error on write | Toast error: "Import failed. Please try again." — no partial writes |

---

## Out of Scope (v1)

- Cross-project import
- Duplicate detection
- Import history / undo
- `.xlsx` support
- Mapping wizard for non-standard column names
- Import via URL (Google Sheets, etc.)

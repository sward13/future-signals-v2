/**
 * CsvImportModal — bulk-import inputs from a CSV file into the current project.
 *
 * Flow: idle → (file selected) → preview → (confirm) → importing → done (modal closes)
 *
 * @param {{ open: boolean, onClose: () => void, projectId: string, addInput: (fields: object) => void, showToast: (msg: string, type?: string) => void }} props
 */
import { useRef, useState } from "react";
import { c, btnP, btnSec, inp } from "../../styles/tokens.js";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const VALID_SUBTYPES   = new Set(["signal", "issue", "projection", "plan", "obstacle", "source"]);
const VALID_STRENGTHS  = new Set(["weak", "moderate", "strong"]);
const VALID_CONFIDENCES = new Set(["low", "moderate", "high"]);
const VALID_HORIZONS   = new Set(["H1", "H2", "H3"]);

const STEEPLED_MAP = {
  soc: "Social", tech: "Technological", eco: "Economic",  env: "Environmental",
  pol: "Political", leg: "Legal",       eth: "Ethical",   dem: "Demographic",
};
const STEEPLED_FULL = new Set(Object.values(STEEPLED_MAP));

// ─── CSV utilities ─────────────────────────────────────────────────────────────

/** Parse a single CSV row respecting RFC 4180 quoted fields. */
function parseCsvRow(line) {
  const fields = [];
  let field    = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;                              // closing quote
      } else {
        field += ch;
      }
    } else {
      if      (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(field); field = ""; }
      else                 { field += ch; }
    }
  }
  fields.push(field);
  return fields;
}

/** Parse full CSV text into an array of row arrays. Skips blank lines. */
function parseCsvText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(parseCsvRow);
}

// ─── Field parsers ─────────────────────────────────────────────────────────────

function parseSubtype(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return VALID_SUBTYPES.has(lower) ? lower : null;
}

function parseSignalStrength(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return VALID_STRENGTHS.has(lower) ? lower.charAt(0).toUpperCase() + lower.slice(1) : null;
}

function parseSourceConfidence(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return VALID_CONFIDENCES.has(lower) ? lower.charAt(0).toUpperCase() + lower.slice(1) : null;
}

function parseDate(raw) {
  if (!raw || !raw.trim()) return null;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseHorizon(raw) {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  return VALID_HORIZONS.has(upper) ? upper : null;
}

function parseSteepled(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .map((s) => {
      if (STEEPLED_FULL.has(s)) return s;
      return STEEPLED_MAP[s.toLowerCase()] ?? null;
    })
    .filter(Boolean);
}

// ─── Full file parse → [{input fields}] ───────────────────────────────────────

/**
 * Parse CSV text into validated input objects.
 * Returns { rows, skipped, error } where:
 *   error  — hard-block reason (string) or null
 *   rows   — array of valid input field objects ready for addInput
 *   skipped — count of rows dropped (empty/example titles)
 */
function parseImportFile(text) {
  let allRows;
  try {
    allRows = parseCsvText(text);
  } catch {
    return { error: "Could not parse this file. Please check it is a valid CSV.", rows: [], skipped: 0 };
  }

  if (allRows.length === 0) {
    return { error: "The file is empty.", rows: [], skipped: 0 };
  }

  const headerRow = allRows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = headerRow.indexOf("name");

  if (nameIdx === -1) {
    return { error: "No Name column found. Please include a column named \"Name\".", rows: [], skipped: 0 };
  }

  const col = (name) => headerRow.indexOf(name);

  const dataRows = allRows.slice(1);
  if (dataRows.length === 0) {
    return { error: "The file has no data rows — only a header was found.", rows: [], skipped: 0 };
  }

  const rows = [];
  let skipped = 0;

  for (const fields of dataRows) {
    const name = (fields[nameIdx] ?? "").trim();

    // Skip blank names and example/comment rows (prefixed with #)
    if (!name || name.startsWith("#")) {
      skipped++;
      continue;
    }

    const rawDate = fields[col("date added")] ?? "";
    const parsedDate = parseDate(rawDate);

    rows.push({
      name,
      subtype:          parseSubtype(fields[col("subtype")] ?? ""),
      description:      (fields[col("description")] ?? "").trim(),
      source_url:       (fields[col("source url")]  ?? "").trim(),
      steepled:         parseSteepled(fields[col("steepled")] ?? ""),
      signal_strength:  parseSignalStrength(fields[col("signal strength")] ?? ""),
      source_confidence: parseSourceConfidence(fields[col("source confidence")] ?? ""),
      horizon:          parseHorizon(fields[col("horizon")] ?? ""),
      ...(parsedDate ? { created_at: parsedDate } : {}),
    });
  }

  if (rows.length === 0) {
    return { error: "No valid inputs found. Check that your Name column is populated.", rows: [], skipped };
  }

  return { error: null, rows, skipped };
}

// ─── Template download ─────────────────────────────────────────────────────────

function downloadTemplate() {
  const header  = "Name,Subtype,Description,Source URL,STEEPLED,Horizon,Signal Strength,Source Confidence,Date Added";
  const example = [
    '"#EXAMPLE - Replace this row with your data"',
    "Signal",
    '"A brief description of what this signal is about"',
    "https://example.com/article",
    '"Soc,Tech"',
    "H1",
    "",
    "",
    "4/14/2026",
  ].join(",");
  const csv  = header + "\n" + example + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "future-signals-import-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Modal component ───────────────────────────────────────────────────────────

export function CsvImportModal({ open, onClose, projectId, addInput, showToast }) {
  const fileInputRef = useRef(null);
  const [step,        setStep]        = useState("idle");    // idle | preview | importing
  const [fileError,   setFileError]   = useState(null);
  const [parsedRows,  setParsedRows]  = useState([]);
  const [skipped,     setSkipped]     = useState(0);
  const [fileName,    setFileName]    = useState("");

  const reset = () => {
    setStep("idle");
    setFileError(null);
    setParsedRows([]);
    setSkipped(0);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Please upload a .csv file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File exceeds the 5 MB limit.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const { error, rows, skipped: sk } = parseImportFile(ev.target.result);
      if (error) {
        setFileError(error);
        setStep("idle");
      } else {
        setParsedRows(rows);
        setSkipped(sk);
        setStep("preview");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setStep("importing");
    try {
      parsedRows.forEach((row) => addInput({ ...row, project_id: projectId }));
      showToast(`${parsedRows.length} input${parsedRows.length !== 1 ? "s" : ""} imported`);
      handleClose();
    } catch {
      showToast("Import failed. Please try again.", "error");
      setStep("preview");
    }
  };

  if (!open) return null;

  const previewRows = parsedRows.slice(0, 5);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)", zIndex: 400 }}
      />

      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 401,
          width: "100%",
          maxWidth: 560,
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          background: c.white,
          borderRadius: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.ink }}>Import inputs</div>
          <button
            onClick={handleClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: c.hint, lineHeight: 1, padding: "0 2px", fontFamily: "inherit" }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 20px 24px", overflowY: "auto", flex: 1 }}>

          {step === "idle" && (
            <>
              {/* Step 1 — template */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: c.hint, letterSpacing: "0.06em", marginBottom: 8 }}>
                  Step 1 — Download template
                </div>
                <button
                  onClick={downloadTemplate}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "9px 14px", borderRadius: 7,
                    border: `1px solid ${c.borderStrong}`,
                    background: c.surfaceAlt, color: c.ink,
                    fontSize: 12, fontWeight: 500,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span>↓</span> Download template CSV
                </button>
                <div style={{ fontSize: 11, color: c.hint, marginTop: 6, lineHeight: 1.5 }}>
                  Includes all required columns and one example row. Delete the example row before uploading.
                </div>
              </div>

              {/* Step 2 — upload */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: c.hint, letterSpacing: "0.06em", marginBottom: 8 }}>
                  Step 2 — Upload your file
                </div>

                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "24px 20px",
                  border: `2px dashed ${fileError ? c.redBorder : c.borderStrong}`,
                  borderRadius: 8,
                  background: fileError ? c.red50 : c.surfaceAlt,
                  cursor: "pointer",
                  gap: 8,
                  flexDirection: "column",
                  transition: "border-color 0.15s",
                }}>
                  <span style={{ fontSize: 22 }}>📄</span>
                  <span style={{ fontSize: 13, color: c.muted }}>
                    {fileName ? fileName : "Choose a .csv file"}
                  </span>
                  <span style={{ fontSize: 11, color: c.hint }}>Max 5 MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </label>

                {fileError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: c.red800, padding: "8px 10px", background: c.red50, border: `1px solid ${c.redBorder}`, borderRadius: 6 }}>
                    {fileError}
                  </div>
                )}
              </div>
            </>
          )}

          {(step === "preview" || step === "importing") && (
            <>
              {/* Summary */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: c.ink, marginBottom: 4 }}>
                  {parsedRows.length} input{parsedRows.length !== 1 ? "s" : ""} ready to import
                  {skipped > 0 && (
                    <span style={{ fontWeight: 400, fontSize: 12, color: c.amber700, marginLeft: 10 }}>
                      · {skipped} row{skipped !== 1 ? "s" : ""} skipped (missing name)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: c.hint }}>
                  Duplicate check not performed — review your file before importing.
                </div>
              </div>

              {/* Preview table */}
              <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: c.surfaceAlt, borderBottom: `1px solid ${c.border}` }}>
                  {["Name", "Subtype", "Signal Strength", "Horizon"].map((h) => (
                    <div key={h} style={{ padding: "7px 10px", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: c.hint }}>
                      {h}
                    </div>
                  ))}
                </div>
                {/* Data rows */}
                {previewRows.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderTop: i > 0 ? `1px solid ${c.border}` : undefined }}>
                    <div style={{ padding: "8px 10px", fontSize: 12, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.name}
                    </div>
                    <div style={{ padding: "8px 10px", fontSize: 11, color: c.muted }}>
                      {row.subtype ? row.subtype.charAt(0).toUpperCase() + row.subtype.slice(1) : <span style={{ color: c.hint }}>—</span>}
                    </div>
                    <div style={{ padding: "8px 10px", fontSize: 11, color: c.muted }}>
                      {row.signal_strength ?? <span style={{ color: c.hint }}>—</span>}
                    </div>
                    <div style={{ padding: "8px 10px", fontSize: 11, color: c.muted }}>
                      {row.horizon ?? <span style={{ color: c.hint }}>—</span>}
                    </div>
                  </div>
                ))}
                {parsedRows.length > 5 && (
                  <div style={{ padding: "7px 10px", borderTop: `1px solid ${c.border}`, fontSize: 11, color: c.hint, background: c.surfaceAlt }}>
                    + {parsedRows.length - 5} more row{parsedRows.length - 5 !== 1 ? "s" : ""} not shown
                  </div>
                )}
              </div>

              {/* From filename */}
              <div style={{ fontSize: 11, color: c.hint, marginBottom: 2 }}>
                File: {fileName}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px",
          borderTop: `1px solid ${c.border}`,
          flexShrink: 0,
          gap: 10,
        }}>
          {step === "idle" && (
            <>
              <div />
              <button onClick={handleClose} style={btnSec}>Cancel</button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => { reset(); }}
                style={{ ...btnSec, fontSize: 12 }}
              >
                ← Choose different file
              </button>
              <button
                onClick={handleImport}
                style={{ ...btnP, fontSize: 13 }}
              >
                Import {parsedRows.length} input{parsedRows.length !== 1 ? "s" : ""} →
              </button>
            </>
          )}

          {step === "importing" && (
            <>
              <div />
              <button disabled style={{ ...btnP, opacity: 0.65, fontSize: 13 }}>
                Importing…
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

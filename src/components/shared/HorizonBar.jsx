import { c } from "../../styles/tokens.js";

/**
 * Proportional three-band H1/H2/H3 time horizon bar.
 * Requires project.h1_start, h1_end, h2_start, h2_end, h3_start, h3_end.
 * Render nothing when h1_start is absent (horizons not configured).
 */
export function HorizonBar({ project }) {
  const start = parseInt(project.h1_start, 10) || 2025;
  const end = parseInt(project.h3_end, 10) || 2040;
  const h1End = parseInt(project.h1_end, 10) || start + 3;
  const h2End = parseInt(project.h2_end, 10) || h1End + 5;
  const span = end - start || 15;

  const h1Pct = ((h1End - start) / span) * 100;
  const h2Pct = ((h2End - start) / span) * 100;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ position: "relative", height: 46, borderRadius: 8, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: `${h1Pct}%`, height: "100%",
          background: c.green50, borderRight: `2px solid ${c.white}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.green700, lineHeight: 1 }}>H1</span>
          <span style={{ fontSize: 10, color: c.green700, lineHeight: 1 }}>{project.h1_start}–{project.h1_end}</span>
        </div>
        <div style={{
          position: "absolute", left: `${h1Pct}%`, top: 0,
          width: `${h2Pct - h1Pct}%`, height: "100%",
          background: c.blue50, borderRight: `2px solid ${c.white}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.blue700, lineHeight: 1 }}>H2</span>
          <span style={{ fontSize: 10, color: c.blue700, lineHeight: 1 }}>{project.h2_start}–{project.h2_end}</span>
        </div>
        <div style={{
          position: "absolute", left: `${h2Pct}%`, top: 0, right: 0, height: "100%",
          background: c.amber50,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: c.amber700, lineHeight: 1 }}>H3</span>
          <span style={{ fontSize: 10, color: c.amber700, lineHeight: 1 }}>{project.h3_start}–{project.h3_end}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Proportional three-band H1/H2/H3 time horizon bar.
 * Requires project.h1_start, h1_end, h2_start, h2_end, h3_start, h3_end.
 * Render nothing when h1_start is absent (horizons not configured).
 * Consumer is responsible for wrapping in a card and providing bottom margin.
 */
export function HorizonBar({ project }) {
  const start = parseInt(project.h1_start, 10) || 2025;
  const end   = parseInt(project.h3_end, 10)   || 2040;
  const h1End = parseInt(project.h1_end, 10)   || start + 3;
  const h2End = parseInt(project.h2_end, 10)   || h1End + 5;
  const span  = end - start || 15;

  const h1Pct = ((h1End - start) / span) * 100;
  const h2Pct = ((h2End - start) / span) * 100;

  return (
    <div className="flex rounded-container overflow-hidden border border-border">

      <div
        className="flex flex-col items-center justify-center py-3 px-4 bg-green-50 shrink-0"
        style={{ width: `${h1Pct}%` }}
      >
        <span className="text-[14px] font-semibold text-green-700 leading-none">H1</span>
        <span className="text-xs text-green-700 leading-none mt-1">{project.h1_start}–{project.h1_end}</span>
      </div>

      <div
        className="flex flex-col items-center justify-center py-3 px-4 bg-blue-50 shrink-0"
        style={{ width: `${h2Pct - h1Pct}%` }}
      >
        <span className="text-[14px] font-semibold text-blue-700 leading-none">H2</span>
        <span className="text-xs text-blue-700 leading-none mt-1">{project.h2_start}–{project.h2_end}</span>
      </div>

      <div className="flex flex-col items-center justify-center py-3 px-4 bg-amber-50 flex-1">
        <span className="text-[14px] font-semibold text-amber-700 leading-none">H3</span>
        <span className="text-xs text-amber-700 leading-none mt-1">{project.h3_start}–{project.h3_end}</span>
      </div>

    </div>
  );
}

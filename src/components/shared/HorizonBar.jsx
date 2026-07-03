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
    <div className="mb-3">
      <div className="relative h-[46px] rounded-container overflow-hidden">

        {/* H1 band — width is runtime-computed, must stay inline */}
        <div
          className="absolute left-0 top-0 h-full bg-green-50 border-r-2 border-white flex flex-col items-center justify-center gap-0.5"
          style={{ width: `${h1Pct}%` }}
        >
          <span className="text-[11px] font-semibold text-green-700 leading-none">H1</span>
          <span className="text-[10px] text-green-700 leading-none">{project.h1_start}–{project.h1_end}</span>
        </div>

        {/* H2 band — left and width are runtime-computed */}
        <div
          className="absolute top-0 h-full bg-blue-50 border-r-2 border-white flex flex-col items-center justify-center gap-0.5"
          style={{ left: `${h1Pct}%`, width: `${h2Pct - h1Pct}%` }}
        >
          <span className="text-[11px] font-semibold text-blue-700 leading-none">H2</span>
          <span className="text-[10px] text-blue-700 leading-none">{project.h2_start}–{project.h2_end}</span>
        </div>

        {/* H3 band — left is runtime-computed; right-0 fills the remainder */}
        <div
          className="absolute top-0 right-0 h-full bg-amber-50 flex flex-col items-center justify-center gap-0.5"
          style={{ left: `${h2Pct}%` }}
        >
          <span className="text-[11px] font-semibold text-amber-700 leading-none">H3</span>
          <span className="text-[10px] text-amber-700 leading-none">{project.h3_start}–{project.h3_end}</span>
        </div>

      </div>
    </div>
  );
}

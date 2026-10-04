import { DAY_NAMES } from "@/lib/constants";

export function RunDays({ mask }: { mask: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label="Running days">
      {DAY_NAMES.map((d, i) => {
        const on = (mask & (1 << i)) !== 0;
        return (
          <span
            key={d}
            title={`${d}: ${on ? "runs" : "doesn't run"}`}
            className={`w-4 text-center text-[10px] font-semibold ${on ? "text-brand" : "text-slate-300"}`}
          >
            {d[0]}
          </span>
        );
      })}
    </span>
  );
}

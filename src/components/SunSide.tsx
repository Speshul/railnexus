import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import type { SunReport, SunState } from "@/lib/sun";
import { formatDuration } from "@/lib/dates";
import type { T } from "@/i18n/core";

const clockIST = (ms: number, locale: string) =>
  new Date(ms).toLocaleTimeString(locale === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Colour of each window row for a given sun state. The text above always says the same thing in words.
const ROW: Record<"left" | "right", Record<SunState, string>> = {
  left: { night: "bg-slate-700", left: "bg-amber-400", right: "bg-sky-100", ahead: "bg-amber-100" },
  right: { night: "bg-slate-700", left: "bg-sky-100", right: "bg-amber-400", ahead: "bg-amber-100" },
};

/** "Which side gets the sun?" card (compact: no heading or footnote, for embedding under the caller's own title): advice in words, sunrise/sunset moments, and a two-row timeline (left/right windows). */
export function SunSide({ report, t, compact = false }: { report: SunReport; t: T; compact?: boolean }) {
  const L = t.locale;
  const { minutes, shade } = report;
  const sunny = minutes.left + minutes.right + minutes.ahead;
  const total = report.end - report.start;
  const dur = (m: number) => formatDuration(Math.round(m), L);

  let headline: string;
  if (shade) headline = t(shade === "left" ? "sun.shadeLeft" : "sun.shadeRight");
  else if (sunny < 20) headline = t("sun.night");
  else headline = t("sun.even");

  return (
    <section className={compact ? "" : "card p-4"} aria-label={t("sun.title")}>
      {!compact && (
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Sun className="size-4 text-amber-500" aria-hidden /> {t("sun.title")}
        </h2>
      )}
      <p className="font-medium text-slate-900">{headline}</p>
      {sunny >= 20 && (
        <p className="text-sm text-slate-600">{t("sun.summary", { left: dur(minutes.left), right: dur(minutes.right) })}</p>
      )}
      {report.events.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {report.events.map((e) => (
            <li key={e.t} className="flex items-start gap-2">
              {e.kind === "sunrise" ? <Sunrise className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden /> : <Sunset className="mt-0.5 size-4 shrink-0 text-orange-700" aria-hidden />}
              <span>
                {t(e.kind === "sunrise" ? "sun.sunrise" : "sun.sunset", { time: clockIST(e.t, L), station: e.near })}{" "}
                {e.side !== "ahead" && <b>{t(e.side === "left" ? "sun.viewLeft" : "sun.viewRight")}</b>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3" aria-hidden>
        {(["left", "right"] as const).map((row) => (
          <div key={row} className="mb-1 flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs text-slate-600">{t(row === "left" ? "sun.rowLeft" : "sun.rowRight")}</span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
              {report.bands.map((b) => (
                <div key={b.from} className={`absolute inset-y-0 ${ROW[row][b.state]}`}
                  style={{ left: `${((b.from - report.start) / total) * 100}%`, width: `${((b.to - b.from) / total) * 100}%` }} />
              ))}
            </div>
          </div>
        ))}
        <div className="ml-10 flex justify-between text-xs text-slate-500">
          <span>{clockIST(report.start, L)}</span>
          <span>{clockIST(report.end, L)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-amber-400" /> {t("sun.legendSun")}</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-amber-100" /> {t("sun.legendAhead")}</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-sky-100" /> {t("sun.legendShade")}</span>
          <span className="flex items-center gap-1"><Moon className="size-3 text-slate-700" /> {t("sun.legendNight")}</span>
        </div>
      </div>
      {!compact && <p className="mt-2 text-xs text-slate-500">{t("sun.note")}</p>}
    </section>
  );
}

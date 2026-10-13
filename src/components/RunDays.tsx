"use client";
import { DAY_NAMES } from "@/lib/constants";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";

export function RunDays({ mask }: { mask: number }) {
  const t = useT();
  const on = (i: number) => (mask & (1 << i)) !== 0;
  const running = DAY_NAMES.map((_, i) => i).filter(on).map((i) => t(`day.${i}` as MessageKey));
  return (
    <span className="inline-flex gap-1 font-sign leading-tight">
      {/* Letters are visual only; screen readers get the running days spelled out. */}
      <span className="sr-only">{t("days.label")}: {running.length === 7 ? t("days.daily") : running.join(", ")}</span>
      {DAY_NAMES.map((d, i) => (
        <span
          key={d}
          aria-hidden
          title={`${t(`day.${i}` as MessageKey)}: ${on(i) ? t("days.runs") : t("days.notRuns")}`}
          className={`min-w-4 text-center text-[1.1rem] ${on(i) ? "font-bold text-brand" : "text-slate-500 line-through"}`}
        >
          {t(`dayLetter.${i}` as MessageKey)}
        </span>
      ))}
    </span>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import type { Stop } from "@/lib/rail";
import { useT } from "@/i18n/client";

export function ScheduleTable({ stops, segment }: { stops: Stop[]; segment: { from: number; to: number } | null }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? stops : stops.filter((s) => s.halt);
  let haltNo = 0;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="font-sign text-[1.6rem] uppercase leading-none tracking-[0.03em] text-brand">{t("sched.title")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          {t("sched.showAll", { n: stops.length - stops.filter((s) => s.halt).length })}
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("sched.caption")}</caption>
          <thead className="bg-slate-50 text-left text-sm uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{t("sched.station")}</th>
              <th className="px-3 py-2">{t("sched.arr")}</th>
              <th className="px-3 py-2">{t("sched.dep")}</th>
              <th className="px-3 py-2">{t("sched.halt")}</th>
              <th className="px-3 py-2">{t("sched.day")}</th>
              <th className="px-3 py-2 text-right">{t("sched.km")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              if (s.halt) haltNo++;
              const inSeg = segment && s.seq >= segment.from && s.seq <= segment.to;
              const isEnd = segment && (s.seq === segment.from || s.seq === segment.to);
              return (
                <tr
                  key={s.seq}
                  className={`border-t border-slate-100 ${!s.halt ? "text-slate-500" : ""} ${inSeg ? "bg-brand-light/60" : ""} ${isEnd ? "font-semibold" : ""}`}
                >
                  <td className="px-3 py-1.5 tabular-nums">{s.halt ? haltNo : ""}</td>
                  <td className="px-3 py-1.5">
                    <Link href={`/station/${s.code}`} className="hover:underline">{s.name}</Link>{" "}
                    <span className="font-sign text-[1.1rem] text-slate-500">{s.code}</span>
                    {!s.halt && <span className="ml-1 text-sm uppercase">{t("sched.passes")}</span>}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{s.arr ?? t("sched.starts")}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.dep ?? t("sched.ends")}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.halt && s.halt_min ? t("sched.min", { n: s.halt_min }) : "—"}</td>
                  <td className="px-3 py-1.5">{s.day}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{s.dist}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

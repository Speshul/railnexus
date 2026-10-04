"use client";
import { useState } from "react";
import Link from "next/link";
import type { Stop } from "@/lib/rail";

export function ScheduleTable({ stops, segment }: { stops: Stop[]; segment: { from: number; to: number } | null }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? stops : stops.filter((s) => s.halt);
  let haltNo = 0;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold">Timetable</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show stations it passes without stopping ({stops.length - stops.filter((s) => s.halt).length})
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Station</th>
              <th className="px-3 py-2">Arrives</th>
              <th className="px-3 py-2">Departs</th>
              <th className="px-3 py-2">Halt</th>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2 text-right">Km</th>
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
                  className={`border-t border-slate-100 ${!s.halt ? "text-slate-400" : ""} ${inSeg ? "bg-brand-light/60" : ""} ${isEnd ? "font-semibold" : ""}`}
                >
                  <td className="px-3 py-1.5 tabular-nums">{s.halt ? haltNo : ""}</td>
                  <td className="px-3 py-1.5">
                    <Link href={`/station/${s.code}`} className="hover:underline">{s.name}</Link>{" "}
                    <span className="font-mono text-xs text-slate-500">{s.code}</span>
                    {!s.halt && <span className="ml-1 text-[10px] uppercase">passes</span>}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{s.arr ?? "Starts"}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.dep ?? "Ends"}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.halt && s.halt_min ? `${s.halt_min}m` : "—"}</td>
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

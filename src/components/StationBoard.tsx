"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RunDays } from "./RunDays";

type Row = {
  number: string; name: string; type: string; from: string; to: string; fromCode: string; toCode: string;
  arr: string | null; dep: string | null; halt: number | null; day: number; runDays: number; reservable: boolean;
};

export function StationBoard({ code, trains, date, today }: { code: string; trains: Row[]; date: string; today: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "originating" | "terminating">("all");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return trains.filter((t) => {
      if (kind === "originating" && t.fromCode !== code) return false;
      if (kind === "terminating" && t.toCode !== code) return false;
      return !s || t.number.includes(s) || t.name.toLowerCase().includes(s) || t.from.toLowerCase().includes(s) || t.to.toLowerCase().includes(s);
    });
  }, [trains, q, kind, code]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <input className="input max-w-xs" aria-label="Filter trains by name, number or route" placeholder="Filter by train, number, origin…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" aria-label="Which trains to show" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">All trains</option>
          <option value="originating">Starting here</option>
          <option value="terminating">Ending here</option>
        </select>
        <label className="ml-auto flex items-center gap-2 text-sm">
          Running on
          <input type="date" className="input w-auto" value={date} min={today}
            onChange={(e) => router.push(e.target.value ? `/station/${code}?date=${e.target.value}` : `/station/${code}`)} />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Train</th>
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2">Arr</th>
              <th className="px-3 py-2">Dep</th>
              <th className="px-3 py-2">Runs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.number} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link href={`/train/${t.number}`} className="font-medium hover:underline">
                    <span className="font-mono">{t.number}</span> {t.name}
                  </Link>
                  <div className="text-xs text-slate-500">{t.type}{!t.reservable && " · unreserved"}</div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{t.from} → {t.to}</td>
                <td className="px-3 py-2 tabular-nums">{t.arr ?? "Starts"}</td>
                <td className="px-3 py-2 tabular-nums">{t.dep ?? "Ends"}{t.day > 1 && <span className="ml-1 text-[10px] text-slate-500">D{t.day}</span>}</td>
                <td className="px-3 py-2"><RunDays mask={t.runDays} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No trains match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

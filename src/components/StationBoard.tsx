"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RunDays } from "./RunDays";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";

type Row = {
  number: string; name: string; type: string; from: string; to: string; fromCode: string; toCode: string;
  arr: string | null; dep: string | null; halt: number | null; day: number; runDays: number; reservable: boolean;
};

export function StationBoard({ code, trains, date, today }: { code: string; trains: Row[]; date: string; today: string }) {
  const router = useRouter();
  const t = useT();
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
        <input className="input max-w-xs" aria-label={t("board.filter")} placeholder={t("board.filterPh")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" aria-label={t("board.kind")} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">{t("board.all")}</option>
          <option value="originating">{t("board.starting")}</option>
          <option value="terminating">{t("board.ending")}</option>
        </select>
        <label className="ml-auto flex items-center gap-2 text-sm">
          {t("board.runningOn")}
          <input type="date" className="input w-auto" value={date} min={today}
            onChange={(e) => router.push(e.target.value ? `/station/${code}?date=${e.target.value}` : `/station/${code}`)} />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-sm uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("board.train")}</th>
              <th className="px-3 py-2">{t("board.route")}</th>
              <th className="px-3 py-2">{t("board.arr")}</th>
              <th className="px-3 py-2">{t("board.dep")}</th>
              <th className="px-3 py-2">{t("board.runs")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.number} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link href={`/train/${r.number}`} className="font-medium hover:underline">
                    <span className="font-sign">{r.number}</span> {r.name}
                  </Link>
                  <div className="text-sm text-slate-500">{t(`ttype.${r.type}` as MessageKey)}{!r.reservable && ` · ${t("board.unreserved")}`}</div>
                </td>
                <td className="px-3 py-2 text-sm text-slate-600">{r.from} → {r.to}</td>
                <td className="px-3 py-2 tabular-nums">{r.arr ?? t("sched.starts")}</td>
                <td className="px-3 py-2 tabular-nums">{r.dep ?? t("sched.ends")}{r.day > 1 && <span className="ml-1 text-sm text-slate-500">{t("board.day", { n: r.day })}</span>}</td>
                <td className="px-3 py-2"><RunDays mask={r.runDays} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">{t("board.none")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { railDb } from "@/lib/db";
import { StationFinder } from "@/components/StationFinder";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("stns.title") };
}

export default async function StationsPage() {
  const t = await getT();
  const busiest = railDb()
    .prepare("SELECT code, name, state, train_count FROM stations ORDER BY train_count DESC LIMIT 40")
    .all() as { code: string; name: string; state: string | null; train_count: number }[];
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-1 font-sign text-[2.16rem] leading-tight text-brand">{t("stns.title")}</h1>
      <p className="mb-4 text-sm text-slate-600">{t("stns.body")}</p>
      <div className="card mb-6 max-w-xl p-4"><StationFinder /></div>
      <h2 className="mb-3 font-sign text-[1.15rem] leading-tight text-brand">{t("stns.busiest")}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {busiest.map((s) => (
          <Link key={s.code} href={`/station/${s.code}`} className="card flex items-center justify-between p-3 text-sm hover:border-brand">
            <span><b>{s.name}</b> <span className="font-sign text-[0.95rem] text-slate-500">{s.code}</span></span>
            <span className="text-sm text-slate-500">{t("stns.trains", { n: s.train_count })}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

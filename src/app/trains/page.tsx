import Link from "next/link";
import type { Metadata } from "next";
import { railDb } from "@/lib/db";
import { TrainLookup } from "@/components/TrainLookup";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/core";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("trains.title") };
}

const FEATURED = ["Raj", "Shtb", "Drnt", "GR"];

export default async function TrainsPage() {
  const t = await getT();
  const featured = railDb()
    .prepare(
      `SELECT t.number, t.name, t.type, fs.name f, ts.name tt FROM trains t
       JOIN stations fs ON fs.code = t.from_code JOIN stations ts ON ts.code = t.to_code
       WHERE t.type IN (${FEATURED.map(() => "?").join(",")}) ORDER BY t.type, t.number`
    )
    .all(...FEATURED) as { number: string; name: string; type: string; f: string; tt: string }[];
  const groups = Map.groupBy(featured, (r) => r.type);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">{t("trains.title")}</h1>
      <p className="mb-4 text-sm text-slate-600">{t("trains.body")}</p>
      <div className="card mb-6 max-w-xl p-4"><TrainLookup /></div>
      {[...groups.entries()].map(([type, list]) => (
        <section key={type} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">
            {t("trains.group", { type: t(`ttype.${type}` as MessageKey) })} <span className="text-sm font-normal text-slate-500">({list.length})</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((r) => (
              <Link key={r.number} href={`/train/${r.number}`} className="card p-3 text-sm hover:border-brand">
                <span className="font-mono font-semibold">{r.number}</span> {r.name}
                <span className="block text-xs text-slate-500">{r.f} → {r.tt}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { railDb } from "@/lib/db";
import { TrainLookup } from "@/components/TrainLookup";

export const metadata: Metadata = { title: "Trains" };

const FEATURED = ["Raj", "Shtb", "Drnt", "GR"];

export default function TrainsPage() {
  const featured = railDb()
    .prepare(
      `SELECT t.number, t.name, t.type_name, fs.name f, ts.name tt FROM trains t
       JOIN stations fs ON fs.code = t.from_code JOIN stations ts ON ts.code = t.to_code
       WHERE t.type IN (${FEATURED.map(() => "?").join(",")}) ORDER BY t.type, t.number`
    )
    .all(...FEATURED) as { number: string; name: string; type_name: string; f: string; tt: string }[];
  const groups = Map.groupBy(featured, (t) => t.type_name);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">Trains</h1>
      <p className="mb-4 text-sm text-slate-600">Search any train by number or name to see its full route, stops and fares.</p>
      <div className="card mb-6 max-w-xl p-4"><TrainLookup autoFocus /></div>
      {[...groups.entries()].map(([type, list]) => (
        <section key={type} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{type} trains <span className="text-sm font-normal text-slate-500">({list.length})</span></h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => (
              <Link key={t.number} href={`/train/${t.number}`} className="card p-3 text-sm hover:border-brand">
                <span className="font-mono font-semibold">{t.number}</span> {t.name}
                <span className="block text-xs text-slate-500">{t.f} → {t.tt}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { railDb } from "@/lib/db";
import { StationFinder } from "@/components/StationFinder";

export const metadata: Metadata = { title: "Stations" };

export default function StationsPage() {
  const busiest = railDb()
    .prepare("SELECT code, name, state, train_count FROM stations ORDER BY train_count DESC LIMIT 40")
    .all() as { code: string; name: string; state: string | null; train_count: number }[];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold">Stations</h1>
      <p className="mb-4 text-sm text-slate-600">Find a station to see every train that stops there, its timings and nearby stations.</p>
      <div className="card mb-6 max-w-xl p-4"><StationFinder /></div>
      <h2 className="mb-3 text-lg font-semibold">Busiest stations</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {busiest.map((s) => (
          <Link key={s.code} href={`/station/${s.code}`} className="card flex items-center justify-between p-3 text-sm hover:border-brand">
            <span><b>{s.name}</b> <span className="font-mono text-xs text-slate-500">{s.code}</span></span>
            <span className="text-xs text-slate-500">{s.train_count} trains</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

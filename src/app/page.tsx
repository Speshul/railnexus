import Link from "next/link";
import { ArrowRight, MapPinned, Route, Ticket } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";
import { TrainLookup } from "@/components/TrainLookup";
import { stats } from "@/lib/rail";
import { addDays, todayIST } from "@/lib/dates";
import { getT } from "@/i18n/server";

const POPULAR: [string, string, string, string][] = [
  ["NDLS", "New Delhi", "BCT", "Mumbai Central"],
  ["HWH", "Howrah", "NDLS", "New Delhi"],
  ["SBC", "Bangalore City", "MAS", "Chennai Central"],
  ["NDLS", "New Delhi", "LKO", "Lucknow"],
  ["CSTM", "Mumbai CST", "PUNE", "Pune"],
  ["SC", "Secunderabad", "SBC", "Bangalore City"],
  ["NDLS", "New Delhi", "JAT", "Jammu Tawi"],
  ["ADI", "Ahmedabad", "BCT", "Mumbai Central"],
];

export default async function Home() {
  const t = await getT();
  const today = todayIST();
  const s = stats();
  const tomorrow = addDays(today, 1);
  return (
    <>
      <section className="bg-gradient-to-b from-brand to-brand-dark pb-24 pt-10 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-3xl font-bold md:text-4xl">{t("home.title")}</h1>
          <p className="mt-2 max-w-2xl text-white/80">
            {t("home.subtitle", { trains: s.trains.toLocaleString("en-IN"), stations: s.stations.toLocaleString("en-IN") })}
          </p>
        </div>
      </section>
      <div className="mx-auto -mt-20 max-w-6xl px-4">
        <div className="card p-5 md:p-6">
          <SearchForm today={today} />
        </div>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">{t("home.popular")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POPULAR.map(([f, fn, t, tn]) => (
              <Link
                key={f + t}
                href={`/search?from=${f}&to=${t}&date=${tomorrow}&quota=GN`}
                className="card flex items-center justify-between p-4 text-sm hover:border-brand"
              >
                <span>
                  <span className="font-semibold">{fn}</span>
                  <ArrowRight className="mx-1 inline size-3 text-slate-400" />
                  <span className="font-semibold">{tn}</span>
                </span>
                <span className="font-mono text-xs text-slate-500">{f}-{t}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <Route className="mb-2 size-6 text-accent" />
            <h3 className="font-semibold">{t("home.lookup.title")}</h3>
            <p className="mb-3 text-sm text-slate-600">{t("home.lookup.body")}</p>
            <TrainLookup />
          </div>
          <Link href="/stations" className="card p-5 hover:border-brand">
            <MapPinned className="mb-2 size-6 text-accent" />
            <h3 className="font-semibold">{t("home.stations.title")}</h3>
            <p className="text-sm text-slate-600">{t("home.stations.body")}</p>
          </Link>
          <div className="card p-5">
            <Ticket className="mb-2 size-6 text-accent" />
            <h3 className="font-semibold">{t("home.smart.title")}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-600">
              <li>{t("home.smart.1")}</li>
              <li>{t("home.smart.2")}</li>
              <li>{t("home.smart.3")}</li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

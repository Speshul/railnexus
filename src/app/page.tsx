import Link from "next/link";
import { ArrowRight, MapPinned, Route, Ticket } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";
import { TrainLookup } from "@/components/TrainLookup";
import { stats } from "@/lib/rail";
import { addDays, todayIST } from "@/lib/dates";

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

export default function Home() {
  const today = todayIST();
  const s = stats();
  const tomorrow = addDays(today, 1);
  return (
    <>
      <section className="bg-gradient-to-b from-brand to-brand-dark pb-24 pt-10 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-3xl font-bold md:text-4xl">Book train tickets across India</h1>
          <p className="mt-2 max-w-2xl text-white/80">
            {s.trains.toLocaleString("en-IN")} trains · {s.stations.toLocaleString("en-IN")} stations · every route and stop on a map.
          </p>
        </div>
      </section>
      <div className="mx-auto -mt-20 max-w-6xl px-4">
        <div className="card p-5 md:p-6">
          <SearchForm today={today} />
        </div>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Popular routes</h2>
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
            <h3 className="font-semibold">Look up a train</h3>
            <p className="mb-3 text-sm text-slate-600">Full timetable, every stop, and the route on a map.</p>
            <TrainLookup />
          </div>
          <Link href="/stations" className="card p-5 hover:border-brand">
            <MapPinned className="mb-2 size-6 text-accent" />
            <h3 className="font-semibold">Explore stations</h3>
            <p className="text-sm text-slate-600">See every train that stops at a station, and other stations nearby.</p>
          </Link>
          <div className="card p-5">
            <Ticket className="mb-2 size-6 text-accent" />
            <h3 className="font-semibold">Smarter booking</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-600">
              <li>Confirmation chance for waitlisted tickets</li>
              <li>Connecting journeys when no direct train runs</li>
              <li>Search nearby stations in the same city</li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

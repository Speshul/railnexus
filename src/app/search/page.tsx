import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";
import { ResultsView } from "@/components/ResultsView";
import { parseSearchParams, searchJourneys } from "@/lib/search";
import { addDays, diffDays, formatDate, todayIST } from "@/lib/dates";
import { BOOKING_WINDOW_DAYS, QUOTAS } from "@/lib/constants";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const p = parseSearchParams(await searchParams);
  return { title: p ? `${p.from} to ${p.to} trains` : "Search trains" };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const today = todayIST();
  const params = parseSearchParams(await searchParams);
  if (!params) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="card p-5"><SearchForm today={today} /></div>
      </div>
    );
  }
  const data = searchJourneys(params);
  const { fromStation, toStation } = data;
  // No direct trains between the exact stations: check whether other stations in the same cities have some.
  const nearbyCount = !params.nearby && data.results.length === 0 ? searchJourneys({ ...params, nearby: true }).results.length : 0;

  const qs = (date: string) => {
    const q = new URLSearchParams({ from: params.from, to: params.to, date, quota: params.quota });
    if (params.cls) q.set("cls", params.cls);
    if (params.nearby) q.set("nearby", "1");
    return `/search?${q}`;
  };
  const strip = Array.from({ length: 7 }, (_, i) => addDays(params.date, i - 3)).filter(
    (d) => diffDays(d, today) >= 0 && diffDays(d, today) <= BOOKING_WINDOW_DAYS
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="card mb-4 p-4">
        <SearchForm
          compact
          today={today}
          defaults={{
            from: fromStation ? { code: fromStation.code, name: fromStation.name } : null,
            to: toStation ? { code: toStation.code, name: toStation.name } : null,
            date: params.date,
            quota: params.quota,
            cls: params.cls,
            nearby: params.nearby,
          }}
        />
      </div>

      {!fromStation || !toStation ? (
        <div className="card p-8 text-center text-slate-600">Unknown station code. Please pick stations from the suggestions.</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">
                {fromStation.name} <span className="text-slate-400">→</span> {toStation.name}
              </h1>
              <p className="text-sm text-slate-600">
                {formatDate(params.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {QUOTAS[params.quota].name} quota
                {params.nearby && (
                  <> · including {data.fromCodes.length - 1} + {data.toCodes.length - 1} nearby stations</>
                )}
              </p>
            </div>
            <nav className="flex items-center gap-1 text-sm" aria-label="Change date">
              <Link href={qs(addDays(params.date, -1))} aria-label="Previous day"
                className={`rounded-md p-1.5 hover:bg-white ${diffDays(params.date, today) <= 0 ? "pointer-events-none opacity-30" : ""}`}>
                <ChevronLeft className="size-4" />
              </Link>
              {strip.map((d) => (
                <Link key={d} href={qs(d)}
                  className={`rounded-md px-2.5 py-1.5 ${d === params.date ? "bg-brand font-semibold text-white" : "hover:bg-white"}`}>
                  {formatDate(d, { weekday: "short", day: "numeric" })}
                </Link>
              ))}
              <Link href={qs(addDays(params.date, 1))} aria-label="Next day"
                className={`rounded-md p-1.5 hover:bg-white ${diffDays(params.date, today) >= BOOKING_WINDOW_DAYS ? "pointer-events-none opacity-30" : ""}`}>
                <ChevronRight className="size-4" />
              </Link>
            </nav>
          </div>
          <ResultsView data={data} nearbyCount={nearbyCount} nearbyHref={nearbyCount ? `${qs(params.date)}&nearby=1` : undefined} />
        </>
      )}
    </div>
  );
}

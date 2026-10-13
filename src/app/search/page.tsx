import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";
import { ResultsView } from "@/components/ResultsView";
import { alternativeRoutes, parseSearchParams, searchJourneys } from "@/lib/search";
import { loadSales } from "@/lib/availability";
import { addDays, diffDays, formatDate, todayIST } from "@/lib/dates";
import { BOOKING_WINDOW_DAYS } from "@/lib/constants";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/core";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const p = parseSearchParams(await searchParams);
  const t = await getT();
  return { title: p ? t("searchPage.title", { from: p.from, to: p.to }) : t("searchPage.titleEmpty") };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const today = todayIST();
  const t = await getT();
  const L = t.locale;
  const params = parseSearchParams(await searchParams);
  if (!params) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="card p-5"><SearchForm today={today} /></div>
      </div>
    );
  }
  // Client components (form state, tabs, filters) must reset when the search changes via in-app links.
  const searchKey = JSON.stringify(params);
  await loadSales();
  const data = searchJourneys(params);
  const { fromStation, toStation } = data;
  // Few or no direct trains between the exact stations: suggest nearby station pairs that have some.
  const alternatives = !params.nearby && data.results.length < 5 ? alternativeRoutes(params) : [];

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
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="card mb-6 p-5">
        <SearchForm
          key={searchKey}
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
        <div className="card p-8 text-center text-slate-600">{t("searchPage.unknown")}</div>
      ) : fromStation.code === toStation.code ? (
        <div className="card p-8 text-center text-slate-600">{t("searchPage.same")}</div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              {/* The route lettered like a destination board. */}
              <h1 className="font-sign text-[2.16rem] leading-tight text-brand">
                {fromStation.name} <span className="text-slate-400">→</span> {toStation.name}
              </h1>
              <p className="mt-1 text-slate-600">
                {formatDate(params.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, L)} ·{" "}
                {t("searchPage.quota", { quota: t(`quota.${params.quota}` as MessageKey) })}
                {params.nearby && <> · {t("searchPage.nearby", { a: data.fromCodes.length - 1, b: data.toCodes.length - 1 })}</>}
              </p>
            </div>
            <nav className="flex items-center gap-1" aria-label={t("searchPage.changeDate")}>
              <Link href={qs(addDays(params.date, -1))} aria-label={t("searchPage.prev")}
                className={`rounded-md p-1.5 hover:bg-white ${diffDays(params.date, today) <= 0 ? "pointer-events-none opacity-30" : ""}`}>
                <ChevronLeft className="size-4" />
              </Link>
              {strip.map((d) => (
                <Link key={d} href={qs(d)}
                  aria-current={d === params.date ? "date" : undefined}
                  className={`rounded-md px-3 py-1.5 ${d === params.date ? "bg-brand font-semibold text-accent" : "text-slate-700 hover:bg-white"}`}>
                  {formatDate(d, { weekday: "short", day: "numeric" }, L)}
                </Link>
              ))}
              <Link href={qs(addDays(params.date, 1))} aria-label={t("searchPage.next")}
                className={`rounded-md p-1.5 hover:bg-white ${diffDays(params.date, today) >= BOOKING_WINDOW_DAYS ? "pointer-events-none opacity-30" : ""}`}>
                <ChevronRight className="size-4" />
              </Link>
            </nav>
          </div>
          <ResultsView key={searchKey} data={data} alternatives={alternatives} nearbyHref={`${qs(params.date)}&nearby=1`} />
        </>
      )}
    </div>
  );
}

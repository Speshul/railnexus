"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, Moon, Route, TrainFront, X } from "lucide-react";
import type { Destination, ExploreResult } from "@/lib/explore";
import { CLASS_ORDER } from "@/lib/constants";
import { formatDuration } from "@/lib/dates";
import { inr } from "@/lib/format";
import { StationInput, type StationOption } from "@/components/StationInput";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";
import { BUCKETS, BUDGETS, bucketOf, SIZES, type ExploreFilters, type Size, type Sort } from "./buckets";

const ExploreMap = dynamic(() => import("./ExploreMap"), {
  ssr: false,
  loading: () => <div className="h-[640px] animate-pulse rounded-md bg-white" />,
});


const POPULAR = [
  { code: "NDLS", name: "New Delhi" }, { code: "CSTM", name: "Mumbai CSMT" }, { code: "SBC", name: "Bengaluru" },
  { code: "HWH", name: "Howrah" }, { code: "MAS", name: "Chennai Central" }, { code: "SC", name: "Secunderabad" },
  { code: "PUNE", name: "Pune" }, { code: "ADI", name: "Ahmedabad" },
];

// Weighted random pick: bigger places come up more often, but anywhere can.
function surprise(list: Destination[], current: string | null) {
  const pool = list.filter((d) => d.code !== current);
  const total = pool.reduce((s, d) => s + Math.sqrt(d.size), 0);
  let r = Math.random() * total;
  for (const d of pool) if ((r -= Math.sqrt(d.size)) <= 0) return d;
  return pool[0] ?? null;
}

export function ExploreView({ data, initial, defaultDate, today }: {
  data: ExploreResult | null; initial: ExploreFilters; defaultDate: string; today: string;
}) {
  const t = useT();
  const L = t.locale;
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const origin: StationOption | null = data ? { code: data.origin.code, name: data.origin.name } : null;

  const set = <K extends keyof ExploreFilters>(k: K, v: ExploreFilters[K]) => {
    const next = { ...f, [k]: v };
    setF(next);
    setShowAll(false);
    // Keep the URL shareable without a server round trip.
    const q = new URLSearchParams(window.location.search);
    q.set("h", String(next.hours));
    q.set("b", String(next.budget));
    q.set("size", next.size);
    q.set("sort", next.sort);
    if (next.night) q.set("night", "1"); else q.delete("night");
    window.history.replaceState(null, "", `?${q}`);
  };
  const go = (code: string, date: string | null) => {
    const q = new URLSearchParams(window.location.search);
    q.set("from", code);
    if (date) q.set("date", date); else q.delete("date");
    setSelected(null);
    router.push(`/explore?${q}`);
  };

  const list = useMemo(() => {
    if (!data) return [];
    const out = data.destinations.filter(
      (d) => d.fastest <= f.hours * 60 && (!f.budget || (d.cheapest ?? Infinity) <= f.budget) && (!f.night || d.overnight > 0) && d.size >= SIZES[f.size]
    );
    const by: Record<Sort, (a: Destination, b: Destination) => number> = {
      popular: (a, b) => b.size - a.size,
      fastest: (a, b) => a.fastest - b.fastest,
      cheapest: (a, b) => (a.cheapest ?? Infinity) - (b.cheapest ?? Infinity),
    };
    return out.sort(by[f.sort]);
  }, [data, f]);
  const sel = list.find((d) => d.code === selected) ?? null;
  const searchDate = data?.date ?? defaultDate;
  const shown = showAll ? list : list.slice(0, 25);

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-4 md:grid-cols-[1.4fr_1fr]">
        <div>
          <StationInput label={t("explore.from")} value={origin} onChange={(s) => s && go(s.code, data?.date ?? null)} placeholder={t("station.placeholder")} />
          {!data && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {POPULAR.map((p) => (
                <button key={p.code} onClick={() => go(p.code, null)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm hover:border-brand">{p.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-brand" checked={!data?.date} disabled={!data}
              onChange={(e) => data && go(data.origin.code, e.target.checked ? null : defaultDate)} />
            {t("explore.anyDay")}
          </label>
          {data?.date && (
            <div>
              <label htmlFor="ex-date" className="label">{t("search.date")}</label>
              <input id="ex-date" type="date" className="input" min={today} value={data.date} onChange={(e) => e.target.value && go(data.origin.code, e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {data && (
        <>
          <div className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="ex-h" className="label">{t("explore.maxTime")}: <b>{t("explore.hours", { n: f.hours })}</b></label>
              <input id="ex-h" type="range" min={1} max={36} value={f.hours} onChange={(e) => set("hours", Number(e.target.value))} className="w-full accent-brand" />
            </div>
            <div>
              <label htmlFor="ex-b" className="label">{t("explore.maxFare")}: <b>{f.budget ? inr(f.budget) : t("explore.anyFare")}</b></label>
              <input id="ex-b" type="range" min={0} max={BUDGETS.length - 1} value={Math.max(0, BUDGETS.indexOf(f.budget))}
                onChange={(e) => set("budget", BUDGETS[Number(e.target.value)])} className="w-full accent-brand"
                aria-valuetext={f.budget ? inr(f.budget) : t("explore.anyFare")} />
            </div>
            <div>
              <label htmlFor="ex-size" className="label">{t("explore.size")}</label>
              <select id="ex-size" className="input" value={f.size} onChange={(e) => set("size", e.target.value as Size)}>
                <option value="major">{t("explore.size.major")}</option>
                <option value="medium">{t("explore.size.medium")}</option>
                <option value="all">{t("explore.size.all")}</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="accent-brand" checked={f.night} onChange={(e) => set("night", e.target.checked)} />
              <Moon className="size-4 text-brand" aria-hidden /> {t("explore.overnight")}
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-sign text-[2rem] uppercase leading-none tracking-[0.03em] text-brand" aria-live="polite">
              {t.n("explore.count", list.length, { origin: data.origin.name })}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {BUCKETS.map((b) => (
                <span key={b.key} className="flex items-center gap-1"><i className="size-3 rounded-full" style={{ background: b.color }} />{t(b.key as MessageKey)}</span>
              ))}
              <button className="btn-primary ml-2 py-1.5 text-sm" disabled={!list.length} onClick={() => setSelected(surprise(list, selected)?.code ?? null)}>
                <Dices className="size-4" aria-hidden /> {t("explore.surprise")}
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <ExploreMap origin={data.origin} destinations={list} selected={selected} onSelect={setSelected} />
            <aside aria-live="polite">
              {sel ? (
                <div className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-sign text-[1.6rem] uppercase leading-none tracking-[0.03em] text-brand">{sel.name} <span className="font-sign text-[1.2rem] text-slate-500">{sel.code}</span></h2>
                      {sel.state && <p className="text-sm text-slate-500">{sel.state}</p>}
                    </div>
                    <button onClick={() => setSelected(null)} aria-label={t("explore.close")} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="label">{t("explore.fastest")}</dt><dd className="font-semibold">{formatDuration(sel.fastest, L)}</dd><dd className="text-sm text-slate-500">{t("explore.by", { train: sel.fastestTrain })}</dd></div>
                    <div><dt className="label">{t("explore.trains")}</dt><dd className="font-semibold">{sel.trains}</dd><dd className="text-sm text-slate-500">{t("explore.first", { time: sel.firstDep })}</dd></div>
                  </dl>
                  {sel.overnight > 0 && (
                    <p className="mt-3 flex items-center gap-2 rounded-md bg-brand-light px-3 py-2 text-sm text-brand"><Moon className="size-4" aria-hidden /> {t.n("explore.nightTrains", sel.overnight)}</p>
                  )}
                  {sel.cheapest !== null && (
                    <table className="mt-3 w-full text-sm">
                      <caption className="label text-left">{t("explore.faresFrom")}</caption>
                      <tbody>
                        {CLASS_ORDER.filter((c) => sel.fares[c] !== undefined).map((c) => (
                          <tr key={c} className="border-t border-slate-100"><td className="py-1"><b>{c}</b> <span className="text-sm text-slate-500">{t(`class.${c}` as MessageKey)}</span></td><td className="text-right">{inr(sel.fares[c]!)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="mt-4 grid gap-2">
                    <Link href={`/search?from=${data.origin.code}&to=${sel.code}&date=${searchDate}&quota=GN`} className="btn-primary"><TrainFront className="size-4" aria-hidden /> {t("explore.seeTrains")}</Link>
                    <Link href={`/plan?q=${encodeURIComponent(t("explore.planPrompt", { from: data.origin.name, to: sel.name }))}`} className="btn-secondary"><Route className="size-4" aria-hidden /> {t("explore.plan")}</Link>
                  </div>
                </div>
              ) : (
                <div className="plate-indigo p-6 text-[1.05rem] leading-snug">{t("explore.pick")}</div>
              )}
            </aside>
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
              <h2 className="font-sign text-[1.6rem] uppercase leading-none tracking-[0.03em] text-brand">{t("explore.listTitle")}</h2>
              <label className="flex items-center gap-2 text-sm">{t("res.sortBy")}
                <select className="input w-auto py-1" value={f.sort} onChange={(e) => set("sort", e.target.value as Sort)}>
                  <option value="popular">{t("explore.sort.popular")}</option>
                  <option value="fastest">{t("explore.sort.fastest")}</option>
                  <option value="cheapest">{t("explore.sort.cheapest")}</option>
                </select>
              </label>
            </div>
            {list.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-600">{t("explore.none")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-sm uppercase text-slate-500">
                    <tr><th className="px-3 py-2">{t("explore.th.place")}</th><th className="px-3 py-2">{t("explore.fastest")}</th><th className="px-3 py-2">{t("explore.trains")}</th><th className="px-3 py-2">{t("explore.th.from")}</th><th className="px-3 py-2"><span className="sr-only">{t("explore.th.actions")}</span></th></tr>
                  </thead>
                  <tbody>
                    {shown.map((d) => (
                      <tr key={d.code} className={`border-t border-slate-100 ${d.code === selected ? "bg-brand-light" : ""}`}>
                        <td className="px-3 py-2">
                          <button onClick={() => setSelected(d.code)} className="text-left font-medium hover:underline">{d.name}</button>
                          <span className="block text-sm text-slate-500">{d.state}{d.overnight > 0 && <> · <Moon className="inline size-3" aria-hidden /> {t("explore.overnightShort")}</>}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap"><i className="mr-1.5 inline-block size-2.5 rounded-full" style={{ background: BUCKETS[bucketOf(d.fastest)].color }} aria-hidden />{formatDuration(d.fastest, L)}</td>
                        <td className="px-3 py-2">{d.trains}</td>
                        <td className="px-3 py-2">{d.cheapest !== null ? inr(d.cheapest) : "—"}</td>
                        <td className="px-3 py-2 text-right"><Link href={`/search?from=${data.origin.code}&to=${d.code}&date=${searchDate}&quota=GN`} className="text-brand hover:underline">{t("explore.view")}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {list.length > shown.length && (
              <button onClick={() => setShowAll(true)} className="w-full border-t border-slate-100 p-2 text-sm font-medium text-brand hover:bg-slate-50">{t("explore.showAll", { n: list.length })}</button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

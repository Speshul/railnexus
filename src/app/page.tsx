import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";
import { TrainLookup } from "@/components/TrainLookup";
import { stats } from "@/lib/rail";
import { explore } from "@/lib/explore";
import { addDays, todayIST } from "@/lib/dates";
import { BUCKETS, bucketOf } from "@/components/explore/buckets";
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

/** Real places one direct train reaches from New Delhi within 10 hours, drawn as dots at their true positions. */
function reachMap() {
  const data = explore("NDLS", null);
  if (!data) return null;
  const pts = data.destinations.filter((d) => d.size >= 50 && d.fastest <= 600);
  const all = [data.origin, ...pts];
  const lat = all.map((p) => p.lat);
  const lng = all.map((p) => p.lng);
  const [x0, x1, y0, y1] = [Math.min(...lng), Math.max(...lng), Math.min(...lat), Math.max(...lat)];
  const W = 320;
  const H = Math.round((W * (y1 - y0)) / (x1 - x0)) || 260;
  const px = (p: { lat: number; lng: number }) => [((p.lng - x0) / (x1 - x0)) * (W - 24) + 12, ((y1 - p.lat) / (y1 - y0)) * (H - 24) + 12];
  return { origin: data.origin, pts: pts.map((d) => ({ code: d.code, xy: px(d), color: BUCKETS[bucketOf(d.fastest)].color })), o: px(data.origin), W, H, count: pts.length };
}

export default async function Home() {
  const t = await getT();
  const today = todayIST();
  const s = stats();
  const tomorrow = addDays(today, 1);
  const map = reachMap();
  return (
    <>
      {/* The station board: the name lettered at sign scale, English and Devanagari side by side. */}
      <section className="bg-brand text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-end gap-12 px-6 pb-32 pt-14">
          <div>
            <h1 className="font-sign text-[6rem] uppercase leading-[0.82] tracking-[0.04em] text-accent">
              Safarnama <span lang="hi" className="ml-3 align-baseline text-[4.2rem] normal-case tracking-normal text-white">सफ़रनामा</span>
            </h1>
            <p className="mt-6 max-w-[34ch] text-[1.6rem] font-medium leading-snug text-white" style={{ textWrap: "balance" }}>{t("home.title")}</p>
            <p className="mt-2 text-[1.05rem] text-white/80">
              {t("home.subtitle", { trains: s.trains.toLocaleString("en-IN"), stations: s.stations.toLocaleString("en-IN") })}
            </p>
          </div>
          <div className="plate-yellow w-[22rem] p-5">
            <p className="font-sign text-[2.1rem] uppercase leading-none">{t("home.meaningTitle")}</p>
            <p className="mt-2 text-[1rem] leading-snug">{t("home.meaning")}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6">
        {/* The search plate hangs across the bottom edge of the board. */}
        <div className="card settle -mt-24 p-7">
          <SearchForm today={today} />
        </div>

        <section className="mt-8 grid grid-cols-[1.25fr_1fr] gap-6">
          <Link href="/plan" className="plate-yellow group flex flex-col justify-between gap-6 p-7 transition-colors hover:bg-accent-dark">
            <span>
              <span className="block font-sign text-[2.6rem] uppercase leading-none">{t("home.plan.title")}</span>
              <span className="mt-2 block max-w-[48ch] text-[1.05rem] leading-snug">{t("home.plan.body")}</span>
            </span>
            <span className="flex items-center gap-3 rounded-md bg-white px-4 py-3 text-[1.05rem]">
              <span className="flex-1 text-slate-600">{t("home.plan.example")}</span>
              <span className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 font-semibold text-accent">
                {t("home.plan.cta")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </span>
          </Link>
          <Link href="/explore?from=NDLS" className="plate-indigo group flex items-stretch gap-5 p-7 transition-colors hover:bg-brand-dark">
            <span className="flex flex-1 flex-col justify-between gap-4">
              <span>
                <span className="block font-sign text-[2.6rem] uppercase leading-none text-accent">{t("home.explore.title")}</span>
                <span className="mt-2 block text-[1.05rem] leading-snug text-white/90">{t("home.explore.body")}</span>
              </span>
              {map && <span className="text-[0.95rem] text-white/85">{t("home.explore.stat", { n: map.count, origin: map.origin.name })}</span>}
              <span className="flex items-center gap-1.5 font-semibold text-accent">
                {t("home.explore.cta")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </span>
            {map && (
              <svg viewBox={`0 0 ${map.W} ${map.H}`} className="w-44 shrink-0 self-center" aria-hidden>
                {map.pts.map((p) => <line key={`l${p.code}`} x1={map.o[0]} y1={map.o[1]} x2={p.xy[0]} y2={p.xy[1]} stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" />)}
                {map.pts.map((p) => <circle key={p.code} cx={p.xy[0]} cy={p.xy[1]} r="4.5" fill={p.color} stroke="#1b2559" strokeWidth="1.5" />)}
                <circle cx={map.o[0]} cy={map.o[1]} r="8" fill="#f5b700" stroke="#1b2559" strokeWidth="2.5" />
              </svg>
            )}
          </Link>
        </section>

        <section className="mt-12">
          <h2 className="mb-4 font-sign text-[2.2rem] uppercase leading-none text-brand">{t("home.popular")}</h2>
          {/* Coach destination boards: the yellow plate every Indian coach carries beside its door. */}
          <div className="grid grid-cols-4 gap-4">
            {POPULAR.map(([f, fn, to, tn]) => (
              <Link key={f + to} href={`/search?from=${f}&to=${to}&date=${tomorrow}&quota=GN`}
                className="plate-yellow group block px-5 py-4 transition-colors hover:bg-accent-dark">
                <span className="block font-sign text-[1.7rem] uppercase leading-[0.95]">
                  {fn} <ArrowRight className="mb-1 inline size-5" aria-hidden /> {tn}
                </span>
                <span className="mt-2 block font-sign text-[1.1rem] tracking-wide text-ink/75">{f} – {to}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="card mt-12 grid grid-cols-[1.2fr_1fr_1fr] divide-x-2 divide-ground">
          <div className="p-7">
            <h2 className="font-sign text-[1.9rem] uppercase leading-none text-brand">{t("home.lookup.title")}</h2>
            <p className="mb-4 mt-1 text-slate-600">{t("home.lookup.body")}</p>
            <TrainLookup />
          </div>
          <Link href="/stations" className="group p-7 hover:bg-brand-light">
            <h2 className="font-sign text-[1.9rem] uppercase leading-none text-brand">{t("home.stations.title")}</h2>
            <p className="mt-1 text-slate-600">{t("home.stations.body")}</p>
            <span className="mt-4 flex items-center gap-1.5 font-semibold text-brand">
              {t("nav.stations")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
          <div className="p-7">
            <h2 className="font-sign text-[1.9rem] uppercase leading-none text-brand">{t("home.smart.title")}</h2>
            <ul className="mt-2 space-y-2 text-slate-700">
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

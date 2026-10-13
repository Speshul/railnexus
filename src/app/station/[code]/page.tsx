import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStation, nearbyStations, trainsAtStation } from "@/lib/rail";
import { isValidDate, todayIST, formatDate } from "@/lib/dates";
import { RouteMapLazy } from "@/components/RouteMapLazy";
import type { MapStop } from "@/components/RouteMap";
import { StationBoard } from "@/components/StationBoard";
import { getT } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/station/[code]">): Promise<Metadata> {
  const s = getStation((await params).code);
  return { title: s ? `${s.name} (${s.code})` : (await getT())("stn.notFound") };
}

export default async function StationPage({ params, searchParams }: PageProps<"/station/[code]">) {
  const { code } = await params;
  const sp = await searchParams;
  const t = await getT();
  const station = getStation(code);
  if (!station) notFound();
  const date = typeof sp.date === "string" && isValidDate(sp.date) ? sp.date : undefined;
  const trains = trainsAtStation(station.code, date);
  const nearby = nearbyStations(station.code, 30).filter((s) => s.code !== station.code).slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="card mb-4 p-5">
        <p className="text-sm text-slate-500">{[station.state, station.zone && t("stn.zone", { zone: station.zone })].filter(Boolean).join(" · ") || t("stn.station")}</p>
        <h1 className="font-sign text-[3rem] uppercase leading-[0.9] tracking-[0.03em] text-brand">{station.name} <span className="font-sign text-lg text-slate-500">{station.code}</span></h1>
        {station.address && <p className="text-sm text-slate-600">{station.address}</p>}
        <p className="mt-2 text-sm">
          {t("stn.count", { n: station.train_count })}{date && <> · {t("stn.showing", { n: trains.length, date: formatDate(date, undefined, t.locale) })}</>}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <StationBoard
          code={station.code}
          date={date ?? ""}
          today={todayIST()}
          trains={trains.map(({ train, stop }) => ({
            number: train.number,
            name: train.name,
            type: train.type,
            from: train.from_name,
            to: train.to_name,
            fromCode: train.from_code,
            toCode: train.to_code,
            arr: stop.arr,
            dep: stop.dep,
            halt: stop.halt_min,
            day: stop.day,
            runDays: train.run_days,
            reservable: train.reservable,
          }))}
        />
        <aside className="space-y-4">
          <RouteMapLazy
            height={260}
            stops={[
              { code: station.code, name: station.name, lat: station.lat, lng: station.lng, halt: true, emphasis: true, inSegment: true },
              ...nearby.map((n): MapStop => ({ code: n.code, name: n.name, lat: n.lat, lng: n.lng, halt: true, label: t("stn.away", { km: n.km.toFixed(1) }) })),
            ]}
          />
          {nearby.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 font-sign text-[1.6rem] uppercase leading-none tracking-[0.03em] text-brand">{t("stn.nearby")}</h2>
              <ul className="space-y-1 text-sm">
                {nearby.map((n) => (
                  <li key={n.code} className="flex justify-between gap-2">
                    <Link href={`/station/${n.code}`} className="hover:underline">{n.name} <span className="font-sign text-[1.1rem] text-slate-500">{n.code}</span></Link>
                    <span className="text-slate-500">{t("stn.km", { km: n.km.toFixed(1) })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

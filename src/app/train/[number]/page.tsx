import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftRight, Sun } from "lucide-react";
import { getStops, getTrain } from "@/lib/rail";
import { adultFare } from "@/lib/fare";
import { CLASS_ORDER, QUOTAS, type Quota } from "@/lib/constants";
import { formatDate, formatDuration, todayIST, addDays, isValidDate } from "@/lib/dates";
import { inr, runDaysLabel } from "@/lib/format";
import { RunDays } from "@/components/RunDays";
import { RouteMapLazy } from "@/components/RouteMapLazy";
import { ScheduleTable } from "@/components/ScheduleTable";
import { TrainJourneyPicker } from "@/components/TrainJourneyPicker";
import { SunSide } from "@/components/SunSide";
import { CoachBoard } from "@/components/CoachBoard";
import { sunForJourney } from "@/lib/sunpath";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/core";

export async function generateMetadata({ params }: PageProps<"/train/[number]">): Promise<Metadata> {
  const tr = getTrain((await params).number);
  return { title: tr ? `${tr.number} ${tr.name}` : (await getT())("train.notFound") };
}

export default async function TrainPage({ params, searchParams }: PageProps<"/train/[number]">) {
  const { number } = await params;
  const sp = await searchParams;
  const t = await getT();
  const L = t.locale;
  const train = getTrain(number);
  if (!train) notFound();
  const stops = getStops(number);
  const halts = stops.filter((s) => s.halt);

  const fromCode = typeof sp.from === "string" ? sp.from.toUpperCase() : undefined;
  const toCode = typeof sp.to === "string" ? sp.to.toUpperCase() : undefined;
  const from = halts.find((s) => s.code === fromCode);
  const to = halts.find((s) => s.code === toCode && from && s.seq > from.seq);
  const segment = from && to ? { from: from.seq, to: to.seq } : null;
  const km = segment ? to!.dist - from!.dist : train.distance;
  const returnTrain = train.return_train ? getTrain(train.return_train) : null;
  const date = typeof sp.date === "string" && isValidDate(sp.date) ? sp.date : addDays(todayIST(), 1);
  // Sun advice for the chosen part of the route (or the whole route), departing on the chosen date.
  const sunFrom = from ?? halts[0];
  const sunTo = to ?? halts[halts.length - 1];
  const sun = sunFrom && sunTo ? sunForJourney(train.number, sunFrom.code, sunTo.code, addDays(date, -(sunFrom.day - 1))) : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-1 overflow-hidden rounded-t-xl">
        <CoachBoard as="h1" size="lg" number={train.number} name={train.name}>
          <span className="rounded bg-brand px-2.5 pb-0.5 pt-1 font-sign text-[0.95rem] leading-tight text-accent">{t("train.zone", { type: t(`ttype.${train.type}` as MessageKey), zone: train.zone ?? "IR" })}</span>
        </CoachBoard>
      </div>
      <div className="mb-6 rounded-b-xl bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[1.1rem] text-slate-700">
              <Link href={`/station/${train.from_code}`} className="hover:underline">{train.from_name}</Link> ({train.departure})
              {" → "}
              <Link href={`/station/${train.to_code}`} className="hover:underline">{train.to_name}</Link> ({train.arrival})
            </p>
          </div>
          {returnTrain && (
            <Link href={`/train/${returnTrain.number}`} className="btn-secondary">
              <ArrowLeftRight className="size-4" aria-hidden /> {t("train.return", { n: returnTrain.number })}
            </Link>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <div><dt className="label">{t("train.runsOn")}</dt><dd><RunDays mask={train.run_days} /> <span className="text-sm text-slate-500">{runDaysLabel(train.run_days, t)}</span></dd></div>
          <div><dt className="label">{t("train.distance")}</dt><dd className="font-semibold">{t("unit.km", { n: train.distance })}</dd></div>
          <div><dt className="label">{t("train.time")}</dt><dd className="font-semibold">{formatDuration(train.duration_min, L)}</dd></div>
          <div><dt className="label">{t("train.halts")}</dt><dd className="font-semibold">{train.halt_count} <span className="font-normal text-slate-500">{t("train.haltsOf", { n: train.stop_count })}</span></dd></div>
          <div><dt className="label">{t("train.classes")}</dt><dd className="font-semibold">{train.classes.join(" · ")}</dd></div>
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <RouteMapLazy
            stops={stops.map((s) => ({
              code: s.code, name: s.name, lat: s.lat, lng: s.lng, halt: s.halt,
              label: s.halt ? t("train.mapStop", { arr: s.arr ?? t("train.mapStart"), dep: s.dep ?? t("train.mapEnd"), day: s.day, km: s.dist }) : t("train.mapPasses", { time: s.dep ?? "" }),
              inSegment: segment ? s.seq >= segment.from && s.seq <= segment.to : undefined,
              emphasis: segment ? s.seq === segment.from || s.seq === segment.to : s.seq === 0 || s.seq === stops.length - 1,
            }))}
          />
          {train.halts_inferred === 1 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("train.inferred")}
            </p>
          )}
          <ScheduleTable stops={stops} segment={segment} />
        </div>

        <aside className="space-y-4">
          {train.reservable ? (
            <div className="card p-4">
              <h2 className="mb-3 font-sign text-[1.15rem] leading-tight text-brand">{t("train.bookThis")}</h2>
              <TrainJourneyPicker
                key={`${train.number}-${from?.code ?? ""}-${to?.code ?? ""}`}
                train={train.number}
                halts={halts.map((h) => ({ code: h.code, name: h.name, seq: h.seq, day: h.day }))}
                classes={train.classes.filter((c) => c !== "UR")}
                defaultFrom={from?.code}
                defaultTo={to?.code}
                today={todayIST()}
                defaultDate={date}
                defaultQuota={typeof sp.quota === "string" && sp.quota in QUOTAS ? (sp.quota as Quota) : "GN"}
                runsOn={train.run_days}
              />
            </div>
          ) : (
            <div className="card p-4 text-sm text-slate-600">{t("train.unreservedSvc")}</div>
          )}
          {train.reservable && (
            <div className="card p-4">
              <h2 className="font-sign text-[1.15rem] leading-tight text-brand">{t("train.fares")}</h2>
              <p className="mb-2 text-sm text-slate-500">
                {segment ? `${from!.name} → ${to!.name}` : t("train.fullRoute")}, {t("unit.km", { n: km })}
              </p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-sm text-slate-500"><th className="py-1">{t("train.fareClass")}</th><th className="text-right">{t("train.fareGeneral")}</th><th className="text-right">{t("train.fareTatkal")}</th></tr></thead>
                <tbody>
                  {CLASS_ORDER.filter((c) => train.classes.includes(c) && c !== "UR").map((c) => (
                    <tr key={c} className="border-t border-slate-100">
                      <td className="py-1.5"><b>{c}</b> <span className="text-sm text-slate-500">{t(`class.${c}` as MessageKey)}</span></td>
                      <td className="text-right">{inr(adultFare({ cls: c, km, trainType: train.type, quota: "GN" }).total)}</td>
                      <td className="text-right">{c === "1A" || c === "EC" ? "—" : inr(adultFare({ cls: c, km, trainType: train.type, quota: "TQ" }).total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sun && (
            <div className="card p-4">
              <h2 className="mb-1 flex items-center gap-2 font-sign text-[1.15rem] leading-tight text-brand">
                <Sun className="size-4 text-amber-600" aria-hidden /> {t("sun.title")}
              </h2>
              <SunSide report={sun} t={t} compact />
              <p className="mt-2 text-sm text-slate-500">
                {sunFrom.name} → {sunTo.name}. {t("sun.forDate", { date: formatDate(date, undefined, L) })} {t("sun.note")}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

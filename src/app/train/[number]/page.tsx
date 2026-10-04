import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { getStops, getTrain } from "@/lib/rail";
import { adultFare } from "@/lib/fare";
import { CLASSES, CLASS_ORDER } from "@/lib/constants";
import { formatDuration, todayIST, addDays } from "@/lib/dates";
import { inr, runDaysLabel } from "@/lib/format";
import { RunDays } from "@/components/RunDays";
import { RouteMapLazy } from "@/components/RouteMapLazy";
import { ScheduleTable } from "@/components/ScheduleTable";
import { TrainJourneyPicker } from "@/components/TrainJourneyPicker";

export async function generateMetadata({ params }: PageProps<"/train/[number]">): Promise<Metadata> {
  const t = getTrain((await params).number);
  return { title: t ? `${t.number} ${t.name}` : "Train not found" };
}

export default async function TrainPage({ params, searchParams }: PageProps<"/train/[number]">) {
  const { number } = await params;
  const sp = await searchParams;
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{train.type_name} · {train.zone ?? "IR"} zone</p>
            <h1 className="text-2xl font-bold"><span className="font-mono">{train.number}</span> {train.name}</h1>
            <p className="mt-1 text-slate-700">
              <Link href={`/station/${train.from_code}`} className="hover:underline">{train.from_name}</Link> ({train.departure})
              {" → "}
              <Link href={`/station/${train.to_code}`} className="hover:underline">{train.to_name}</Link> ({train.arrival})
            </p>
          </div>
          {returnTrain && (
            <Link href={`/train/${returnTrain.number}`} className="btn-secondary">
              <ArrowLeftRight className="size-4" /> Return: {returnTrain.number}
            </Link>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <div><dt className="label">Runs on</dt><dd><RunDays mask={train.run_days} /> <span className="text-xs text-slate-500">{runDaysLabel(train.run_days)}</span></dd></div>
          <div><dt className="label">Distance</dt><dd className="font-semibold">{train.distance} km</dd></div>
          <div><dt className="label">Journey time</dt><dd className="font-semibold">{formatDuration(train.duration_min)}</dd></div>
          <div><dt className="label">Halts</dt><dd className="font-semibold">{train.halt_count} <span className="font-normal text-slate-500">of {train.stop_count} stations</span></dd></div>
          <div><dt className="label">Classes</dt><dd className="font-semibold">{train.classes.join(" · ")}</dd></div>
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <RouteMapLazy
            stops={stops.map((s) => ({
              code: s.code, name: s.name, lat: s.lat, lng: s.lng, halt: s.halt,
              label: s.halt ? `${s.arr ?? "Start"} → ${s.dep ?? "End"} · Day ${s.day} · ${s.dist} km` : `Passes ~${s.dep}`,
              inSegment: segment ? s.seq >= segment.from && s.seq <= segment.to : undefined,
              emphasis: segment ? s.seq === segment.from || s.seq === segment.to : s.seq === 0 || s.seq === stops.length - 1,
            }))}
          />
          <ScheduleTable stops={stops} segment={segment} />
        </div>

        <aside className="space-y-4">
          {train.reservable ? (
            <div className="card p-4">
              <h2 className="mb-3 font-semibold">Book this train</h2>
              <TrainJourneyPicker
                train={train.number}
                halts={halts.map((h) => ({ code: h.code, name: h.name, seq: h.seq }))}
                classes={train.classes.filter((c) => c !== "UR")}
                defaultFrom={from?.code}
                defaultTo={to?.code}
                today={todayIST()}
                defaultDate={addDays(todayIST(), 1)}
              />
            </div>
          ) : (
            <div className="card p-4 text-sm text-slate-600">This is an unreserved suburban service. Tickets are bought at the station or via UTS.</div>
          )}
          {train.reservable && (
            <div className="card p-4">
              <h2 className="font-semibold">Fares per adult</h2>
              <p className="mb-2 text-xs text-slate-500">
                {segment ? `${from!.name} → ${to!.name}` : "Full route"}, {km} km
              </p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Class</th><th className="text-right">General</th><th className="text-right">Tatkal</th></tr></thead>
                <tbody>
                  {CLASS_ORDER.filter((c) => train.classes.includes(c) && c !== "UR").map((c) => (
                    <tr key={c} className="border-t border-slate-100">
                      <td className="py-1.5"><b>{c}</b> <span className="text-xs text-slate-500">{CLASSES[c].name}</span></td>
                      <td className="text-right">{inr(adultFare({ cls: c, km, trainType: train.type, quota: "GN" }).total)}</td>
                      <td className="text-right">{c === "1A" || c === "EC" ? "—" : inr(adultFare({ cls: c, km, trainType: train.type, quota: "TQ" }).total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

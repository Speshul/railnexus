"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin } from "lucide-react";
import type { JourneyResult } from "@/lib/search";
import type { Availability } from "@/lib/availability";
import { CLASSES, type ClassCode, type Quota } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { availTone, inr, pct } from "@/lib/format";
import { RunDays } from "./RunDays";

export function TrainCard({ j, quota, initialClass }: { j: JourneyResult; quota: Quota; initialClass?: ClassCode | null }) {
  const [selected, setSelected] = useState<ClassCode | null>(initialClass ?? null);
  return (
    <article id={j.number} className="card scroll-mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
        <Link href={`/train/${j.number}`} className="font-semibold hover:text-brand hover:underline">
          <span className="font-mono">{j.number}</span> {j.name}
        </Link>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="rounded bg-brand-light px-1.5 py-0.5 font-medium text-brand">{j.typeName}</span>
          <RunDays mask={j.runDays} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        <div>
          <div className="text-2xl font-bold tabular-nums">{j.from.time}</div>
          <div className="text-sm font-medium">{j.from.name} <span className="font-mono text-xs text-slate-500">{j.from.code}</span></div>
          <div className="text-xs text-slate-500">{formatDate(j.date)}</div>
        </div>
        <div className="flex flex-col items-center text-xs text-slate-500">
          <span className="font-medium text-slate-700">{formatDuration(j.duration)}</span>
          <span className="my-1 h-px w-20 bg-slate-300 md:w-40" />
          <span>{j.distance} km</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{j.to.time}</div>
          <div className="text-sm font-medium">{j.to.name} <span className="font-mono text-xs text-slate-500">{j.to.code}</span></div>
          <div className="text-xs text-slate-500">{formatDate(j.arrivalDate)}</div>
        </div>
      </div>

      {j.reservable ? (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {j.classes.map((c) => (
            <button
              key={c.cls}
              onClick={() => setSelected(selected === c.cls ? null : c.cls)}
              aria-expanded={selected === c.cls}
              className={`min-w-32 shrink-0 rounded-lg border px-3 py-2 text-left transition ${
                selected === c.cls ? "border-brand bg-brand-light ring-1 ring-brand" : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{c.cls}</span>
                <span className="text-sm font-semibold">{inr(c.fare)}</span>
              </div>
              <div className={`text-sm font-semibold ${availTone(c.avail.status)}`}>{c.avail.label}</div>
              {c.avail.status === "WL" && <div className="text-[11px] text-slate-500">{pct(c.avail.chance)} chance</div>}
            </button>
          ))}
        </div>
      ) : (
        <p className="px-4 pb-3 text-sm text-slate-500">Unreserved service: no booking required, buy a ticket at the station.</p>
      )}

      {selected && <AvailabilityPanel j={j} cls={selected} quota={quota} />}

      <div className="flex flex-wrap gap-x-4 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span><MapPin className="mr-0.5 inline size-3" />{j.origin} → {j.destination}</span>
        <Link href={`/train/${j.number}?from=${j.from.code}&to=${j.to.code}`} className="text-brand hover:underline">
          Route &amp; all stops
        </Link>
      </div>
    </article>
  );
}

type Cal = { date: string; runs: boolean; avail: Availability | null }[];

function AvailabilityPanel({ j, cls, quota }: { j: JourneyResult; cls: ClassCode; quota: Quota }) {
  const key = `${j.number}|${cls}|${quota}|${j.date}`;
  const [state, setState] = useState<{ key: string; cal?: Cal; fare?: number; error?: string } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ train: j.number, from: j.from.code, to: j.to.code, date: j.date, cls, quota, days: "6" });
    fetch(`/api/availability?${qs}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setState(d.error ? { key, error: d.error } : { key, cal: d.calendar, fare: d.fare.total }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [j, cls, quota, key]);

  const loaded = state?.key === key ? state : null;
  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{CLASSES[cls].name} ({cls})</span>
        {loaded?.fare !== undefined && <span>Fare per adult <b>{inr(loaded.fare)}</b></span>}
      </div>
      {!loaded ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Checking availability…</div>
      ) : loaded.error ? (
        <p className="text-sm text-bad">{loaded.error}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {loaded.cal!.map((d) => {
            const a = d.avail;
            const bookHref = `/book?${new URLSearchParams({ train: j.number, from: j.from.code, to: j.to.code, date: d.date, cls, quota })}`;
            return (
              <div key={d.date} className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
                <div className="text-xs text-slate-500">{formatDate(d.date)}</div>
                {!d.runs || !a ? (
                  <div className="py-1 text-slate-400">Doesn&apos;t run</div>
                ) : (
                  <>
                    <div className={`font-semibold ${availTone(a.status)}`}>{a.label}</div>
                    {a.status === "WL" && <div className="text-[11px] text-slate-500">{pct(a.chance)} chance</div>}
                    {a.bookable ? (
                      <Link href={bookHref} className="btn-primary mt-1.5 w-full py-1 text-xs">Book now</Link>
                    ) : (
                      a.note && <div className="mt-1 text-[11px] leading-tight text-slate-500">{a.note}</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

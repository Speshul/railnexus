"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Leaf, Loader2, MapPin, Split } from "lucide-react";
import type { JourneyResult } from "@/lib/search";
import type { Availability } from "@/lib/availability";
import { CLASSES, type ClassCode, type Quota } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { availText, availTone, inr, pct } from "@/lib/format";
import { RunDays } from "./RunDays";
import { bookHref as tripHref } from "@/lib/trip-url";

export function TrainCard({ j, quota, initialClass, anchor = true }: { j: JourneyResult; quota: Quota; initialClass?: ClassCode | null; anchor?: boolean }) {
  const [calendarFor, setCalendarFor] = useState<ClassCode | null>(null);
  const bookHref = (cls: ClassCode, date = j.date) =>
    `/book?${new URLSearchParams({ train: j.number, from: j.from.code, to: j.to.code, date, cls, quota })}`;
  const routeHref = `/train/${j.number}?${new URLSearchParams({ from: j.from.code, to: j.to.code, date: j.date, quota })}`;

  return (
    <article id={anchor ? j.number : undefined} className="card scroll-mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
        <h3 className="font-semibold">
          <span className="font-mono">{j.number}</span> {j.name}
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="rounded bg-brand-light px-1.5 py-0.5 font-medium text-brand">{j.typeName}</span>
          <RunDays mask={j.runDays} />
          <Link href={routeHref} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            <MapPin className="size-3" /> Route &amp; stops
          </Link>
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
        <div className="px-4 pb-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Choose a class to book</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {j.classes.map((c) => (
              <div
                key={c.cls}
                className={`flex flex-col rounded-lg border p-3 ${calendarFor === c.cls || initialClass === c.cls ? "border-brand ring-1 ring-brand" : "border-slate-200"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold leading-tight">{CLASSES[c.cls].name}</div>
                    <div className="font-mono text-xs text-slate-500">{c.cls}</div>
                  </div>
                  <div className="text-right font-semibold">{inr(c.fare)}</div>
                </div>
                <div className={`mt-1 text-sm font-semibold ${availTone(c.avail.status)}`}>{availText(c.avail)}</div>
                {c.avail.status === "WL" && <div className="text-xs text-slate-500">{pct(c.avail.chance)} chance of confirmation</div>}
                {c.avail.status === "RAC" && <div className="text-xs text-slate-500">Shared berth, usually confirms</div>}
                {c.split && (
                  <div className="mt-2 rounded-md border border-green-200 bg-green-50 p-2 text-xs">
                    <p className="flex items-start gap-1 font-semibold text-ok">
                      <Split className="mt-0.5 size-3.5 shrink-0" /> Confirmed seats with a split ticket
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      Same train, two tickets: change seats at <b>{c.split.via.name}</b>. {inr(c.split.fare)} ({c.split.extra > 0 ? `+${inr(c.split.extra)}` : "same price"}).
                    </p>
                    <Link
                      href={tripHref(c.split.legs.map((l) => ({ train: j.number, from: l.from, to: l.to, date: l.date, cls: c.cls })), quota)}
                      className="mt-1.5 inline-flex font-semibold text-ok underline"
                    >
                      Book split ticket
                    </Link>
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2 pt-2">
                  {c.avail.bookable ? (
                    <Link href={bookHref(c.cls)} className="btn-primary flex-1 py-1.5">
                      {c.avail.status === "AVAILABLE" ? "Book" : c.avail.status === "RAC" ? "Book (RAC)" : "Book (waitlist)"}
                    </Link>
                  ) : (
                    <span className="flex-1 text-xs text-slate-500">{c.avail.note ?? "Not bookable"}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCalendarFor(calendarFor === c.cls ? null : c.cls)}
                    aria-expanded={calendarFor === c.cls}
                    className="shrink-0 text-xs font-medium text-brand hover:underline"
                  >
                    {calendarFor === c.cls ? "Hide dates" : "Other dates"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-4 pb-3 text-sm text-slate-500">Unreserved service: no booking required, buy a ticket at the station.</p>
      )}

      {calendarFor && <AvailabilityPanel j={j} cls={calendarFor} quota={quota} bookHref={bookHref} />}

      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Runs {j.origin} → {j.destination}
        {j.co2Saved > 0 && (
          <span className="ml-3 inline-flex items-center gap-1 text-ok">
            <Leaf className="size-3" /> Saves ~{j.co2Saved} kg CO₂ vs flying
          </span>
        )}
      </div>
    </article>
  );
}

type Cal = { date: string; runs: boolean; avail: Availability | null }[];

function AvailabilityPanel({ j, cls, quota, bookHref }: { j: JourneyResult; cls: ClassCode; quota: Quota; bookHref: (cls: ClassCode, date: string) => string }) {
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
            return (
              <div key={d.date} className={`rounded-lg border bg-white p-2 text-sm ${d.date === j.date ? "border-brand" : "border-slate-200"}`}>
                <div className="text-xs text-slate-500">{formatDate(d.date)}{d.date === j.date && " · your date"}</div>
                {!d.runs || !a ? (
                  <div className="py-1 text-slate-500">Doesn&apos;t run</div>
                ) : (
                  <>
                    <div className={`font-semibold ${availTone(a.status)}`}>{availText(a)}</div>
                    {a.status === "WL" && <div className="text-[11px] text-slate-500">{pct(a.chance)} chance</div>}
                    {a.bookable ? (
                      <Link href={bookHref(cls, d.date)} className="btn-primary mt-1.5 w-full py-1 text-xs">Book</Link>
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

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, Clock3, Hourglass, Leaf, Loader2, MapPin, Split } from "lucide-react";
import type { JourneyResult } from "@/lib/search";
import type { Availability } from "@/lib/availability";
import type { ClassCode, Quota } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { availText, availTone, inr, pct } from "@/lib/format";
import { RunDays } from "./RunDays";
import { CoachBoard } from "./CoachBoard";
import { bookHref as tripHref } from "@/lib/trip-url";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";

export function TrainCard({ j, quota, initialClass, anchor = true }: { j: JourneyResult; quota: Quota; initialClass?: ClassCode | null; anchor?: boolean }) {
  const t = useT();
  const L = t.locale;
  const [calendarFor, setCalendarFor] = useState<ClassCode | null>(null);
  const bookHref = (cls: ClassCode, date = j.date) =>
    `/book?${new URLSearchParams({ train: j.number, from: j.from.code, to: j.to.code, date, cls, quota })}`;
  const routeHref = `/train/${j.number}?${new URLSearchParams({ from: j.from.code, to: j.to.code, date: j.date, quota })}`;

  return (
    <article id={anchor ? j.number : undefined} className="scroll-mt-4 bg-white">
      <CoachBoard as="h3" number={j.number} name={j.name} from={j.from.name} to={j.to.name}>
        <span className="rounded bg-brand px-2 pb-0.5 pt-1 font-sign text-[1.15rem] uppercase leading-none tracking-[0.05em] text-accent">{t(`ttype.${j.type}` as MessageKey)}</span>
        <Link href={routeHref} className="inline-flex items-center gap-1 font-semibold text-brand underline-offset-4 hover:underline">
          <MapPin className="size-5" aria-hidden /> {t("card.route")}
        </Link>
      </CoachBoard>

      <div className="grid grid-cols-[1fr_minmax(12rem,22rem)_1fr] items-center gap-6 px-5 py-4">
        <div>
          <div className="font-sign text-[3rem] leading-none tracking-[0.02em] text-ink">{j.from.time}</div>
          <div className="mt-1 font-semibold">{j.from.name} <span className="font-sign text-[1.1rem] text-slate-500">{j.from.code}</span></div>
          <div className="text-[0.95rem] text-slate-600">{formatDate(j.date, undefined, L)}</div>
        </div>
        {/* The journey as a painted track: an open dot where you board, a filled one where you arrive. */}
        <div className="flex flex-col items-center text-[0.95rem] text-slate-600">
          <span className="font-sign text-[1.35rem] leading-none text-brand">{formatDuration(j.duration, L)}</span>
          <span className="relative my-2 h-[5px] w-full rounded-full bg-brand before:absolute before:-left-1 before:-top-[5px] before:size-[15px] before:rounded-full before:border-[3px] before:border-brand before:bg-white after:absolute after:-right-1 after:-top-[5px] after:size-[15px] after:rounded-full after:bg-brand" aria-hidden />
          <span>{t("unit.km", { n: j.distance })}</span>
        </div>
        <div className="text-right">
          <div className="font-sign text-[3rem] leading-none tracking-[0.02em] text-ink">{j.to.time}</div>
          <div className="mt-1 font-semibold">{j.to.name} <span className="font-sign text-[1.1rem] text-slate-500">{j.to.code}</span></div>
          <div className="text-[0.95rem] text-slate-600">{formatDate(j.arrivalDate, undefined, L)}</div>
        </div>
      </div>

      {j.reservable ? (
        <div className="px-5 pb-4">
          <p className="mb-2 font-sign text-[1.15rem] uppercase tracking-[0.05em] text-slate-600">{t("card.chooseClass")}</p>
          <div className="grid grid-cols-4 divide-x-2 divide-ground border-y-2 border-ground">
            {j.classes.map((c) => (
              <div
                key={c.cls}
                className={`flex flex-col p-4 ${calendarFor === c.cls || initialClass === c.cls ? "bg-brand-light" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-brand px-1.5 pb-0.5 pt-1 font-sign text-[1.35rem] leading-none text-accent">{c.cls}</span>
                    <span className="text-[0.9rem] font-semibold leading-tight text-slate-700">{t(`class.${c.cls}` as MessageKey)}</span>
                  </div>
                  <div className="font-sign text-[1.6rem] leading-none text-ink">{inr(c.fare)}</div>
                </div>
                {/* Availability is a painted mark plus words: never colour alone. */}
                <div className={`mt-2 flex items-center gap-1.5 font-semibold ${availTone(c.avail.status)}`}>
                  {c.avail.status === "AVAILABLE" ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : c.avail.status === "RAC" ? <Clock3 className="size-4 shrink-0" aria-hidden /> : c.avail.status === "WL" ? <Hourglass className="size-4 shrink-0" aria-hidden /> : null}
                  {availText(c.avail, t)}
                </div>
                {c.avail.status === "WL" && <div className="text-[0.95rem] text-slate-600">{t("card.chance", { pct: pct(c.avail.chance) })}</div>}
                {c.avail.status === "RAC" && <div className="text-[0.95rem] text-slate-600">{t("card.racHint")}</div>}
                {c.split && (
                  <div className="mt-2 rounded-md bg-green-light p-2.5 text-[0.95rem]">
                    <p className="flex items-start gap-1 font-semibold text-ok">
                      <Split className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("card.split.title")}
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      {t("card.split.body", { station: c.split.via.name, fare: inr(c.split.fare) })}{" "}
                      ({c.split.extra > 0 ? `+${inr(c.split.extra)}` : t("card.split.samePrice")}).
                    </p>
                    <Link
                      href={tripHref(c.split.legs.map((l) => ({ train: j.number, from: l.from, to: l.to, date: l.date, cls: c.cls })), quota)}
                      className="mt-1.5 inline-flex font-semibold text-ok underline"
                    >
                      {t("card.split.book")}
                    </Link>
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2 pt-2">
                  {c.avail.bookable ? (
                    <Link href={bookHref(c.cls)} className="btn-primary flex-1 py-2">
                      {c.avail.status === "AVAILABLE" ? t("card.book") : c.avail.status === "RAC" ? t("card.bookRac") : t("card.bookWl")}
                    </Link>
                  ) : (
                    <span className="flex-1 text-[0.95rem] text-slate-600">{c.avail.note ? t.msg(c.avail.note) : t("card.notBookable")}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCalendarFor(calendarFor === c.cls ? null : c.cls)}
                    aria-expanded={calendarFor === c.cls}
                    className="shrink-0 text-[0.95rem] font-semibold text-brand hover:underline"
                  >
                    {calendarFor === c.cls ? t("card.hideDates") : t("card.otherDates")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-5 pb-4 text-slate-600">{t("card.unreserved")}</p>
      )}

      {calendarFor && <AvailabilityPanel j={j} cls={calendarFor} quota={quota} bookHref={bookHref} />}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2.5 text-slate-600">
        <RunDays mask={j.runDays} />
        <span>{t("card.runs", { from: j.origin, to: j.destination })}</span>
        {j.co2Saved > 0 && (
          <span className="inline-flex items-center gap-1 text-ok">
            <Leaf className="size-4" aria-hidden /> {t("card.co2", { kg: j.co2Saved })}
          </span>
        )}
      </div>
    </article>
  );
}

type Cal = { date: string; runs: boolean; avail: Availability | null }[];

function AvailabilityPanel({ j, cls, quota, bookHref }: { j: JourneyResult; cls: ClassCode; quota: Quota; bookHref: (cls: ClassCode, date: string) => string }) {
  const t = useT();
  const key = `${j.number}|${cls}|${quota}|${j.date}`;
  const [state, setState] = useState<{ key: string; cal?: Cal; fare?: number; error?: boolean } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ train: j.number, from: j.from.code, to: j.to.code, date: j.date, cls, quota, days: "6" });
    fetch(`/api/availability?${qs}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setState(d.error ? { key, error: true } : { key, cal: d.calendar, fare: d.fare.total }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [j, cls, quota, key]);

  const loaded = state?.key === key ? state : null;
  return (
    <div className="border-t-2 border-ground bg-brand-light px-5 py-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{t(`class.${cls}` as MessageKey)} ({cls})</span>
        {loaded?.fare !== undefined && <span>{t("card.farePerAdult")} <b>{inr(loaded.fare)}</b></span>}
      </div>
      {!loaded ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" aria-hidden /> {t("card.checking")}</div>
      ) : loaded.error ? (
        <p className="text-sm text-bad">{t("card.calError")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {loaded.cal!.map((d) => {
            const a = d.avail;
            return (
              <div key={d.date} className={`rounded-md bg-white p-2.5 text-[0.9rem] ${d.date === j.date ? "ring-[3px] ring-brand" : ""}`}>
                <div className="text-sm text-slate-500">{formatDate(d.date, undefined, t.locale)}{d.date === j.date && ` · ${t("card.yourDate")}`}</div>
                {!d.runs || !a ? (
                  <div className="py-1 text-slate-500">{t("card.noRun")}</div>
                ) : (
                  <>
                    <div className={`font-semibold ${availTone(a.status)}`}>{availText(a, t)}</div>
                    {a.status === "WL" && <div className="text-sm text-slate-500">{t("card.chanceShort", { pct: pct(a.chance) })}</div>}
                    {a.bookable ? (
                      <Link href={bookHref(cls, d.date)} className="btn-primary mt-1.5 w-full py-1 text-sm">{t("card.book")}</Link>
                    ) : (
                      a.note && <div className="mt-1 text-sm leading-tight text-slate-500">{t.msg(a.note)}</div>
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

import Link from "next/link";
import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSegment } from "@/lib/rail";
import { getAvailability } from "@/lib/availability";
import { savedPassengers } from "@/lib/booking";
import { CLASSES, PREMIUM_TYPES, QUOTAS, type Quota } from "@/lib/constants";
import { formatDate, formatDuration, isValidDate } from "@/lib/dates";
import { availText, availTone, pct } from "@/lib/format";
import { decodeLegs, type LegRef } from "@/lib/trip-url";
import { BookingForm } from "@/components/BookingForm";

export const metadata: Metadata = { title: "Passenger details" };

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  const user = await requireUser(`/book?${qs}`);

  const quota = (get("quota") in QUOTAS ? get("quota") : "GN") as Quota;
  const refs: LegRef[] = get("legs")
    ? decodeLegs(get("legs"))
    : [{ train: get("train"), from: get("from").toUpperCase(), to: get("to").toUpperCase(), date: get("date"), cls: get("cls") as LegRef["cls"] }];
  const legs = refs.map((r) => {
    const seg = isValidDate(r.date) && r.cls in CLASSES ? getSegment(r.train, r.from, r.to, r.date) : null;
    return seg && seg.train.classes.includes(r.cls) ? { ref: r, seg, avail: getAvailability(seg, r.cls, quota) } : null;
  });

  if (!legs.length || legs.some((l) => !l)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="card p-6 text-center">
          <h1 className="mb-2 text-lg font-semibold">This journey isn&apos;t available</h1>
          <p className="mb-4 text-sm text-slate-600">A train may not run on that date, or the class or stations are invalid.</p>
          <Link href="/" className="btn-primary">Search again</Link>
        </div>
      </div>
    );
  }
  const ok = legs as NonNullable<(typeof legs)[number]>[];
  const blocked = ok.find((l) => !l.avail.bookable);
  const multi = ok.length > 1;
  const sameTrain = multi && ok[0].seg.train.number === ok[1].seg.train.number;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <ol className="mb-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
        <li className="text-slate-500">1. Search</li><li>›</li>
        <li className="text-brand">2. Passenger details</li><li>›</li>
        <li>3. Review</li><li>›</li>
        <li>4. Payment</li>
      </ol>
      {multi && (
        <p className="mb-3 rounded-lg border border-brand/30 bg-brand-light px-3 py-2 text-sm">
          {sameTrain ? (
            <>Split ticket: <b>same train, two tickets, one payment</b>. Both pieces are confirmed; you move to your second seat at {ok[1].seg.from.name}.</>
          ) : (
            <>Connecting journey: <b>{ok.length} trains, one payment</b>. Each train gets its own PNR and ticket.</>
          )}
        </p>
      )}

      <div className="mb-4 space-y-2">
        {ok.map(({ ref, seg, avail }, i) => (
          <div key={i}>
            {multi && i > 0 && (
              <p className="flex items-center gap-1.5 px-1 py-1 text-sm text-warn">
                <Clock className="size-4" /> {sameTrain ? `Change seats at ${seg.from.name} (stay on the same train)` : `Change at ${seg.from.name}`}
              </p>
            )}
            <div className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {multi && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{sameTrain ? `Ticket ${i + 1}` : `Train ${i + 1}`}</p>}
                  <Link href={`/train/${seg.train.number}?from=${seg.from.code}&to=${seg.to.code}&date=${seg.date}`} className="font-semibold hover:underline">
                    <span className="font-mono">{seg.train.number}</span> {seg.train.name}
                  </Link>
                  <p className="text-sm text-slate-600">{CLASSES[ref.cls].name} ({ref.cls}) · {QUOTAS[quota].name} quota</p>
                </div>
                <div className="text-right text-sm">
                  <span className={`font-semibold ${availTone(avail.status)}`}>{availText(avail)}</span>
                  {avail.status === "WL" && <span className="block text-xs text-slate-500">{pct(avail.chance)} chance of confirmation</span>}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div>
                  <div className="text-xl font-bold">{seg.from.dep}</div>
                  <div className="text-sm">{seg.from.name} ({seg.from.code})</div>
                  <div className="text-xs text-slate-500">{formatDate(seg.date)}</div>
                </div>
                <div className="text-center text-xs text-slate-500">{formatDuration(seg.duration)}<br />{seg.distance} km</div>
                <div className="text-right">
                  <div className="text-xl font-bold">{seg.to.arr}</div>
                  <div className="text-sm">{seg.to.name} ({seg.to.code})</div>
                  <div className="text-xs text-slate-500">{formatDate(seg.arrivalDate)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {blocked ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Booking not possible on {blocked.seg.train.number}: {blocked.avail.label}</p>
          {blocked.avail.note && <p className="mt-1 text-sm text-slate-600">{blocked.avail.note}</p>}
          <Link href={`/search?from=${ok[0].seg.from.code}&to=${ok[ok.length - 1].seg.to.code}&date=${ok[0].seg.date}&quota=${quota}`} className="btn-primary mt-4">
            See other trains
          </Link>
        </div>
      ) : (
        <BookingForm
          quota={quota}
          journeys={ok.map(({ ref, seg, avail }) => ({
            train: seg.train.number, from: seg.from.code, to: seg.to.code, date: seg.date, cls: ref.cls,
            km: seg.distance, trainType: seg.train.type, premium: PREMIUM_TYPES.has(seg.train.type), availStatus: avail.status,
          }))}
          user={{ email: user.email, phone: user.phone ?? "", name: user.full_name }}
          saved={savedPassengers(user.id)}
        />
      )}
    </div>
  );
}

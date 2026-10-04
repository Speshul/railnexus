import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSegment } from "@/lib/rail";
import { getAvailability } from "@/lib/availability";
import { savedPassengers } from "@/lib/booking";
import { CLASSES, PREMIUM_TYPES, QUOTAS, type ClassCode, type Quota } from "@/lib/constants";
import { formatDate, formatDuration, isValidDate } from "@/lib/dates";
import { availTone, pct } from "@/lib/format";
import { BookingForm } from "@/components/BookingForm";

export const metadata: Metadata = { title: "Passenger details" };

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  const user = await requireUser(`/book?${qs}`);

  const cls = get("cls") as ClassCode;
  const quota = (get("quota") || "GN") as Quota;
  const date = get("date");
  const seg = isValidDate(date) && cls in CLASSES && quota in QUOTAS ? getSegment(get("train"), get("from"), get("to"), date) : null;

  if (!seg || !seg.train.classes.includes(cls)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="card p-6 text-center">
          <h1 className="mb-2 text-lg font-semibold">This journey isn&apos;t available</h1>
          <p className="mb-4 text-sm text-slate-600">The train may not run on that date, or the class/stations are invalid.</p>
          <Link href="/" className="btn-primary">Search again</Link>
        </div>
      </div>
    );
  }
  const avail = getAvailability(seg, cls, quota);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <ol className="mb-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
        <li className="text-slate-400">1. Search</li><li>›</li>
        <li className="text-brand">2. Passenger details</li><li>›</li>
        <li>3. Review</li><li>›</li>
        <li>4. Payment</li>
      </ol>

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/train/${seg.train.number}?from=${seg.from.code}&to=${seg.to.code}`} className="font-semibold hover:underline">
              <span className="font-mono">{seg.train.number}</span> {seg.train.name}
            </Link>
            <p className="text-sm text-slate-600">{CLASSES[cls].name} ({cls}) · {QUOTAS[quota].name} quota</p>
          </div>
          <div className="text-right text-sm">
            <span className={`font-semibold ${availTone(avail.status)}`}>{avail.label}</span>
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

      {!avail.bookable ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Booking not possible: {avail.label}</p>
          {avail.note && <p className="mt-1 text-sm text-slate-600">{avail.note}</p>}
          <Link href={`/search?from=${seg.from.code}&to=${seg.to.code}&date=${seg.date}&quota=${quota}`} className="btn-primary mt-4">See other trains</Link>
        </div>
      ) : (
        <BookingForm
          journey={{
            train: seg.train.number, from: seg.from.code, to: seg.to.code, date: seg.date, cls, quota,
            km: seg.distance, trainType: seg.train.type, premium: PREMIUM_TYPES.has(seg.train.type),
            availStatus: avail.status,
          }}
          user={{ email: user.email, phone: user.phone ?? "", name: user.full_name }}
          saved={savedPassengers(user.id)}
        />
      )}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { chartStatus, getBookingByPnr } from "@/lib/booking";
import { APP_NAME, CLASSES, QUOTAS } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { statusTone } from "@/lib/format";

export const metadata: Metadata = { title: "PNR status" };

export default async function PnrPage({ searchParams }: PageProps<"/pnr">) {
  const sp = await searchParams;
  const n = typeof sp.n === "string" ? sp.n.replace(/\D/g, "") : "";
  const b = n.length === 10 ? getBookingByPnr(n) : null;
  const chart = b ? chartStatus(b) : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">PNR status</h1>
      <p className="mb-4 text-sm text-slate-600">Enter the 10-digit PNR printed on the ticket. Passenger names are hidden for privacy.</p>
      <form className="card mb-6 flex gap-2 p-3" action="/pnr">
        <input name="n" defaultValue={n} inputMode="numeric" maxLength={10} pattern="\d{10}" required placeholder="10-digit PNR" className="input font-mono tracking-widest" />
        <button className="btn-primary"><Search className="size-4" /> Check</button>
      </form>

      {n && !b && <div className="card p-6 text-center text-slate-600">No booking found for PNR {n}.</div>}
      {b && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 p-4">
            <div>
              <div className="font-mono text-sm text-slate-500">PNR {b.pnr}</div>
              <h2 className="text-lg font-semibold">{b.train_number} {b.fare.trainName}</h2>
              <p className="text-sm text-slate-600">{CLASSES[b.class_code].name} ({b.class_code}) · {QUOTAS[b.quota].name} quota</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${chart === "Chart prepared" ? "bg-amber-100 text-warn" : "bg-slate-100 text-slate-600"}`}>{chart}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 text-sm">
            <div>
              <div className="text-lg font-bold">{b.fare.dep}</div>
              <div>{b.fare.fromName} ({b.from_code})</div>
              <div className="text-xs text-slate-500">{formatDate(b.journey_date)}</div>
            </div>
            <div className="text-center text-xs text-slate-500">{formatDuration(b.fare.duration)}</div>
            <div className="text-right">
              <div className="text-lg font-bold">{b.fare.arr}</div>
              <div>{b.fare.toName} ({b.to_code})</div>
              <div className="text-xs text-slate-500">{formatDate(b.fare.arrivalDate)}</div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2">Passenger</th><th className="px-4 py-2">Booking status</th><th className="px-4 py-2">Current status</th></tr>
            </thead>
            <tbody>
              {b.passengers.map((p, i) => (
                <tr key={p.idx} className="border-t border-slate-100">
                  <td className="px-4 py-2">Passenger {i + 1}</td>
                  <td className="px-4 py-2 font-mono text-xs">{b.status === "PENDING_PAYMENT" ? "Awaiting payment" : p.booking_status ?? "—"}</td>
                  <td className={`px-4 py-2 font-mono text-xs font-semibold ${statusTone(p.status)}`}>{p.cancelled ? "CANCELLED" : p.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 p-4 text-xs text-slate-500">
            Booked on {APP_NAME}. Signed in as the booker? <Link href="/account" className="text-brand underline">See the full ticket in My Bookings</Link>.
          </p>
        </div>
      )}
    </div>
  );
}


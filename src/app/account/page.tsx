import Link from "next/link";
import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listBookings, savedPassengers } from "@/lib/booking";
import { formatDate } from "@/lib/dates";
import { inr } from "@/lib/format";
import { removeSavedPassenger } from "@/app/actions/booking";

export const metadata: Metadata = { title: "My account" };

const STATUS: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-warn",
  CONFIRMED: "bg-green-100 text-ok",
  EXPIRED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-slate-100 text-slate-500",
};
const LABEL: Record<string, string> = { PENDING_PAYMENT: "Awaiting payment", CONFIRMED: "Booked", EXPIRED: "Hold expired", CANCELLED: "Released" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const bookings = listBookings(user.id);
  const passengers = savedPassengers(user.id);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold">{user.full_name}</h1>
      <p className="mb-6 text-sm text-slate-600">@{user.username} · {user.email} · {user.phone}</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">My bookings</h2>
          {bookings.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-600">No bookings yet. <Link href="/" className="text-brand underline">Search trains</Link></div>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <Link key={b.id} href={`/booking/${b.id}`} className="card flex flex-wrap items-center justify-between gap-2 p-4 hover:border-brand">
                  <div>
                    <div className="font-semibold"><span className="font-mono">{b.train_number}</span> {b.fare.trainName}</div>
                    <div className="text-sm text-slate-600">
                      {b.fare.fromName} → {b.fare.toName} · {formatDate(b.journey_date)} · {b.class_code} · {b.passengers.length} pax
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[b.status]}`}>{LABEL[b.status] ?? b.status}</span>
                    <div className="mt-1 text-sm font-semibold">{inr(b.total_paise / 100, true)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Saved passengers</h2>
          <div className="card divide-y divide-slate-100">
            {passengers.length === 0 && <p className="p-4 text-sm text-slate-500">Passengers you save while booking appear here.</p>}
            {passengers.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 text-sm">
                <span><b>{p.name}</b> <span className="text-slate-500">{p.age} · {p.gender}{p.berth_pref && ` · ${p.berth_pref}`}</span></span>
                <form action={removeSavedPassenger.bind(null, p.id)}>
                  <button aria-label={`Remove ${p.name}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-bad"><Trash2 className="size-4" /></button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

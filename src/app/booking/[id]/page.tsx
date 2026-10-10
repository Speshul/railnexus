import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Clock, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTrip, quoteCancellation, refundsFor, type BookingRecord } from "@/lib/booking";
import { CLASSES, FOOD_PREFS, QUOTAS, SEAT_PREFS, SLEEPER_BERTHS } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { inr, pct, statusTone } from "@/lib/format";
import { bookHref } from "@/lib/trip-url";
import { HoldTimer } from "@/components/HoldTimer";
import { PayButton } from "@/components/PayButton";
import { CancelPanel } from "@/components/CancelPanel";
import { cancelHold } from "@/app/actions/booking";

export const metadata: Metadata = { title: "Your booking" };

const BERTHS: Record<string, string> = { ...SLEEPER_BERTHS, ...SEAT_PREFS };
const GENDER: Record<string, string> = { M: "Male", F: "Female", T: "Transgender" };
const fullDate = (d: string) => formatDate(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

function LegCard({ b, index, multi, paid, tripId }: { b: BookingRecord; index: number; multi: boolean; paid: boolean; tripId: string }) {
  const f = b.fare;
  const cancellable = b.passengers.filter((p) => !p.cancelled && p.age >= 5).map((p) => p.idx);
  const quote = paid ? quoteCancellation(b, cancellable) : null;
  const refunds = paid ? refundsFor(b.id) : [];
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 p-4">
        <div>
          {multi && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Train {index + 1}</p>}
          <h2 className="font-semibold"><span className="font-mono">{b.train_number}</span> {f.trainName}</h2>
          <p className="text-sm text-slate-600">{CLASSES[b.class_code].name} ({b.class_code}) · {QUOTAS[b.quota].name} quota</p>
        </div>
        <div className="text-right text-sm">
          {b.pnr ? (
            <>
              <div className="text-xs text-slate-500">PNR</div>
              <div className="font-mono text-lg font-bold tracking-wider">{b.pnr}</div>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-500">Status if booked now</div>
              <div className="font-semibold">{f.availabilityAtBooking}</div>
              {f.availabilityAtBooking.includes("WL") && <div className="text-xs text-slate-500">{pct(f.chance)} chance of confirmation</div>}
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4">
        <div>
          <div className="text-xl font-bold">{f.dep}</div>
          <div className="text-sm">{f.fromName} ({b.from_code})</div>
          <div className="text-xs text-slate-500">{fullDate(b.journey_date)}</div>
        </div>
        <div className="text-center text-xs text-slate-500">{formatDuration(f.duration)}<br />{f.distance} km</div>
        <div className="text-right">
          <div className="text-xl font-bold">{f.arr}</div>
          <div className="text-sm">{f.toName} ({b.to_code})</div>
          <div className="text-xs text-slate-500">{fullDate(f.arrivalDate)}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Age</th><th className="px-4 py-2">Gender</th>
              <th className="px-4 py-2">{paid ? "Status" : "Preference"}</th><th className="px-4 py-2 text-right">Fare</th>
            </tr>
          </thead>
          <tbody>
            {b.passengers.map((p, i) => {
              const pf = f.perPassenger[i];
              return (
                <tr key={p.idx} className="border-t border-slate-100">
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2">{p.age}</td>
                  <td className="px-4 py-2">{GENDER[p.gender]}</td>
                  <td className="px-4 py-2">
                    {paid ? (
                      <span className={`font-semibold ${statusTone(p.status)}`}>
                        {p.cancelled ? <>Cancelled <span className="font-normal text-slate-500">(refund {inr(p.refund_paise / 100)})</span></> : p.status}
                      </span>
                    ) : (
                      <span className="text-slate-600">
                        {pf?.kind === "infant" ? "Infant, no berth" : p.no_berth ? "No berth (child)" : p.berth_pref ? BERTHS[p.berth_pref] : "No preference"}
                        {p.food_pref && ` · ${FOOD_PREFS[p.food_pref as keyof typeof FOOD_PREFS]}`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{pf?.fare ? inr(pf.fare.total) : "Free"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {paid && (
        <div className="flex flex-wrap items-start gap-3 border-t border-slate-100 p-4">
          {b.pnr && b.status !== "CANCELLED" && (
            <Link href={`/ticket/${b.pnr}`} className="btn-brand py-1.5 text-sm"><Ticket className="size-4" /> View e-ticket</Link>
          )}
          {b.pnr && <Link href={`/pnr?n=${b.pnr}`} className="btn-secondary py-1.5 text-sm">PNR status</Link>}
          <div className="w-full sm:w-auto sm:flex-1">
            <CancelPanel tripId={tripId} bookingId={b.id} pnr={b.pnr ?? ""} rows={quote?.rows ?? []} blockedReason={quote?.reason} />
          </div>
          {refunds.length > 0 && (
            <div className="w-full text-xs text-slate-600">
              {refunds.map((r) => (
                <p key={r.id}>Refund {inr(r.amount_paise / 100)} · {r.status} · <span className="font-mono">{r.id}</span> · {new Date(r.created_at).toLocaleString("en-IN")}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default async function TripPage({ params, searchParams }: PageProps<"/booking/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/booking/${id}`);
  const trip = getTrip(id, user.id);
  if (!trip) notFound();
  const first = trip.legs[0];
  const paid = trip.status === "CONFIRMED" || (trip.status === "CANCELLED" && !!trip.payment && trip.payment.status === "PAID");
  const pending = trip.status === "PENDING_PAYMENT";
  const again = bookHref(trip.legs.map((b) => ({ train: b.train_number, from: b.from_code, to: b.to_code, date: b.journey_date, cls: b.class_code })), first.quota);
  const multi = trip.legs.length > 1;
  const convenience = trip.legs.reduce((s, b) => s + b.fare.convenienceFee, 0);
  const insurance = trip.legs.reduce((s, b) => s + b.fare.insurance, 0);
  const ticketFare = trip.legs.reduce((s, b) => s + b.fare.ticketFare, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ol className="mb-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
        <li className="text-slate-500">1. Search</li><li>›</li>
        <li className="text-slate-500">2. Passenger details</li><li>›</li>
        <li className={pending ? "text-brand" : "text-slate-500"}>3. Review</li><li>›</li>
        <li className={paid ? "text-brand" : ""}>4. {paid ? "Booked" : "Payment"}</li>
      </ol>

      {paid && sp.paid === "1" && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ok" />
          <div>
            <p className="font-semibold text-ok">Payment successful. Your {multi ? "tickets are" : "ticket is"} booked!</p>
            <p className="text-sm text-slate-700">
              PNR {trip.legs.map((b) => b.pnr).join(" & ")} · paid {inr(trip.totalPaise / 100, true)} via Razorpay ({trip.payment?.method ?? "test"}).
              Your e-ticket is below and in <Link href="/account" className="underline">My Bookings</Link>.
            </p>
          </div>
        </div>
      )}
      {pending && trip.expiresAt && <HoldTimer expiresAt={trip.expiresAt} />}
      {trip.status === "EXPIRED" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-bad">
          This seat hold expired. <Link href={again} className="font-semibold underline">Start the booking again</Link>.
        </div>
      )}
      {trip.status === "CANCELLED" && !paid && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          This booking was released{trip.refundPaise > 0 && <> and {inr(trip.refundPaise / 100)} refunded</>}. <Link href={again} className="font-semibold underline">Book again</Link>.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          {trip.legs.map((b, i) => (
            <div key={b.id}>
              {multi && i > 0 && (
                <p className="flex items-center gap-1.5 px-1 pb-2 text-sm text-warn">
                  <Clock className="size-4" />
                  {b.train_number === trip.legs[0].train_number ? `Change seats at ${b.fare.fromName} (same train)` : `Change trains at ${b.fare.fromName}`}
                </p>
              )}
              <LegCard b={b} index={i} multi={multi} paid={paid} tripId={trip.id} />
            </div>
          ))}
          <section className="card grid gap-2 p-4 text-sm sm:grid-cols-2">
            <div><span className="label">Contact</span>{first.contact_email} · {first.contact_phone}</div>
            <div>
              <span className="label">Options</span>
              Insurance: {first.options.insurance ? "Yes" : "No"} · Auto-upgrade: {first.options.autoUpgrade ? "Yes" : "No"}
              {first.options.confirmOnly && " · Confirmed berths only"}
            </div>
          </section>
        </div>

        <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-4">
          <h2 className="font-semibold">{paid ? "Payment" : "Payment summary"}</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Ticket fare{multi && ` (${trip.legs.length} trains)`}</dt><dd>{inr(ticketFare)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Convenience fee (incl. GST)</dt><dd>{inr(convenience, true)}</dd></div>
            {insurance > 0 && <div className="flex justify-between"><dt className="text-slate-600">Travel insurance</dt><dd>{inr(insurance, true)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>{paid ? "Paid" : "Total payable"}</dt><dd>{inr(trip.totalPaise / 100, true)}</dd></div>
            {trip.refundPaise > 0 && <div className="flex justify-between text-ok"><dt>Refunded</dt><dd>{inr(trip.refundPaise / 100, true)}</dd></div>}
          </dl>
          {pending && (
            <>
              <PayButton tripId={trip.id} amountPaise={trip.totalPaise} />
              <form action={cancelHold.bind(null, trip.id)}>
                <button className="btn-secondary w-full">Release seats</button>
              </form>
              <Link href={again} className="block text-center text-xs text-brand hover:underline">Edit passengers</Link>
            </>
          )}
          {paid && trip.payment?.payment_id && (
            <p className="text-xs text-slate-500">Razorpay payment <span className="font-mono">{trip.payment.payment_id}</span></p>
          )}
          {!pending && !paid && <Link href={again} className="btn-primary w-full">Book again</Link>}
        </aside>
      </div>
    </div>
  );
}

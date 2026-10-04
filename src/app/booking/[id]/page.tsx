import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CreditCard, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBooking } from "@/lib/booking";
import { CLASSES, FOOD_PREFS, QUOTAS, SEAT_PREFS, SLEEPER_BERTHS } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { inr, pct } from "@/lib/format";
import { HoldTimer } from "@/components/HoldTimer";
import { cancelHold } from "@/app/actions/booking";

export const metadata: Metadata = { title: "Review booking" };

const BERTHS: Record<string, string> = { ...SLEEPER_BERTHS, ...SEAT_PREFS };
const GENDER: Record<string, string> = { M: "Male", F: "Female", T: "Transgender" };

export default async function ReviewPage({ params }: PageProps<"/booking/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/booking/${id}`);
  const b = getBooking(id, user.id);
  if (!b) notFound();
  const f = b.fare;
  const pending = b.status === "PENDING_PAYMENT";
  const bookAgain = `/book?${new URLSearchParams({ train: b.train_number, from: b.from_code, to: b.to_code, date: b.journey_date, cls: b.class_code, quota: b.quota })}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ol className="mb-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
        <li className="text-slate-400">1. Search</li><li>›</li>
        <li className="text-slate-400">2. Passenger details</li><li>›</li>
        <li className="text-brand">3. Review</li><li>›</li>
        <li>4. Payment</li>
      </ol>

      {pending && b.expires_at && <HoldTimer expiresAt={b.expires_at} />}
      {b.status === "EXPIRED" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-bad">
          This seat hold expired. <Link href={bookAgain} className="font-semibold underline">Start the booking again</Link>.
        </div>
      )}
      {b.status === "CANCELLED" && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          You released this hold. <Link href={bookAgain} className="font-semibold underline">Book again</Link>.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <section className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="font-semibold"><span className="font-mono">{b.train_number}</span> {f.trainName}</h1>
                <p className="text-sm text-slate-600">{CLASSES[b.class_code].name} ({b.class_code}) · {QUOTAS[b.quota].name} quota</p>
              </div>
              <div className="text-right text-sm">
                <div className="text-xs text-slate-500">Status if booked now</div>
                <div className="font-semibold">{f.availabilityAtBooking}</div>
                {f.availabilityAtBooking.includes("WL") && <div className="text-xs text-slate-500">{pct(f.chance)} chance of confirmation</div>}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <div className="text-xl font-bold">{f.dep}</div>
                <div className="text-sm">{f.fromName} ({b.from_code})</div>
                <div className="text-xs text-slate-500">{formatDate(b.journey_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
              <div className="text-center text-xs text-slate-500">{formatDuration(f.duration)}<br />{f.distance} km</div>
              <div className="text-right">
                <div className="text-xl font-bold">{f.arr}</div>
                <div className="text-sm">{f.toName} ({b.to_code})</div>
                <div className="text-xs text-slate-500">{formatDate(f.arrivalDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
            </div>
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Passengers</h2>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Age</th><th className="px-4 py-2">Gender</th><th className="px-4 py-2">Preference</th><th className="px-4 py-2 text-right">Fare</th></tr>
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
                      <td className="px-4 py-2 text-slate-600">
                        {pf?.kind === "infant" ? "Infant, no berth" : p.no_berth ? "No berth (child)" : p.berth_pref ? BERTHS[p.berth_pref] : "No preference"}
                        {p.food_pref && ` · ${FOOD_PREFS[p.food_pref as keyof typeof FOOD_PREFS]}`}
                      </td>
                      <td className="px-4 py-2 text-right">{pf?.fare ? inr(pf.fare.total) : "Free"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="card grid gap-2 p-4 text-sm sm:grid-cols-2">
            <div><span className="label">Contact</span>{b.contact_email} · {b.contact_phone}</div>
            <div>
              <span className="label">Options</span>
              Insurance: {b.options.insurance ? "Yes" : "No"} · Auto-upgrade: {b.options.autoUpgrade ? "Yes" : "No"}
              {b.options.confirmOnly && " · Confirmed berths only"}
            </div>
          </section>
        </div>

        <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-4">
          <h2 className="font-semibold">Payment summary</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Ticket fare</dt><dd>{inr(f.ticketFare)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Convenience fee (incl. GST)</dt><dd>{inr(f.convenienceFee, true)}</dd></div>
            {f.insurance > 0 && <div className="flex justify-between"><dt className="text-slate-600">Travel insurance</dt><dd>{inr(f.insurance, true)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>Total payable</dt><dd>{inr(b.total_paise / 100, true)}</dd></div>
          </dl>
          {pending ? (
            <>
              {/* Phase 3: Razorpay checkout replaces this placeholder. */}
              <button className="btn-primary w-full py-3" disabled title="Payment gateway arrives in the next phase">
                <CreditCard className="size-4" /> Pay {inr(b.total_paise / 100, true)}
              </button>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="size-3.5" /> Payment gateway is being integrated. Your seats stay held until the timer runs out.
              </p>
              <form action={cancelHold.bind(null, b.id)}>
                <button className="btn-secondary w-full">Release seats</button>
              </form>
              <Link href={bookAgain} className="block text-center text-xs text-brand hover:underline">Edit passengers</Link>
            </>
          ) : (
            <Link href={bookAgain} className="btn-primary w-full">Book again</Link>
          )}
        </aside>
      </div>
    </div>
  );
}

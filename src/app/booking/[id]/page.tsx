import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Clock, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTrip, quoteCancellation, refundsFor, type BookingRecord } from "@/lib/booking";
import { sunForJourney } from "@/lib/sunpath";
import { isRoundTrip } from "@/lib/rail";
import { SunSide } from "@/components/SunSide";
import { CoachBoard } from "@/components/CoachBoard";
import { SLEEPER_BERTHS } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { inr, pct, statusTone } from "@/lib/format";
import { bookHref } from "@/lib/trip-url";
import { HoldTimer } from "@/components/HoldTimer";
import { PayButton } from "@/components/PayButton";
import { WalletPay } from "@/components/WalletPay";
import { walletBalance } from "@/lib/wallet";
import { CancelPanel } from "@/components/CancelPanel";
import { cancelHold } from "@/app/actions/booking";
import { getT } from "@/i18n/server";
import type { MessageKey, T } from "@/i18n/core";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("trip.meta") };
}

const fullDate = (d: string, t: T) => formatDate(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, t.locale);
const berthName = (code: string, t: T) => t(`${code in SLEEPER_BERTHS ? "berth" : "seat"}.${code}` as MessageKey);

async function LegCard({ b, index, multi, roundTrip, paid, tripId, t }: { b: BookingRecord; index: number; multi: boolean; roundTrip: boolean; paid: boolean; tripId: string; t: T }) {
  const f = b.fare;
  const cancellable = b.passengers.filter((p) => !p.cancelled && p.age >= 5).map((p) => p.idx);
  const quote = paid ? quoteCancellation(b, cancellable) : null;
  const refunds = paid ? await refundsFor(b.id) : [];
  const sun = b.status !== "CANCELLED" ? sunForJourney(b.train_number, b.from_code, b.to_code, b.train_start_date) : null;
  return (
    <section className="card overflow-hidden">
      {multi && <p className="bg-brand px-5 pb-1 pt-1.5 font-sign text-[1.2rem] uppercase leading-none tracking-[0.05em] text-accent">{roundTrip ? t(index === 0 ? "book.going" : "book.comingBack") : t("book.trainN", { i: index + 1 })}</p>}
      <CoachBoard as="h2" number={b.train_number} name={f.trainName} from={f.fromName} to={f.toName} />
      <div className="flex items-stretch gap-4 border-b-2 border-ground px-5">
        <div className="flex-1 py-3">
          <p className="text-slate-700">{t("book.classQuota", { cls: t(`class.${b.class_code}` as MessageKey), code: b.class_code, quota: t(`quota.${b.quota}` as MessageKey) })}</p>
        </div>
        <div className="self-center text-right">
          {b.pnr ? (
            <>
              <div className="text-sm text-slate-500">{t("trip.pnr")}</div>
              <div className="font-sign text-lg font-bold tracking-wider">{b.pnr}</div>
            </>
          ) : (
            <>
              <div className="text-sm text-slate-500">{t("trip.statusNow")}</div>
              <div className="font-semibold">{f.availabilityAtBooking}</div>
              {f.availabilityAtBooking.includes("WL") && <div className="text-sm text-slate-500">{t("card.chance", { pct: pct(f.chance) })}</div>}
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4">
        <div>
          <div className="font-sign text-[2.6rem] leading-none text-ink">{f.dep}</div>
          <div className="text-sm">{f.fromName} ({b.from_code})</div>
          <div className="text-sm text-slate-500">{fullDate(b.journey_date, t)}</div>
        </div>
        <div className="text-center text-sm text-slate-500">{formatDuration(f.duration, t.locale)}<br />{t("unit.km", { n: f.distance })}</div>
        <div className="text-right">
          <div className="font-sign text-[2.6rem] leading-none text-ink">{f.arr}</div>
          <div className="text-sm">{f.toName} ({b.to_code})</div>
          <div className="text-sm text-slate-500">{fullDate(f.arrivalDate, t)}</div>
        </div>
      </div>
      {sun && (
        <details className="border-t border-slate-100 px-4 py-2 text-sm">
          <summary className="cursor-pointer py-1 font-medium text-brand">{t("sun.title")}</summary>
          <div className="pb-2 pt-1"><SunSide report={sun} t={t} compact /></div>
        </details>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-sm uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th><th className="px-4 py-2">{t("trip.th.name")}</th><th className="px-4 py-2">{t("trip.th.age")}</th><th className="px-4 py-2">{t("trip.th.gender")}</th>
              <th className="px-4 py-2">{paid ? t("trip.th.status") : t("trip.th.pref")}</th><th className="px-4 py-2 text-right">{t("trip.th.fare")}</th>
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
                  <td className="px-4 py-2">{t(`gender.${p.gender}` as MessageKey)}</td>
                  <td className="px-4 py-2">
                    {paid ? (
                      <span className={`font-semibold ${statusTone(p.status)}`}>
                        {p.cancelled ? <>{t("trip.cancelled")} <span className="font-normal text-slate-500">{t("trip.refundOf", { amount: inr(p.refund_paise / 100) })}</span></> : p.status}
                      </span>
                    ) : (
                      <span className="text-slate-600">
                        {pf?.kind === "infant" ? t("trip.infantNoBerth") : p.no_berth ? t("trip.noBerthChild") : p.berth_pref ? berthName(p.berth_pref, t) : t("trip.noPref")}
                        {p.food_pref && ` · ${t(`food.${p.food_pref}` as MessageKey)}`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{pf?.fare ? inr(pf.fare.total) : t("bf.free")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {paid && (
        <div className="flex flex-wrap items-start gap-3 border-t border-slate-100 p-4">
          {b.pnr && b.status !== "CANCELLED" && (
            <Link href={`/ticket/${b.pnr}`} className="btn-brand py-1.5 text-sm"><Ticket className="size-4" aria-hidden /> {t("trip.viewTicket")}</Link>
          )}
          {b.pnr && <Link href={`/pnr?n=${b.pnr}`} className="btn-secondary py-1.5 text-sm">{t("trip.pnrStatus")}</Link>}
          <div className="w-full sm:w-auto sm:flex-1">
            <CancelPanel tripId={tripId} bookingId={b.id} pnr={b.pnr ?? ""} rows={quote?.rows ?? []} blockedReason={quote?.reason} />
          </div>
          {refunds.length > 0 && (
            <div className="w-full text-sm text-slate-600">
              {refunds.map((r) => (
                <p key={r.id}>{t("trip.refundLine", { amount: inr(r.amount_paise / 100), status: r.status, id: r.id, when: new Date(r.created_at).toLocaleString(t.locale === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata" }) })}</p>
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
  const t = await getT();
  const trip = await getTrip(id, user.id);
  if (!trip) notFound();
  const first = trip.legs[0];
  const paid = trip.status === "CONFIRMED" || (trip.status === "CANCELLED" && !!trip.payment && trip.payment.status === "PAID");
  const pending = trip.status === "PENDING_PAYMENT";
  const balance = pending ? await walletBalance(user.id) : 0;
  const paidByWallet = trip.payment?.method === "wallet";
  const again = bookHref(trip.legs.map((b) => ({ train: b.train_number, from: b.from_code, to: b.to_code, date: b.journey_date, cls: b.class_code })), first.quota);
  const multi = trip.legs.length > 1;
  const roundTrip = multi && trip.legs[0].train_number !== trip.legs[1].train_number && isRoundTrip(trip.legs[0].from_code, trip.legs[1].to_code);
  const convenience = trip.legs.reduce((s, b) => s + b.fare.convenienceFee, 0);
  const insurance = trip.legs.reduce((s, b) => s + b.fare.insurance, 0);
  const ticketFare = trip.legs.reduce((s, b) => s + b.fare.ticketFare, 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <ol className="mb-4 flex flex-wrap gap-2 text-sm font-medium text-slate-500">
        <li className="text-slate-500">{t("steps.search")}</li><li aria-hidden>›</li>
        <li className="text-slate-500">{t("steps.passengers")}</li><li aria-hidden>›</li>
        <li className={pending ? "text-brand" : "text-slate-500"} aria-current={pending ? "step" : undefined}>{t("steps.review")}</li><li aria-hidden>›</li>
        <li className={paid ? "text-brand" : ""} aria-current={paid ? "step" : undefined}>{paid ? t("steps.booked") : t("steps.payment")}</li>
      </ol>

      {paid && sp.paid === "1" && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden />
          <div>
            <p className="font-semibold text-ok">{t.n("trip.paidTitle", trip.legs.length)}</p>
            <p className="text-sm text-slate-700">
              {t(paidByWallet ? "trip.paidBodyWallet" : "trip.paidBody", { pnrs: trip.legs.map((b) => b.pnr).join(" & "), amount: inr(trip.totalPaise / 100, true), method: trip.payment?.method ?? "test" })}{" "}
              <Link href="/account" className="underline">{t("trip.myBookings")}</Link>.
            </p>
          </div>
        </div>
      )}
      {pending && trip.expiresAt && <HoldTimer expiresAt={trip.expiresAt} />}
      {trip.status === "EXPIRED" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-bad">
          {t("trip.expired")} <Link href={again} className="font-semibold underline">{t("trip.startAgain")}</Link>.
        </div>
      )}
      {trip.status === "CANCELLED" && !paid && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {trip.refundPaise > 0 ? t("trip.releasedRefund", { amount: inr(trip.refundPaise / 100) }) : t("trip.released")} <Link href={again} className="font-semibold underline">{t("trip.bookAgain")}</Link>
        </div>
      )}

      <div className="grid grid-cols-[1fr_27rem] gap-6">
        <div className="space-y-3">
          {trip.legs.map((b, i) => (
            <div key={b.id}>
              {multi && i > 0 && (
                <p className="flex items-center gap-1.5 px-1 pb-2 text-sm text-warn">
                  <Clock className="size-4" aria-hidden />
                  {b.train_number === trip.legs[0].train_number ? t("trip.changeSeats", { station: b.fare.fromName })
                    : roundTrip ? t("book.returnFrom", { station: b.fare.fromName, date: formatDate(b.journey_date, undefined, t.locale) })
                    : t("trip.changeTrains", { station: b.fare.fromName })}
                </p>
              )}
              <LegCard b={b} index={i} multi={multi} roundTrip={roundTrip} paid={paid} tripId={trip.id} t={t} />
            </div>
          ))}
          <section className="card grid gap-2 p-4 text-sm sm:grid-cols-2">
            <div><span className="label">{t("trip.contact")}</span>{first.contact_email} · {first.contact_phone}</div>
            <div>
              <span className="label">{t("trip.options")}</span>
              {t("trip.optLine", { ins: first.options.insurance ? t("common.yes") : t("common.no"), up: first.options.autoUpgrade ? t("common.yes") : t("common.no") })}
              {first.options.confirmOnly && t("trip.confirmOnly")}
            </div>
          </section>
        </div>

        <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-4">
          <h2 className="font-sign text-[1.6rem] uppercase leading-none tracking-[0.03em] text-brand">{paid ? t("trip.payment") : t("trip.paymentSummary")}</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">{multi ? t("trip.ticketFareN", { n: trip.legs.length }) : t("fare.ticket")}</dt><dd>{inr(ticketFare)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">{t("fare.convenience")}</dt><dd>{inr(convenience, true)}</dd></div>
            {insurance > 0 && <div className="flex justify-between"><dt className="text-slate-600">{t("fare.insurance")}</dt><dd>{inr(insurance, true)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>{paid ? t("trip.paid") : t("trip.totalPayable")}</dt><dd>{inr(trip.totalPaise / 100, true)}</dd></div>
            {trip.refundPaise > 0 && <div className="flex justify-between text-ok"><dt>{t("trip.refunded")}</dt><dd>{inr(trip.refundPaise / 100, true)}</dd></div>}
          </dl>
          {pending && (
            <>
              <WalletPay
                tripId={trip.id}
                amountPaise={trip.totalPaise}
                balancePaise={balance}
                summary={{
                  trains: trip.legs.map((b) => `${b.train_number} ${b.fare.trainName}`).join(" + "),
                  route: `${trip.legs[0].fare.fromName} → ${trip.legs[trip.legs.length - 1].fare.toName}`,
                  date: formatDate(trip.legs[0].journey_date, { weekday: "short", day: "numeric", month: "short" }, t.locale),
                  cls: [...new Set(trip.legs.map((b) => b.class_code))].join(" + "),
                  passengers: trip.legs[0].passengers.map((p) => p.name),
                  boards: trip.legs.map((b) => ({ number: b.train_number, name: b.fare.trainName, from: b.fare.fromName, to: b.fare.toName })),
                }}
              />
              <p className="text-center text-sm text-slate-500">{t("wallet.or")}</p>
              <PayButton tripId={trip.id} amountPaise={trip.totalPaise} />
              <form action={cancelHold.bind(null, trip.id)}>
                <button className="btn-secondary w-full">{t("trip.release")}</button>
              </form>
              <Link href={again} className="block text-center text-sm text-brand hover:underline">{t("trip.edit")}</Link>
            </>
          )}
          {paid && trip.payment?.payment_id && (
            <p className="text-sm text-slate-500">{paidByWallet ? t("wallet.paidWith") : t("trip.rzpPayment", { id: trip.payment.payment_id })}</p>
          )}
          {!pending && !paid && <Link href={again} className="btn-primary w-full">{t("trip.bookAgain")}</Link>}
        </aside>
      </div>
    </div>
  );
}

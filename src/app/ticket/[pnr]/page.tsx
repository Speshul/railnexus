import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { Leaf, TrainFront } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBookingByPnr, ticketSignature } from "@/lib/booking";
import { getStops } from "@/lib/rail";
import { APP_NAME } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { inr, statusTone } from "@/lib/format";
import { siteOrigin } from "@/lib/origin";
import { co2SavedVsFlight } from "@/lib/carbon";
import { PrintButton } from "@/components/PrintButton";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/core";

export async function generateMetadata({ params }: PageProps<"/ticket/[pnr]">): Promise<Metadata> {
  return { title: (await getT())("ticket.meta", { pnr: (await params).pnr }) };
}

const fullDate = (d: string, locale: "en" | "hi") => formatDate(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, locale);

export default async function TicketPage({ params }: PageProps<"/ticket/[pnr]">) {
  const { pnr } = await params;
  const user = await requireUser(`/ticket/${pnr}`);
  const t = await getT();
  const L = t.locale;
  const b = /^\d{10}$/.test(pnr) ? await getBookingByPnr(pnr) : null;
  if (!b || b.user_id !== user.id) notFound();
  const f = b.fare;
  const verifyUrl = `${await siteOrigin()}/verify/${pnr}?s=${await ticketSignature(pnr)}`;
  const qr = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b2a56", light: "#ffffff" } });
  const halts = getStops(b.train_number).filter((s) => s.halt);
  const from = halts.find((s) => s.code === b.from_code);
  const to = halts.find((s) => s.code === b.to_code);
  const between = from && to ? halts.filter((s) => s.seq > from.seq && s.seq < to.seq).length : 0;
  const active = b.passengers.filter((p) => !p.cancelled);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/booking/${b.trip_id}`} className="text-sm text-brand hover:underline">{t("ticket.back")}</Link>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm print:rounded-none print:border-slate-400 print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-brand px-6 py-4 text-white print:bg-white print:text-slate-900">
          <div className="flex items-center gap-2">
            <TrainFront className="size-7 text-accent" aria-hidden />
            <div>
              <div className="text-lg font-bold">{t("ticket.title", { app: APP_NAME })}</div>
              <div className="text-xs opacity-90">{t("ticket.ers")}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-90">{t("ticket.pnr")}</div>
            <div className="font-mono text-2xl font-bold tracking-widest">{pnr}</div>
          </div>
        </header>

        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">{b.train_number} {f.trainName}</h1>
              <p className="text-sm text-slate-600">
                {t("ticket.line", { cls: t(`class.${b.class_code}` as MessageKey), code: b.class_code, quota: t(`quota.${b.quota}` as MessageKey), km: f.distance, n: between })}
              </p>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <div className="text-xs uppercase text-slate-500">{t("ticket.boarding")}</div>
                <div className="text-2xl font-bold">{f.dep}</div>
                <div className="font-medium">{f.fromName} ({b.from_code})</div>
                <div className="text-sm text-slate-600">{fullDate(b.journey_date, L)}</div>
              </div>
              <div className="text-center text-xs text-slate-500">{formatDuration(f.duration, L)}<div className="my-1 h-px w-16 bg-slate-300" /></div>
              <div className="text-right">
                <div className="text-xs uppercase text-slate-500">{t("ticket.arrival")}</div>
                <div className="text-2xl font-bold">{f.arr}</div>
                <div className="font-medium">{f.toName} ({b.to_code})</div>
                <div className="text-sm text-slate-600">{fullDate(f.arrivalDate, L)}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="size-36 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} aria-label={t("ticket.qr")} role="img" />
            <span className="text-xs text-slate-500">{t("ticket.scan")}</span>
          </div>
        </div>

        <div className="overflow-x-auto px-6">
          <table className="w-full text-sm">
            <thead className="border-y border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr><th className="py-2">#</th><th>{t("ticket.th.passenger")}</th><th>{t("ticket.th.age")}</th><th>{t("ticket.th.gender")}</th><th>{t("ticket.th.booking")}</th><th>{t("ticket.th.current")}</th><th>{t("ticket.th.meal")}</th></tr>
            </thead>
            <tbody>
              {b.passengers.map((p, i) => (
                <tr key={p.idx} className="border-b border-slate-100">
                  <td className="py-2">{i + 1}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.age}</td>
                  <td>{t(`gshort.${p.gender}` as MessageKey)}</td>
                  <td className="font-mono text-xs">{p.booking_status}</td>
                  <td className={`font-mono text-xs font-semibold ${statusTone(p.status)}`}>{p.cancelled ? t("ticket.cancelled") : p.status}</td>
                  <td className="text-xs">{p.food_pref ? t(`food.${p.food_pref}` as MessageKey) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 p-6 text-sm sm:grid-cols-2">
          <dl className="space-y-1">
            <div className="flex justify-between"><dt className="text-slate-500">{t("fare.ticket")}</dt><dd>{inr(f.ticketFare)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{t("fare.convenience")}</dt><dd>{inr(f.convenienceFee, true)}</dd></div>
            {f.insurance > 0 && <div className="flex justify-between"><dt className="text-slate-500">{t("fare.insurance")}</dt><dd>{inr(f.insurance, true)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-1 font-bold"><dt>{t("ticket.totalPaid")}</dt><dd>{inr(b.total_paise / 100, true)}</dd></div>
            {b.refund_paise > 0 && <div className="flex justify-between text-ok"><dt>{t("trip.refunded")}</dt><dd>{inr(b.refund_paise / 100, true)}</dd></div>}
          </dl>
          <div className="space-y-1 text-xs text-slate-600">
            <p><b>{t("ticket.booked")}</b> {b.confirmed_at ? new Date(b.confirmed_at).toLocaleString(L === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata" }) : "—"} · {t("ticket.active", { n: active.length, total: b.passengers.length })}</p>
            <p><b>{t("ticket.contact")}</b> {b.contact_email} · {b.contact_phone}</p>
            {co2SavedVsFlight(f.distance) > 0 && (
              <p className="flex items-center gap-1 text-ok">
                <Leaf className="size-3.5" aria-hidden /> {t("ticket.co2", { kg: co2SavedVsFlight(f.distance) * active.filter((p) => p.age >= 5).length })}
              </p>
            )}
            <p>{t("ticket.rules")}</p>
            <p>{t("ticket.live")} <Link href={`/pnr?n=${pnr}`} className="text-brand underline print:no-underline">{t("trip.pnrStatus")}</Link>.</p>
          </div>
        </div>
      </article>
    </div>
  );
}

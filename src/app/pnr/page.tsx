import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { chartStatus, getBookingByPnr } from "@/lib/booking";
import { APP_NAME } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { statusTone } from "@/lib/format";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/core";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("pnr.meta") };
}

export default async function PnrPage({ searchParams }: PageProps<"/pnr">) {
  const sp = await searchParams;
  const t = await getT();
  const L = t.locale;
  const n = typeof sp.n === "string" ? sp.n.replace(/\D/g, "") : "";
  const b = n.length === 10 ? await getBookingByPnr(n) : null;
  const chart = b ? chartStatus(b) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">{t("pnr.title")}</h1>
      <p className="mb-4 text-sm text-slate-600">{t("pnr.body")}</p>
      <form className="card mb-6 flex gap-2 p-3" action="/pnr">
        <input name="n" aria-label={t("pnr.label")} defaultValue={n} inputMode="numeric" maxLength={10} pattern="\d{10}" required placeholder={t("pnr.placeholder")} className="input font-mono tracking-widest" />
        <button className="btn-primary"><Search className="size-4" aria-hidden /> {t("pnr.check")}</button>
      </form>

      {n && !b && <div className="card p-6 text-center text-slate-600">{t("pnr.none", { n })}</div>}
      {b && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 p-4">
            <div>
              <div className="font-mono text-sm text-slate-500">{t("pnr.pnr", { n: b.pnr ?? "" })}</div>
              <h2 className="text-lg font-semibold">{b.train_number} {b.fare.trainName}</h2>
              <p className="text-sm text-slate-600">{t("book.classQuota", { cls: t(`class.${b.class_code}` as MessageKey), code: b.class_code, quota: t(`quota.${b.quota}` as MessageKey) })}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${chart === "chart.prepared" ? "bg-amber-100 text-warn" : "bg-slate-100 text-slate-600"}`}>{chart && t(chart)}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 text-sm">
            <div>
              <div className="text-lg font-bold">{b.fare.dep}</div>
              <div>{b.fare.fromName} ({b.from_code})</div>
              <div className="text-xs text-slate-500">{formatDate(b.journey_date, undefined, L)}</div>
            </div>
            <div className="text-center text-xs text-slate-500">{formatDuration(b.fare.duration, L)}</div>
            <div className="text-right">
              <div className="text-lg font-bold">{b.fare.arr}</div>
              <div>{b.fare.toName} ({b.to_code})</div>
              <div className="text-xs text-slate-500">{formatDate(b.fare.arrivalDate, undefined, L)}</div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2">{t("ticket.th.passenger")}</th><th className="px-4 py-2">{t("ticket.th.booking")}</th><th className="px-4 py-2">{t("ticket.th.current")}</th></tr>
            </thead>
            <tbody>
              {b.passengers.map((p, i) => (
                <tr key={p.idx} className="border-t border-slate-100">
                  <td className="px-4 py-2">{t("pnr.passenger", { i: i + 1 })}</td>
                  <td className="px-4 py-2 font-mono text-xs">{b.status === "PENDING_PAYMENT" ? t("pnr.awaiting") : p.booking_status ?? "—"}</td>
                  <td className={`px-4 py-2 font-mono text-xs font-semibold ${statusTone(p.status)}`}>{p.cancelled ? t("ticket.cancelled") : p.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 p-4 text-xs text-slate-500">
            {t("pnr.footer", { app: APP_NAME })} <Link href="/account" className="text-brand underline">{t("pnr.footerLink")}</Link>.
          </p>
        </div>
      )}
    </div>
  );
}


"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Wallet, X } from "lucide-react";
import { inr } from "@/lib/format";
import { useT } from "@/i18n/client";
import { useVoiceContext, useVoiceHandlers } from "./voice/VoiceBridge";

export type WalletPaySummary = { trains: string; route: string; date: string; cls: string; passengers: string[] };

/**
 * Pay for a held booking from the wallet. Always goes through a confirmation card that lists exactly what is being
 * paid for; the voice assistant can open the card ("wallet se pay karo"), but only a tap on Confirm or the spoken
 * phrase "confirm payment" (matched by the browser) actually pays.
 */
export function WalletPay({ tripId, amountPaise, balancePaise, summary }: {
  tripId: string; amountPaise: number; balancePaise: number; summary: WalletPaySummary;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const enough = balancePaise >= amountPaise;
  const amount = inr(amountPaise / 100, true);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/payments/wallet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tripId }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? t("pay.confirmFail"));
      setBusy(false);
      router.refresh();
      return;
    }
    router.replace(`/booking/${tripId}?paid=1`);
    router.refresh();
  }

  // Tell the voice assistant what paying would mean, and whether the card is waiting for an answer.
  const voiceCtx = useMemo(
    () => ({
      review: {
        summary: `${summary.trains}, ${summary.route}, ${summary.date}, ${summary.cls}, ${summary.passengers.length} ${summary.passengers.length === 1 ? "passenger" : "passengers"}`,
        amount, balance: inr(balancePaise / 100, true), enough, awaitingConfirm: open && !busy,
      },
    }),
    [summary, amount, balancePaise, enough, open, busy]
  );
  useVoiceContext(voiceCtx);
  useVoiceHandlers({
    pay_wallet: () => {
      if (!enough) return t("wallet.voiceLow", { balance: inr(balancePaise / 100, true), amount });
      setOpen(true);
    },
    confirm_payment: (a) => {
      if (!open) return;
      if (!a.yes) {
        setOpen(false);
        return t("voice.payCancelled");
      }
      void pay();
      return t("wallet.paying");
    },
  });

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  return (
    <div className="space-y-2 rounded-lg border border-brand/20 bg-brand-light/50 p-3">
      <p className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold"><Wallet className="size-4 text-brand" aria-hidden /> {t("wallet.name")}</span>
        <span>{t("wallet.balance")}: <b>{inr(balancePaise / 100, true)}</b></span>
      </p>
      {enough ? (
        <button onClick={() => setOpen(true)} className="btn-brand w-full py-2.5">{t("wallet.payFrom", { amount })}</button>
      ) : (
        <p className="text-sm text-slate-700">
          {t("wallet.short", { amount: inr((amountPaise - balancePaise) / 100, true) })}{" "}
          <Link href={`/wallet?add=${Math.ceil((amountPaise - balancePaise) / 100)}&return=${encodeURIComponent(`/booking/${tripId}`)}`} className="font-semibold text-brand underline">
            {t("wallet.addMoney")}
          </Link>
        </p>
      )}
      <p className="flex items-center gap-1 text-xs text-slate-600"><Mic className="size-3" aria-hidden /> {t("wallet.voiceHint")}</p>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="wp-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <h2 id="wp-title" className="text-lg font-bold">{t("wallet.confirmTitle")}</h2>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label={t("explore.close")} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t("wallet.c.train")}</dt><dd className="text-right font-medium">{summary.trains}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t("wallet.c.route")}</dt><dd className="text-right">{summary.route}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t("wallet.c.date")}</dt><dd className="text-right">{summary.date}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t("wallet.c.class")}</dt><dd className="text-right">{summary.cls}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t("wallet.c.passengers")}</dt><dd className="text-right">{summary.passengers.join(", ")}</dd></div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-bold"><dt>{t("wallet.c.total")}</dt><dd>{amount}</dd></div>
              <div className="flex justify-between gap-3 text-slate-600"><dt>{t("wallet.c.after")}</dt><dd>{inr((balancePaise - amountPaise) / 100, true)}</dd></div>
            </dl>
            <p className="mt-3 flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700"><Mic className="size-3.5 shrink-0" aria-hidden /> {t("wallet.sayConfirm")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setOpen(false)} disabled={busy} className="btn-secondary">{t("wallet.cancel")}</button>
              <button ref={confirmRef} onClick={pay} disabled={busy} className="btn-primary">
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("wallet.confirmPay", { amount })}
              </button>
            </div>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Wallet, X } from "lucide-react";
import { inr } from "@/lib/format";
import { useT } from "@/i18n/client";
import { useVoiceContext, useVoiceHandlers } from "./voice/VoiceBridge";
import { CoachBoard } from "./CoachBoard";

export type WalletPaySummary = { trains: string; route: string; date: string; cls: string; passengers: string[]; boards: { number: string; name: string; from: string; to: string }[] };

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
    <div className="space-y-3 rounded-xl bg-brand p-5 text-white">
      <p className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-sign text-[0.95rem] text-accent"><Wallet className="size-5" aria-hidden /> {t("wallet.name")}</span>
        <span className="text-[0.95rem] text-white/90">{t("wallet.balance")}: <b className="text-white">{inr(balancePaise / 100, true)}</b></span>
      </p>
      {enough ? (
        <button onClick={() => setOpen(true)} className="btn w-full bg-accent py-3 font-sign text-[1.01rem] leading-tight text-ink hover:bg-accent-dark">{t("wallet.payFrom", { amount })}</button>
      ) : (
        <p className="text-[0.95rem] text-white">
          {t("wallet.short", { amount: inr((amountPaise - balancePaise) / 100, true) })}{" "}
          <Link href={`/wallet?add=${Math.ceil((amountPaise - balancePaise) / 100)}&return=${encodeURIComponent(`/booking/${tripId}`)}`} className="font-semibold text-accent underline">
            {t("wallet.addMoney")}
          </Link>
        </p>
      )}
      <p className="flex items-center gap-1.5 text-[0.95rem] text-white/90"><Mic className="size-4" aria-hidden /> {t("wallet.voiceHint")}</p>
      {error && <p className="rounded-md bg-white px-3 py-2 text-[0.9rem] text-bad">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-brand-dark/70 p-4 text-ink" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="wp-title" className="settle w-full max-w-2xl overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            {/* The confirmation plate: the coach board, then every fact the payment covers, then two plain buttons. */}
            {summary.boards.map((bd) => <CoachBoard key={bd.number + bd.from} size="sm" number={bd.number} name={bd.name} from={bd.from} to={bd.to} />)}
            <div className="p-7">
            <div className="mb-4 flex items-start justify-between">
              <h2 id="wp-title" className="font-sign text-[1.73rem] leading-tight text-brand">{t("wallet.confirmTitle")}</h2>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label={t("explore.close")} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
            </div>
            <dl className="space-y-2 text-[1.05rem]">
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t("wallet.c.date")}</dt><dd className="text-right">{summary.date}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t("wallet.c.class")}</dt><dd className="text-right">{summary.cls}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">{t("wallet.c.passengers")}</dt><dd className="text-right">{summary.passengers.join(", ")}</dd></div>
              <div className="flex items-baseline justify-between gap-3 border-t-2 border-ground pt-3"><dt className="font-sign text-[1.15rem] leading-tight text-brand">{t("wallet.c.total")}</dt><dd className="font-sign text-[1.73rem] leading-tight">{amount}</dd></div>
              <div className="flex justify-between gap-3 text-slate-600"><dt>{t("wallet.c.after")}</dt><dd>{inr((balancePaise - amountPaise) / 100, true)}</dd></div>
            </dl>
            <p className="mt-4 flex items-center gap-2 rounded-md bg-brand-light px-3 py-2.5 text-[0.95rem] text-brand"><Mic className="size-5 shrink-0" aria-hidden /> {t("wallet.sayConfirm")}</p>
            <div className="mt-5 grid grid-cols-[1fr_1.6fr] gap-3">
              <button onClick={() => setOpen(false)} disabled={busy} className="btn-secondary py-3">{t("wallet.cancel")}</button>
              <button ref={confirmRef} onClick={pay} disabled={busy} className="btn-primary py-3.5 font-sign text-[1.1rem] leading-tight">
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("wallet.confirmPay", { amount })}
              </button>
            </div>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[0.95rem] text-bad">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

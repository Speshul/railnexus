"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Loader2, Plus } from "lucide-react";
import { inr } from "@/lib/format";
import { APP_NAME } from "@/lib/constants";
import { useT } from "@/i18n/client";

const AMOUNTS = [500, 1000, 2000, 5000];
type RzpResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

/** Add money to the wallet through Razorpay Checkout (test mode), then go back to where the user came from. */
export function WalletTopUp({ initial, min, max, returnTo }: { initial: number; min: number; max: number; returnTo: string | null }) {
  const t = useT();
  const router = useRouter();
  const [amount, setAmount] = useState(String(initial || 1000));
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const value = Number(amount);
  const valid = Number.isInteger(value) && value >= min && value <= max;

  async function add() {
    if (!valid || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/wallet/topup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: value }) });
    const order = await res.json().catch(() => ({}));
    if (!res.ok || !window.Razorpay) {
      setMsg({ ok: false, text: order.error ?? t("pay.noWindow") });
      setBusy(false);
      return;
    }
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: "INR",
      name: APP_NAME,
      description: t("wallet.topupDesc"),
      order_id: order.orderId,
      prefill: order.prefill,
      theme: { color: "#04056f" },
      modal: { ondismiss: () => setBusy(false) },
      handler: async (r: RzpResponse) => {
        const v = await fetch("/api/wallet/topup/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
        });
        const d = await v.json().catch(() => ({}));
        setBusy(false);
        if (!v.ok) return setMsg({ ok: false, text: d.error ?? t("pay.confirmFail") });
        setMsg({ ok: true, text: t("wallet.added", { amount: inr(value, true) }) });
        if (returnTo) router.push(returnTo);
        else router.refresh();
      },
    });
    rzp.on("payment.failed", (r) => setMsg({ ok: false, text: t("pay.failed", { reason: r.error.description ?? t("pay.failedDefault") }) }));
    rzp.open();
  }

  return (
    <div className="space-y-3">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("wallet.quick")}>
        {AMOUNTS.map((a) => (
          <button key={a} type="button" onClick={() => setAmount(String(a))} aria-pressed={value === a}
            className={`rounded-full border px-3 py-1.5 text-sm ${value === a ? "border-brand bg-brand text-white" : "border-slate-300 bg-white hover:border-brand"}`}>
            {inr(a)}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <label htmlFor="wt-amount" className="sr-only">{t("wallet.amount")}</label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
          <input id="wt-amount" inputMode="numeric" className="input pl-7" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </div>
        <button onClick={add} disabled={!valid || busy || !ready} className="btn-primary">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />} {t("wallet.addMoney")}
        </button>
      </div>
      <p className="text-sm text-slate-500">{t("wallet.limits", { min: inr(min), max: inr(max) })} · {t("pay.testUpi", { ok: "success@razorpay", fail: "failure@razorpay" })}</p>
      {msg && <p role="status" className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-brand-light text-brand" : "bg-red-50 text-bad"}`}>{msg.text}</p>}
    </div>
  );
}

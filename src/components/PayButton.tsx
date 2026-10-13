"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { inr } from "@/lib/format";
import { useT } from "@/i18n/client";

type RzpResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RzpFailure = { error: { description?: string; metadata?: { payment_id?: string; order_id?: string } } };
type RzpInstance = { open(): void; on(event: "payment.failed", cb: (r: RzpFailure) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RzpInstance;
  }
}

/** Opens Razorpay Checkout (test mode) for a held trip, then verifies the payment on our server. */
export function PayButton({ tripId, amountPaise }: { tripId: string; amountPaise: number }) {
  const router = useRouter();
  const t = useT();
  const [phase, setPhase] = useState<"idle" | "starting" | "open" | "verifying">("idle");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  async function pay() {
    setError("");
    setPhase("starting");
    const res = await fetch("/api/payments/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tripId }) });
    const order = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(order.error ?? t("pay.startFail"));
      setPhase("idle");
      if (res.status === 409 || res.status === 410) router.refresh();
      return;
    }
    if (!window.Razorpay) {
      setError(t("pay.noWindow"));
      setPhase("idle");
      return;
    }
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: "INR",
      name: "RailNexus",
      description: order.description,
      order_id: order.orderId,
      prefill: order.prefill,
      notes: { trip: tripId },
      theme: { color: "#0b3a75" },
      modal: { ondismiss: () => setPhase((p) => (p === "open" ? "idle" : p)) },
      handler: async (r: RzpResponse) => {
        setPhase("verifying");
        const v = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tripId, orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
        });
        const d = await v.json().catch(() => ({}));
        if (!v.ok) {
          setError(d.error ?? t("pay.confirmFail"));
          setPhase("idle");
          router.refresh();
          return;
        }
        router.replace(`/booking/${tripId}?paid=1`);
        router.refresh();
      },
    });
    rzp.on("payment.failed", (r) => {
      setError(t("pay.failed", { reason: r.error.description ?? t("pay.failedDefault") }));
      fetch("/api/payments/failed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: r.error.metadata?.order_id, paymentId: r.error.metadata?.payment_id }),
      }).catch(() => {});
    });
    setPhase("open");
    rzp.open();
  }

  const busy = phase !== "idle";
  return (
    <div className="space-y-2">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setReady(true)} />
      <button onClick={pay} disabled={busy || !ready} className="btn-primary w-full py-3">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
        {phase === "verifying" ? t("pay.confirming") : phase === "open" ? t("pay.inWindow") : t("pay.payUpi", { amount: inr(amountPaise / 100, true) })}
      </button>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="rounded-md border border-dashed border-slate-300 p-2 text-xs text-slate-600">
        <p className="mb-1 flex items-center gap-1 font-semibold"><ShieldCheck className="size-3.5" aria-hidden /> {t("pay.testTitle")}</p>
        <p>{t("pay.testUpi", { ok: "success@razorpay", fail: "failure@razorpay" })}</p>
        <p>{t("pay.testCard", { card: "4100 2800 0000 1007" })}</p>
      </div>
    </div>
  );
}

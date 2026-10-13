import { getUser } from "@/lib/auth";
import { appDb } from "@/lib/db";
import { ConfirmationError, confirmTrip, getTrip } from "@/lib/booking";
import { capturePayment, fetchPayment, refundPayment, verifySignature } from "@/lib/razorpay";
import { notifyTicketsIssued } from "@/lib/notify";
import { getT } from "@/i18n/server";

// AI and payment providers can be slow; give the function time to finish on Vercel.
export const maxDuration = 30;

type Body = { tripId?: string; orderId?: string; paymentId?: string; signature?: string };

// POST after Razorpay Checkout succeeds. Never trusts the browser: checks the signature, then asks Razorpay
// directly for the payment's amount and status before issuing tickets.
export async function POST(req: Request) {
  const user = await getUser();
  const t = await getT();
  if (!user) return Response.json({ error: t("err.signInAgain") }, { status: 401 });
  const { tripId, orderId, paymentId, signature } = (await req.json().catch(() => ({}))) as Body;
  if (!tripId || !orderId || !paymentId || !signature) return Response.json({ error: t("pay.incomplete") }, { status: 400 });

  const db = await appDb();
  const pay = await db.get<{ status: string; amount_paise: number; payment_id: string | null }>(
    "SELECT * FROM payments WHERE order_id = ? AND trip_id = ? AND user_id = ?", orderId, tripId, user.id
  );
  if (!pay) return Response.json({ error: t("pay.unknown") }, { status: 404 });
  if (pay.status === "PAID") return Response.json({ ok: true, trip: await getTrip(tripId, user.id) }); // already processed (retry/double click)
  if (!verifySignature(orderId, paymentId, signature)) return Response.json({ error: t("pay.badSignature") }, { status: 400 });

  let payment;
  try {
    payment = await fetchPayment(paymentId);
    if (payment.order_id !== orderId || payment.amount !== pay.amount_paise) throw new Error(t("pay.mismatch"));
    if (payment.status === "authorized") payment = await capturePayment(paymentId, pay.amount_paise);
    if (payment.status !== "captured") throw new Error(t("pay.status", { status: payment.status }));
  } catch (e) {
    await db.run("UPDATE payments SET status = 'FAILED', payment_id = ? WHERE order_id = ?", paymentId, orderId);
    return Response.json({ error: (e as Error).message }, { status: 402 });
  }
  await db.run("UPDATE payments SET status = 'PAID', payment_id = ?, method = ?, paid_at = ? WHERE order_id = ?",
    paymentId, payment.method, Date.now(), orderId);

  try {
    const trip = await confirmTrip(tripId);
    notifyTicketsIssued(trip, new URL(req.url).origin);
    return Response.json({ ok: true, trip });
  } catch (e) {
    if (!(e instanceof ConfirmationError)) throw e;
    // Seats vanished while paying (or "confirmed berths only" can't be met): give the money back automatically.
    const refund = await refundPayment(paymentId, pay.amount_paise, { trip: tripId, reason: "auto-refund: booking failed" }).catch(() => null);
    await db.run("UPDATE bookings SET status = 'CANCELLED', refund_paise = total_paise WHERE trip_id = ? AND status IN ('PENDING_PAYMENT', 'EXPIRED')", tripId);
    return Response.json(
      { error: `${t.msg(e.m)} ${refund ? t("pay.refundedFull") : t("pay.refundManual")}`, refunded: !!refund },
      { status: 409 }
    );
  }
}

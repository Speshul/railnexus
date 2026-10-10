import { getUser } from "@/lib/auth";
import { appDb } from "@/lib/db";
import { ConfirmationError, confirmTrip, getTrip } from "@/lib/booking";
import { capturePayment, fetchPayment, refundPayment, verifySignature } from "@/lib/razorpay";
import { notifyTicketsIssued } from "@/lib/notify";

type Body = { tripId?: string; orderId?: string; paymentId?: string; signature?: string };

// POST after Razorpay Checkout succeeds. Never trusts the browser: checks the signature, then asks Razorpay
// directly for the payment's amount and status before issuing tickets.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const { tripId, orderId, paymentId, signature } = (await req.json().catch(() => ({}))) as Body;
  if (!tripId || !orderId || !paymentId || !signature) return Response.json({ error: "Incomplete payment details." }, { status: 400 });

  const db = appDb();
  const pay = db.prepare("SELECT * FROM payments WHERE order_id = ? AND trip_id = ? AND user_id = ?").get(orderId, tripId, user.id) as
    | { status: string; amount_paise: number; payment_id: string | null }
    | undefined;
  if (!pay) return Response.json({ error: "Unknown payment." }, { status: 404 });
  if (pay.status === "PAID") return Response.json({ ok: true, trip: getTrip(tripId, user.id) }); // already processed (retry/double click)
  if (!verifySignature(orderId, paymentId, signature)) return Response.json({ error: "Payment signature check failed." }, { status: 400 });

  let payment;
  try {
    payment = await fetchPayment(paymentId);
    if (payment.order_id !== orderId || payment.amount !== pay.amount_paise) throw new Error("Payment doesn't match this booking.");
    if (payment.status === "authorized") payment = await capturePayment(paymentId, pay.amount_paise);
    if (payment.status !== "captured") throw new Error(`Payment is ${payment.status}.`);
  } catch (e) {
    db.prepare("UPDATE payments SET status = 'FAILED', payment_id = ? WHERE order_id = ?").run(paymentId, orderId);
    return Response.json({ error: (e as Error).message }, { status: 402 });
  }
  db.prepare("UPDATE payments SET status = 'PAID', payment_id = ?, method = ?, paid_at = ? WHERE order_id = ?")
    .run(paymentId, payment.method, Date.now(), orderId);

  try {
    const trip = confirmTrip(tripId);
    notifyTicketsIssued(trip, new URL(req.url).origin);
    return Response.json({ ok: true, trip });
  } catch (e) {
    if (!(e instanceof ConfirmationError)) throw e;
    // Seats vanished while paying (or "confirmed berths only" can't be met): give the money back automatically.
    const refund = await refundPayment(paymentId, pay.amount_paise, { trip: tripId, reason: "auto-refund: booking failed" }).catch(() => null);
    db.prepare("UPDATE bookings SET status = 'CANCELLED', refund_paise = total_paise WHERE trip_id = ? AND status IN ('PENDING_PAYMENT', 'EXPIRED')").run(tripId);
    return Response.json(
      { error: `${e.message} ${refund ? "Your payment has been refunded in full." : "We couldn't refund automatically; it will be reversed by the bank."}`, refunded: !!refund },
      { status: 409 }
    );
  }
}

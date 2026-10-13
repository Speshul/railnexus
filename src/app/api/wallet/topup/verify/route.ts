import { getUser } from "@/lib/auth";
import { appDb, transaction } from "@/lib/db";
import { capturePayment, fetchPayment, verifySignature } from "@/lib/razorpay";
import { credit } from "@/lib/wallet";
import { getT } from "@/i18n/server";

export const maxDuration = 30;

// POST { orderId, paymentId, signature } after Checkout succeeds: check with Razorpay, then credit the wallet once.
export async function POST(req: Request) {
  const user = await getUser();
  const t = await getT();
  if (!user) return Response.json({ error: t("err.signInAgain") }, { status: 401 });
  const { orderId, paymentId, signature } = (await req.json().catch(() => ({}))) as { orderId?: string; paymentId?: string; signature?: string };
  if (!orderId || !paymentId || !signature) return Response.json({ error: t("pay.incomplete") }, { status: 400 });
  const db = await appDb();
  const topup = await db.get<{ amount_paise: number; status: string }>("SELECT amount_paise, status FROM wallet_topups WHERE order_id = ? AND user_id = ?", orderId, user.id);
  if (!topup) return Response.json({ error: t("pay.unknown") }, { status: 404 });
  if (topup.status === "PAID") return Response.json({ ok: true }); // already credited (retry / double click)
  if (!verifySignature(orderId, paymentId, signature)) return Response.json({ error: t("pay.badSignature") }, { status: 400 });
  try {
    let payment = await fetchPayment(paymentId);
    if (payment.order_id !== orderId || payment.amount !== topup.amount_paise) throw new Error(t("pay.mismatch"));
    if (payment.status === "authorized") payment = await capturePayment(paymentId, topup.amount_paise);
    if (payment.status !== "captured") throw new Error(t("pay.status", { status: payment.status }));
  } catch (e) {
    await db.run("UPDATE wallet_topups SET status = 'FAILED', payment_id = ? WHERE order_id = ? AND status = 'CREATED'", paymentId, orderId);
    return Response.json({ error: (e as Error).message }, { status: 402 });
  }
  // Claim the order and credit in one transaction: two simultaneous verifies can't both add the money.
  const balance = await transaction(async (tx) => {
    const claimed = await tx.run("UPDATE wallet_topups SET status = 'PAID', payment_id = ?, paid_at = ? WHERE order_id = ? AND status = 'CREATED'",
      paymentId, Date.now(), orderId);
    return claimed.changes ? credit(tx, user.id, topup.amount_paise, "topup", orderId) : null;
  });
  return Response.json({ ok: true, balance });
}

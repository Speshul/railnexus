import { getUser } from "@/lib/auth";
import { appDb } from "@/lib/db";

// POST { orderId, paymentId?, reason } when Checkout reports a failed attempt. Informational only:
// the order stays open so the user can retry while their seats are still held.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { orderId, paymentId } = (await req.json().catch(() => ({}))) as { orderId?: string; paymentId?: string };
  if (orderId) {
    await (await appDb()).run(
      "UPDATE payments SET payment_id = COALESCE(?, payment_id), method = 'failed-attempt' WHERE order_id = ? AND user_id = ? AND status = 'CREATED'",
      paymentId ?? null, orderId, user.id
    );
  }
  return Response.json({ ok: true });
}

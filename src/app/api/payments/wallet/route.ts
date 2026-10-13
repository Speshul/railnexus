import { getUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { ConfirmationError, confirmTrip, getTrip } from "@/lib/booking";
import { credit, debit } from "@/lib/wallet";
import { notifyTicketsIssued } from "@/lib/notify";
import { inr } from "@/lib/format";
import { getT } from "@/i18n/server";

export const maxDuration = 30;

// POST { tripId } -> pay for held seats from the wallet, then issue tickets. Only ever called after the user
// confirms (a tap, or the exact spoken phrase on the confirmation card).
export async function POST(req: Request) {
  const user = await getUser();
  const t = await getT();
  if (!user) return Response.json({ error: t("err.signInAgain") }, { status: 401 });
  const { tripId } = (await req.json().catch(() => ({}))) as { tripId?: string };
  const trip = tripId ? await getTrip(tripId, user.id) : null;
  if (!trip) return Response.json({ error: t("err.notFound") }, { status: 404 });
  if (trip.status === "CONFIRMED") return Response.json({ error: t("pay.alreadyPaid") }, { status: 409 });
  if (trip.status !== "PENDING_PAYMENT") return Response.json({ error: t("pay.holdExpired") }, { status: 410 });

  const ref = `wallet_${trip.id}_${Date.now()}`;
  // Debit and record the payment together; a second tab or double tap finds the trip already paid.
  const outcome = await transaction(async (tx) => {
    if (await tx.get("SELECT 1 FROM payments WHERE trip_id = ? AND status = 'PAID'", trip.id)) return "paid" as const;
    if (!(await debit(tx, user.id, trip.totalPaise, "booking", trip.id))) return "low" as const;
    const now = Date.now();
    await tx.run(
      "INSERT INTO payments (order_id, trip_id, user_id, amount_paise, status, payment_id, method, created_at, paid_at) VALUES (?, ?, ?, ?, 'PAID', ?, 'wallet', ?, ?)",
      ref, trip.id, user.id, trip.totalPaise, ref, now, now
    );
    return "ok" as const;
  });
  if (outcome === "paid") return Response.json({ error: t("pay.alreadyPaid") }, { status: 409 });
  if (outcome === "low") return Response.json({ error: t("wallet.err.low") }, { status: 402 });

  try {
    const confirmed = await confirmTrip(trip.id);
    notifyTicketsIssued(confirmed, new URL(req.url).origin);
    return Response.json({ ok: true });
  } catch (e) {
    if (!(e instanceof ConfirmationError)) throw e;
    // Seats ran out between holding and paying: put the money straight back.
    await transaction(async (tx) => {
      await credit(tx, user.id, trip.totalPaise, "reversal", trip.id);
      await tx.run("UPDATE payments SET status = 'REFUNDED' WHERE order_id = ?", ref);
      await tx.run("UPDATE bookings SET status = 'CANCELLED', refund_paise = total_paise WHERE trip_id = ? AND status IN ('PENDING_PAYMENT', 'EXPIRED')", trip.id);
    });
    return Response.json({ error: `${t.msg(e.m)} ${t("wallet.reversed", { amount: inr(trip.totalPaise / 100, true) })}` }, { status: 409 });
  }
}

import { getUser } from "@/lib/auth";
import { appDb } from "@/lib/db";
import { getTrip } from "@/lib/booking";
import { getT } from "@/i18n/server";
import { createOrder, publicKeyId, razorpayConfigured } from "@/lib/razorpay";

// POST { tripId } -> Razorpay order for the held seats (reused if the user retries).
export async function POST(req: Request) {
  const user = await getUser();
  const t = await getT();
  if (!user) return Response.json({ error: t("err.signInAgain") }, { status: 401 });
  if (!razorpayConfigured()) return Response.json({ error: t("pay.notConfigured") }, { status: 503 });
  const { tripId } = (await req.json().catch(() => ({}))) as { tripId?: string };
  const trip = tripId ? getTrip(tripId, user.id) : null;
  if (!trip) return Response.json({ error: t("err.notFound") }, { status: 404 });
  if (trip.status === "CONFIRMED") return Response.json({ error: t("pay.alreadyPaid") }, { status: 409 });
  if (trip.status !== "PENDING_PAYMENT") return Response.json({ error: t("pay.holdExpired") }, { status: 410 });

  const db = appDb();
  const existing = db
    .prepare("SELECT order_id FROM payments WHERE trip_id = ? AND user_id = ? AND status = 'CREATED' AND amount_paise = ? ORDER BY created_at DESC LIMIT 1")
    .get(trip.id, user.id, trip.totalPaise) as { order_id: string } | undefined;
  let orderId = existing?.order_id;
  if (!orderId) {
    try {
      const order = await createOrder(trip.totalPaise, `trip_${trip.id}`, {
        trip: trip.id,
        trains: trip.legs.map((l) => l.train_number).join(","),
      });
      orderId = order.id;
    } catch (e) {
      return Response.json({ error: t("pay.startFailed", { msg: (e as Error).message }) }, { status: 502 });
    }
    db.prepare("INSERT INTO payments (order_id, trip_id, user_id, amount_paise, status, created_at) VALUES (?, ?, ?, ?, 'CREATED', ?)")
      .run(orderId, trip.id, user.id, trip.totalPaise, Date.now());
  }
  const first = trip.legs[0];
  return Response.json({
    orderId,
    amount: trip.totalPaise,
    keyId: publicKeyId(),
    description: trip.legs.map((l) => `${l.train_number} ${l.from_code}-${l.to_code} ${l.class_code}`).join(" + "),
    // Razorpay expects the country code; without it Checkout asks for the number again.
    prefill: { name: user.full_name, email: first.contact_email, contact: `+91${first.contact_phone}` },
    expiresAt: trip.expiresAt,
  });
}

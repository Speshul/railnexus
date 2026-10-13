import { z } from "zod";
import { getUser } from "@/lib/auth";
import { appDb } from "@/lib/db";
import { createOrder, publicKeyId, razorpayConfigured } from "@/lib/razorpay";
import { TOPUP_MAX, TOPUP_MIN } from "@/lib/wallet";
import { getT } from "@/i18n/server";

const bodySchema = z.object({ amount: z.number().int().min(TOPUP_MIN).max(TOPUP_MAX) });

// POST { amount (rupees) } -> Razorpay order to add money to the wallet.
export async function POST(req: Request) {
  const user = await getUser();
  const t = await getT();
  if (!user) return Response.json({ error: t("err.signInAgain") }, { status: 401 });
  if (!razorpayConfigured()) return Response.json({ error: t("pay.notConfigured") }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: t("wallet.err.amount", { min: TOPUP_MIN, max: TOPUP_MAX }) }, { status: 400 });
  const paise = parsed.data.amount * 100;
  let orderId: string;
  try {
    orderId = (await createOrder(paise, `wallet_${user.id}_${Date.now()}`, { purpose: "wallet top-up", user: String(user.id) })).id;
  } catch (e) {
    return Response.json({ error: t("pay.startFailed", { msg: (e as Error).message }) }, { status: 502 });
  }
  await (await appDb()).run("INSERT INTO wallet_topups (order_id, user_id, amount_paise, status, created_at) VALUES (?, ?, ?, 'CREATED', ?)",
    orderId, user.id, paise, Date.now());
  return Response.json({
    orderId, amount: paise, keyId: publicKeyId(),
    prefill: { name: user.full_name, email: user.email, contact: user.phone ? `+91${user.phone}` : undefined },
  });
}

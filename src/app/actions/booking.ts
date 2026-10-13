"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { loadSales } from "@/lib/availability";
import { randomBytes } from "node:crypto";
import { appDb, transaction } from "@/lib/db";
import {
  applyCancellation, bookingSchema, cancelDraft, createDraftTrip, deleteSavedPassenger, getTrip, quoteCancellation, validateBooking,
} from "@/lib/booking";
import { refundPayment } from "@/lib/razorpay";
import { getT } from "@/i18n/server";

export type BookingFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createBooking(_: BookingFormState, form: FormData): Promise<BookingFormState> {
  const user = await getUser();
  const t = await getT();
  if (!user) return { error: t("err.session") };

  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: t("err.invalidForm") };
  }
  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= t.maybe(issue.message);
    return { error: t("err.checkFields"), fieldErrors };
  }
  await loadSales();
  const result = validateBooking(parsed.data);
  if (!result.ok) {
    const fieldErrors = result.fieldErrors && Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, t(v)]));
    return { error: t.msg(result.error), fieldErrors };
  }

  const tripId = await createDraftTrip(user, parsed.data, result);
  redirect(`/booking/${tripId}`);
}

export async function cancelHold(tripId: string) {
  const user = await getUser();
  if (!user) redirect("/login");
  await cancelDraft(tripId, user.id);
  revalidatePath(`/booking/${tripId}`);
}

export type CancelState = { error?: string; done?: { refund: number; refundId: string | null; toWallet?: boolean } } | undefined;

/** Cancel selected passengers of one paid booking (one train) and refund the way it was paid: wallet or Razorpay (test mode). */
export async function cancelPassengers(_: CancelState, form: FormData): Promise<CancelState> {
  const user = await getUser();
  const t = await getT();
  if (!user) return { error: t("err.signInAgain") };
  const tripId = String(form.get("tripId") ?? "");
  const bookingId = String(form.get("bookingId") ?? "");
  const idxs = form.getAll("idx").map(Number).filter((n) => Number.isInteger(n));
  if (!idxs.length) return { error: t("err.selectCancel") };

  const trip = await getTrip(tripId, user.id);
  const booking = trip?.legs.find((b) => b.id === bookingId);
  if (!trip || !booking) return { error: t("err.notFound") };
  const quote = quoteCancellation(booking, idxs);
  if (!quote.allowed) return { error: t.msg(quote.reason ?? "err.cantCancel") };

  const db = await appDb();
  const payment = await db.get<{ payment_id: string; method: string | null }>("SELECT payment_id, method FROM payments WHERE trip_id = ? AND status = 'PAID'", tripId);
  const amountPaise = Math.round(quote.refund * 100);
  if (amountPaise > 0 && !payment) return { error: t("err.noPayment") };

  // Claim these passengers before any money moves, so a second cancel (another tab, a double tap) can't refund them again.
  const ids = quote.rows.map((r) => r.idx);
  const marks = ids.map(() => "?").join(",");
  const claimed = await transaction(async (tx) => {
    const r = await tx.run(`UPDATE booking_passengers SET cancelled = 1 WHERE booking_id = ? AND idx IN (${marks}) AND cancelled = 0`, booking.id, ...ids);
    if (r.changes !== ids.length) throw new Error("already cancelled");
    return true;
  }).catch(() => false);
  if (!claimed) return { error: t("err.cantCancel") };

  const wallet = payment?.method === "wallet";
  let refund: { id: string; status: string; paymentId: string } | null = null;
  if (amountPaise > 0 && wallet) {
    refund = { id: `wallet_refund_${randomBytes(6).toString("hex")}`, status: "processed", paymentId: payment.payment_id };
  } else if (amountPaise > 0) {
    try {
      const r = await refundPayment(payment!.payment_id, amountPaise, { pnr: booking.pnr ?? "", passengers: idxs.join(",") });
      refund = { id: r.id, status: r.status, paymentId: payment!.payment_id };
    } catch (e) {
      // Nothing was refunded: give the passengers back their tickets.
      await db.run(`UPDATE booking_passengers SET cancelled = 0 WHERE booking_id = ? AND idx IN (${marks})`, booking.id, ...ids);
      return { error: t("err.refundFailed", { msg: (e as Error).message }) };
    }
  }
  await applyCancellation(booking, quote, refund, wallet ? user.id : undefined);
  revalidatePath(`/booking/${tripId}`);
  revalidatePath("/account");
  return { done: { refund: quote.refund, refundId: refund?.id ?? null, toWallet: wallet } };
}

export async function removeSavedPassenger(id: number) {
  const user = await getUser();
  if (!user) return;
  await deleteSavedPassenger(id, user.id);
  revalidatePath("/account");
}

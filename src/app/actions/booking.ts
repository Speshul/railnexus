"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { loadSales } from "@/lib/availability";
import { appDb } from "@/lib/db";
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

export type CancelState = { error?: string; done?: { refund: number; refundId: string | null } } | undefined;

/** Cancel selected passengers of one paid booking (one train) and refund via Razorpay (test mode). */
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

  const payment = await (await appDb()).get<{ payment_id: string }>("SELECT payment_id FROM payments WHERE trip_id = ? AND status = 'PAID'", tripId);
  let refund: { id: string; status: string; paymentId: string } | null = null;
  const amountPaise = Math.round(quote.refund * 100);
  if (amountPaise > 0) {
    if (!payment) return { error: t("err.noPayment") };
    try {
      const r = await refundPayment(payment.payment_id, amountPaise, { pnr: booking.pnr ?? "", passengers: idxs.join(",") });
      refund = { id: r.id, status: r.status, paymentId: payment.payment_id };
    } catch (e) {
      return { error: t("err.refundFailed", { msg: (e as Error).message }) };
    }
  }
  await applyCancellation(booking, quote, refund);
  revalidatePath(`/booking/${tripId}`);
  revalidatePath("/account");
  return { done: { refund: quote.refund, refundId: refund?.id ?? null } };
}

export async function removeSavedPassenger(id: number) {
  const user = await getUser();
  if (!user) return;
  await deleteSavedPassenger(id, user.id);
  revalidatePath("/account");
}

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { appDb } from "@/lib/db";
import {
  applyCancellation, bookingSchema, cancelDraft, createDraftTrip, deleteSavedPassenger, getTrip, quoteCancellation, validateBooking,
} from "@/lib/booking";
import { refundPayment } from "@/lib/razorpay";

export type BookingFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createBooking(_: BookingFormState, form: FormData): Promise<BookingFormState> {
  const user = await getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Invalid form submission." };
  }
  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  const result = validateBooking(parsed.data);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };

  const tripId = createDraftTrip(user, parsed.data, result);
  redirect(`/booking/${tripId}`);
}

export async function cancelHold(tripId: string) {
  const user = await getUser();
  if (!user) redirect("/login");
  cancelDraft(tripId, user.id);
  revalidatePath(`/booking/${tripId}`);
}

export type CancelState = { error?: string; done?: { refund: number; refundId: string | null } } | undefined;

/** Cancel selected passengers of one paid booking (one train) and refund via Razorpay (test mode). */
export async function cancelPassengers(_: CancelState, form: FormData): Promise<CancelState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in again." };
  const tripId = String(form.get("tripId") ?? "");
  const bookingId = String(form.get("bookingId") ?? "");
  const idxs = form.getAll("idx").map(Number).filter((n) => Number.isInteger(n));
  if (!idxs.length) return { error: "Select at least one passenger to cancel." };

  const trip = getTrip(tripId, user.id);
  const booking = trip?.legs.find((b) => b.id === bookingId);
  if (!trip || !booking) return { error: "Booking not found." };
  const quote = quoteCancellation(booking, idxs);
  if (!quote.allowed) return { error: quote.reason ?? "These passengers can't be cancelled." };

  const payment = appDb().prepare("SELECT payment_id FROM payments WHERE trip_id = ? AND status = 'PAID'").get(tripId) as
    | { payment_id: string }
    | undefined;
  let refund: { id: string; status: string; paymentId: string } | null = null;
  const amountPaise = Math.round(quote.refund * 100);
  if (amountPaise > 0) {
    if (!payment) return { error: "No payment found for this booking." };
    try {
      const r = await refundPayment(payment.payment_id, amountPaise, { pnr: booking.pnr ?? "", passengers: idxs.join(",") });
      refund = { id: r.id, status: r.status, paymentId: payment.payment_id };
    } catch (e) {
      return { error: `Refund failed: ${(e as Error).message}` };
    }
  }
  applyCancellation(booking, quote, refund);
  revalidatePath(`/booking/${tripId}`);
  revalidatePath("/account");
  return { done: { refund: quote.refund, refundId: refund?.id ?? null } };
}

export async function removeSavedPassenger(id: number) {
  const user = await getUser();
  if (!user) return;
  deleteSavedPassenger(id, user.id);
  revalidatePath("/account");
}

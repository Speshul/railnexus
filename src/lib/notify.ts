import "server-only";
import type { Trip } from "./booking";

/**
 * Tell an external automation (e.g. a Make.com scenario that emails the ticket) that tickets were issued.
 * Set MAKE_WEBHOOK_URL in .env.local to enable; fire-and-forget so it never slows down or breaks a booking.
 */
export function notifyTicketsIssued(trip: Trip, origin: string) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return;
  const payload = {
    event: "tickets.issued",
    email: trip.legs[0].contact_email,
    phone: trip.legs[0].contact_phone,
    amount: trip.totalPaise / 100,
    tickets: trip.legs.map((b) => ({
      pnr: b.pnr,
      url: `${origin}/ticket/${b.pnr}`,
      train: `${b.train_number} ${b.fare.trainName}`,
      from: `${b.fare.fromName} (${b.from_code})`,
      to: `${b.fare.toName} (${b.to_code})`,
      date: b.journey_date,
      departure: b.fare.dep,
      class: b.class_code,
      passengers: b.passengers.map((p) => ({ name: p.name, age: p.age, status: p.status })),
    })),
  };
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch((e) =>
    console.warn(`[notify] webhook failed: ${(e as Error).message}`)
  );
}

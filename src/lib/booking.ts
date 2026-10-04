import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { appDb } from "./db";
import { getSegment, type Segment } from "./rail";
import { getAvailability, type Availability } from "./availability";
import { bookingFare, type BookingFare } from "./fare";
import {
  CLASSES, FOOD_PREFS, HOLD_MINUTES, MAX_PASSENGERS, PREMIUM_TYPES, QUOTAS, SEAT_PREFS, SLEEPER_BERTHS,
  type ClassCode, type Quota,
} from "./constants";
import { isValidDate } from "./dates";
import type { User } from "./auth";

export const passengerSchema = z.object({
  name: z.string().trim().min(3, "Name must be 3-30 characters").max(30, "Name must be 3-30 characters")
    .regex(/^[a-zA-Z .]+$/, "Letters, spaces and dots only"),
  age: z.coerce.number().int("Enter a whole number").min(0, "Invalid age").max(125, "Invalid age"),
  gender: z.enum(["M", "F", "T"], { message: "Select gender" }),
  berth: z.string().optional().default(""),
  food: z.string().optional().default(""),
  noBerth: z.coerce.boolean().optional().default(false),
});

export const bookingSchema = z.object({
  train: z.string().regex(/^\d{5}$/),
  from: z.string().min(1),
  to: z.string().min(1),
  date: z.string().refine(isValidDate, "Invalid date"),
  cls: z.enum(Object.keys(CLASSES) as [ClassCode, ...ClassCode[]]),
  quota: z.enum(Object.keys(QUOTAS) as [Quota, ...Quota[]]),
  passengers: z.array(passengerSchema).min(1, "Add at least one passenger"),
  email: z.email("Enter a valid email"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
  insurance: z.boolean(),
  autoUpgrade: z.boolean(),
  confirmOnly: z.boolean(),
  savePassengers: z.boolean(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export type ValidationResult =
  | { ok: true; segment: Segment; availability: Availability; fare: BookingFare }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Business rules on top of the schema: quota eligibility, passenger limits, current availability. */
export function validateBooking(input: BookingInput): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  const segment = getSegment(input.train, input.from, input.to, input.date);
  if (!segment) return { ok: false, error: "This train doesn't run between these stations on the selected date." };
  if (!segment.train.classes.includes(input.cls)) return { ok: false, error: "Selected class isn't available on this train." };

  const premium = PREMIUM_TYPES.has(segment.train.type);
  const isSleeper = CLASSES[input.cls].berth === "sleeper";
  const validBerths: string[] = isSleeper ? Object.keys(SLEEPER_BERTHS) : Object.keys(SEAT_PREFS);
  const infants = input.passengers.filter((p) => p.age < 5);
  const ticketed = input.passengers.filter((p) => p.age >= 5);
  const max = MAX_PASSENGERS[input.quota];

  if (ticketed.length === 0) return { ok: false, error: "Add at least one passenger aged 5 or above." };
  if (ticketed.length > max) return { ok: false, error: `${QUOTAS[input.quota].name} quota allows at most ${max} passengers per ticket.` };
  if (infants.length > 2) return { ok: false, error: "At most 2 infants (below 5 years) per ticket." };
  if (!input.passengers.some((p) => p.age >= 12)) return { ok: false, error: "At least one passenger must be 12 years or older." };

  input.passengers.forEach((p, i) => {
    if (p.berth && !validBerths.includes(p.berth)) fieldErrors[`passengers.${i}.berth`] = "Invalid preference";
    if (p.food && (!premium || !(p.food in FOOD_PREFS))) fieldErrors[`passengers.${i}.food`] = "Invalid meal choice";
    if (p.noBerth && (p.age < 5 || p.age > 11)) fieldErrors[`passengers.${i}.noBerth`] = "Only for children aged 5-11";
    if (input.quota === "LD" && p.gender !== "F" && p.age >= 12) fieldErrors[`passengers.${i}.gender`] = "Ladies quota: female passengers (boys under 12 allowed)";
    if (input.quota === "SS" && !((p.gender === "M" && p.age >= 60) || (p.gender === "F" && p.age >= 45) || (p.gender === "T" && p.age >= 60)))
      fieldErrors[`passengers.${i}.age`] = "Needs men 60+ or women 45+";
    if (input.quota === "TQ" && p.noBerth) fieldErrors[`passengers.${i}.noBerth`] = "Not allowed in Tatkal";
  });
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted passenger details.", fieldErrors };

  const availability = getAvailability(segment, input.cls, input.quota);
  if (!availability.bookable) return { ok: false, error: `Booking not possible: ${availability.note ?? availability.label}` };
  if (input.confirmOnly && availability.status !== "AVAILABLE")
    return { ok: false, error: `Only ${availability.label} available. Untick "Book only if confirmed berths" to join the waitlist.` };
  const seatsNeeded = input.passengers.filter((p) => p.age >= 5 && !p.noBerth).length;
  if (availability.status === "AVAILABLE" && availability.count < seatsNeeded && input.confirmOnly)
    return { ok: false, error: `Only ${availability.count} confirmed berths left.` };

  const fare = bookingFare(
    { cls: input.cls, km: segment.distance, trainType: segment.train.type, quota: input.quota, insurance: input.insurance },
    input.passengers.map((p) => ({ age: p.age, noBerth: p.noBerth }))
  );
  return { ok: true, segment, availability, fare };
}

export function createDraftBooking(user: User, input: BookingInput, v: Extract<ValidationResult, { ok: true }>) {
  const db = appDb();
  const id = randomBytes(6).toString("hex");
  const now = Date.now();
  const { segment, fare, availability } = v;
  const snapshot = {
    ...fare,
    trainName: segment.train.name,
    trainType: segment.train.type,
    fromName: segment.from.name,
    toName: segment.to.name,
    dep: segment.from.dep,
    arr: segment.to.arr,
    arrivalDate: segment.arrivalDate,
    duration: segment.duration,
    distance: segment.distance,
    availabilityAtBooking: availability.label,
    chance: availability.chance,
  };
  db.exec("BEGIN");
  try {
    // "Edit passengers" creates a fresh hold; release the old one so seats aren't held twice.
    db.prepare(
      `UPDATE bookings SET status = 'CANCELLED'
       WHERE user_id = ? AND status = 'PENDING_PAYMENT' AND train_number = ? AND train_start_date = ? AND class_code = ? AND quota = ?`
    ).run(user.id, input.train, segment.startDate, input.cls, input.quota);
    db.prepare(
      `INSERT INTO bookings (id, user_id, status, train_number, from_code, to_code, boarding_code, journey_date, train_start_date,
         class_code, quota, seats, contact_email, contact_phone, options, fare, total_paise, created_at, expires_at)
       VALUES (?, ?, 'PENDING_PAYMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, user.id, input.train, input.from, input.to, input.from, input.date, segment.startDate, input.cls, input.quota,
      fare.seats, input.email, input.phone,
      JSON.stringify({ insurance: input.insurance, autoUpgrade: input.autoUpgrade, confirmOnly: input.confirmOnly }),
      JSON.stringify(snapshot), Math.round(fare.total * 100), now, now + HOLD_MINUTES * 60000
    );
    const ins = db.prepare(
      `INSERT INTO booking_passengers (booking_id, idx, name, age, gender, berth_pref, food_pref, no_berth) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    input.passengers.forEach((p, i) => ins.run(id, i, p.name, p.age, p.gender, p.berth || null, p.food || null, p.noBerth ? 1 : 0));

    if (input.savePassengers) {
      const exists = db.prepare("SELECT 1 FROM saved_passengers WHERE user_id = ? AND name = ? COLLATE NOCASE AND age = ?");
      const save = db.prepare("INSERT INTO saved_passengers (user_id, name, age, gender, berth_pref, food_pref) VALUES (?, ?, ?, ?, ?, ?)");
      for (const p of input.passengers) {
        if (!exists.get(user.id, p.name, p.age)) save.run(user.id, p.name, p.age, p.gender, p.berth || null, p.food || null);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return id;
}

export type BookingRecord = {
  id: string;
  user_id: number;
  pnr: string | null;
  status: string;
  train_number: string;
  from_code: string;
  to_code: string;
  journey_date: string;
  train_start_date: string;
  class_code: ClassCode;
  quota: Quota;
  seats: number;
  contact_email: string;
  contact_phone: string;
  options: { insurance: boolean; autoUpgrade: boolean; confirmOnly: boolean };
  fare: BookingFare & {
    trainName: string; trainType: string; fromName: string; toName: string; dep: string; arr: string;
    arrivalDate: string; duration: number; distance: number; availabilityAtBooking: string; chance: number;
  };
  total_paise: number;
  created_at: number;
  expires_at: number | null;
  passengers: { idx: number; name: string; age: number; gender: string; berth_pref: string | null; food_pref: string | null; no_berth: number; status: string | null }[];
};

export function getBooking(id: string, userId: number): BookingRecord | null {
  const db = appDb();
  const row = db.prepare("SELECT * FROM bookings WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  if (row.status === "PENDING_PAYMENT" && (row.expires_at as number) < Date.now()) {
    db.prepare("UPDATE bookings SET status = 'EXPIRED' WHERE id = ?").run(id);
    row.status = "EXPIRED";
  }
  const passengers = db.prepare("SELECT * FROM booking_passengers WHERE booking_id = ? ORDER BY idx").all(id);
  return {
    ...(row as unknown as BookingRecord),
    options: JSON.parse(row.options as string),
    fare: JSON.parse(row.fare as string),
    passengers: passengers as unknown as BookingRecord["passengers"],
  };
}

export function listBookings(userId: number) {
  appDb()
    .prepare("UPDATE bookings SET status = 'EXPIRED' WHERE user_id = ? AND status = 'PENDING_PAYMENT' AND expires_at < ?")
    .run(userId, Date.now());
  const rows = appDb()
    .prepare("SELECT id FROM bookings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(userId) as { id: string }[];
  return rows.map((r) => getBooking(r.id, userId)!);
}

export function cancelDraft(id: string, userId: number) {
  appDb().prepare("UPDATE bookings SET status = 'CANCELLED' WHERE id = ? AND user_id = ? AND status = 'PENDING_PAYMENT'").run(id, userId);
}

export type SavedPassenger = { id: number; name: string; age: number; gender: string; berth_pref: string | null; food_pref: string | null };

export function savedPassengers(userId: number): SavedPassenger[] {
  return appDb()
    .prepare("SELECT id, name, age, gender, berth_pref, food_pref FROM saved_passengers WHERE user_id = ? ORDER BY id")
    .all(userId) as unknown as SavedPassenger[];
}

export function deleteSavedPassenger(id: number, userId: number) {
  appDb().prepare("DELETE FROM saved_passengers WHERE id = ? AND user_id = ?").run(id, userId);
}

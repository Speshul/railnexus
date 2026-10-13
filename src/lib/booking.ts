import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { appDb, appSecret, transaction, type Db } from "./db";
import { getSegment, getStops, type Segment } from "./rail";
import { getAvailability, inventory, loadSales, type Availability } from "./availability";
import { bookingFare, type BookingFare } from "./fare";
import {
  CLASSES, FOOD_PREFS, HOLD_MINUTES, MAX_PASSENGERS, PREMIUM_TYPES, QUOTAS, SEAT_PREFS, SLEEPER_BERTHS,
  type ClassCode, type Quota,
} from "./constants";
import { isValidDate } from "./dates";
import type { User } from "./auth";
import { msg, type MessageKey, type Msg } from "@/i18n/core";

// ---------------------------------------------------------------- input

export const passengerSchema = z.object({
  name: z.string().trim().min(3, "err.name").max(30, "err.name")
    .regex(/^[a-zA-Z .]+$/, "err.nameChars"),
  age: z.coerce.number().int("err.wholeNumber").min(0, "err.age").max(125, "err.age"),
  gender: z.enum(["M", "F", "T"], { message: "err.gender" }),
  berth: z.string().optional().default(""),
  food: z.string().optional().default(""),
  noBerth: z.coerce.boolean().optional().default(false),
});

export const legSchema = z.object({
  train: z.string().regex(/^\d{5}$/),
  from: z.string().min(1).max(5),
  to: z.string().min(1).max(5),
  date: z.string().refine(isValidDate, "err.date"),
  cls: z.enum(Object.keys(CLASSES) as [ClassCode, ...ClassCode[]]),
});
export type LegInput = z.infer<typeof legSchema>;

/** One checkout: one train, or two trains of a connecting journey, for the same passengers. */
export const bookingSchema = z.object({
  legs: z.array(legSchema).min(1).max(2),
  quota: z.enum(Object.keys(QUOTAS) as [Quota, ...Quota[]]),
  passengers: z.array(passengerSchema).min(1, "err.addPassenger"),
  email: z.email("err.email"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "err.phone"),
  insurance: z.boolean(),
  autoUpgrade: z.boolean(),
  confirmOnly: z.boolean(),
  savePassengers: z.boolean(),
});
export type BookingInput = z.infer<typeof bookingSchema>;

type ValidLeg = { input: LegInput; segment: Segment; availability: Availability; fare: BookingFare };
export type ValidationResult =
  | { ok: true; legs: ValidLeg[] }
  | { ok: false; error: Msg; fieldErrors?: Record<string, MessageKey> };

const berthPrefsFor = (cls: ClassCode): string[] => Object.keys(CLASSES[cls].berth === "sleeper" ? SLEEPER_BERTHS : SEAT_PREFS);
const minutesOf = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+05:30`) / 60000;

/** Business rules on top of the schema: quota eligibility, passenger limits, connection timing, availability. */
export function validateBooking(input: BookingInput): ValidationResult {
  const fieldErrors: Record<string, MessageKey> = {};
  const legs: Omit<ValidLeg, "availability" | "fare">[] = [];
  for (const [i, leg] of input.legs.entries()) {
    const segment = getSegment(leg.train, leg.from, leg.to, leg.date);
    const label = input.legs.length > 1 ? { k: "err.legLabel" as const, v: { i: i + 1, train: leg.train } } : { k: "err.thisTrain" as const };
    if (!segment) return { ok: false, error: msg("err.notRunning", { label }) };
    if (!segment.train.classes.includes(leg.cls)) return { ok: false, error: msg("err.noClass", { label }) };
    legs.push({ input: leg, segment });
  }
  if (legs.length === 2) {
    const arrive = minutesOf(legs[0].segment.arrivalDate, legs[0].segment.to.arr!);
    const depart = minutesOf(legs[1].segment.date, legs[1].segment.from.dep!);
    if (legs[0].segment.to.code !== legs[1].segment.from.code) return { ok: false, error: "err.connectStation" };
    // Split ticket on the same train run: you just move to another seat at that station.
    const sameTrain = legs[0].input.train === legs[1].input.train && legs[0].segment.startDate === legs[1].segment.startDate;
    if (!sameTrain && depart - arrive < 30) return { ok: false, error: "err.connectTime" };
  }

  const anyPremium = legs.some((l) => PREMIUM_TYPES.has(l.segment.train.type));
  const validBerths = new Set(legs.flatMap((l) => berthPrefsFor(l.input.cls)));
  const infants = input.passengers.filter((p) => p.age < 5);
  const ticketed = input.passengers.filter((p) => p.age >= 5);
  const max = MAX_PASSENGERS[input.quota];

  if (ticketed.length === 0) return { ok: false, error: "err.needTicketed" };
  if (ticketed.length > max) return { ok: false, error: msg("err.maxPax", { quota: { k: `quota.${input.quota}` as MessageKey }, max }) };
  if (infants.length > 2) return { ok: false, error: "err.infants" };
  if (!input.passengers.some((p) => p.age >= 12)) return { ok: false, error: "err.adult" };

  input.passengers.forEach((p, i) => {
    if (p.berth && !validBerths.has(p.berth)) fieldErrors[`passengers.${i}.berth`] = "err.berth";
    if (p.food && (!anyPremium || !(p.food in FOOD_PREFS))) fieldErrors[`passengers.${i}.food`] = "err.food";
    if (p.noBerth && (p.age < 5 || p.age > 11)) fieldErrors[`passengers.${i}.noBerth`] = "err.noBerthAge";
    if (input.quota === "LD" && p.gender !== "F" && p.age >= 12) fieldErrors[`passengers.${i}.gender`] = "err.ladies";
    if (input.quota === "SS" && !((p.gender === "M" && p.age >= 60) || (p.gender === "F" && p.age >= 45) || (p.gender === "T" && p.age >= 60)))
      fieldErrors[`passengers.${i}.age`] = "err.senior";
    if (input.quota === "TQ" && p.noBerth) fieldErrors[`passengers.${i}.noBerth`] = "err.noBerthTatkal";
  });
  if (Object.keys(fieldErrors).length) return { ok: false, error: "err.fixPassengers", fieldErrors };

  const seatsNeeded = input.passengers.filter((p) => p.age >= 5 && !p.noBerth).length;
  const out: ValidLeg[] = [];
  for (const [i, l] of legs.entries()) {
    const prefix = legs.length > 1 ? { k: "err.legPrefix" as const, v: { i: i + 1, train: l.input.train } } : { k: "err.none" as const };
    const availability = getAvailability(l.segment, l.input.cls, input.quota);
    if (!availability.bookable) {
      const note = availability.note;
      const reason = note === undefined ? availability.label : typeof note === "string" ? { k: note } : note;
      return { ok: false, error: msg("err.notBookable", { prefix, reason }) };
    }
    if (input.confirmOnly && (availability.status !== "AVAILABLE" || availability.count < seatsNeeded))
      return { ok: false, error: msg("err.confirmOnly", { prefix, label: availability.label }) };
    const fare = bookingFare(
      { cls: l.input.cls, km: l.segment.distance, trainType: l.segment.train.type, quota: input.quota, insurance: input.insurance },
      input.passengers.map((p) => ({ age: p.age, noBerth: p.noBerth }))
    );
    out.push({ ...l, availability, fare });
  }
  return { ok: true, legs: out };
}

// ---------------------------------------------------------------- holds (pending payment)

const newId = () => randomBytes(6).toString("hex");

/** Create the seat holds for a checkout. Returns the trip id used for review and payment. */
export async function createDraftTrip(user: User, input: BookingInput, v: Extract<ValidationResult, { ok: true }>) {
  const tripId = newId();
  const now = Date.now();
  await transaction(async (db) => {
    for (const [legIdx, l] of v.legs.entries()) {
      const { segment, fare, availability } = l;
      const premium = PREMIUM_TYPES.has(segment.train.type);
      const prefs = berthPrefsFor(l.input.cls);
      // "Edit passengers" creates a fresh hold; release the old one so seats aren't held twice.
      // (Never this checkout's own holds: a split ticket books the same train twice.)
      await db.run(
        `UPDATE bookings SET status = 'CANCELLED'
         WHERE user_id = ? AND status = 'PENDING_PAYMENT' AND train_number = ? AND train_start_date = ? AND class_code = ? AND quota = ?
           AND trip_id <> ?`,
        user.id, l.input.train, segment.startDate, l.input.cls, input.quota, tripId
      );
      const id = newId();
      const snapshot = {
        ...fare,
        trainName: segment.train.name, trainType: segment.train.type, fromName: segment.from.name, toName: segment.to.name,
        dep: segment.from.dep, arr: segment.to.arr, arrivalDate: segment.arrivalDate, duration: segment.duration,
        distance: segment.distance, availabilityAtBooking: availability.label, chance: availability.chance,
      };
      await db.run(
        `INSERT INTO bookings (id, trip_id, leg, user_id, status, train_number, from_code, to_code, boarding_code, journey_date,
           train_start_date, class_code, quota, seats, contact_email, contact_phone, options, fare, total_paise, created_at, expires_at)
         VALUES (?, ?, ?, ?, 'PENDING_PAYMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, tripId, legIdx, user.id, l.input.train, l.input.from, l.input.to, l.input.from, l.input.date, segment.startDate,
        l.input.cls, input.quota, fare.seats, input.email, input.phone,
        JSON.stringify({ insurance: input.insurance, autoUpgrade: input.autoUpgrade, confirmOnly: input.confirmOnly }),
        JSON.stringify(snapshot), Math.round(fare.total * 100), now, now + HOLD_MINUTES * 60000
      );
      for (const [i, p] of input.passengers.entries()) {
        await db.run(
          `INSERT INTO booking_passengers (booking_id, idx, name, age, gender, berth_pref, food_pref, no_berth) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          id, i, p.name, p.age, p.gender, prefs.includes(p.berth) ? p.berth : null, premium && p.food ? p.food : null, p.noBerth ? 1 : 0
        );
      }
    }
    if (input.savePassengers) {
      for (const p of input.passengers) {
        const exists = await db.get("SELECT 1 FROM saved_passengers WHERE user_id = ? AND name = ? COLLATE NOCASE AND age = ?", user.id, p.name, p.age);
        if (!exists) {
          await db.run("INSERT INTO saved_passengers (user_id, name, age, gender, berth_pref, food_pref) VALUES (?, ?, ?, ?, ?, ?)",
            user.id, p.name, p.age, p.gender, p.berth || null, p.food || null);
        }
      }
    }
  });
  return tripId;
}

// ---------------------------------------------------------------- reading

export type Passenger = {
  idx: number; name: string; age: number; gender: string; berth_pref: string | null; food_pref: string | null;
  no_berth: number; booking_status: string | null; status: string | null; coach: string | null; berth_no: number | null;
  berth_type: string | null; cancelled: number; refund_paise: number;
};

export type BookingRecord = {
  id: string; trip_id: string; leg: number; user_id: number; pnr: string | null; status: string;
  train_number: string; from_code: string; to_code: string; journey_date: string; train_start_date: string;
  class_code: ClassCode; quota: Quota; seats: number; contact_email: string; contact_phone: string;
  options: { insurance: boolean; autoUpgrade: boolean; confirmOnly: boolean };
  fare: BookingFare & {
    trainName: string; trainType: string; fromName: string; toName: string; dep: string; arr: string;
    arrivalDate: string; duration: number; distance: number; availabilityAtBooking: string; chance: number;
  };
  total_paise: number; refund_paise: number; created_at: number; confirmed_at: number | null; expires_at: number | null;
  passengers: Passenger[];
};

export type Trip = {
  id: string;
  /** PENDING_PAYMENT | CONFIRMED | CANCELLED | EXPIRED (CONFIRMED = paid; passengers may still be RAC/WL) */
  status: string;
  legs: BookingRecord[];
  totalPaise: number;
  refundPaise: number;
  expiresAt: number | null;
  payment: { order_id: string; payment_id: string | null; status: string; method: string | null; paid_at: number | null } | null;
};

async function expireStale(db: Db) {
  await db.run("UPDATE bookings SET status = 'EXPIRED' WHERE status = 'PENDING_PAYMENT' AND expires_at < ?", Date.now());
}

const ph = (n: number) => Array(n).fill("?").join(",");

/** Bookings (with passengers) and payments for some trips, in three queries however many trips there are. */
async function loadTrips(db: Db, rows: Record<string, unknown>[]): Promise<Trip[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id as string);
  const tripIds = [...new Set(rows.map((r) => r.trip_id as string))];
  const pax = await db.all<Passenger & { booking_id: string }>(`SELECT * FROM booking_passengers WHERE booking_id IN (${ph(ids.length)}) ORDER BY idx`, ...ids);
  const pays = await db.all<NonNullable<Trip["payment"]> & { trip_id: string; created_at: number }>(
    `SELECT trip_id, order_id, payment_id, status, method, paid_at, created_at FROM payments WHERE trip_id IN (${ph(tripIds.length)})
     ORDER BY (status = 'PAID') DESC, created_at DESC`,
    ...tripIds
  );
  const legsOf = new Map<string, BookingRecord[]>();
  for (const row of rows) {
    const leg: BookingRecord = {
      ...(row as unknown as BookingRecord),
      options: JSON.parse(row.options as string),
      fare: JSON.parse(row.fare as string),
      passengers: pax.filter((p) => p.booking_id === row.id),
    };
    const list = legsOf.get(leg.trip_id) ?? [];
    list.push(leg);
    legsOf.set(leg.trip_id, list);
  }
  return tripIds.map((id) => {
    const legs = legsOf.get(id)!.sort((a, b) => a.leg - b.leg);
    const statuses = new Set(legs.map((l) => l.status));
    const status = statuses.has("CONFIRMED") ? "CONFIRMED" : statuses.has("PENDING_PAYMENT") ? "PENDING_PAYMENT" : legs[0].status;
    const pay = pays.find((x) => x.trip_id === id);
    return {
      id,
      status,
      legs,
      totalPaise: legs.reduce((s, l) => s + l.total_paise, 0),
      refundPaise: legs.reduce((s, l) => s + l.refund_paise, 0),
      expiresAt: status === "PENDING_PAYMENT" ? Math.min(...legs.map((l) => l.expires_at ?? Infinity)) : null,
      payment: pay ? { order_id: pay.order_id, payment_id: pay.payment_id, status: pay.status, method: pay.method, paid_at: pay.paid_at } : null,
    };
  });
}

export async function getTrip(tripId: string, userId?: number, conn?: Db): Promise<Trip | null> {
  const db = conn ?? (await appDb());
  await expireStale(db);
  const rows = await db.all(
    `SELECT * FROM bookings WHERE trip_id = ? ${userId !== undefined ? "AND user_id = ?" : ""} ORDER BY leg`,
    ...(userId !== undefined ? [tripId, userId] : [tripId])
  );
  return (await loadTrips(db, rows))[0] ?? null;
}

export async function listTrips(userId: number): Promise<Trip[]> {
  const db = await appDb();
  await expireStale(db);
  const rows = await db.all(
    `SELECT * FROM bookings WHERE trip_id IN (
       SELECT trip_id FROM bookings WHERE user_id = ? GROUP BY trip_id ORDER BY MAX(created_at) DESC LIMIT 100
     ) ORDER BY created_at DESC, leg`,
    userId
  );
  return loadTrips(db, rows);
}

export async function getBookingByPnr(pnr: string): Promise<BookingRecord | null> {
  const db = await appDb();
  const row = await db.get("SELECT * FROM bookings WHERE pnr = ?", pnr);
  if (!row) return null;
  const trip = (await loadTrips(db, [row]))[0];
  return trip?.legs[0] ?? null;
}

export async function cancelDraft(tripId: string, userId: number) {
  await (await appDb()).run("UPDATE bookings SET status = 'CANCELLED' WHERE trip_id = ? AND user_id = ? AND status = 'PENDING_PAYMENT'", tripId, userId);
}

// ---------------------------------------------------------------- confirmation: PNR + berth allocation

const BAY: Partial<Record<ClassCode, string[]>> = {
  "1A": ["LB", "UB"],
  "2A": ["LB", "UB", "LB", "UB", "SL", "SU"],
  "3A": ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"],
  SL: ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"],
  CC: ["WS", "MS", "AS", "AS", "WS"],
  EC: ["WS", "AS", "AS", "WS"],
  "2S": ["WS", "MS", "AS", "AS", "MS", "WS"],
};
export const berthTypeOf = (cls: ClassCode, n: number) => {
  const bay = BAY[cls] ?? ["WS"];
  return bay[(n - 1) % bay.length];
};
const bayOf = (cls: ClassCode, n: number) => Math.floor((n - 1) / (BAY[cls]?.length ?? 1));

function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Pick coach + berth numbers for confirmed passengers: keep the group in one coach and close together,
 * honour berth preferences, and give seniors a lower berth when they have no preference.
 */
async function allocateBerths(
  db: Db, seg: Segment, cls: ClassCode, bookingId: string, coaches: number,
  people: { idx: number; age: number; gender: string; pref: string | null }[]
) {
  const cap = CLASSES[cls].coachCap;
  // A berth is only taken if its holder's journey overlaps ours: one used Delhi -> Kanpur is free from Kanpur on.
  const order = new Map<string, number>();
  getStops(seg.train.number).filter((s) => s.halt).forEach((s, i) => { if (!order.has(s.code)) order.set(s.code, i); });
  const myFrom = order.get(seg.from.code) ?? 0;
  const myTo = order.get(seg.to.code) ?? Infinity;
  const taken = new Set(
    (await db.all<{ coach: string; berth_no: number; from_code: string; to_code: string }>(
      `SELECT a.coach, a.berth_no, b.from_code, b.to_code FROM berth_allocations a JOIN bookings b ON b.id = a.booking_id
       WHERE a.train_number = ? AND a.train_start_date = ? AND a.class_code = ?`,
      seg.train.number, seg.startDate, cls
    ))
      .filter((r) => (order.get(r.from_code) ?? 0) < myTo && myFrom < (order.get(r.to_code) ?? Infinity))
      .map((r) => `${r.coach}/${r.berth_no}`)
  );
  // Simulated passengers already occupy some berths; mark a deterministic share of them as taken too.
  const busy = (coach: string, n: number) => hash32(`${seg.train.number}|${seg.startDate}|${coach}|${n}`) % 100 < 55;
  const start = hash32(bookingId) % coaches;
  const coachOrder = Array.from({ length: coaches }, (_, i) => `${CLASSES[cls].coachPrefix}${((start + i) % coaches) + 1}`);
  const free = (coach: string) =>
    Array.from({ length: cap }, (_, i) => i + 1).filter((n) => !taken.has(`${coach}/${n}`) && !busy(coach, n));
  // first coach with room for everyone, else the emptiest
  const coach = coachOrder.find((c) => free(c).length >= people.length) ?? coachOrder.sort((a, b) => free(b).length - free(a).length)[0];
  const pool = free(coach);
  const senior = (p: { age: number; gender: string }) => (p.gender === "F" ? p.age >= 45 : p.age >= 60);
  const out = new Map<number, { coach: string; berth: number; type: string }>();
  let anchorBay: number | null = null;
  for (const p of people) {
    const want = p.pref ?? (CLASSES[cls].berth === "sleeper" && senior(p) ? "LB" : null);
    const near = (n: number) => (anchorBay === null ? 0 : Math.abs(bayOf(cls, n) - anchorBay));
    const ranked = [...pool].sort((a, b) => {
      const pa = want && berthTypeOf(cls, a) === want ? 0 : 1;
      const pb = want && berthTypeOf(cls, b) === want ? 0 : 1;
      return pa - pb || near(a) - near(b) || a - b;
    });
    const n = ranked[0];
    if (n === undefined) break;
    pool.splice(pool.indexOf(n), 1);
    anchorBay ??= bayOf(cls, n);
    out.set(p.idx, { coach, berth: n, type: berthTypeOf(cls, n) });
    await db.run("INSERT INTO berth_allocations (train_number, train_start_date, class_code, coach, berth_no, booking_id, idx) VALUES (?, ?, ?, ?, ?, ?, ?)",
      seg.train.number, seg.startDate, cls, coach, n, bookingId, p.idx);
  }
  return out;
}

async function newPnr(db: Db) {
  for (;;) {
    const pnr = `${randomInt(2, 9)}${String(randomInt(0, 1e9)).padStart(9, "0")}`;
    if (!(await db.get("SELECT 1 FROM bookings WHERE pnr = ?", pnr))) return pnr;
  }
}

export class ConfirmationError extends Error {
  constructor(readonly m: Msg) {
    super(typeof m === "string" ? m : m.k);
  }
}

/** After payment: give each passenger CNF/RAC/WL in queue order, allocate berths, issue PNRs. */
export async function confirmTrip(tripId: string): Promise<Trip> {
  return transaction(async (db) => {
    const trip = await getTrip(tripId, undefined, db);
    if (!trip) throw new ConfirmationError("err.notFound");
    // Seat counts read inside the transaction, so nobody else's booking can slip in between counting and confirming.
    await loadSales(db);
    for (const b of trip.legs) {
      if (b.status === "CONFIRMED") continue;
      if (b.status !== "PENDING_PAYMENT" && b.status !== "EXPIRED") throw new ConfirmationError("err.wasCancelled");
      const seg = getSegment(b.train_number, b.from_code, b.to_code, b.journey_date);
      if (!seg) throw new ConfirmationError("err.noLongerRuns");
      const inv = inventory(seg, b.class_code, b.quota, b.id);
      const wlPrefix = b.quota === "GN" ? "GNWL" : `${b.quota}WL`;
      const seated = b.passengers.filter((p) => p.age >= 5 && !p.no_berth);
      const statuses = new Map<number, string>();
      const cnf: typeof seated = [];
      seated.forEach((p, k) => {
        const pos = inv.sold + k + 1;
        if (pos <= inv.pool) cnf.push(p);
        else if (pos <= inv.pool + inv.racSlots) statuses.set(p.idx, `RAC ${pos - inv.pool}`);
        else {
          const wl = pos - inv.pool - inv.racSlots;
          if (wl > inv.maxWl) throw new ConfirmationError(msg("err.soldOut", { train: b.train_number }));
          statuses.set(p.idx, `${wlPrefix} ${wl}`);
        }
      });
      if (b.options.confirmOnly && cnf.length < seated.length)
        throw new ConfirmationError(msg("err.cnfRanOut", { train: b.train_number }));
      const seats = await allocateBerths(db, seg, b.class_code, b.id, inv.coaches, cnf.map((p) => ({ idx: p.idx, age: p.age, gender: p.gender, pref: p.berth_pref })));
      const firstCoach = [...seats.values()][0]?.coach ?? null;
      for (const p of b.passengers) {
        const s = seats.get(p.idx);
        let text: string;
        if (s) text = `CNF/${s.coach}/${s.berth}/${s.type}`;
        else if (statuses.has(p.idx)) text = statuses.get(p.idx)!;
        else if (p.age < 5) text = "Infant (no ticket)";
        else text = firstCoach ? `CNF/${firstCoach}/No berth` : "No berth (child)";
        await db.run(
          "UPDATE booking_passengers SET booking_status = ?, status = ?, coach = ?, berth_no = ?, berth_type = ? WHERE booking_id = ? AND idx = ?",
          text, text, s?.coach ?? null, s?.berth ?? null, s?.type ?? null, b.id, p.idx
        );
      }
      await db.run("UPDATE bookings SET status = 'CONFIRMED', pnr = ?, confirmed_at = ?, expires_at = NULL WHERE id = ?", await newPnr(db), Date.now(), b.id);
    }
    return (await getTrip(tripId, undefined, db))!;
  });
}

// ---------------------------------------------------------------- cancellation & refunds

// Flat cancellation charge per passenger for confirmed tickets cancelled >48 h before departure (IRCTC-style).
const FLAT_CHARGE: Record<ClassCode, number> = { "1A": 240, EC: 240, "2A": 200, "3A": 180, CC: 180, SL: 120, "2S": 60, UR: 60 };
const WL_CLERKAGE = 60;

export type CancelQuote = {
  hoursLeft: number;
  rows: { idx: number; name: string; status: string; fare: number; charge: number; refund: number; rule: Msg }[];
  refund: number;
  allowed: boolean;
  reason?: Msg;
};

export function departureMs(b: BookingRecord) {
  return Date.parse(`${b.journey_date}T${b.fare.dep}:00+05:30`);
}

/** IRCTC prepares the reservation chart about 4 hours before departure. Returns a message key. */
export function chartStatus(b: BookingRecord, now = Date.now()) {
  const hoursLeft = (departureMs(b) - now) / 3600000;
  return hoursLeft <= 0 ? "chart.departed" : hoursLeft <= 4 ? "chart.prepared" : "chart.notPrepared";
}

/** What the passenger gets back if these passengers are cancelled now. Convenience fee and insurance are never refunded. */
export function quoteCancellation(b: BookingRecord, idxs: number[], now = Date.now()): CancelQuote {
  const hoursLeft = (departureMs(b) - now) / 3600000;
  if (b.status !== "CONFIRMED") return { hoursLeft, rows: [], refund: 0, allowed: false, reason: "cancel.onlyPaid" };
  if (hoursLeft <= 0) return { hoursLeft, rows: [], refund: 0, allowed: false, reason: "cancel.departed" };
  const ac = CLASSES[b.class_code].ac;
  const rows = b.passengers
    .filter((p) => idxs.includes(p.idx) && !p.cancelled && p.age >= 5)
    .map((p) => {
      const fare = b.fare.perPassenger[p.idx]?.fare?.total ?? 0;
      const status = p.status ?? "";
      let charge: number;
      let rule: Msg;
      if (!status.startsWith("CNF")) {
        charge = hoursLeft > 0.5 ? WL_CLERKAGE : fare;
        rule = hoursLeft > 0.5 ? msg("rule.clerkage", { amount: WL_CLERKAGE }) : "rule.under30";
      } else {
        const flat = Math.round(FLAT_CHARGE[b.class_code] * (ac ? 1.05 : 1));
        if (hoursLeft > 48) { charge = flat; rule = msg("rule.over48", { amount: flat }); }
        else if (hoursLeft > 12) { charge = Math.max(flat, Math.round(fare * 0.25)); rule = "rule.48to12"; }
        else if (hoursLeft > 4) { charge = Math.max(flat, Math.round(fare * 0.5)); rule = "rule.12to4"; }
        else { charge = fare; rule = "rule.chart"; }
      }
      charge = Math.min(charge, fare);
      return { idx: p.idx, name: p.name, status, fare, charge, refund: fare - charge, rule };
    });
  return { hoursLeft, rows, refund: rows.reduce((s, r) => s + r.refund, 0), allowed: rows.length > 0 };
}

/** Mark passengers cancelled, free their berths and record the refund (the Razorpay call is made by the caller). */
export async function applyCancellation(b: BookingRecord, quote: CancelQuote, refund: { id: string; status: string; paymentId: string } | null) {
  await transaction(async (db) => {
    let seatsFreed = 0;
    for (const r of quote.rows) {
      const p = b.passengers.find((x) => x.idx === r.idx)!;
      await db.run("UPDATE booking_passengers SET cancelled = 1, refund_paise = ?, status = 'CAN' WHERE booking_id = ? AND idx = ?",
        Math.round(r.refund * 100), b.id, r.idx);
      await db.run("DELETE FROM berth_allocations WHERE booking_id = ? AND idx = ?", b.id, r.idx);
      if (p.age >= 5 && !p.no_berth) seatsFreed++;
    }
    const refundPaise = Math.round(quote.refund * 100);
    const remaining = b.passengers.filter((p) => !p.cancelled && p.age >= 5 && !quote.rows.some((r) => r.idx === p.idx));
    await db.run("UPDATE bookings SET seats = MAX(0, seats - ?), refund_paise = refund_paise + ?, status = ? WHERE id = ?",
      seatsFreed, refundPaise, remaining.length ? "CONFIRMED" : "CANCELLED", b.id);
    if (refund) {
      await db.run("INSERT INTO refunds (id, payment_id, booking_id, amount_paise, status, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        refund.id, refund.paymentId, b.id, refundPaise, refund.status, JSON.stringify(quote.rows), Date.now());
    }
  });
}

export async function refundsFor(bookingId: string) {
  return (await appDb()).all<{ id: string; amount_paise: number; status: string; details: string; created_at: number }>(
    "SELECT id, amount_paise, status, details, created_at FROM refunds WHERE booking_id = ? ORDER BY created_at", bookingId
  );
}

// ---------------------------------------------------------------- ticket QR signature

/** Short signature printed in the ticket QR, so a scanned ticket can be checked as genuine. */
export async function ticketSignature(pnr: string) {
  return createHmac("sha256", await appSecret("ticket")).update(pnr).digest("base64url").slice(0, 16);
}

// ---------------------------------------------------------------- saved passengers

export type SavedPassenger = { id: number; name: string; age: number; gender: string; berth_pref: string | null; food_pref: string | null };

export async function savedPassengers(userId: number): Promise<SavedPassenger[]> {
  return (await appDb()).all<SavedPassenger>("SELECT id, name, age, gender, berth_pref, food_pref FROM saved_passengers WHERE user_id = ? ORDER BY id", userId);
}

export async function deleteSavedPassenger(id: number, userId: number) {
  await (await appDb()).run("DELETE FROM saved_passengers WHERE id = ? AND user_id = ?", id, userId);
}

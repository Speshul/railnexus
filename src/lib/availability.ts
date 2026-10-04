import "server-only";
// Simulated seat inventory. Real IRCTC availability isn't public, so each
// (train run, class, quota) gets a deterministic "already sold" figure driven by
// train popularity, weekday and how far away the journey is. Seats held or
// booked inside this app are subtracted on top, so the demo reacts to bookings.
import { appDb } from "./db";
import { CLASSES, BOOKING_WINDOW_DAYS, type ClassCode, type Quota } from "./constants";
import { diffDays, todayIST, nowMinutesIST, weekday, addDays } from "./dates";
import type { Segment } from "./rail";

export type AvailStatus = "AVAILABLE" | "RAC" | "WL" | "REGRET" | "NOT_OPEN" | "DEPARTED" | "UNRESERVED" | "NA";

export type Availability = {
  status: AvailStatus;
  count: number;
  label: string;
  /** probability (0-1) that a booking made now ends up confirmed */
  chance: number;
  bookable: boolean;
  note?: string;
};

const COACHES: Record<ClassCode, number> = { "1A": 1, "2A": 2, "3A": 5, SL: 10, EC: 1, CC: 6, "2S": 4, UR: 0 };
const POPULARITY: Record<string, number> = { Raj: 1.2, Drnt: 1.15, Shtb: 1.05, SF: 1.1, GR: 1.15, JShtb: 1.0, Exp: 1.0, Mail: 1.0, Pass: 0.55, Toy: 0.9 };

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function pools(cls: ClassCode, coaches: number) {
  const cap = COACHES[cls] === 0 ? 0 : coaches * CLASSES[cls].coachCap;
  const tq = Math.round(cap * (cls === "1A" || cls === "EC" ? 0 : 0.2));
  const ld = ["SL", "3A", "CC", "2S"].includes(cls) ? 6 : 0;
  const ss = CLASSES[cls].berth === "sleeper" && cls !== "1A" ? coaches * 6 : 0;
  return { cap, GN: cap - tq - ld - ss, TQ: tq, LD: ld, SS: ss, rac: CLASSES[cls].rac ? coaches * 9 : 0 };
}

/** Seats held (unexpired) or confirmed in this app for a train run. */
function appSeats(train: string, startDate: string, cls: ClassCode, quota: Quota) {
  const r = appDb()
    .prepare(
      `SELECT COALESCE(SUM(seats), 0) n FROM bookings
       WHERE train_number = ? AND train_start_date = ? AND class_code = ? AND quota = ?
         AND (status = 'CONFIRMED' OR (status = 'PENDING_PAYMENT' AND expires_at > ?))`
    )
    .get(train, startDate, cls, quota, Date.now()) as { n: number };
  return r.n;
}

export function getAvailability(seg: Segment, cls: ClassCode, quota: Quota): Availability {
  const na = (status: AvailStatus, label: string, note?: string): Availability => ({ status, count: 0, label, chance: 0, bookable: false, note });
  if (!seg.train.classes.includes(cls)) return na("NA", "Not offered");
  if (!seg.train.reservable || cls === "UR") return na("UNRESERVED", "Unreserved", "No reservation needed. Buy a ticket at the station or on UTS.");

  const today = todayIST();
  const ahead = diffDays(seg.date, today);
  if (ahead < 0) return na("DEPARTED", "Departed");
  if (ahead === 0 && (seg.from.dep_min! % 1440) <= nowMinutesIST()) return na("DEPARTED", "Departed");
  if (ahead > BOOKING_WINDOW_DAYS) return na("NOT_OPEN", "Not open", `Booking opens ${BOOKING_WINDOW_DAYS} days before the journey.`);
  if (quota === "TQ") {
    if (cls === "1A" || cls === "EC") return na("NA", "No Tatkal", "Tatkal quota is not available in this class.");
    if (ahead > 1) return na("NOT_OPEN", "Opens later", `Tatkal opens on ${addDays(seg.date, -1)} (one day before the journey).`);
  }

  const coaches = seg.train.type === "Pass" && cls === "2S" ? 8 : COACHES[cls];
  const p = pools(cls, coaches);
  const pool = p[quota];
  if (pool === 0) return na("NA", "No quota", "This quota is not available in this class.");

  const h = hash(`${seg.train.number}|${seg.startDate}|${cls}|${quota}`);
  const dow = weekday(seg.date);
  const weekend = dow === 0 || dow === 5 || dow === 6 ? 1.12 : 1;
  const nearness = ahead <= 2 ? 1.2 : ahead <= 7 ? 1.08 : ahead <= 21 ? 0.95 : ahead <= 40 ? 0.8 : 0.6;
  const pop = POPULARITY[seg.train.type] ?? 1;
  const premiumClass = cls === "1A" || cls === "EC" ? 0.75 : 1;
  const frac = (0.3 + 0.95 * h) * weekend * nearness * pop * premiumClass;
  const sold = Math.round(frac * pool) + appSeats(seg.train.number, seg.startDate, cls, quota);

  if (sold < pool) {
    const left = pool - sold;
    return { status: "AVAILABLE", count: left, label: `AVL ${left}`, chance: 1, bookable: true };
  }
  let over = sold - pool;
  if (p.rac && quota === "GN") {
    if (over < p.rac * 2) {
      const n = over + 1;
      return { status: "RAC", count: n, label: `RAC ${n}`, chance: 0.95, bookable: true, note: "RAC: shared side-lower berth, likely to confirm." };
    }
    over -= p.rac * 2;
  }
  const wl = over + 1;
  const maxWl = Math.max(20, Math.round(pool * 0.4));
  if (wl > maxWl) return na("REGRET", "Regret", "Waitlist is full for this date.");
  // Expected cancellations scale with quota size and time left before the chart is prepared.
  const expected = pool * (quota === "TQ" ? 0.04 : 0.1) * Math.min(1.2, 0.35 + ahead / 25);
  const chance = Math.max(0.03, Math.min(0.97, 1 / (1 + Math.exp((wl - expected) / (expected * 0.35 + 1)))));
  return { status: "WL", count: wl, label: `${quota === "GN" ? "GN" : quota}WL ${wl}`, chance, bookable: true };
}

/** Availability for the next `days` departures from the boarding station (skipping days the train doesn't run). */
export function availabilityCalendar(
  seg: Segment,
  cls: ClassCode,
  quota: Quota,
  days: number,
  segmentFor: (date: string) => Segment | null
) {
  const out: { date: string; runs: boolean; avail: Availability | null }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(seg.date, i);
    const s = segmentFor(date);
    out.push({ date, runs: !!s, avail: s ? getAvailability(s, cls, quota) : null });
  }
  return out;
}

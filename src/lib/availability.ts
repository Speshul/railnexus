import "server-only";
// Simulated seat inventory. Real IRCTC availability isn't public, so each
// (train run, class, quota) gets a deterministic "already sold" figure driven by
// train popularity, weekday and how far away the journey is. Seats held or
// booked inside this app are subtracted on top, so the demo reacts to bookings.
import { appDb } from "./db";
import { CLASSES, BOOKING_WINDOW_DAYS, type ClassCode, type Quota } from "./constants";
import { diffDays, todayIST, nowMinutesIST, weekday, addDays } from "./dates";
import { getStops, type Segment, type Stop } from "./rail";

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

export const coachCount = (seg: Segment, cls: ClassCode) => (seg.train.type === "Pass" && cls === "2S" ? 8 : COACHES[cls]);

export type Inventory = { pool: number; racSlots: number; maxWl: number; sold: number; coaches: number };

// Halting stations per train (static data, so cached for the life of the server).
const haltCache = new Map<string, Stop[]>();
function haltsOf(train: string) {
  let h = haltCache.get(train);
  if (!h) {
    h = getStops(train).filter((s) => s.halt);
    haltCache.set(train, h);
  }
  return h;
}

type SectionLoad = {
  halts: Stop[];
  /** seats occupied on each section between consecutive halts */
  sold: number[];
  pool: number; racSlots: number; maxWl: number; coaches: number;
  /** extra seats lost per unit of route covered, because boarding/alighting fragments berths */
  fragmentation: number;
  total: number;
};

/**
 * Seat inventory per section of the route, like IRCTC's: demand peaks mid-route and varies per section, and this
 * app's bookings only occupy the sections they travel. A long journey needs one berth free for its whole stretch,
 * which gets harder as passengers get on and off along the way, so a full route can be waitlisted while each half
 * still has confirmed seats.
 */
function sectionLoad(seg: Segment, cls: ClassCode, quota: Quota, excludeBooking = ""): SectionLoad {
  const halts = haltsOf(seg.train.number);
  const total = halts[halts.length - 1].dist || 1;
  const coaches = coachCount(seg, cls);
  const p = pools(cls, coaches);
  const pool = p[quota];
  const key = `${seg.train.number}|${seg.startDate}|${cls}|${quota}`;
  const ahead = diffDays(seg.startDate, todayIST());
  const dow = weekday(seg.startDate);
  const weekend = dow === 0 || dow === 5 || dow === 6 ? 1.12 : 1;
  const nearness = ahead <= 2 ? 1.2 : ahead <= 7 ? 1.08 : ahead <= 21 ? 0.95 : ahead <= 40 ? 0.8 : 0.6;
  const pop = POPULARITY[seg.train.type] ?? 1;
  const premiumClass = cls === "1A" || cls === "EC" ? 0.75 : 1;
  const frac = 0.88 * (0.3 + 0.95 * hash(key)) * weekend * nearness * pop * premiumClass;

  const sold = halts.slice(0, -1).map((a, i) => {
    const x = (a.dist + halts[i + 1].dist) / 2 / total;
    const shape = 0.5 + 0.4 * Math.sin(Math.PI * x) + (hash(`${key}|${i}`) - 0.5) * 0.24;
    return Math.round(Math.max(0, frac * shape) * pool);
  });

  const idx = new Map<string, number>();
  halts.forEach((h, i) => { if (!idx.has(h.code)) idx.set(h.code, i); });
  const rows = appDb()
    .prepare(
      `SELECT from_code, to_code, seats FROM bookings
       WHERE train_number = ? AND train_start_date = ? AND class_code = ? AND quota = ? AND id <> ?
         AND (status = 'CONFIRMED' OR (status = 'PENDING_PAYMENT' AND expires_at > ?))`
    )
    .all(seg.train.number, seg.startDate, cls, quota, excludeBooking, Date.now()) as { from_code: string; to_code: string; seats: number }[];
  for (const r of rows) {
    const i0 = idx.get(r.from_code);
    const i1 = idx.get(r.to_code);
    if (i0 === undefined || i1 === undefined) continue;
    for (let i = i0; i < i1; i++) sold[i] += r.seats;
  }
  return {
    halts, sold, pool, coaches, total,
    racSlots: p.rac && quota === "GN" ? p.rac * 2 : 0,
    maxWl: Math.max(20, Math.round(pool * 0.4)),
    fragmentation: 0.4 * Math.min(1, frac) * pool,
  };
}

/** Effective seats taken for a stretch of the route (halt index i0 to i1). */
function soldFor(load: SectionLoad, i0: number, i1: number) {
  let max = 0;
  for (let i = i0; i < i1; i++) max = Math.max(max, load.sold[i]);
  const cover = (load.halts[i1].dist - load.halts[i0].dist) / load.total;
  return max + Math.round(load.fragmentation * cover);
}

const haltIndex = (load: SectionLoad, seq: number) => load.halts.findIndex((h) => h.seq === seq);

/**
 * Quota size and seats already taken for this segment of a train run.
 * `excludeBooking` leaves one booking out, so its passengers can be placed in order when it is confirmed.
 */
export function inventory(seg: Segment, cls: ClassCode, quota: Quota, excludeBooking = ""): Inventory {
  const load = sectionLoad(seg, cls, quota, excludeBooking);
  const sold = soldFor(load, haltIndex(load, seg.from.seq), haltIndex(load, seg.to.seq));
  return { pool: load.pool, racSlots: load.racSlots, maxWl: load.maxWl, sold, coaches: load.coaches };
}

export type SplitOption = { via: { code: string; name: string; seq: number; day: number; dist: number }; first: number; second: number };

/**
 * When the whole stretch is waitlisted, find a station to split the journey at so that both pieces (same train,
 * two tickets, change seats once) have confirmed seats for `seats` passengers. Prefers the split with the most
 * seats on its tighter piece.
 */
export function findSplit(seg: Segment, cls: ClassCode, quota: Quota, seats = 1): SplitOption | null {
  const load = sectionLoad(seg, cls, quota);
  if (!load.pool) return null;
  const i0 = haltIndex(load, seg.from.seq);
  const i1 = haltIndex(load, seg.to.seq);
  let best: SplitOption | null = null;
  for (let k = i0 + 1; k < i1; k++) {
    const first = load.pool - soldFor(load, i0, k);
    const second = load.pool - soldFor(load, k, i1);
    if (first < seats || second < seats) continue;
    if (!best || Math.min(first, second) > Math.min(best.first, best.second)) {
      const h = load.halts[k];
      best = { via: { code: h.code, name: h.name, seq: h.seq, day: h.day, dist: h.dist }, first, second };
    }
  }
  return best;
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

  const { pool, racSlots, maxWl, sold } = inventory(seg, cls, quota);
  if (pool === 0) return na("NA", "No quota", "This quota is not available in this class.");

  if (sold < pool) {
    const left = pool - sold;
    return { status: "AVAILABLE", count: left, label: `AVL ${left}`, chance: 1, bookable: true };
  }
  let over = sold - pool;
  if (racSlots) {
    if (over < racSlots) {
      const n = over + 1;
      return { status: "RAC", count: n, label: `RAC ${n}`, chance: 0.95, bookable: true, note: "RAC: shared side-lower berth, likely to confirm." };
    }
    over -= racSlots;
  }
  const wl = over + 1;
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

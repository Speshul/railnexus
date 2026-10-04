// Fare model approximating Indian Railways' published fare structure:
// telescopic base fare per km by class + reservation charge + superfast surcharge
// + Tatkal charge + catering (premium trains) + 5% GST on AC classes.
// All amounts in whole rupees.
import { CLASSES, PREMIUM_TYPES, SUPERFAST_TYPES, type ClassCode, type Quota } from "./constants";

const RATE_PER_KM: Record<ClassCode, number> = {
  "1A": 3.13, "2A": 1.83, "3A": 1.25, SL: 0.48, EC: 3.2, CC: 1.62, "2S": 0.3, UR: 0.25,
};
const MIN_DISTANCE: Partial<Record<ClassCode, number>> = { "1A": 300, "2A": 300, "3A": 300, SL: 200, EC: 50, CC: 50, "2S": 50 };
const RESERVATION: Record<ClassCode, number> = { "1A": 60, "2A": 50, "3A": 40, SL: 20, EC: 60, CC: 40, "2S": 15, UR: 0 };
const SUPERFAST: Record<ClassCode, number> = { "1A": 75, "2A": 45, "3A": 45, SL: 30, EC: 75, CC: 45, "2S": 15, UR: 15 };
const TATKAL: Record<ClassCode, { pct: number; min: number; max: number }> = {
  "1A": { pct: 0.3, min: 400, max: 500 }, "2A": { pct: 0.3, min: 400, max: 500 }, "3A": { pct: 0.3, min: 300, max: 400 },
  SL: { pct: 0.3, min: 100, max: 200 }, EC: { pct: 0.3, min: 400, max: 500 }, CC: { pct: 0.3, min: 125, max: 225 },
  "2S": { pct: 0.1, min: 10, max: 15 }, UR: { pct: 0, min: 0, max: 0 },
};
const CATERING: Partial<Record<ClassCode, number>> = { "1A": 420, "2A": 360, "3A": 320, EC: 260, CC: 210, SL: 140 };

export type FareBreakup = {
  base: number;
  reservation: number;
  superfast: number;
  tatkal: number;
  catering: number;
  gst: number;
  total: number;
};

const round5 = (n: number) => Math.round(n / 5) * 5;

function effectiveKm(km: number) {
  return Math.min(km, 500) + 0.85 * Math.min(Math.max(km - 500, 0), 1000) + 0.7 * Math.max(km - 1500, 0);
}

/** Per-adult fare for one passenger occupying a berth/seat. */
export function adultFare(opts: { cls: ClassCode; km: number; trainType: string; quota: Quota }): FareBreakup {
  const { cls, trainType, quota } = opts;
  const km = Math.max(opts.km, MIN_DISTANCE[cls] ?? 1);
  const premium = PREMIUM_TYPES.has(trainType);
  let base = round5(RATE_PER_KM[cls] * effectiveKm(km) * (premium ? 1.3 : 1));
  base = Math.max(base, cls === "2S" || cls === "UR" ? 10 : 50);
  const reservation = RESERVATION[cls];
  const superfast = SUPERFAST_TYPES.has(trainType) ? SUPERFAST[cls] : 0;
  const t = TATKAL[cls];
  const tatkal = quota === "TQ" ? round5(Math.min(t.max, Math.max(t.min, base * t.pct))) : 0;
  const catering = premium ? Math.round((CATERING[cls] ?? 0) * (km > 800 ? 1.6 : 1)) : 0;
  const gst = CLASSES[cls].ac ? Math.round((base + reservation + superfast + tatkal) * 0.05) : 0;
  return { base, reservation, superfast, tatkal, catering, gst, total: base + reservation + superfast + tatkal + catering + gst };
}

/** Child (5-11) opting for no berth pays half the base fare plus full fixed charges; no catering. */
export function childNoBerthFare(adult: FareBreakup, cls: ClassCode): FareBreakup {
  const base = round5(adult.base / 2);
  const gst = CLASSES[cls].ac ? Math.round((base + adult.reservation + adult.superfast + adult.tatkal) * 0.05) : 0;
  const total = base + adult.reservation + adult.superfast + adult.tatkal + gst;
  return { ...adult, base, catering: 0, gst, total };
}

export const CONVENIENCE_FEE = { ac: 30, nonAc: 15, gstPct: 0.18 };
export const INSURANCE_PER_PASSENGER = 0.45;

export type PassengerKind = "adult" | "child_no_berth" | "infant";

export function passengerKind(age: number, noBerth: boolean): PassengerKind {
  if (age < 5) return "infant";
  if (age <= 11 && noBerth) return "child_no_berth";
  return "adult";
}

export type BookingFare = {
  perPassenger: { kind: PassengerKind; fare: FareBreakup | null }[];
  ticketFare: number;
  convenienceFee: number;
  insurance: number;
  total: number;
  seats: number;
};

export function bookingFare(
  opts: { cls: ClassCode; km: number; trainType: string; quota: Quota; insurance: boolean },
  passengers: { age: number; noBerth: boolean }[]
): BookingFare {
  const adult = adultFare(opts);
  const perPassenger = passengers.map((p) => {
    const kind = passengerKind(p.age, p.noBerth);
    return { kind, fare: kind === "adult" ? adult : kind === "child_no_berth" ? childNoBerthFare(adult, opts.cls) : null };
  });
  const ticketFare = perPassenger.reduce((s, p) => s + (p.fare?.total ?? 0), 0);
  const fee = CLASSES[opts.cls].ac ? CONVENIENCE_FEE.ac : CONVENIENCE_FEE.nonAc;
  const convenienceFee = Math.round(fee * (1 + CONVENIENCE_FEE.gstPct) * 100) / 100;
  const ticketed = perPassenger.filter((p) => p.kind !== "infant").length;
  const insurance = opts.insurance ? Math.round(INSURANCE_PER_PASSENGER * ticketed * 100) / 100 : 0;
  return {
    perPassenger,
    ticketFare,
    convenienceFee,
    insurance,
    total: Math.round((ticketFare + convenienceFee + insurance) * 100) / 100,
    seats: perPassenger.filter((p) => p.kind === "adult").length,
  };
}

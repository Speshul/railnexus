import "server-only";
import { railDb } from "./db";
import { addDays, isOvernightRide, weekday } from "./dates";
import { adultFare } from "./fare";
import { getStation, nearbyStations } from "./rail";
import type { ClassCode } from "./constants";

/** One place you can reach from the origin with a single train, summarised over every train that goes there. */
export type Destination = {
  code: string;
  name: string;
  state: string | null;
  lat: number;
  lng: number;
  /** how many trains a day stop at this station overall: a rough "how big is this place" measure */
  size: number;
  trains: number;
  /** fastest direct ride, minutes */
  fastest: number;
  fastestTrain: string;
  /** cheapest reserved adult fare per class (general quota) */
  fares: Partial<Record<ClassCode, number>>;
  cheapest: number | null;
  /** trains that leave in the evening and arrive in the morning: travel while you sleep */
  overnight: number;
  /** earliest departure time of day, "HH:MM" */
  firstDep: string;
};

export type ExploreResult = { origin: { code: string; name: string; lat: number; lng: number }; date: string | null; destinations: Destination[] };

const hhmm = (min: number) => `${String(Math.floor((min % 1440) / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLng - aLng) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}


const cache = new Map<string, ExploreResult | null>();

/**
 * Every station reachable by one direct train from `fromCode` (and stations within 15 km of it, so "New Delhi" also
 * covers Old Delhi and Nizamuddin). With a date, only trains running that day count; with null, any day of the week.
 * Places closer than 40 km are left out: that's a local hop, not a trip.
 */
export function explore(fromCode: string, date: string | null): ExploreResult | null {
  const key = `${fromCode}|${date ?? "any"}`;
  if (cache.has(key)) return cache.get(key)!;
  const origin = getStation(fromCode);
  if (!origin || origin.lat === null || origin.lng === null) return null;
  const codes = nearbyStations(fromCode, 15).map((s) => s.code);
  const rows = railDb()
    .prepare(
      `SELECT t.number, t.type, t.classes, t.run_days, t.reservable, a.dep_min, a.day a_day, b.arr_min, b.dist - a.dist dist,
              b.station_code code, st.name, st.state, st.lat, st.lng, st.train_count size
       FROM stops a
       JOIN stops b ON b.train_number = a.train_number AND b.seq > a.seq AND b.halt = 1
       JOIN trains t ON t.number = a.train_number
       JOIN stations st ON st.code = b.station_code
       WHERE a.halt = 1 AND a.station_code IN (${codes.map(() => "?").join(",")}) AND st.lat IS NOT NULL`
    )
    .all(...codes) as {
    number: string; type: string; classes: string; run_days: number; reservable: number; dep_min: number; a_day: number;
    arr_min: number; dist: number; code: string; name: string; state: string | null; lat: number; lng: number; size: number;
  }[];

  const out = new Map<string, Destination & { seen: Set<string>; night: Set<string> }>();
  for (const r of rows) {
    if (codes.includes(r.code) || km(origin.lat, origin.lng, r.lat, r.lng) < 40) continue;
    // A train boarding on `date` left its origin (a_day - 1) days earlier.
    if (date && !(r.run_days & (1 << weekday(addDays(date, -(r.a_day - 1)))))) continue;
    const duration = r.arr_min - r.dep_min;
    if (duration <= 0) continue;
    let d = out.get(r.code);
    if (!d) {
      d = {
        code: r.code, name: r.name, state: r.state, lat: r.lat, lng: r.lng, size: r.size, trains: 0, fastest: Infinity,
        fastestTrain: "", fares: {}, cheapest: null, overnight: 0, firstDep: "23:59", seen: new Set(), night: new Set(),
      };
      out.set(r.code, d);
    }
    // The same train can board at two origin-area stations; count it once, keep its best numbers.
    d.seen.add(r.number);
    if (duration < d.fastest) {
      d.fastest = duration;
      d.fastestTrain = r.number;
    }
    if (hhmm(r.dep_min) < d.firstDep) d.firstDep = hhmm(r.dep_min);
    if (isOvernightRide(r.dep_min, duration)) d.night.add(r.number);
    if (r.reservable) {
      for (const cls of r.classes.split(",") as ClassCode[]) {
        if (cls === "UR") continue;
        const fare = adultFare({ cls, km: r.dist, trainType: r.type, quota: "GN" }).total;
        if (!(d.fares[cls]! <= fare)) d.fares[cls] = fare;
        if (d.cheapest === null || fare < d.cheapest) d.cheapest = fare;
      }
    }
  }
  const destinations = [...out.values()].map(({ seen, night, ...d }) => ({ ...d, trains: seen.size, overnight: night.size }));
  const result = { origin: { code: origin.code, name: origin.name, lat: origin.lat, lng: origin.lng }, date, destinations };
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

import "server-only";
import { findConnections, findTrains, getStation, nearbyStations, type Segment, type Station } from "./rail";
import { findSplit, getAvailability, type Availability } from "./availability";
import { co2SavedVsFlight } from "./carbon";
import { adultFare } from "./fare";
import { CLASS_ORDER, QUOTAS, type ClassCode, type Quota } from "./constants";
import { addDays, isValidDate, todayIST } from "./dates";

export type SearchParams = { from: string; to: string; date: string; quota: Quota; cls?: ClassCode; nearby: boolean };

export function parseSearchParams(sp: Record<string, string | string[] | undefined>): SearchParams | null {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const from = get("from").toUpperCase();
  const to = get("to").toUpperCase();
  if (!from || !to) return null;
  // Missing, malformed or past dates fall back to today.
  const today = todayIST();
  const date = isValidDate(get("date")) && get("date") >= today ? get("date") : today;
  const quota = (get("quota") in QUOTAS ? get("quota") : "GN") as Quota;
  const cls = CLASS_ORDER.includes(get("cls") as ClassCode) ? (get("cls") as ClassCode) : undefined;
  return { from, to, date, quota, cls, nearby: get("nearby") === "1" };
}

/** A waitlisted class that can be booked confirmed by splitting the journey on the same train. */
export type SplitTicket = {
  via: { code: string; name: string };
  legs: [{ from: string; to: string; date: string; seats: number }, { from: string; to: string; date: string; seats: number }];
  /** fare of both pieces together, per adult */
  fare: number;
  /** how much more than a single ticket */
  extra: number;
};

export type ClassOption = { cls: ClassCode; fare: number; avail: Availability; split?: SplitTicket };

export type JourneyResult = {
  number: string;
  name: string;
  type: string;
  typeName: string;
  runDays: number;
  reservable: boolean;
  from: { code: string; name: string; time: string; day: number };
  to: { code: string; name: string; time: string; day: number };
  origin: string;
  destination: string;
  date: string;
  arrivalDate: string;
  duration: number;
  distance: number;
  /** kg CO2 saved compared with flying the same distance */
  co2Saved: number;
  classes: ClassOption[];
};

export function toJourney(seg: Segment, quota: Quota): JourneyResult {
  const fareQuota = quota === "TQ" ? "TQ" : "GN";
  const fareFor = (cls: ClassCode, km: number) => adultFare({ cls, km, trainType: seg.train.type, quota: fareQuota }).total;
  const classes = CLASS_ORDER.filter((c) => seg.train.classes.includes(c)).map((cls): ClassOption => {
    const fare = fareFor(cls, seg.distance);
    const avail = getAvailability(seg, cls, quota);
    const option: ClassOption = { cls, fare, avail };
    // Waitlisted or RAC? See if two tickets on this same train (change seats once) would both be confirmed.
    if (avail.bookable && avail.status !== "AVAILABLE") {
      const sp = findSplit(seg, cls, quota);
      if (sp) {
        const pieces = fareFor(cls, sp.via.dist - seg.from.dist) + fareFor(cls, seg.to.dist - sp.via.dist);
        option.split = {
          via: { code: sp.via.code, name: sp.via.name },
          legs: [
            { from: seg.from.code, to: sp.via.code, date: seg.date, seats: sp.first },
            { from: sp.via.code, to: seg.to.code, date: addDays(seg.startDate, sp.via.day - 1), seats: sp.second },
          ],
          fare: pieces,
          extra: pieces - fare,
        };
      }
    }
    return option;
  });
  return {
    number: seg.train.number,
    name: seg.train.name,
    type: seg.train.type,
    typeName: seg.train.type_name,
    runDays: seg.train.run_days,
    reservable: seg.train.reservable,
    from: { code: seg.from.code, name: seg.from.name, time: seg.from.dep ?? "", day: seg.from.day },
    to: { code: seg.to.code, name: seg.to.name, time: seg.to.arr ?? "", day: seg.to.day },
    origin: seg.train.from_name,
    destination: seg.train.to_name,
    date: seg.date,
    arrivalDate: seg.arrivalDate,
    duration: seg.duration,
    distance: seg.distance,
    co2Saved: co2SavedVsFlight(seg.distance),
    classes,
  };
}

export type SearchResponse = {
  params: SearchParams;
  fromStation: Station | null;
  toStation: Station | null;
  fromCodes: string[];
  toCodes: string[];
  results: JourneyResult[];
};

export function stationCodes(code: string, nearby: boolean) {
  return nearby ? nearbyStations(code, 30).map((s) => s.code) : [code];
}

export function searchJourneys(params: SearchParams): SearchResponse {
  const fromStation = getStation(params.from);
  const toStation = getStation(params.to);
  if (!fromStation || !toStation) return { params, fromStation, toStation, fromCodes: [], toCodes: [], results: [] };
  const fromCodes = stationCodes(fromStation.code, params.nearby);
  const toCodes = stationCodes(toStation.code, params.nearby).filter((c) => !fromCodes.includes(c));
  const results = findTrains(fromCodes, toCodes, params.date).map((s) => toJourney(s, params.quota));
  return { params, fromStation, toStation, fromCodes, toCodes, results };
}

export type ConnectionResult = { via: { code: string; name: string }; layover: number; duration: number; legs: [JourneyResult, JourneyResult] };

export function searchConnections(params: SearchParams): ConnectionResult[] {
  const fromStation = getStation(params.from);
  const toStation = getStation(params.to);
  if (!fromStation || !toStation) return [];
  const fromCodes = stationCodes(fromStation.code, params.nearby);
  const toCodes = stationCodes(toStation.code, params.nearby).filter((c) => !fromCodes.includes(c));
  return findConnections(fromCodes, toCodes, params.date).map((c) => ({
    via: { code: c.via.code, name: c.via.name },
    layover: c.layover,
    duration: c.duration,
    legs: [toJourney(c.legs[0], params.quota), toJourney(c.legs[1], params.quota)],
  }));
}

export type AlternativeRoute = {
  from: { code: string; name: string; km: number };
  to: { code: string; name: string; km: number };
  count: number;
  fastest: number;
  earliest: string;
  trains: { number: string; name: string }[];
};

/**
 * "Nearby airports" for trains: station pairs within 30 km of the requested ones that have
 * direct trains on the date. Closest alternatives first, so a station across the road
 * (e.g. Dadar West -> Dadar Central) beats one across the city.
 */
export function alternativeRoutes(params: SearchParams, limit = 6): AlternativeRoute[] {
  const nf = nearbyStations(params.from, 30);
  const nt = nearbyStations(params.to, 30);
  if (nf.length <= 1 && nt.length <= 1) return [];
  const kmFrom = new Map(nf.map((s) => [s.code, s]));
  const kmTo = new Map(nt.map((s) => [s.code, s]));
  const groups = new Map<string, AlternativeRoute>();
  for (const seg of findTrains(nf.map((s) => s.code), nt.map((s) => s.code), params.date)) {
    if (seg.from.code === params.from && seg.to.code === params.to) continue;
    const key = `${seg.from.code}-${seg.to.code}`;
    const dep = seg.from.dep ?? "";
    const g = groups.get(key) ?? {
      from: { code: seg.from.code, name: seg.from.name, km: kmFrom.get(seg.from.code)?.km ?? 0 },
      to: { code: seg.to.code, name: seg.to.name, km: kmTo.get(seg.to.code)?.km ?? 0 },
      count: 0,
      fastest: Infinity,
      earliest: dep,
      trains: [],
    };
    g.count++;
    g.fastest = Math.min(g.fastest, seg.duration);
    if (dep < g.earliest) g.earliest = dep;
    g.trains.push({ number: seg.train.number, name: seg.train.name });
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.from.km + a.to.km - (b.from.km + b.to.km) || b.count - a.count)
    .slice(0, limit);
}

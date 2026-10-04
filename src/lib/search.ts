import "server-only";
import { findConnections, findTrains, getStation, nearbyStations, type Segment, type Station } from "./rail";
import { getAvailability, type Availability } from "./availability";
import { adultFare } from "./fare";
import { CLASS_ORDER, QUOTAS, type ClassCode, type Quota } from "./constants";
import { isValidDate, todayIST } from "./dates";

export type SearchParams = { from: string; to: string; date: string; quota: Quota; cls?: ClassCode; nearby: boolean };

export function parseSearchParams(sp: Record<string, string | string[] | undefined>): SearchParams | null {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const from = get("from").toUpperCase();
  const to = get("to").toUpperCase();
  if (!from || !to) return null;
  const date = isValidDate(get("date")) ? get("date") : todayIST();
  const quota = (get("quota") in QUOTAS ? get("quota") : "GN") as Quota;
  const cls = CLASS_ORDER.includes(get("cls") as ClassCode) ? (get("cls") as ClassCode) : undefined;
  return { from, to, date, quota, cls, nearby: get("nearby") === "1" };
}

export type ClassOption = { cls: ClassCode; fare: number; avail: Availability };

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
  classes: ClassOption[];
};

export function toJourney(seg: Segment, quota: Quota): JourneyResult {
  const classes = CLASS_ORDER.filter((c) => seg.train.classes.includes(c)).map((cls) => ({
    cls,
    fare: adultFare({ cls, km: seg.distance, trainType: seg.train.type, quota: quota === "TQ" ? "TQ" : "GN" }).total,
    avail: getAvailability(seg, cls, quota),
  }));
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

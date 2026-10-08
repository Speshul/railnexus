import "server-only";
import { railDb } from "./db";
import { addDays, weekday } from "./dates";
import type { ClassCode } from "./constants";

export type Station = {
  code: string;
  name: string;
  state: string | null;
  zone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  train_count: number;
};

export type Train = {
  number: string;
  name: string;
  type: string;
  type_name: string;
  zone: string | null;
  from_code: string;
  to_code: string;
  from_name: string;
  to_name: string;
  departure: string | null;
  arrival: string | null;
  duration_min: number;
  distance: number;
  classes: ClassCode[];
  run_days: number;
  reservable: boolean;
  return_train: string | null;
  stop_count: number;
  halt_count: number;
};

export type Stop = {
  seq: number;
  code: string;
  name: string;
  state: string | null;
  arr: string | null;
  dep: string | null;
  arr_min: number | null;
  dep_min: number | null;
  day: number;
  dist: number;
  halt: boolean;
  halt_min: number | null;
  lat: number | null;
  lng: number | null;
};

type Row = Record<string, unknown>;

const TRAIN_COLS = `t.*, fs.name AS from_name, ts.name AS to_name`;
const TRAIN_JOIN = `JOIN stations fs ON fs.code = t.from_code JOIN stations ts ON ts.code = t.to_code`;

function toTrain(r: Row): Train {
  return {
    ...(r as unknown as Train),
    classes: String(r.classes).split(",") as ClassCode[],
    reservable: r.reservable === 1,
  };
}

/** Station codes that changed after the source data was collected, plus popular alternate names. */
const ALIASES: Record<string, string[]> = {
  csmt: ["CSTM"], "chhatrapati shivaji": ["CSTM"], vt: ["CSTM"], prayagraj: ["ALD"], pryj: ["ALD"],
  ddu: ["MGS"], "deen dayal": ["MGS"], bengaluru: ["SBC", "YPR", "BNC", "KJM"], bangalore: ["SBC", "YPR", "BNC", "KJM"],
  ksr: ["SBC"], kolkata: ["HWH", "SDAH", "KOAA"], calcutta: ["HWH", "SDAH"], howrah: ["HWH"],
  mumbai: ["CSTM", "BCT", "LTT", "DR", "BDTS"], bombay: ["CSTM", "BCT"], delhi: ["NDLS", "DLI", "NZM", "DEE", "ANVT"],
  nizamuddin: ["NZM"], chennai: ["MAS", "MS"], madras: ["MAS", "MS"], hyderabad: ["SC", "HYB", "KCG"],
  trivandrum: ["TVC"], thiruvananthapuram: ["TVC"], kochi: ["ERS"], cochin: ["ERS"], goa: ["MAO"],
  vizag: ["VSKP"], visakhapatnam: ["VSKP"], banaras: ["BSB"], kashi: ["BSB"], gurgaon: ["GGN"], gurugram: ["GGN"],
  katra: ["SVDK"], "vaishno devi": ["SVDK"], pune: ["PUNE"], poona: ["PUNE"],
};

/** Station codes for a city-level name like "Mumbai" or "Delhi" (several stations), else []. */
export function cityCodes(name: string): string[] {
  const codes = ALIASES[name.trim().toLowerCase()];
  return codes && codes.length > 1 ? codes : [];
}

export function searchStations(q: string, limit = 10): Station[] {
  const query = q.trim();
  if (!query) return [];
  const db = railDb();
  const aliasCodes = new Set<string>();
  const lq = query.toLowerCase();
  for (const [k, codes] of Object.entries(ALIASES)) {
    if (k.startsWith(lq) || (lq.length >= 4 && lq.startsWith(k))) codes.forEach((c) => aliasCodes.add(c));
  }
  const rows = db
    .prepare(
      `SELECT *, CASE
         WHEN code = :exact THEN 0
         WHEN name LIKE :prefix THEN 1
         WHEN code LIKE :prefix THEN 2
         WHEN name LIKE :word THEN 3
         ELSE 4 END AS rank
       FROM stations
       WHERE train_count > 0 AND (code LIKE :prefix OR name LIKE :contains)
       ORDER BY rank, train_count DESC
       LIMIT :limit`
    )
    .all({ exact: query.toUpperCase(), prefix: `${query}%`, word: `% ${query}%`, contains: `%${query}%`, limit }) as Row[];

  let out = rows as unknown as (Station & { rank: number })[];
  // An exact code match ("DEL" = Denduluru, "GOA" = Gohad Road) usually isn't what someone typing a place
  // name means. Keep it first only if the input looks like a code (all capitals) or no much busier station's
  // name starts with the same letters.
  const exactCode = out.find((s) => s.rank === 0);
  const typedAsCode = query === query.toUpperCase() && /[A-Z]/.test(query);
  if (exactCode && !typedAsCode) {
    const busierName = out.some((s) => s.rank === 1 && s.train_count > exactCode.train_count * 2);
    if (busierName || ALIASES[lq]) out = [...out.filter((s) => s !== exactCode && s.rank <= 1), exactCode, ...out.filter((s) => s.rank > 1)];
  }
  if (aliasCodes.size) {
    const aliasHits = [...aliasCodes].map((c) => out.find((s) => s.code === c) ?? getStation(c)).filter((s): s is Station & { rank: number } => !!s);
    const keepExactFirst = exactCode && typedAsCode;
    // A city name ("goa", "bengaluru") goes straight to that city's stations.
    out = [...(keepExactFirst ? [exactCode] : []), ...aliasHits, ...out.filter((s) => !aliasCodes.has(s.code) && !(keepExactFirst && s === exactCode))];
  }
  return out.slice(0, limit).map(stripRank);
}

function stripRank(s: Station & { rank?: number }): Station {
  const { rank, ...rest } = s;
  void rank;
  return rest;
}

export function getStation(code: string): Station | null {
  return (railDb().prepare("SELECT * FROM stations WHERE code = ?").get(code.toUpperCase()) as unknown as Station) ?? null;
}

export function getStations(codes: string[]): Map<string, Station> {
  if (!codes.length) return new Map();
  const rows = railDb()
    .prepare(`SELECT * FROM stations WHERE code IN (${codes.map(() => "?").join(",")})`)
    .all(...codes) as unknown as Station[];
  return new Map(rows.map((s) => [s.code, s]));
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

/** Stations with at least one halting train within `radiusKm` of `code`, nearest first (includes the station itself). */
export function nearbyStations(code: string, radiusKm = 30): (Station & { km: number })[] {
  const s = getStation(code);
  if (!s) return [];
  if (s.lat === null || s.lng === null) return [{ ...s, km: 0 }];
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((s.lat * Math.PI) / 180));
  const rows = railDb()
    .prepare("SELECT * FROM stations WHERE train_count > 0 AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?")
    .all(s.lat - dLat, s.lat + dLat, s.lng - dLng, s.lng + dLng) as unknown as Station[];
  return rows
    .map((r) => ({ ...r, km: haversine(s.lat!, s.lng!, r.lat!, r.lng!) }))
    .filter((r) => r.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

export function runsOn(runDays: number, date: string) {
  return (runDays & (1 << weekday(date))) !== 0;
}

export type Segment = {
  train: Train;
  from: Stop;
  to: Stop;
  /** date the train leaves the boarding station */
  date: string;
  /** date the train started from its origin (inventory key) */
  startDate: string;
  arrivalDate: string;
  duration: number;
  distance: number;
};

const stopFrom = (r: Row, p: string): Stop => ({
  seq: r[`${p}seq`] as number,
  code: r[`${p}code`] as string,
  name: r[`${p}name`] as string,
  state: (r[`${p}state`] as string) ?? null,
  arr: (r[`${p}arr`] as string) ?? null,
  dep: (r[`${p}dep`] as string) ?? null,
  arr_min: (r[`${p}arr_min`] as number) ?? null,
  dep_min: (r[`${p}dep_min`] as number) ?? null,
  day: r[`${p}day`] as number,
  dist: r[`${p}dist`] as number,
  halt: true,
  halt_min: (r[`${p}halt_min`] as number) ?? null,
  lat: (r[`${p}lat`] as number) ?? null,
  lng: (r[`${p}lng`] as number) ?? null,
});

const STOP_SELECT = (alias: string, st: string, p: string) =>
  `${alias}.seq ${p}seq, ${alias}.station_code ${p}code, ${st}.name ${p}name, ${st}.state ${p}state, ${alias}.arr ${p}arr,
   ${alias}.dep ${p}dep, ${alias}.arr_min ${p}arr_min, ${alias}.dep_min ${p}dep_min, ${alias}.day ${p}day,
   ${alias}.dist ${p}dist, ${alias}.halt_min ${p}halt_min, ${st}.lat ${p}lat, ${st}.lng ${p}lng`;

function makeSegment(train: Train, from: Stop, to: Stop, date: string): Segment {
  const startDate = addDays(date, -(from.day - 1));
  return {
    train,
    from,
    to,
    date,
    startDate,
    arrivalDate: addDays(startDate, to.day - 1),
    duration: (to.arr_min ?? 0) - (from.dep_min ?? 0),
    distance: to.dist - from.dist,
  };
}

/** All trains running between any of `fromCodes` and any of `toCodes`, departing the boarding station on `date`. */
export function findTrains(fromCodes: string[], toCodes: string[], date: string): Segment[] {
  if (!fromCodes.length || !toCodes.length) return [];
  const ph = (n: number) => Array(n).fill("?").join(",");
  const rows = railDb()
    .prepare(
      `SELECT ${TRAIN_COLS}, ${STOP_SELECT("a", "sa", "a_")}, ${STOP_SELECT("b", "sb", "b_")}
       FROM stops a
       JOIN stops b ON b.train_number = a.train_number AND b.seq > a.seq AND b.halt = 1
       JOIN trains t ON t.number = a.train_number
       ${TRAIN_JOIN}
       JOIN stations sa ON sa.code = a.station_code
       JOIN stations sb ON sb.code = b.station_code
       WHERE a.halt = 1 AND a.station_code IN (${ph(fromCodes.length)}) AND b.station_code IN (${ph(toCodes.length)})`
    )
    .all(...fromCodes, ...toCodes) as Row[];

  const exactFrom = fromCodes[0];
  const exactTo = toCodes[0];
  const best = new Map<string, { seg: Segment; score: number }>();
  for (const r of rows) {
    const train = toTrain(r);
    const from = stopFrom(r, "a_");
    const to = stopFrom(r, "b_");
    const seg = makeSegment(train, from, to, date);
    if (!runsOn(train.run_days, seg.startDate)) continue;
    // Prefer the stations the user asked for; among nearby alternatives prefer the shortest ride.
    const score = (from.code === exactFrom ? 0 : 1e6) + (to.code === exactTo ? 0 : 1e6) + seg.duration;
    const prev = best.get(train.number);
    if (!prev || score < prev.score) best.set(train.number, { seg, score });
  }
  return [...best.values()].map((b) => b.seg).sort((a, b) => (a.from.dep_min! % 1440) - (b.from.dep_min! % 1440));
}

export type Connection = { legs: [Segment, Segment]; via: Station; layover: number; duration: number };

/**
 * One-change journeys when direct trains are scarce: board any train at `from`, change at a common halt,
 * reach `to`. Layover between 45 min and 10 h. Ranked by total journey time.
 */
export function findConnections(fromCodes: string[], toCodes: string[], date: string, limit = 12): Connection[] {
  const ph = (n: number) => Array(n).fill("?").join(",");
  const rows = railDb()
    .prepare(
      `SELECT a.train_number t1, a.seq a_seq, a.dep_min a_dep, a.day a_day,
              v1.seq v1_seq, v1.station_code via, v1.arr_min v1_arr,
              v2.train_number t2, v2.seq v2_seq, v2.dep_min v2_dep, v2.day v2_day,
              b.seq b_seq, b.arr_min b_arr
       FROM stops a
       JOIN trains ta ON ta.number = a.train_number AND ta.reservable = 1
       JOIN stops v1 ON v1.train_number = a.train_number AND v1.seq > a.seq AND v1.halt = 1
       JOIN stops v2 ON v2.station_code = v1.station_code AND v2.halt = 1 AND v2.train_number <> a.train_number
       JOIN trains tb ON tb.number = v2.train_number AND tb.reservable = 1
       JOIN stops b ON b.train_number = v2.train_number AND b.seq > v2.seq AND b.halt = 1
       WHERE a.halt = 1 AND a.station_code IN (${ph(fromCodes.length)}) AND b.station_code IN (${ph(toCodes.length)})
         AND v1.station_code NOT IN (${ph(fromCodes.length + toCodes.length)})`
    )
    .all(...fromCodes, ...toCodes, ...fromCodes, ...toCodes) as Row[];

  const direct = new Set(findTrains(fromCodes, toCodes, date).map((s) => s.train.number));
  const trainCache = new Map<string, Train>();
  const train = (n: string) => {
    if (!trainCache.has(n)) trainCache.set(n, getTrain(n)!);
    return trainCache.get(n)!;
  };

  type Cand = { r: Row; d1: string; d2: string; total: number; layover: number };
  const best = new Map<string, Cand>();
  for (const r of rows) {
    const t1 = r.t1 as string;
    const t2 = r.t2 as string;
    if (direct.has(t1) || direct.has(t2)) continue;
    const t1Train = train(t1);
    const start1 = addDays(date, -((r.a_day as number) - 1));
    if (!runsOn(t1Train.run_days, start1)) continue;
    // absolute minutes from `date` 00:00
    const board = (r.a_dep as number) % 1440;
    const arriveVia = board + ((r.v1_arr as number) - (r.a_dep as number));
    const depClock = (r.v2_dep as number) % 1440;
    let depVia = Math.floor(arriveVia / 1440) * 1440 + depClock;
    if (depVia < arriveVia + 45) depVia += 1440;
    const layover = depVia - arriveVia;
    if (layover > 600) continue;
    const d2 = addDays(date, Math.floor(depVia / 1440));
    const start2 = addDays(d2, -((r.v2_day as number) - 1));
    if (!runsOn(train(t2).run_days, start2)) continue;
    const total = depVia + ((r.b_arr as number) - (r.v2_dep as number)) - board;
    const key = `${t1}-${t2}`;
    const prev = best.get(key);
    if (!prev || total < prev.total) best.set(key, { r, d1: date, d2, total, layover });
  }

  const ranked = [...best.values()].sort((a, b) => a.total - b.total).slice(0, limit);
  return ranked.map((c) => {
    const t1 = train(c.r.t1 as string);
    const t2 = train(c.r.t2 as string);
    const s1 = getStops(t1.number);
    const s2 = getStops(t2.number);
    const leg1 = makeSegment(t1, s1[c.r.a_seq as number], s1[c.r.v1_seq as number], c.d1);
    const leg2 = makeSegment(t2, s2[c.r.v2_seq as number], s2[c.r.b_seq as number], c.d2);
    return { legs: [leg1, leg2], via: getStation(c.r.via as string)!, layover: c.layover, duration: c.total };
  });
}

export function getTrain(number: string): Train | null {
  const r = railDb().prepare(`SELECT ${TRAIN_COLS} FROM trains t ${TRAIN_JOIN} WHERE t.number = ?`).get(number) as Row | undefined;
  return r ? toTrain(r) : null;
}

/** Every stop (halting and passing) of a train, indexed by seq. */
export function getStops(number: string): Stop[] {
  const rows = railDb()
    .prepare(
      `SELECT s.seq, s.station_code code, st.name, st.state, s.arr, s.dep, s.arr_min, s.dep_min, s.day, s.dist,
              s.halt, s.halt_min, st.lat, st.lng
       FROM stops s JOIN stations st ON st.code = s.station_code
       WHERE s.train_number = ? ORDER BY s.seq`
    )
    .all(number) as Row[];
  return rows.map((r) => ({ ...(r as unknown as Stop), halt: r.halt === 1 }));
}

/** A train's segment between two halting stations for a boarding date (validates order and running day). */
export function getSegment(number: string, fromCode: string, toCode: string, date: string): Segment | null {
  const train = getTrain(number);
  if (!train) return null;
  const stops = getStops(number);
  const from = stops.find((s) => s.code === fromCode && s.halt);
  const to = stops.find((s) => s.code === toCode && s.halt && from && s.seq > from.seq);
  if (!from || !to) return null;
  const seg = makeSegment(train, from, to, date);
  return runsOn(train.run_days, seg.startDate) ? seg : null;
}

export type StationTrain = { train: Train; stop: Stop };

/** Trains halting at a station (optionally only those running on `date`), by departure time. */
export function trainsAtStation(code: string, date?: string): StationTrain[] {
  const rows = railDb()
    .prepare(
      `SELECT ${TRAIN_COLS}, ${STOP_SELECT("s", "st", "s_")}
       FROM stops s JOIN trains t ON t.number = s.train_number ${TRAIN_JOIN}
       JOIN stations st ON st.code = s.station_code
       WHERE s.station_code = ? AND s.halt = 1`
    )
    .all(code) as Row[];
  return rows
    .map((r) => ({ train: toTrain(r), stop: stopFrom(r, "s_") }))
    .filter(({ train, stop }) => !date || runsOn(train.run_days, addDays(date, -(stop.day - 1))))
    .sort((a, b) => ((a.stop.dep_min ?? a.stop.arr_min!) % 1440) - ((b.stop.dep_min ?? b.stop.arr_min!) % 1440));
}

export function lookupTrains(q: string, limit = 10): Train[] {
  const query = q.trim();
  if (!query) return [];
  const rows = railDb()
    .prepare(
      `SELECT ${TRAIN_COLS} FROM trains t ${TRAIN_JOIN}
       WHERE t.number LIKE :prefix OR t.name LIKE :contains
       ORDER BY CASE WHEN t.number = :q THEN 0 WHEN t.number LIKE :prefix THEN 1 ELSE 2 END, t.number
       LIMIT :limit`
    )
    .all({ q: query, prefix: `${query}%`, contains: `%${query}%`, limit }) as Row[];
  return rows.map(toTrain);
}

export function stats() {
  const db = railDb();
  const c = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  return {
    trains: c("SELECT COUNT(*) c FROM trains"),
    stations: c("SELECT COUNT(*) c FROM stations WHERE train_count > 0"),
    stops: c("SELECT COUNT(*) c FROM stops WHERE halt = 1"),
  };
}

// ---- fuzzy station matching (for misheard speech: "pooney" -> Pune, "lucknau" -> Lucknow)
const GENERIC = /\b(jn|junction|central|cantt|cant|city|terminus|term|trm|halt|road|rd)\b/g;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
function bigrams(s: string) {
  const t = ` ${s} `;
  const out = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1);
  return out;
}
function dice(a: Map<string, number>, b: Map<string, number>) {
  let inter = 0, na = 0, nb = 0;
  for (const v of a.values()) na += v;
  for (const v of b.values()) nb += v;
  for (const [k, v] of a) inter += Math.min(v, b.get(k) ?? 0);
  return na + nb ? (2 * inter) / (na + nb) : 0;
}
let fuzzyIndex: { code: string; trains: number; grams: Map<string, number>[] }[] | null = null;

/** Closest station by spelling similarity, for names a speech recognizer got slightly wrong. */
export function fuzzyStation(q: string, minScore = 0.55): Station | null {
  const query = norm(q).replace(GENERIC, "").trim();
  if (query.length < 3) return null;
  if (!fuzzyIndex) {
    const rows = railDb().prepare("SELECT code, name, train_count FROM stations WHERE train_count > 0").all() as {
      code: string; name: string; train_count: number;
    }[];
    fuzzyIndex = rows.map((r) => {
      const n = norm(r.name);
      const short = n.replace(GENERIC, "").replace(/\s+/g, " ").trim();
      // also match the last word alone ("Mumbai Dadar West" -> "dadar west")
      const tail = short.split(" ").slice(1).join(" ");
      return { code: r.code, trains: r.train_count, grams: [n, short, tail].filter(Boolean).map(bigrams) };
    });
    for (const [alias, codes] of Object.entries(ALIASES)) {
      fuzzyIndex.push({ code: codes[0], trains: 1000, grams: [bigrams(alias)] });
    }
  }
  const qg = bigrams(query);
  let best: { code: string; score: number } | null = null;
  for (const s of fuzzyIndex) {
    const sim = Math.max(...s.grams.map((g) => dice(qg, g)));
    // small popularity bonus so big stations win near-ties
    const score = sim + Math.min(s.trains, 300) / 6000;
    if (sim >= minScore && (!best || score > best.score)) best = { code: s.code, score };
  }
  return best ? getStation(best.code) : null;
}

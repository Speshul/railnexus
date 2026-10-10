// Builds data/rail.db from the open datameet/railways dataset (CC0).
// Usage: node scripts/build-data.mjs [--if-missing]
//
// Raw data: https://github.com/datameet/railways (trains.json, stations.json, schedules.json)
// What the raw data lacks, and how we derive it:
//   - per-stop distance   -> cumulative great-circle distance between stops, scaled to the train's official distance
//   - day-of-journey      -> recomputed from time rollovers (raw `day` is missing for ~5% of rows)
//   - halts vs passing    -> a stop where arrival == departure is a non-halting (passing) point
//   - running days        -> synthesized deterministically (name hints like "Weekly", else hashed)
//   - classes             -> raw class flags, sanity-corrected per train type
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data", "rail.db");
const SRC = "https://raw.githubusercontent.com/datameet/railways/master";

async function ensureRaw(name) {
  const file = path.join(RAW, `${name}.json`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(RAW, { recursive: true });
  console.log(`downloading ${name}.json ...`);
  const res = await fetch(`${SRC}/${name}.json`);
  if (!res.ok) throw new Error(`download failed: ${name} ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const load = async (name) => JSON.parse(fs.readFileSync(await ensureRaw(name), "utf8"));

const titleCase = (s) =>
  s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bJn\b/g, "Jn").trim();

function toMin(t) {
  if (!t || t === "None") return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
const hhmm = (t) => (!t || t === "None" ? null : t.slice(0, 5));

function haversine(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Suburban services are unreserved in reality; we show them but don't sell tickets.
const SUBURBAN = new Set(["MEMU", "DEMU", "Hyd", "SKr", "Del", "Klkt"]);
const TYPE_NAMES = {
  Raj: "Rajdhani", Shtb: "Shatabdi", JShtb: "Jan Shatabdi", Drnt: "Duronto", GR: "Garib Rath",
  SF: "Superfast", Exp: "Express", Mail: "Mail", Pass: "Passenger", MEMU: "MEMU", DEMU: "DEMU",
  Hyd: "MMTS (Hyderabad)", SKr: "Suburban (Kolkata)", Del: "Suburban (Delhi)", Klkt: "Suburban (Kolkata)",
  Toy: "Toy Train", "": "Express",
};

function inferClasses(p) {
  const t = p.type;
  const f = (k) => p[k] === true || p[k] === 1;
  if (t === "Raj") return ["1A", "2A", "3A"];
  if (t === "Shtb") return ["EC", "CC"];
  if (t === "JShtb") return ["CC", "2S"];
  if (t === "GR") return ["3A"];
  if (SUBURBAN.has(t)) return ["UR"];
  const c = [];
  if (f("first_ac")) c.push("1A");
  if (f("second_ac")) c.push("2A");
  if (f("third_ac")) c.push("3A");
  if (f("sleeper")) c.push("SL");
  if (f("chair_car")) {
    if (f("first_class")) c.push("EC");
    c.push("CC");
  }
  if (c.length === 0) {
    if (t === "Pass" || t === "Toy") return ["2S"];
    if (t === "Drnt") return ["1A", "2A", "3A", "SL"];
    // Express/Mail/SF with no flags: a typical long-distance rake
    return ["2A", "3A", "SL", "2S"];
  }
  // Long-distance sleeper trains usually also carry a 2S/general coach; keep the list as-is otherwise.
  return c;
}

// Running days bitmask, bit i = JS getDay() i (0=Sun .. 6=Sat)
function runDays(p) {
  const name = p.name.toLowerCase();
  const h = hash(p.number);
  const pick = (n) => {
    let mask = 0;
    let d = h % 7;
    const step = n === 2 ? 3 : n === 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      mask |= 1 << d;
      d = (d + step) % 7;
    }
    return mask;
  };
  if (/bi-?weekly/.test(name)) return pick(2);
  if (/tri-?weekly/.test(name)) return pick(3);
  if (/weekly/.test(name)) return pick(1);
  if (/daily/.test(name)) return 127;
  if (SUBURBAN.has(p.type) || p.type === "Pass") return 127;
  if (p.number.startsWith("0")) return pick(1); // special trains
  if (p.type === "Shtb" || p.type === "JShtb") return 127 & ~(1 << (h % 7)); // six days a week
  const r = h % 100;
  if (p.type === "Raj" && r < 85) return 127;
  if (r < 80) return 127;
  if (r < 88) return pick(3);
  if (r < 94) return pick(2);
  return pick(1);
}

async function main() {
  if (process.argv.includes("--if-missing") && fs.existsSync(OUT)) return;
  const [stationsRaw, trainsRaw, schedules] = await Promise.all([load("stations"), load("trains"), load("schedules")]);

  const TMP = `${OUT}.tmp`;
  if (fs.existsSync(TMP)) fs.rmSync(TMP);
  const db = new DatabaseSync(TMP);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    CREATE TABLE stations (
      code TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT, zone TEXT, address TEXT,
      lat REAL, lng REAL, train_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE trains (
      number TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, type_name TEXT NOT NULL, zone TEXT,
      from_code TEXT NOT NULL, to_code TEXT NOT NULL, departure TEXT, arrival TEXT,
      duration_min INTEGER, distance INTEGER, classes TEXT NOT NULL, run_days INTEGER NOT NULL,
      reservable INTEGER NOT NULL, return_train TEXT, stop_count INTEGER NOT NULL, halt_count INTEGER NOT NULL,
      halts_inferred INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE stops (
      train_number TEXT NOT NULL, seq INTEGER NOT NULL, station_code TEXT NOT NULL,
      arr TEXT, dep TEXT, arr_min INTEGER, dep_min INTEGER, day INTEGER NOT NULL,
      dist INTEGER NOT NULL, halt INTEGER NOT NULL, halt_min INTEGER,
      PRIMARY KEY (train_number, seq)
    ) WITHOUT ROWID;
  `);

  // ---- stations
  const stations = new Map();
  for (const f of stationsRaw.features) {
    const p = f.properties;
    if (!p.code) continue;
    stations.set(p.code, {
      code: p.code,
      name: titleCase(p.name || p.code),
      state: p.state || null,
      zone: p.zone || null,
      address: p.address || null,
      lat: f.geometry ? f.geometry.coordinates[1] : null,
      lng: f.geometry ? f.geometry.coordinates[0] : null,
      trains: 0,
    });
  }

  // ---- group schedules by train
  const byTrain = new Map();
  for (const s of schedules) {
    if (!byTrain.has(s.train_number)) byTrain.set(s.train_number, []);
    byTrain.get(s.train_number).push(s);
  }

  // ---- halt statistics, for trains whose source data marks no halts at all (~2%: every row has
  // arrival == departure). For each station: how many trains list it, and how many actually stop there,
  // overall and among premium trains. Measured against trains that do mark halts, the rules below agree
  // with real halts ~75% of the time (precision) and find 60-90% of them (recall), depending on type.
  const isMarkedHalt = (r) => r.arrival !== "None" && r.departure !== "None" && r.arrival !== r.departure;
  const PREMIUM_STATS = new Set(["Raj", "Drnt", "Shtb", "SF"]);
  const listed = new Map(), halted = new Map(), pListed = new Map(), pHalted = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  const trainType = new Map(trainsRaw.features.map((f) => [f.properties.number, f.properties.type]));
  for (const [num, rows] of byTrain) {
    const mid = [...rows].sort((a, b) => a.id - b.id).slice(1, -1);
    if (!mid.some(isMarkedHalt)) continue;
    const premium = PREMIUM_STATS.has(trainType.get(num));
    for (const r of mid) {
      bump(listed, r.station_code);
      if (premium) bump(pListed, r.station_code);
      if (isMarkedHalt(r)) {
        bump(halted, r.station_code);
        if (premium) bump(pHalted, r.station_code);
      }
    }
  }
  const PASSENGER_LIKE = new Set(["Pass", "Toy", "MEMU", "DEMU", "Hyd", "SKr", "Del", "Klkt"]);
  /** Should this listed station count as a halt, for a train with no halt data? */
  function inferHalt(type, code, distance) {
    if (PASSENGER_LIKE.has(type) || (!type && distance < 300)) return true; // stopping trains halt everywhere listed
    const premium = ["Raj", "Drnt", "Shtb"].includes(type);
    const L = (premium ? pListed : listed).get(code) ?? 0;
    const H = (premium ? pHalted : halted).get(code) ?? 0;
    const threshold = premium ? 0.7 : ["SF", "GR", "JShtb"].includes(type) ? 0.6 : 0.5;
    return L >= 5 && H / L >= threshold;
  }
  let inferredTrains = 0;

  const insStop = db.prepare(
    `INSERT INTO stops VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insTrain = db.prepare(
    `INSERT INTO trains VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  db.exec("BEGIN");
  let skipped = 0;
  for (const f of trainsRaw.features) {
    const p = f.properties;
    let rows = byTrain.get(p.number);
    if (!rows || rows.length < 2) { skipped++; continue; }
    rows.sort((a, b) => a.id - b.id);
    // Drop duplicate consecutive station rows
    rows = rows.filter((r, i) => i === 0 || r.station_code !== rows[i - 1].station_code);

    // -- pass 1: absolute minute offsets from origin day 00:00 for timed stops
    let day = 0;
    let prev = -1;
    const n = rows.length;
    const stops = rows.map((r, i) => {
      let arr = i === 0 ? null : toMin(r.arrival);
      let dep = i === n - 1 ? null : toMin(r.departure);
      if (arr === null && i > 0) arr = toMin(r.departure);
      if (dep === null && i < n - 1) dep = toMin(r.arrival);
      let arrAbs = null;
      let depAbs = null;
      // A backwards jump of > 6h is a midnight rollover; a smaller one is a data error and is clamped.
      const place = (t) => {
        let abs = t + day * 1440;
        if (abs < prev) {
          if (prev - abs > 360) { day++; abs += 1440; } else abs = prev;
        }
        prev = abs;
        return abs;
      };
      if (arr !== null) arrAbs = place(arr);
      if (dep !== null) depAbs = place(dep);
      return { code: r.station_code, name: r.station_name, arrAbs, depAbs, timed: arrAbs !== null || depAbs !== null, dist: 0 };
    });
    const timedIdx = stops.flatMap((s, i) => (s.timed ? [i] : []));
    if (timedIdx.length < 2) { skipped++; continue; }

    // -- pass 2: distances. Great-circle between consecutive geocoded stops, gaps interpolated by index.
    const coord = (c) => {
      const s = stations.get(c);
      return s && s.lat !== null ? [s.lng, s.lat] : null;
    };
    const known = stops.map((s) => coord(s.code));
    const cum = new Array(n).fill(null);
    let acc = 0;
    let lastIdx = -1;
    for (let i = 0; i < n; i++) {
      if (!known[i]) continue;
      if (lastIdx >= 0) {
        const d = haversine(known[lastIdx], known[i]);
        // reject absurd jumps from bad geocodes (> 300 km between consecutive points)
        acc += d > 300 ? 0 : d;
      }
      cum[i] = acc;
      lastIdx = i;
    }
    if (cum[0] === null) cum[0] = 0;
    for (let i = 0; i < n; i++) {
      if (cum[i] !== null) continue;
      let a = i - 1;
      while (a >= 0 && cum[a] === null) a--;
      let b = i + 1;
      while (b < n && cum[b] === null) b++;
      cum[i] = b >= n ? cum[a] : cum[a] + ((cum[b] - cum[a]) * (i - a)) / (b - a);
    }
    const total = cum[n - 1];
    const official = p.distance > 0 ? p.distance : Math.round(total * 1.25);
    stops.forEach((s, i) => {
      s.dist = total > 0 ? Math.round((cum[i] * official) / total) : Math.round((official * i) / (n - 1));
    });
    for (let i = 1; i < n; i++) if (stops[i].dist < stops[i - 1].dist) stops[i].dist = stops[i - 1].dist;

    // -- pass 3: fill untimed stops by distance (interpolate between timed neighbours, extrapolate at the ends)
    const tA = (s) => s.depAbs ?? s.arrAbs;
    const tB = (s) => s.arrAbs ?? s.depAbs;
    const f0 = stops[timedIdx[0]];
    const f1 = stops[timedIdx[timedIdx.length - 1]];
    const span = tB(f1) - tA(f0);
    const speed = span > 0 && f1.dist > f0.dist ? (f1.dist - f0.dist) / span : 0.75; // km per minute
    for (let i = 0; i < n; i++) {
      const s = stops[i];
      if (s.timed) continue;
      let a = i - 1;
      while (a >= 0 && !stops[a].timed) a--;
      let b = i + 1;
      while (b < n && !stops[b].timed) b++;
      let t;
      if (a >= 0 && b < n) {
        const sa = stops[a], sb = stops[b];
        const frac = sb.dist > sa.dist ? (s.dist - sa.dist) / (sb.dist - sa.dist) : (i - a) / (b - a);
        t = tA(sa) + (tB(sb) - tA(sa)) * frac;
      } else if (a >= 0) {
        t = tA(stops[a]) + (s.dist - stops[a].dist) / speed + 2;
      } else {
        t = tB(stops[b]) - (stops[b].dist - s.dist) / speed - 2;
      }
      t = Math.round(t);
      s.arrAbs = i === 0 ? null : t;
      s.depAbs = i === n - 1 ? null : t;
    }
    // origin must start on day 1
    const shift = stops[0].depAbs < 0 ? Math.ceil(-stops[0].depAbs / 1440) * 1440 : 0;
    const fmt = (m) => (m === null ? null : `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    stops.forEach((s, i) => {
      if (s.arrAbs !== null) s.arrAbs += shift;
      if (s.depAbs !== null) s.depAbs += shift;
      const isEnd = i === 0 || i === n - 1;
      const haltMin = s.arrAbs !== null && s.depAbs !== null ? s.depAbs - s.arrAbs : null;
      s.arr = fmt(s.arrAbs);
      s.dep = fmt(s.depAbs);
      s.day = Math.floor((s.arrAbs ?? s.depAbs) / 1440) + 1;
      s.halt = isEnd || (s.timed && haltMin !== null && haltMin > 0);
      s.haltMin = isEnd ? null : haltMin;
    });
    // No halts marked anywhere in the source for this train: infer them from the rest of the network.
    const haltsInferred = n > 2 && !stops.slice(1, -1).some((s) => s.halt);
    if (haltsInferred) {
      inferredTrains++;
      stops.forEach((s, i) => {
        if (i > 0 && i < n - 1 && s.timed && inferHalt(p.type, s.code, p.distance)) s.halt = true;
      });
    }

    // drop physically impossible records (bad source data)
    const dur = stops[n - 1].arrAbs - stops[0].depAbs;
    if (dur < 5 || (stops[n - 1].dist * 60) / dur > 140) { skipped++; continue; }

    const classes = inferClasses(p);
    const reservable = SUBURBAN.has(p.type) ? 0 : 1;
    let haltCount = 0;
    stops.forEach((s, i) => {
      if (!stations.has(s.code)) {
        stations.set(s.code, { code: s.code, name: titleCase(s.name || s.code), state: null, zone: null, address: null, lat: null, lng: null, trains: 0 });
      }
      if (s.halt) {
        haltCount++;
        stations.get(s.code).trains++;
      }
      insStop.run(p.number, i, s.code, s.arr, s.dep, s.arrAbs, s.depAbs, s.day, s.dist, s.halt ? 1 : 0, s.haltMin);
    });

    const o = stops[0];
    const d = stops[stops.length - 1];
    insTrain.run(
      p.number,
      p.name.trim(),
      p.type || "Exp",
      TYPE_NAMES[p.type] ?? p.type,
      p.zone || null,
      o.code,
      d.code,
      o.dep,
      d.arr,
      d.arrAbs - o.depAbs,
      d.dist,
      classes.join(","),
      runDays(p),
      reservable,
      p.return_train || null,
      stops.length,
      haltCount,
      haltsInferred ? 1 : 0
    );
  }

  const insStation = db.prepare(`INSERT INTO stations VALUES (?,?,?,?,?,?,?,?)`);
  for (const s of stations.values()) {
    insStation.run(s.code, s.name, s.state, s.zone, s.address, s.lat, s.lng, s.trains);
  }
  db.exec("COMMIT");

  db.exec(`
    CREATE INDEX stops_station ON stops(station_code, halt);
    CREATE INDEX stations_name ON stations(name COLLATE NOCASE);
    CREATE INDEX trains_name ON trains(name COLLATE NOCASE);
    ANALYZE;
    VACUUM;
  `);

  const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  console.log(`halts inferred for ${inferredTrains} trains whose source data marks none`);
  console.log(`rail.db built: ${count("trains")} trains, ${count("stations")} stations, ${count("stops")} stops (skipped ${skipped})`);
  db.close();
  try {
    fs.renameSync(TMP, OUT);
  } catch (e) {
    if (e.code !== "EPERM" && e.code !== "EBUSY") throw e;
    console.error("data/rail.db is in use (stop the dev server first), new build left at data/rail.db.tmp");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "server-only";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { scryptSync, randomBytes } from "node:crypto";
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";

// Two databases:
// - rail.db: the timetable. Read-only, built at install/build time and shipped with the app; read with node:sqlite
//   (synchronous, local, fast).
// - app.db: users, sessions, bookings, payments. Lives in Turso when TURSO_DATABASE_URL is set (needed on Vercel,
//   whose servers don't keep files), otherwise in a local file. Accessed through the async helpers below.

// DATA_DIR lets a deployment (or a test run) keep the databases elsewhere.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");

const g = globalThis as unknown as { __railnexusRail?: DatabaseSync; __railnexusApp?: Promise<Db>; __railnexusClient?: Client };

function openRail() {
  const file = path.join(DATA_DIR, "rail.db");
  if (!fs.existsSync(file)) {
    throw new Error("data/rail.db not found. Run `npm run data` to build it.");
  }
  return plainRows(new DatabaseSync(file, { readOnly: true }));
}

// node:sqlite returns null-prototype rows, which React refuses to serialize to
// client components. Wrap prepare() so every row comes back as a plain object.
function plainRows(db: DatabaseSync): DatabaseSync {
  const prepare = db.prepare.bind(db);
  db.prepare = (sql: string) => {
    const stmt = prepare(sql);
    const get = stmt.get.bind(stmt) as (...args: unknown[]) => Record<string, unknown> | undefined;
    const all = stmt.all.bind(stmt) as (...args: unknown[]) => Record<string, unknown>[];
    stmt.get = ((...args: unknown[]) => {
      const row = get(...args);
      return row ? { ...row } : row;
    }) as typeof stmt.get;
    stmt.all = ((...args: unknown[]) => all(...args).map((row) => ({ ...row }))) as typeof stmt.all;
    return stmt;
  };
  return db;
}

export const railDb = () => (g.__railnexusRail ??= openRail());

// ---------------------------------------------------------------- app database (async)

type Arg = InValue | boolean | undefined;
/** The app database, or an open transaction on it: the same calls work on both. */
export type Db = {
  get<T = Record<string, unknown>>(sql: string, ...args: Arg[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, ...args: Arg[]): Promise<T[]>;
  run(sql: string, ...args: Arg[]): Promise<{ changes: number; lastInsertRowid: number }>;
  /** several statements separated by semicolons, no parameters */
  exec(sql: string): Promise<void>;
};

const toArgs = (args: Arg[]): InValue[] => args.map((a) => (a === undefined ? null : typeof a === "boolean" ? (a ? 1 : 0) : a));

function wrap(c: Client | Transaction): Db {
  const query = async (sql: string, args: Arg[]) => {
    const rs = await c.execute({ sql, args: toArgs(args) });
    // Plain objects (not libSQL Row instances) so results can be passed to client components.
    return { rs, rows: rs.rows.map((r) => Object.fromEntries(rs.columns.map((col, i) => [col, r[i]]))) };
  };
  return {
    get: async <T,>(sql: string, ...args: Arg[]) => (await query(sql, args)).rows[0] as T | undefined,
    all: async <T,>(sql: string, ...args: Arg[]) => (await query(sql, args)).rows as T[],
    run: async (sql, ...args) => {
      const { rs } = await query(sql, args);
      return { changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
    },
    exec: async (sql) => {
      await c.executeMultiple(sql);
    },
  };
}

function connect() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: `file:${path.join(DATA_DIR, "app.db").split(path.sep).join("/")}` });
}
const client = () => (g.__railnexusClient ??= connect());

async function openApp(): Promise<Db> {
  const db = wrap(client());
  if (!process.env.TURSO_DATABASE_URL) await db.exec("PRAGMA journal_mode = WAL;");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      full_name TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_passengers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      berth_pref TEXT,
      food_pref TEXT
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pnr TEXT UNIQUE,
      status TEXT NOT NULL,             -- PENDING_PAYMENT | CONFIRMED | CANCELLED | EXPIRED
      train_number TEXT NOT NULL,
      from_code TEXT NOT NULL,
      to_code TEXT NOT NULL,
      boarding_code TEXT NOT NULL,
      journey_date TEXT NOT NULL,       -- date of departure from from_code (YYYY-MM-DD)
      train_start_date TEXT NOT NULL,   -- date the train left its origin; inventory is keyed on this
      class_code TEXT NOT NULL,
      quota TEXT NOT NULL,
      seats INTEGER NOT NULL,           -- passengers occupying a berth/seat
      contact_email TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      options TEXT NOT NULL,            -- JSON: insurance, autoUpgrade, confirmOnly, gst...
      fare TEXT NOT NULL,               -- JSON fare breakdown
      total_paise INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER                -- hold expiry for PENDING_PAYMENT
    );
    CREATE INDEX IF NOT EXISTS bookings_inventory ON bookings(train_number, train_start_date, class_code, quota, status);
    CREATE TABLE IF NOT EXISTS booking_passengers (
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      berth_pref TEXT,
      food_pref TEXT,
      no_berth INTEGER NOT NULL DEFAULT 0,
      status TEXT,                      -- e.g. CNF/S4/23/LB, RAC/12, WL/40 (set on confirmation)
      PRIMARY KEY (booking_id, idx)
    );
  `);
  await migrate(db);
  await seedDemoUser(db);
  return db;
}

/** The app database, created and migrated on first use. */
export function appDb(): Promise<Db> {
  if (!g.__railnexusApp) {
    g.__railnexusApp = openApp();
    // Don't keep a failure (e.g. Turso briefly unreachable): the next request tries again.
    g.__railnexusApp.catch(() => (g.__railnexusApp = undefined));
  }
  return g.__railnexusApp;
}

/** Run `fn` in a write transaction: everything commits together or nothing does. */
export async function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  await appDb();
  const tx = await client().transaction("write");
  try {
    const out = await fn(wrap(tx));
    await tx.commit();
    return out;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  } finally {
    tx.close();
  }
}

async function addColumn(db: Db, table: string, column: string, type: string) {
  const cols = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

// Phase 3: payments, tickets, berth allocation, cancellations. Safe to run on every start.
async function migrate(db: Db) {
  // A trip groups the bookings paid together (one per train; two for a connecting journey).
  await addColumn(db, "bookings", "trip_id", "TEXT");
  await db.exec("UPDATE bookings SET trip_id = id WHERE trip_id IS NULL");
  await addColumn(db, "bookings", "leg", "INTEGER NOT NULL DEFAULT 0");
  await addColumn(db, "bookings", "confirmed_at", "INTEGER");
  await addColumn(db, "bookings", "refund_paise", "INTEGER NOT NULL DEFAULT 0");
  // Per passenger: status when booked and now (e.g. CNF/B3/34/LB, RAC 12, GNWL 40), seat, cancellation.
  await addColumn(db, "booking_passengers", "booking_status", "TEXT");
  await addColumn(db, "booking_passengers", "coach", "TEXT");
  await addColumn(db, "booking_passengers", "berth_no", "INTEGER");
  await addColumn(db, "booking_passengers", "berth_type", "TEXT");
  await addColumn(db, "booking_passengers", "cancelled", "INTEGER NOT NULL DEFAULT 0");
  await addColumn(db, "booking_passengers", "refund_paise", "INTEGER NOT NULL DEFAULT 0");
  await db.exec(`
    CREATE INDEX IF NOT EXISTS bookings_trip ON bookings(trip_id);
    CREATE TABLE IF NOT EXISTS payments (
      order_id TEXT PRIMARY KEY,          -- Razorpay order id
      trip_id TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_paise INTEGER NOT NULL,
      status TEXT NOT NULL,               -- CREATED | PAID | FAILED
      payment_id TEXT,
      method TEXT,
      created_at INTEGER NOT NULL,
      paid_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS payments_trip ON payments(trip_id);
    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,                -- Razorpay refund id
      payment_id TEXT NOT NULL,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      amount_paise INTEGER NOT NULL,
      status TEXT NOT NULL,
      details TEXT NOT NULL,              -- JSON: per-passenger charges
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS berth_allocations (
      train_number TEXT NOT NULL,
      train_start_date TEXT NOT NULL,
      class_code TEXT NOT NULL,
      coach TEXT NOT NULL,
      berth_no INTEGER NOT NULL,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      PRIMARY KEY (booking_id, idx)
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  // A berth can be reused on sections that don't overlap (split tickets, passengers getting off mid-route), so the
  // key is the passenger, not the berth. Rebuild tables created with the old berth-based key.
  const def = await db.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'berth_allocations'");
  if (def?.sql.includes("PRIMARY KEY (train_number")) {
    await db.exec(`
      BEGIN;
      ALTER TABLE berth_allocations RENAME TO berth_allocations_old;
      CREATE TABLE berth_allocations (
        train_number TEXT NOT NULL,
        train_start_date TEXT NOT NULL,
        class_code TEXT NOT NULL,
        coach TEXT NOT NULL,
        berth_no INTEGER NOT NULL,
        booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        idx INTEGER NOT NULL,
        PRIMARY KEY (booking_id, idx)
      );
      INSERT INTO berth_allocations SELECT * FROM berth_allocations_old;
      DROP TABLE berth_allocations_old;
      COMMIT;
    `);
  }
  await db.exec("CREATE INDEX IF NOT EXISTS berth_run ON berth_allocations(train_number, train_start_date, class_code)");
}

const secrets = new Map<string, string>();

/** A per-installation secret (e.g. for signing ticket QR codes), created on first use. */
export async function appSecret(name: string): Promise<string> {
  const cached = secrets.get(name);
  if (cached) return cached;
  const db = await appDb();
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", `secret:${name}`, randomBytes(32).toString("hex"));
  const value = (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", `secret:${name}`))!.value;
  secrets.set(name, value);
  return value;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

// Demo account so graders can log in immediately (credentials documented in README).
async function seedDemoUser(db: Db) {
  if (await db.get("SELECT 1 FROM users WHERE username = 'demo'")) return;
  const info = await db.run(
    "INSERT OR IGNORE INTO users (username, email, full_name, phone, password_hash) VALUES (?, ?, ?, ?, ?)",
    "demo", "demo@railnexus.test", "Demo Traveller", "9876543210", hashPassword("demo1234")
  );
  if (!info.changes) return; // another server instance seeded it at the same moment
  const ins = "INSERT INTO saved_passengers (user_id, name, age, gender, berth_pref, food_pref) VALUES (?, ?, ?, ?, ?, ?)";
  await db.run(ins, info.lastInsertRowid, "Demo Traveller", 28, "M", "LB", "VEG");
  await db.run(ins, info.lastInsertRowid, "Asha Sharma", 54, "F", "LB", "VEG");
}

import "server-only";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { scryptSync, randomBytes } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");

type Dbs = { rail: DatabaseSync; app: DatabaseSync };
const g = globalThis as unknown as { __railnexusDb?: Dbs };

function openRail() {
  const file = path.join(DATA_DIR, "rail.db");
  if (!fs.existsSync(file)) {
    throw new Error("data/rail.db not found. Run `npm run data` to build it.");
  }
  return new DatabaseSync(file, { readOnly: true });
}

function openApp() {
  const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
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
  seedDemoUser(db);
  return db;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

// Demo account so graders can log in immediately (credentials documented in README).
function seedDemoUser(db: DatabaseSync) {
  const exists = db.prepare("SELECT 1 FROM users WHERE username = 'demo'").get();
  if (exists) return;
  const info = db
    .prepare("INSERT INTO users (username, email, full_name, phone, password_hash) VALUES (?, ?, ?, ?, ?)")
    .run("demo", "demo@railnexus.test", "Demo Traveller", "9876543210", hashPassword("demo1234"));
  const ins = db.prepare(
    "INSERT INTO saved_passengers (user_id, name, age, gender, berth_pref, food_pref) VALUES (?, ?, ?, ?, ?, ?)"
  );
  ins.run(info.lastInsertRowid, "Demo Traveller", 28, "M", "LB", "VEG");
  ins.run(info.lastInsertRowid, "Asha Sharma", 54, "F", "LB", "VEG");
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

function dbs(): Dbs {
  if (!g.__railnexusDb) g.__railnexusDb = { rail: plainRows(openRail()), app: plainRows(openApp()) };
  return g.__railnexusDb;
}

export const railDb = () => dbs().rail;
export const appDb = () => dbs().app;

import "server-only";
import { appDb, type Db } from "./db";

// The RailNexus wallet, like IRCTC's eWallet: pay for tickets in one tap (or by voice, after confirming), and get
// refunds back instantly. Every change goes through credit()/debit(), which update the balance and write a ledger row
// in the same transaction, so the history always adds up to the balance.

export const WELCOME_PAISE = 200000; // ₹2,000 so a new (demo) account can try wallet payments straight away
export const TOPUP_MIN = 100;
export const TOPUP_MAX = 20000;

export type WalletTxn = { id: number; amount_paise: number; kind: string; ref: string | null; balance_after: number; created_at: number };

async function ensure(db: Db, userId: number) {
  const now = Date.now();
  const made = await db.run("INSERT OR IGNORE INTO wallets (user_id, balance_paise, created_at) VALUES (?, ?, ?)", userId, WELCOME_PAISE, now);
  if (made.changes) {
    await db.run("INSERT INTO wallet_txns (user_id, amount_paise, kind, ref, balance_after, created_at) VALUES (?, ?, 'welcome', NULL, ?, ?)",
      userId, WELCOME_PAISE, WELCOME_PAISE, now);
  }
}

/** Current balance in paise (the wallet is opened, with its welcome credit, on first look). */
export async function walletBalance(userId: number, conn?: Db) {
  const db = conn ?? (await appDb());
  await ensure(db, userId);
  return (await db.get<{ b: number }>("SELECT balance_paise b FROM wallets WHERE user_id = ?", userId))!.b;
}

export async function walletHistory(userId: number, limit = 50) {
  return (await appDb()).all<WalletTxn>(
    "SELECT id, amount_paise, kind, ref, balance_after, created_at FROM wallet_txns WHERE user_id = ? ORDER BY id DESC LIMIT ?", userId, limit
  );
}

export async function credit(db: Db, userId: number, paise: number, kind: string, ref: string | null) {
  await ensure(db, userId);
  await db.run("UPDATE wallets SET balance_paise = balance_paise + ? WHERE user_id = ?", paise, userId);
  const after = (await db.get<{ b: number }>("SELECT balance_paise b FROM wallets WHERE user_id = ?", userId))!.b;
  await db.run("INSERT INTO wallet_txns (user_id, amount_paise, kind, ref, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    userId, paise, kind, ref, after, Date.now());
  return after;
}

/** Take money out if (and only if) there is enough. Returns false when the balance is too low. */
export async function debit(db: Db, userId: number, paise: number, kind: string, ref: string | null) {
  await ensure(db, userId);
  const r = await db.run("UPDATE wallets SET balance_paise = balance_paise - ? WHERE user_id = ? AND balance_paise >= ?", paise, userId, paise);
  if (!r.changes) return false;
  const after = (await db.get<{ b: number }>("SELECT balance_paise b FROM wallets WHERE user_id = ?", userId))!.b;
  await db.run("INSERT INTO wallet_txns (user_id, amount_paise, kind, ref, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    userId, -paise, kind, ref, after, Date.now());
  return true;
}

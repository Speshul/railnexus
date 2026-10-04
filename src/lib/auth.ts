import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { appDb, hashPassword } from "./db";

export type User = { id: number; username: string; email: string; full_name: string; phone: string | null };

const COOKIE = "session";
const SESSION_DAYS = 7;

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 86400000;
  appDb().prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) appDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  store.delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = appDb()
    .prepare(
      `SELECT u.id, u.username, u.email, u.full_name, u.phone FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now()) as User | undefined;
  return row ?? null;
}

/** Redirects to login (returning to `next`) when signed out. */
export async function requireUser(next: string): Promise<User> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export function findUserForLogin(identifier: string) {
  return appDb()
    .prepare("SELECT id, password_hash FROM users WHERE username = ? OR email = ?")
    .get(identifier, identifier) as { id: number; password_hash: string } | undefined;
}

export function createUser(u: { username: string; email: string; full_name: string; phone: string; password: string }) {
  const info = appDb()
    .prepare("INSERT INTO users (username, email, full_name, phone, password_hash) VALUES (?, ?, ?, ?, ?)")
    .run(u.username, u.email, u.full_name, u.phone, hashPassword(u.password));
  return Number(info.lastInsertRowid);
}

export function takenFields(username: string, email: string) {
  const db = appDb();
  return {
    username: !!db.prepare("SELECT 1 FROM users WHERE username = ?").get(username),
    email: !!email && !!db.prepare("SELECT 1 FROM users WHERE email = ?").get(email),
  };
}

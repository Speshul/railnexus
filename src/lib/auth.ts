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
  await (await appDb()).run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userId, expires);
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
  if (token) await (await appDb()).run("DELETE FROM sessions WHERE token = ?", token);
  store.delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await (await appDb()).get<User>(
    `SELECT u.id, u.username, u.email, u.full_name, u.phone FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`,
    token, Date.now()
  );
  return row ?? null;
}

/** Redirects to login (returning to `next`) when signed out. */
export async function requireUser(next: string): Promise<User> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function findUserForLogin(identifier: string) {
  return (await appDb()).get<{ id: number; password_hash: string }>("SELECT id, password_hash FROM users WHERE username = ? OR email = ?", identifier, identifier);
}

export async function createUser(u: { username: string; email: string; full_name: string; phone: string; password: string }) {
  const info = await (await appDb()).run(
    "INSERT INTO users (username, email, full_name, phone, password_hash) VALUES (?, ?, ?, ?, ?)",
    u.username, u.email, u.full_name, u.phone, hashPassword(u.password)
  );
  return info.lastInsertRowid;
}

export async function takenFields(username: string, email: string) {
  const db = await appDb();
  return {
    username: !!(await db.get("SELECT 1 FROM users WHERE username = ?", username)),
    email: !!email && !!(await db.get("SELECT 1 FROM users WHERE email = ?", email)),
  };
}

"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, createUser, destroySession, findUserForLogin, userExists, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

// Only allow redirects back into this site.
const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!identifier || !password) return { error: "Enter your username and password." };
  const user = findUserForLogin(identifier);
  if (!user || !verifyPassword(password, user.password_hash)) return { error: "Invalid username or password." };
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(60),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_]{3,20}$/, "3-20 letters, numbers or underscore"),
    email: z.email("Enter a valid email"),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const d = parsed.data;
  if (userExists(d.username, d.email)) return { error: "That username or email is already registered." };
  const id = createUser(d);
  await createSession(id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

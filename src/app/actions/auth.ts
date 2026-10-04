"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, createUser, destroySession, findUserForLogin, takenFields, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

// Only allow redirects back into this site.
const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { identifier };
  if (!identifier || !password) return { error: "Enter your username and password.", values };
  const user = findUserForLogin(identifier);
  if (!user || !verifyPassword(password, user.password_hash)) return { error: "Invalid username or password.", values };
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
  // Echo back everything except passwords so a failed submit doesn't wipe the form.
  const values = Object.fromEntries(
    ["full_name", "username", "email", "phone"].map((k) => [k, String(form.get(k) ?? "")])
  );
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values };
  }
  const d = parsed.data;
  const taken = takenFields(d.username, d.email);
  if (taken.username || taken.email) {
    const fieldErrors: Record<string, string> = {};
    if (taken.username) fieldErrors.username = `"${d.username}" is already taken. Try another username.`;
    if (taken.email) fieldErrors.email = "An account with this email already exists. Sign in instead.";
    return { fieldErrors, values };
  }
  const id = createUser(d);
  await createSession(id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

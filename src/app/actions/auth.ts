"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/redirect";
import { getT } from "@/i18n/server";
import { createSession, createUser, destroySession, findUserForLogin, takenFields, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;


export async function login(_: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { identifier };
  const t = await getT();
  if (!identifier || !password) return { error: t("err.loginEmpty"), values };
  const user = findUserForLogin(identifier);
  if (!user || !verifyPassword(password, user.password_hash)) return { error: t("err.loginBad"), values };
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "err.fullName").max(60),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_]{3,20}$/, "err.username"),
    email: z.email("err.email"),
    phone: z.string().regex(/^[6-9]\d{9}$/, "err.indianPhone"),
    password: z.string().min(8, "err.password"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "err.mismatch" });

export async function register(_: FormState, form: FormData): Promise<FormState> {
  // Echo back everything except passwords so a failed submit doesn't wipe the form.
  const values = Object.fromEntries(
    ["full_name", "username", "email", "phone"].map((k) => [k, String(form.get(k) ?? "")])
  );
  const t = await getT();
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= t.maybe(issue.message);
    return { fieldErrors, values };
  }
  const d = parsed.data;
  const taken = takenFields(d.username, d.email);
  if (taken.username || taken.email) {
    const fieldErrors: Record<string, string> = {};
    if (taken.username) fieldErrors.username = t("err.usernameTaken", { u: d.username });
    if (taken.email) fieldErrors.email = t("err.emailTaken");
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

"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { login, register, type FormState } from "@/app/actions/auth";
import { useT } from "@/i18n/client";

function Field({ name, label, type = "text", error, hint, ...rest }: { name: string; label: string; type?: string; error?: string; hint?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} className={`input peer ${error ? "border-bad" : ""}`} aria-invalid={!!error}
        aria-describedby={`${name}-help`} {...rest} />
      <p id={`${name}-help`} className={`mt-1 text-sm ${error ? "text-bad" : "text-slate-500"}`}>{error ?? hint}</p>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, undefined);
  const t = useT();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field name="identifier" label={t("auth.identifier")} autoComplete="username" required autoFocus defaultValue={state?.values?.identifier} />
      <Field name="password" label={t("auth.password")} type="password" autoComplete="current-password" required />
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("auth.signIn")}
      </button>
      <p className="text-center text-sm text-slate-600">
        {t("auth.newHere")} <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-brand hover:underline">{t("auth.create")}</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(register, undefined);
  const t = useT();
  const fe = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  const [username, setUsername] = useState<{ value: string; status: "idle" | "checking" | "available" | "taken" }>({ value: "", status: "idle" });
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  const checkUsername = async (value: string) => {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) return setUsername({ value, status: "idle" });
    setUsername({ value, status: "checking" });
    const r = await fetch(`/api/username?u=${encodeURIComponent(value)}`).then((res) => res.json()).catch(() => null);
    setUsername((cur) => (cur.value === value && r ? { value, status: r.available ? "available" : "taken" } : cur));
  };
  const usernameHint =
    username.status === "available" ? <span className="text-ok">{t("auth.available", { u: username.value })}</span>
    : username.status === "taken" ? <span className="text-bad">{t("auth.taken", { u: username.value })}</span>
    : username.status === "checking" ? t("auth.checking")
    : t("auth.usernameHint");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field name="full_name" label={t("auth.fullName")} autoComplete="name" required minLength={2} error={fe.full_name} autoFocus
        defaultValue={v.full_name} hint={t("auth.fullNameHint")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="username" label={t("auth.username")} autoComplete="username" required pattern="[a-zA-Z0-9_]{3,20}"
          title={t("auth.usernameTitle")} error={fe.username} hint={usernameHint} defaultValue={v.username}
          onBlur={(e) => checkUsername(e.target.value.trim())} />
        <Field name="phone" label={t("auth.phone")} inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}"
          title={t("auth.phoneTitle")} autoComplete="tel-national" required
          error={fe.phone} defaultValue={v.phone} hint={t("auth.phoneHint")} />
      </div>
      <Field name="email" label={t("auth.email")} type="email" autoComplete="email" required error={fe.email} defaultValue={v.email}
        hint={t("auth.emailHint")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="password" label={t("auth.password")} type="password" autoComplete="new-password" required minLength={8}
          error={fe.password} value={pw} onChange={(e) => setPw(e.target.value)}
          hint={<span className={pw.length >= 8 ? "text-ok" : ""}>{pw.length >= 8 ? "✓ " : ""}{t("auth.pwHint")}</span>} />
        <Field name="confirm" label={t("auth.confirm")} type="password" autoComplete="new-password" required
          error={fe.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)}
          hint={confirm ? (confirm === pw ? <span className="text-ok">{t("auth.match")}</span> : <span className="text-bad">{t("auth.noMatch")}</span>) : t("auth.again")} />
      </div>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending || username.status === "taken" || (!!confirm && confirm !== pw)}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("auth.createBtn")}
      </button>
      <p className="text-center text-sm text-slate-600">
        {t("auth.already")} <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-brand hover:underline">{t("auth.signIn")}</Link>
      </p>
    </form>
  );
}

"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { login, register, type FormState } from "@/app/actions/auth";

function Field({ name, label, type = "text", error, hint, ...rest }: { name: string; label: string; type?: string; error?: string; hint?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} className={`input peer ${error ? "border-bad" : ""}`} aria-invalid={!!error}
        aria-describedby={`${name}-help`} {...rest} />
      <p id={`${name}-help`} className={`mt-1 text-xs ${error ? "text-bad" : "text-slate-500"}`}>{error ?? hint}</p>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field name="identifier" label="Username or email" autoComplete="username" required autoFocus defaultValue={state?.values?.identifier} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" required />
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Sign in
      </button>
      <p className="text-center text-sm text-slate-600">
        New here? <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-brand hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(register, undefined);
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
    username.status === "available" ? <span className="text-ok">✓ {username.value} is available</span>
    : username.status === "taken" ? <span className="text-bad">&quot;{username.value}&quot; is already taken</span>
    : username.status === "checking" ? "Checking…"
    : "Your sign-in ID: 3-20 letters, numbers or _";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field name="full_name" label="Full name" autoComplete="name" required minLength={2} error={fe.full_name} autoFocus
        defaultValue={v.full_name} hint="As on your ID. Used to fill in passenger details and your tickets." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="username" label="Username" autoComplete="username" required pattern="[a-zA-Z0-9_]{3,20}"
          title="3-20 letters, numbers or underscore" error={fe.username} hint={usernameHint} defaultValue={v.username}
          onBlur={(e) => checkUsername(e.target.value.trim())} />
        <Field name="phone" label="Mobile number" inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}"
          title="10-digit Indian mobile number starting with 6, 7, 8 or 9" autoComplete="tel-national" required
          error={fe.phone} defaultValue={v.phone} hint="10 digits, starting with 6-9" />
      </div>
      <Field name="email" label="Email" type="email" autoComplete="email" required error={fe.email} defaultValue={v.email}
        hint="Tickets and booking updates are sent here." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="password" label="Password" type="password" autoComplete="new-password" required minLength={8}
          error={fe.password} value={pw} onChange={(e) => setPw(e.target.value)}
          hint={<span className={pw.length >= 8 ? "text-ok" : ""}>{pw.length >= 8 ? "✓ " : ""}At least 8 characters</span>} />
        <Field name="confirm" label="Confirm password" type="password" autoComplete="new-password" required
          error={fe.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)}
          hint={confirm ? (confirm === pw ? <span className="text-ok">✓ Passwords match</span> : <span className="text-bad">Passwords don&apos;t match yet</span>) : "Type it again"} />
      </div>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending || username.status === "taken" || (!!confirm && confirm !== pw)}>
        {pending && <Loader2 className="size-4 animate-spin" />} Create account
      </button>
      <p className="text-center text-sm text-slate-600">
        Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-brand hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

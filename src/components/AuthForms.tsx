"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { login, register, type FormState } from "@/app/actions/auth";

function Field({ name, label, type = "text", error, ...rest }: { name: string; label: string; type?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} className={`input ${error ? "border-bad" : ""}`} aria-invalid={!!error} {...rest} />
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field name="identifier" label="Username or email" autoComplete="username" required autoFocus />
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
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field name="full_name" label="Full name" autoComplete="name" required error={fe.full_name} autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="username" label="Username" autoComplete="username" required error={fe.username} />
        <Field name="phone" label="Mobile" inputMode="numeric" maxLength={10} autoComplete="tel-national" required error={fe.phone} />
      </div>
      <Field name="email" label="Email" type="email" autoComplete="email" required error={fe.email} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="password" label="Password" type="password" autoComplete="new-password" required error={fe.password} />
        <Field name="confirm" label="Confirm password" type="password" autoComplete="new-password" required error={fe.confirm} />
      </div>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Create account
      </button>
      <p className="text-center text-sm text-slate-600">
        Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-brand hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

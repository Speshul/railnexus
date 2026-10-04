import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";
  if (await getUser()) redirect(next);
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="card p-6">
        <h1 className="mb-1 text-xl font-bold">Sign in</h1>
        <p className="mb-5 text-sm text-slate-600">
          {next.startsWith("/book") ? "Sign in to continue with your booking." : "Welcome back."}
        </p>
        <LoginForm next={next} />
      </div>
      <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-xs text-slate-600">
        Demo account: <b>demo</b> / <b>demo1234</b>
      </p>
    </div>
  );
}

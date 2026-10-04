import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/AuthForms";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";
  if (await getUser()) redirect(next);
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="card p-6">
        <h1 className="mb-5 text-xl font-bold">Create your account</h1>
        <RegisterForm next={next} />
      </div>
    </div>
  );
}

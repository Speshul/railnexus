import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("login.meta") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUser()) redirect(next);
  const t = await getT();
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="card p-6">
        <h1 className="mb-1 font-sign text-[2.16rem] leading-tight text-brand">{t("login.title")}</h1>
        <p className="mb-5 text-sm text-slate-600">
          {next.startsWith("/book") ? t("login.continue") : t("login.welcome")}
        </p>
        <LoginForm next={next} />
      </div>
      <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-sm text-slate-600">
        {t("login.demo")} <b>demo</b> / <b>demo1234</b>
      </p>
    </div>
  );
}

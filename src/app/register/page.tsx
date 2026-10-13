import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/AuthForms";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("reg.meta") };
}

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUser()) redirect(next);
  const t = await getT();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="card p-6">
        <h1 className="mb-5 font-sign text-[2.16rem] leading-tight text-brand">{t("reg.title")}</h1>
        <RegisterForm next={next} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { PlanView } from "@/components/PlanView";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("plan.meta") };
}

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const sp = await searchParams;
  const t = await getT();
  const q = typeof sp.q === "string" ? sp.q.slice(0, 500) : "";
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-sign text-[3rem] uppercase leading-[0.9] tracking-[0.03em] text-brand">{t("plan.title")}</h1>
      <p className="mb-4 text-slate-600">{t("plan.body")}</p>
      <PlanView key={q} initial={q} autoRun={sp.go === "1"} />
    </div>
  );
}

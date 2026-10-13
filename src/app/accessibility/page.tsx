import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("a11yp.meta") };
}

const FEATURES = ["display", "lang", "voice", "keyboard", "sr", "contrast", "motion"] as const;

export default async function AccessibilityPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 font-sign text-[2.16rem] leading-tight text-brand">{t("a11yp.title")}</h1>
      <p className="mb-6 text-slate-600">{t("a11yp.intro", { app: APP_NAME })}</p>
      <div className="space-y-3">
        {FEATURES.map((f) => (
          <section key={f} className="card p-4">
            <h2 className="mb-1 font-sign text-[1.15rem] leading-tight text-brand">{t(`a11yp.${f}.t`)}</h2>
            <p className="text-sm text-slate-700">{t(`a11yp.${f}.b`)}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-600">{t("a11yp.limit")}</p>
    </div>
  );
}

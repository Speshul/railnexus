import type { Metadata } from "next";
import { explore } from "@/lib/explore";
import { addDays, isValidDate, todayIST } from "@/lib/dates";
import { ExploreView } from "@/components/explore/ExploreView";
import { BUDGETS, SIZES, type ExploreFilters } from "@/components/explore/buckets";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("explore.meta") };
}

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const sp = await searchParams;
  const t = await getT();
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const from = get("from").toUpperCase();
  const date = isValidDate(get("date")) && get("date") >= todayIST() ? get("date") : null;
  const data = from ? explore(from, date) : null;
  const hours = Number(get("h"));
  const budget = Number(get("b"));
  const initial: ExploreFilters = {
    hours: hours >= 1 && hours <= 36 ? Math.round(hours) : 10,
    budget: BUDGETS.includes(budget) ? budget : 0,
    night: get("night") === "1",
    size: get("size") in SIZES ? (get("size") as ExploreFilters["size"]) : "major",
    sort: ["popular", "fastest", "cheapest"].includes(get("sort")) ? (get("sort") as ExploreFilters["sort"]) : "popular",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-sign text-[3rem] uppercase leading-[0.9] tracking-[0.03em] text-brand">{t("explore.title")}</h1>
      <p className="mb-4 text-slate-600">{t("explore.body")}</p>
      {from && !data && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{t("explore.unknown")}</p>}
      <ExploreView key={`${data?.origin.code}-${data?.date}`} data={data} initial={initial} defaultDate={addDays(todayIST(), 1)} today={todayIST()} />
    </div>
  );
}

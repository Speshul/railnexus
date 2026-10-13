"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Search } from "lucide-react";
import { StationInput, type StationOption } from "./StationInput";
import { BOOKING_WINDOW_DAYS, CLASS_ORDER, QUOTAS, type Quota } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";

export type SearchDefaults = {
  from?: StationOption | null;
  to?: StationOption | null;
  date?: string;
  quota?: Quota;
  cls?: string;
  nearby?: boolean;
};

export function SearchForm({ defaults = {}, today, compact = false }: { defaults?: SearchDefaults; today: string; compact?: boolean }) {
  const router = useRouter();
  const t = useT();
  const [from, setFrom] = useState<StationOption | null>(defaults.from ?? null);
  const [to, setTo] = useState<StationOption | null>(defaults.to ?? null);
  const [date, setDate] = useState(defaults.date ?? addDays(today, 1));
  const [quota, setQuota] = useState<Quota>(defaults.quota ?? "GN");
  const [cls, setCls] = useState(defaults.cls ?? "");
  const [nearby, setNearby] = useState(defaults.nearby ?? false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError(t("search.err.pick"));
    if (from.code === to.code) return setError(t("search.err.same"));
    setError("");
    const qs = new URLSearchParams({ from: from.code, to: to.code, date, quota });
    if (cls) qs.set("cls", cls);
    if (nearby) qs.set("nearby", "1");
    router.push(`/search?${qs}`);
  };

  return (
    <form onSubmit={submit} className={compact ? "grid gap-3 md:grid-cols-[1fr_auto_1fr_10rem_9rem_9rem_auto] md:items-end" : "grid gap-4"}>
      <div className={compact ? "contents" : "grid items-end gap-2 md:grid-cols-[1fr_auto_1fr]"}>
        <StationInput label={t("search.from")} value={from} onChange={setFrom} />
        <button
          type="button"
          onClick={() => { setFrom(to); setTo(from); }}
          className="mx-auto mb-1 flex size-10 items-center justify-center rounded-full bg-brand text-accent hover:bg-brand-dark"
          aria-label={t("search.swap")}
        >
          <ArrowLeftRight className="size-4" />
        </button>
        <StationInput label={t("search.to")} value={to} onChange={setTo} />
      </div>
      <div className={compact ? "contents" : "grid gap-4 sm:grid-cols-3"}>
        <div>
          <label className="label" htmlFor="date">{t("search.date")}</label>
          <input id="date" type="date" className="input" value={date} min={today} max={addDays(today, BOOKING_WINDOW_DAYS)}
            onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="cls">{t("search.class")}</label>
          <select id="cls" className="input" value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">{t("search.allClasses")}</option>
            {CLASS_ORDER.filter((c) => c !== "UR").map((c) => (
              <option key={c} value={c}>{t(`class.${c}` as MessageKey)} ({c})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="quota">{t("search.quota")}</label>
          <select id="quota" className="input" value={quota} onChange={(e) => setQuota(e.target.value as Quota)}>
            {Object.keys(QUOTAS).map((k) => <option key={k} value={k}>{t(`quota.${k}` as MessageKey)}</option>)}
          </select>
        </div>
      </div>
      <div className={compact ? "contents" : "flex flex-wrap items-center justify-between gap-3"}>
        <label className={`flex items-center gap-2 text-sm text-slate-700 ${compact ? "md:order-last md:col-span-full" : ""}`}>
          <input type="checkbox" checked={nearby} onChange={(e) => setNearby(e.target.checked)} className="size-4 accent-brand" />
          {t("search.nearby")}
        </label>
        <button className={`btn-primary ${compact ? "h-[2.75rem]" : "px-10 py-3.5 font-sign text-[1.6rem] uppercase leading-none tracking-[0.05em]"}`}>
          <Search className={compact ? "size-4" : "size-5"} aria-hidden /> {compact ? t("search.modify") : t("search.submit")}
        </button>
      </div>
      {quota === "TQ" && !compact && (
        <p className="text-sm text-warn">{t("quota.TQ.help")}</p>
      )}
      {error && <p className="text-sm text-bad md:col-span-full">{error}</p>}
    </form>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Search } from "lucide-react";
import { StationInput, type StationOption } from "./StationInput";
import { BOOKING_WINDOW_DAYS, CLASSES, CLASS_ORDER, QUOTAS, type Quota } from "@/lib/constants";
import { addDays } from "@/lib/dates";

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
  const [from, setFrom] = useState<StationOption | null>(defaults.from ?? null);
  const [to, setTo] = useState<StationOption | null>(defaults.to ?? null);
  const [date, setDate] = useState(defaults.date ?? addDays(today, 1));
  const [quota, setQuota] = useState<Quota>(defaults.quota ?? "GN");
  const [cls, setCls] = useState(defaults.cls ?? "");
  const [nearby, setNearby] = useState(defaults.nearby ?? false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError("Choose both stations from the suggestions.");
    if (from.code === to.code) return setError("From and To stations must be different.");
    setError("");
    const qs = new URLSearchParams({ from: from.code, to: to.code, date, quota });
    if (cls) qs.set("cls", cls);
    if (nearby) qs.set("nearby", "1");
    router.push(`/search?${qs}`);
  };

  return (
    <form onSubmit={submit} className={compact ? "grid gap-3 md:grid-cols-[1fr_auto_1fr_10rem_9rem_9rem_auto] md:items-end" : "grid gap-4"}>
      <div className={compact ? "contents" : "grid items-end gap-2 md:grid-cols-[1fr_auto_1fr]"}>
        <StationInput label="From" value={from} onChange={setFrom} autoFocus={!compact && !from} />
        <button
          type="button"
          onClick={() => { setFrom(to); setTo(from); }}
          className="mx-auto mb-0.5 flex size-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Swap stations"
        >
          <ArrowLeftRight className="size-4" />
        </button>
        <StationInput label="To" value={to} onChange={setTo} />
      </div>
      <div className={compact ? "contents" : "grid gap-4 sm:grid-cols-3"}>
        <div>
          <label className="label" htmlFor="date">Journey date</label>
          <input id="date" type="date" className="input" value={date} min={today} max={addDays(today, BOOKING_WINDOW_DAYS)}
            onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="cls">Class</label>
          <select id="cls" className="input" value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">All classes</option>
            {CLASS_ORDER.filter((c) => c !== "UR").map((c) => (
              <option key={c} value={c}>{CLASSES[c].name} ({c})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="quota">Quota</label>
          <select id="quota" className="input" value={quota} onChange={(e) => setQuota(e.target.value as Quota)}>
            {Object.entries(QUOTAS).map(([k, q]) => <option key={k} value={k}>{q.name}</option>)}
          </select>
        </div>
      </div>
      <div className={compact ? "contents" : "flex flex-wrap items-center justify-between gap-3"}>
        <label className={`flex items-center gap-2 text-sm text-slate-700 ${compact ? "md:order-last md:col-span-full" : ""}`}>
          <input type="checkbox" checked={nearby} onChange={(e) => setNearby(e.target.checked)} className="size-4 accent-brand" />
          Include nearby stations (within 30 km)
        </label>
        <button className={`btn-primary ${compact ? "h-[38px]" : "px-8 py-3 text-base"}`}>
          <Search className="size-4" /> {compact ? "Modify" : "Search trains"}
        </button>
      </div>
      {quota === "TQ" && !compact && (
        <p className="text-xs text-warn">{QUOTAS.TQ.help}</p>
      )}
      {error && <p className="text-sm text-bad md:col-span-full">{error}</p>}
    </form>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Loader2, SlidersHorizontal } from "lucide-react";
import type { ConnectionResult, JourneyResult, SearchResponse } from "@/lib/search";
import { CLASS_ORDER, TRAIN_TYPE_FILTERS, type ClassCode } from "@/lib/constants";
import { formatDuration } from "@/lib/dates";
import { TrainCard } from "./TrainCard";

const SLOTS = [
  { key: "0", label: "00–06", from: 0, to: 360 },
  { key: "1", label: "06–12", from: 360, to: 720 },
  { key: "2", label: "12–18", from: 720, to: 1080 },
  { key: "3", label: "18–24", from: 1080, to: 1440 },
];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
type Sort = "dep" | "arr" | "dur" | "fare";

function toggle<T>(set: Set<T>, v: T) {
  const n = new Set(set);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  return n;
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
      <input type="checkbox" className="size-4 accent-brand" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

function SlotPicker({ value, set }: { value: Set<string>; set: (s: Set<string>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {SLOTS.map((s) => (
        <button key={s.key} onClick={() => set(toggle(value, s.key))}
          className={`rounded-md border px-2 py-1 text-xs ${value.has(s.key) ? "border-brand bg-brand-light font-semibold text-brand" : "border-slate-200 bg-white"}`}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function ResultsView({ data, nearbyCount = 0, nearbyHref }: { data: SearchResponse; nearbyCount?: number; nearbyHref?: string }) {
  const { results, params } = data;
  const [tab, setTab] = useState<"direct" | "connect">(results.length ? "direct" : "connect");
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [classes, setClasses] = useState<Set<ClassCode>>(new Set(params.cls ? [params.cls] : []));
  const [depSlots, setDepSlots] = useState<Set<string>>(new Set());
  const [arrSlots, setArrSlots] = useState<Set<string>>(new Set());
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [hideUnreserved, setHideUnreserved] = useState(false);
  const [fromStn, setFromStn] = useState<Set<string>>(new Set());
  const [toStn, setToStn] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>("dep");
  const [showFilters, setShowFilters] = useState(false);

  const presentClasses = CLASS_ORDER.filter((c) => results.some((r) => r.classes.some((x) => x.cls === c)));
  const presentTypes = TRAIN_TYPE_FILTERS.filter((f) => results.some((r) => f.types.includes(r.type)));
  const fromStations = [...new Map(results.map((r) => [r.from.code, r.from.name])).entries()];
  const toStations = [...new Map(results.map((r) => [r.to.code, r.to.name])).entries()];

  const filtered = useMemo(() => {
    const typeSet = new Set([...types].flatMap((k) => TRAIN_TYPE_FILTERS.find((f) => f.key === k)!.types));
    const inSlot = (slots: Set<string>, t: string) =>
      slots.size === 0 || SLOTS.some((s) => slots.has(s.key) && toMin(t) >= s.from && toMin(t) < s.to);
    const cheapest = (r: JourneyResult) => Math.min(...r.classes.map((c) => c.fare), Infinity);
    const out = results.filter((r) => {
      if (typeSet.size && !typeSet.has(r.type)) return false;
      if (hideUnreserved && !r.reservable) return false;
      if (classes.size && !r.classes.some((c) => classes.has(c.cls))) return false;
      if (!inSlot(depSlots, r.from.time) || !inSlot(arrSlots, r.to.time)) return false;
      if (fromStn.size && !fromStn.has(r.from.code)) return false;
      if (toStn.size && !toStn.has(r.to.code)) return false;
      if (onlyAvail && !r.classes.some((c) => (!classes.size || classes.has(c.cls)) && c.avail.status === "AVAILABLE")) return false;
      return true;
    });
    const key: Record<Sort, (r: JourneyResult) => number> = {
      dep: (r) => toMin(r.from.time),
      arr: (r) => (r.to.day - r.from.day) * 1440 + toMin(r.to.time),
      dur: (r) => r.duration,
      fare: cheapest,
    };
    return out.sort((a, b) => key[sort](a) - key[sort](b));
  }, [results, types, classes, depSlots, arrSlots, onlyAvail, hideUnreserved, fromStn, toStn, sort]);

  const activeFilters = types.size + classes.size + depSlots.size + arrSlots.size + fromStn.size + toStn.size + (onlyAvail ? 1 : 0) + (hideUnreserved ? 1 : 0);
  const reset = () => {
    setTypes(new Set()); setClasses(new Set()); setDepSlots(new Set()); setArrSlots(new Set());
    setFromStn(new Set()); setToStn(new Set()); setOnlyAvail(false); setHideUnreserved(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
      <aside className={`${showFilters ? "block" : "hidden"} card h-fit space-y-4 p-4 lg:sticky lg:top-4 lg:block`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Filters</h2>
          {activeFilters > 0 && <button onClick={reset} className="text-xs text-brand hover:underline">Reset</button>}
        </div>
        <div>
          <h3 className="label">Availability</h3>
          <Check checked={onlyAvail} onChange={() => setOnlyAvail(!onlyAvail)}>Confirmed seats only</Check>
          {results.some((r) => !r.reservable) && (
            <Check checked={hideUnreserved} onChange={() => setHideUnreserved(!hideUnreserved)}>Hide unreserved trains</Check>
          )}
        </div>
        {presentClasses.length > 1 && (
          <div>
            <h3 className="label">Class</h3>
            {presentClasses.map((c) => (
              <Check key={c} checked={classes.has(c)} onChange={() => setClasses(toggle(classes, c))}>{c}</Check>
            ))}
          </div>
        )}
        {presentTypes.length > 1 && (
          <div>
            <h3 className="label">Train type</h3>
            {presentTypes.map((f) => (
              <Check key={f.key} checked={types.has(f.key)} onChange={() => setTypes(toggle(types, f.key))}>{f.label}</Check>
            ))}
          </div>
        )}
        <div>
          <h3 className="label">Departure from {data.fromStation?.code}</h3>
          <SlotPicker value={depSlots} set={setDepSlots} />
        </div>
        <div>
          <h3 className="label">Arrival at {data.toStation?.code}</h3>
          <SlotPicker value={arrSlots} set={setArrSlots} />
        </div>
        {fromStations.length > 1 && (
          <div>
            <h3 className="label">Boarding station</h3>
            {fromStations.map(([c, n]) => (
              <Check key={c} checked={fromStn.has(c)} onChange={() => setFromStn(toggle(fromStn, c))}>{n} <span className="font-mono text-xs text-slate-500">{c}</span></Check>
            ))}
          </div>
        )}
        {toStations.length > 1 && (
          <div>
            <h3 className="label">Destination station</h3>
            {toStations.map(([c, n]) => (
              <Check key={c} checked={toStn.has(c)} onChange={() => setToStn(toggle(toStn, c))}>{n} <span className="font-mono text-xs text-slate-500">{c}</span></Check>
            ))}
          </div>
        )}
      </aside>

      <section>
        {nearbyHref && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand-light p-3 text-sm">
            <p>
              <b>{nearbyCount} direct {nearbyCount === 1 ? "train runs" : "trains run"}</b> between other stations within 30 km of{" "}
              {data.fromStation?.name} and {data.toStation?.name}.
            </p>
            <Link href={nearbyHref} className="btn-brand py-1.5">Show trains from nearby stations</Link>
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            <button onClick={() => setTab("direct")} className={`rounded-md px-3 py-1.5 ${tab === "direct" ? "bg-brand text-white" : ""}`}>
              Direct trains ({results.length})
            </button>
            <button onClick={() => setTab("connect")} className={`rounded-md px-3 py-1.5 ${tab === "connect" ? "bg-brand text-white" : ""}`}>
              Connecting journeys
            </button>
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary py-1.5 lg:hidden">
            <SlidersHorizontal className="size-4" /> Filters{activeFilters ? ` (${activeFilters})` : ""}
          </button>
          {tab === "direct" && (
            <label className="ml-auto flex items-center gap-2 text-sm">
              Sort by
              <select className="input w-auto py-1.5" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="dep">Departure time</option>
                <option value="arr">Arrival time</option>
                <option value="dur">Duration</option>
                <option value="fare">Lowest fare</option>
              </select>
            </label>
          )}
        </div>

        {tab === "direct" ? (
          filtered.length ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm text-slate-500">Showing {filtered.length} of {results.length} trains. Pick a class on any train to book it.</p>
                <details className="text-sm">
                  <summary className="cursor-pointer text-brand hover:underline">What do these terms mean?</summary>
                  <dl className="card mt-2 max-w-md space-y-1.5 p-3 text-xs text-slate-600">
                    <div><dt className="inline font-semibold text-ok">Seats available</dt><dd className="inline">: you get a confirmed seat/berth straight away.</dd></div>
                    <div><dt className="inline font-semibold text-warn">RAC</dt><dd className="inline"> (Reservation Against Cancellation): you can board, sharing a side berth; usually upgraded to a full berth.</dd></div>
                    <div><dt className="inline font-semibold text-bad">Waitlist #n</dt><dd className="inline">: you&apos;re in a queue for cancellations. The % shows how likely it is to confirm.</dd></div>
                    <div><dt className="inline font-semibold">Classes</dt><dd className="inline">: 1A/2A/3A are AC sleepers (fewer berths per bay = more comfort), SL is non-AC sleeper, CC/EC are AC chair cars, 2S is non-AC seating.</dd></div>
                  </dl>
                </details>
              </div>
              {filtered.map((j) => (
                <TrainCard key={j.number} j={j} quota={params.quota} initialClass={classes.size === 1 ? [...classes][0] : null} />
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center text-slate-600">
              {results.length ? (
                <>No trains match these filters. <button onClick={reset} className="text-brand underline">Clear filters</button></>
              ) : (
                <>
                  No direct trains on this date.{" "}
                  {!params.nearby && <>Try including nearby stations, or </>}
                  <button onClick={() => setTab("connect")} className="text-brand underline">see connecting journeys</button>.
                </>
              )}
            </div>
          )
        ) : (
          <Connections data={data} />
        )}
      </section>
    </div>
  );
}

function Connections({ data }: { data: SearchResponse }) {
  const { params } = data;
  const key = JSON.stringify(params);
  const [state, setState] = useState<{ key: string; list?: ConnectionResult[]; error?: boolean } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ from: params.from, to: params.to, date: params.date, quota: params.quota, connections: "1" });
    if (params.nearby) qs.set("nearby", "1");
    fetch(`/api/search?${qs}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setState({ key, list: d.connections }))
      .catch((e) => { if (e.name !== "AbortError") setState({ key, error: true }); });
    return () => ctrl.abort();
  }, [key, params]);

  const loaded = state?.key === key ? state : null;
  if (!loaded) return <div className="card flex items-center gap-2 p-6 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> Finding journeys with one change…</div>;
  if (loaded.error) return <div className="card p-6 text-sm text-bad">Couldn&apos;t load connecting journeys.</div>;
  if (!loaded.list!.length) return <div className="card p-8 text-center text-slate-600">No one-change journeys found for this date.</div>;

  const noDirect = data.results.length === 0;
  return (
    <div className="space-y-6">
      <div className={`rounded-lg border p-3 text-sm ${noDirect ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-600"}`}>
        {noDirect && <p className="font-semibold">No train runs directly from {data.fromStation?.name} to {data.toStation?.name} on this date.</p>}
        <p>
          These journeys use <b>two trains</b> with one change. You book each train separately: pick a class on Leg 1,
          then come back and book Leg 2. Layovers are between 45 minutes and 10 hours, fastest journeys first.
        </p>
      </div>
      {loaded.list!.map((c, n) => (
        <section key={c.legs[0].number + c.legs[1].number} className="rounded-xl border border-slate-300 bg-slate-100/60 p-3">
          <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm">
            <span className="font-semibold">Option {n + 1}: {formatDuration(c.duration)} total</span>
            <span className="flex items-center gap-1 text-slate-600">
              {c.legs[0].from.code} <ArrowRight className="size-3" /> change at <b>{c.via.name}</b> ({c.via.code}) <ArrowRight className="size-3" /> {c.legs[1].to.code}
            </span>
          </header>
          <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Leg 1</p>
          <TrainCard j={c.legs[0]} quota={params.quota} anchor={false} />
          <p className="my-2 flex items-center gap-1.5 px-1 text-sm text-warn">
            <Clock className="size-4" /> {formatDuration(c.layover)} wait at {c.via.name}
          </p>
          <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Leg 2</p>
          <TrainCard j={c.legs[1]} quota={params.quota} anchor={false} />
        </section>
      ))}
    </div>
  );
}

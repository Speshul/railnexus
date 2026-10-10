"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Clock, Footprints, Loader2, SlidersHorizontal } from "lucide-react";
import type { AlternativeRoute, ConnectionResult, JourneyResult, SearchResponse } from "@/lib/search";
import { CLASSES, CLASS_ORDER, TRAIN_TYPE_FILTERS, type ClassCode, type Quota } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { availText, inr } from "@/lib/format";
import { bookHref } from "@/lib/trip-url";
import { TrainCard } from "./TrainCard";
import { useVoiceContext, useVoiceHandlers } from "./voice/VoiceBridge";
import type { VoiceContext } from "@/lib/voice/types";

/** Compact description of a journey for the voice assistant's context. */
const voiceTrain = (j: JourneyResult) => ({
  n: j.number, name: j.name, from: j.from.code, to: j.to.code, dep: j.from.time, arr: j.to.time, dur: j.duration, date: j.date,
  classes: j.classes.filter((c) => c.avail.bookable).map((c) => `${c.cls}:${c.fare}:${c.avail.label}`).join("|"),
});

function openNearbyOptions() {
  const el = document.getElementById("nearby-options") as HTMLDetailsElement | null;
  if (!el) return "There are no nearby-station options for this search.";
  el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

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

export function ResultsView({ data, alternatives = [], nearbyHref }: { data: SearchResponse; alternatives?: AlternativeRoute[]; nearbyHref: string }) {
  const { results, params } = data;
  const [tab, setTab] = useState<"direct" | "connect">(results.length ? "direct" : "connect");
  const [types, setTypes] = useState<Set<string>>(new Set());
  // The class chosen in the search form pre-filters results, unless no train here offers it.
  const clsOffered = !!params.cls && results.some((r) => r.classes.some((c) => c.cls === params.cls));
  const [classes, setClasses] = useState<Set<ClassCode>>(new Set(params.cls && clsOffered ? [params.cls] : []));
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

  const voiceCtx = useMemo<Partial<VoiceContext>>(
    () => ({
      search: {
        from: params.from, to: params.to, fromName: data.fromStation?.name ?? params.from, toName: data.toStation?.name ?? params.to,
        date: params.date, quota: params.quota, cls: params.cls, nearby: params.nearby,
      },
      trains: tab === "direct" ? filtered.slice(0, 15).map(voiceTrain) : undefined,
      nearbyOptions: alternatives.length,
    }),
    [params, data.fromStation, data.toStation, tab, filtered, alternatives.length]
  );
  useVoiceContext(voiceCtx);
  useVoiceHandlers({
    sort: (a) => { setTab("direct"); setSort(a.by); },
    filter: (a) => { setTab("direct"); setOnlyAvail(a.onlyAvailable); },
    tab: (a) => {
      if (a.tab === "nearby") return openNearbyOptions();
      setTab(a.tab);
    },
  });

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
        {(presentClasses.length > 1 || classes.size > 0) && (
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            <button onClick={() => setTab("direct")} className={`rounded-md px-3 py-1.5 ${tab === "direct" ? "bg-brand text-white" : ""}`}>
              Direct trains ({results.length})
            </button>
            <button onClick={() => setTab("connect")} className={`rounded-md px-3 py-1.5 ${tab === "connect" ? "bg-brand text-white" : ""}`}>
              With 1 change
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
              {params.cls && !clsOffered && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  None of these trains has {CLASSES[params.cls].name} ({params.cls}), so all classes are shown.
                </p>
              )}
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
              {alternatives.length > 0 && <NearbyAlternatives data={data} alternatives={alternatives} nearbyHref={nearbyHref} />}
            </div>
          ) : (
            <div className="card p-8 text-center text-slate-600">
              {results.length ? (
                <>No trains match these filters. <button onClick={reset} className="text-brand underline">Clear filters</button></>
              ) : (
                <>
                  No direct trains on this date.{" "}
                  {!params.nearby && <>Try including nearby stations, or </>}
                  <button onClick={() => setTab("connect")} className="text-brand underline">see journeys with one change</button>.
                </>
              )}
            </div>
          )
        ) : (
          <Connections data={data} alternatives={alternatives} nearbyHref={nearbyHref} />
        )}
      </section>
    </div>
  );
}

function Connections({ data, alternatives, nearbyHref }: { data: SearchResponse; alternatives: AlternativeRoute[]; nearbyHref: string }) {
  const { params, fromStation, toStation } = data;
  const key = JSON.stringify(params);
  const [state, setState] = useState<{ key: string; list?: ConnectionResult[]; error?: boolean } | null>(null);
  const [open, setOpen] = useState<number | null>(0);

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
  const openLegs = loaded?.list && open !== null ? loaded.list[open]?.legs : undefined;
  const voiceCtx = useMemo<Partial<VoiceContext>>(
    () => ({ connections: loaded?.list?.length ?? 0, ...(openLegs ? { trains: openLegs.map(voiceTrain) } : {}) }),
    [loaded?.list?.length, openLegs]
  );
  useVoiceContext(voiceCtx);
  useVoiceHandlers({
    select_option: (a) => {
      const n = loaded?.list?.length ?? 0;
      if (!n) return "There are no journeys with a change to open yet.";
      if (a.index > n) return `There are only ${n} options.`;
      setOpen(a.index - 1);
      setTimeout(() => document.getElementById(`journey-option-${a.index - 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    },
  });
  const noDirect = data.results.length === 0;
  const nearby = alternatives.length > 0 && <NearbyAlternatives data={data} alternatives={alternatives} nearbyHref={nearbyHref} />;

  if (!loaded)
    return (
      <div className="space-y-3">
        {nearby}
        <div className="card flex items-center gap-2 p-6 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" /> Finding journeys with one change…</div>
      </div>
    );
  if (loaded.error) return <div className="card p-6 text-sm text-bad">Couldn&apos;t load journeys with a change.</div>;
  if (!loaded.list!.length)
    return (
      <div className="space-y-3">
        <div className="card p-8 text-center text-slate-600">
          No journeys with one change found for this date. Try another date{alternatives.length ? " or a nearby station below" : ""}.
        </div>
        {nearby}
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h2 className="font-semibold">
          {noDirect ? `You can still travel from ${fromStation?.name} to ${toStation?.name}` : `${loaded.list!.length} more ways to travel with one change`}
        </h2>
        <p className="text-sm text-slate-600">
          {noDirect && "No single train runs between these stations on this date, so these journeys use two trains. "}
          Fastest first. Select a journey to book both trains (each train is a separate ticket).
        </p>
      </div>
      {nearby}
      {loaded.list!.map((c, n) => (
        <ConnectionOption key={c.legs[0].number + c.legs[1].number} id={`journey-option-${n}`} c={c} quota={params.quota} open={open === n}
          onToggle={() => setOpen(open === n ? null : n)} />
      ))}
    </div>
  );
}

/** One checkout for both trains of a connecting journey: pick a class on each, pay once, get two PNRs. */
function BookBoth({ c, quota }: { c: ConnectionResult; quota: Quota }) {
  const bookable = (j: JourneyResult) => j.classes.filter((x) => x.avail.bookable);
  // default: cheapest class with confirmed seats, else the cheapest bookable one
  const cheapest = (xs: JourneyResult["classes"]) => [...xs].sort((a, b) => a.fare - b.fare)[0];
  const initial = (j: JourneyResult) => (cheapest(bookable(j).filter((x) => x.avail.status === "AVAILABLE")) ?? cheapest(bookable(j)))?.cls;
  const [cls, setCls] = useState<(ClassCode | undefined)[]>(() => c.legs.map(initial));
  if (c.legs.some((l) => !bookable(l).length)) return null;
  const total = c.legs.reduce((s, l, i) => s + (l.classes.find((x) => x.cls === cls[i])?.fare ?? 0), 0);
  const href = bookHref(
    c.legs.map((l, i) => ({ train: l.number, from: l.from.code, to: l.to.code, date: l.date, cls: cls[i]! })),
    quota
  );
  return (
    <div className="rounded-lg border border-brand/30 bg-white p-3">
      <p className="mb-2 text-sm font-semibold">Book both trains together: one payment, two tickets</p>
      <div className="flex flex-wrap items-end gap-3">
        {c.legs.map((l, i) => (
          <label key={l.number} className="text-xs">
            <span className="label">Train {i + 1} · {l.number}</span>
            <select className="input w-auto py-1.5" value={cls[i]} onChange={(e) => setCls((v) => v.map((x, k) => (k === i ? (e.target.value as ClassCode) : x)))}>
              {bookable(l).map((x) => (
                <option key={x.cls} value={x.cls}>{x.cls} · {inr(x.fare)} · {availText(x.avail)}</option>
              ))}
            </select>
          </label>
        ))}
        <Link href={href} className="btn-primary ml-auto">Book both · from {inr(total)}</Link>
      </div>
    </div>
  );
}

function cheapestBookable(j: JourneyResult) {
  const fares = j.classes.filter((c) => c.avail.bookable).map((c) => c.fare);
  return fares.length ? Math.min(...fares) : null;
}

function ConnectionOption({ id, c, quota, open, onToggle }: { id: string; c: ConnectionResult; quota: Quota; open: boolean; onToggle: () => void }) {
  const [l1, l2] = c.legs;
  const f1 = cheapestBookable(l1);
  const f2 = cheapestBookable(l2);
  const seatsBoth = [l1, l2].every((l) => l.classes.some((x) => x.avail.status === "AVAILABLE"));
  return (
    <article id={id} className={`card scroll-mt-4 overflow-hidden ${open ? "border-brand ring-1 ring-brand" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="grid w-full gap-3 p-4 text-left hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-xl font-bold tabular-nums">{l1.from.time}</span>
            <span className="text-sm text-slate-500">{formatDate(l1.date)}</span>
            <ArrowRight className="size-4 self-center text-slate-400" />
            <span className="text-xl font-bold tabular-nums">{l2.to.time}</span>
            <span className="text-sm text-slate-500">{formatDate(l2.arrivalDate)}</span>
            <span className="text-sm font-medium text-slate-700">{formatDuration(c.duration)}</span>
          </div>
          <div className="mt-1 text-sm text-slate-700">
            1 change at <b>{c.via.name}</b> <span className="text-warn">({formatDuration(c.layover)} wait)</span>
          </div>
          <div className="truncate text-xs text-slate-500">{l1.number} {l1.name} + {l2.number} {l2.name}</div>
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
          {f1 !== null && f2 !== null && <div className="text-sm">from <b className="text-base">{inr(f1 + f2)}</b></div>}
          <div className={`text-xs font-medium ${seatsBoth ? "text-ok" : "text-warn"}`}>{seatsBoth ? "Seats on both trains" : "Waitlist on one train"}</div>
          <span className={open ? "btn-secondary py-1.5 text-xs" : "btn-primary py-1.5 text-xs"}>{open ? "Hide" : "Select"}</span>
        </div>
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-3">
          <BookBoth c={c} quota={quota} />
          <p className="px-1 pt-1 text-xs text-slate-500">Or book each train separately:</p>
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Train 1: {l1.from.name} → {l1.to.name}</p>
          <TrainCard j={l1} quota={quota} anchor={false} />
          <p className="flex items-center gap-1.5 px-1 text-sm text-warn"><Clock className="size-4" /> Change at {c.via.name}: {formatDuration(c.layover)} wait</p>
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Train 2: {l2.from.name} → {l2.to.name}</p>
          <TrainCard j={l2} quota={quota} anchor={false} />
        </div>
      )}
    </article>
  );
}

const kmLabel = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

function NearbyAlternatives({ data, alternatives, nearbyHref }: { data: SearchResponse; alternatives: AlternativeRoute[]; nearbyHref: string }) {
  const { params, fromStation, toStation } = data;
  const total = new Set(alternatives.flatMap((a) => a.trains.map((t) => t.number))).size;
  const href = (a: AlternativeRoute) => {
    const q = new URLSearchParams({ from: a.from.code, to: a.to.code, date: params.date, quota: params.quota });
    if (params.cls) q.set("cls", params.cls);
    return `/search?${q}`;
  };
  const best = alternatives[0];
  const fromChanged = best.from.code !== params.from;
  const toChanged = best.to.code !== params.to;
  return (
    <details id="nearby-options" className="group scroll-mt-4 overflow-hidden rounded-xl border border-brand/30 bg-brand-light">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <Footprints className="size-5 shrink-0 text-brand" />
        <span className="min-w-0 flex-1 basis-56">
          <b>Direct trains are available from nearby stations.</b>{" "}
          {fromChanged ? `${best.from.name} (${kmLabel(best.from.km)} away)` : best.from.name} →{" "}
          {toChanged ? `${best.to.name} (${kmLabel(best.to.km)} from ${toStation?.name})` : best.to.name} has {best.count} direct{" "}
          {best.count === 1 ? "train" : "trains"}
          {alternatives.length > 1 && <>, plus {alternatives.length - 1} more nearby {alternatives.length === 2 ? "option" : "options"}</>}.
        </span>
        <span className="btn-brand w-full shrink-0 py-1.5 sm:w-auto">
          <span className="group-open:hidden">See {alternatives.length} direct {alternatives.length === 1 ? "option" : "options"}</span>
          <span className="hidden group-open:inline">Hide options</span>
          <ChevronDown className="size-4 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="bg-white">
      <p className="border-t border-slate-100 px-4 pt-2 text-xs text-slate-500">
        Stations within 30 km of {fromStation?.name} / {toStation?.name}, closest first.
      </p>
      <ul className="divide-y divide-slate-100">
        {alternatives.map((a) => {
          const changedFrom = a.from.code !== params.from;
          const changedTo = a.to.code !== params.to;
          return (
            <li key={a.from.code + a.to.code}>
              <Link href={href(a)} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    <span className={changedFrom ? "text-brand" : ""}>{a.from.name} ({a.from.code})</span>
                    <ArrowRight className="mx-1 inline size-3.5 text-slate-400" />
                    <span className={changedTo ? "text-brand" : ""}>{a.to.name} ({a.to.code})</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                    {changedFrom && (
                      <span><Footprints className="mr-0.5 inline size-3" />Board {kmLabel(a.from.km)} from {fromStation?.name}</span>
                    )}
                    {changedTo && <span><Footprints className="mr-0.5 inline size-3" />Arrive {kmLabel(a.to.km)} from {toStation?.name}</span>}
                    <span className="truncate">e.g. {a.trains.slice(0, 2).map((t) => t.name).join(", ")}</span>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-ok">{a.count} direct {a.count === 1 ? "train" : "trains"}</div>
                  <div className="text-xs text-slate-500">fastest {formatDuration(a.fastest)} · first at {a.earliest}</div>
                </div>
                <span className="btn-brand py-1.5 text-xs">View trains</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-slate-100 px-4 py-2 text-sm">
        <Link href={nearbyHref} className="font-medium text-brand hover:underline">
          Show all {total}+ trains from every nearby station together →
        </Link>
      </div>
      </div>
    </details>
  );
}

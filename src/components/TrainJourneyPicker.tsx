"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKING_WINDOW_DAYS, CLASSES, QUOTAS, type ClassCode, type Quota } from "@/lib/constants";
import { addDays } from "@/lib/dates";

type Halt = { code: string; name: string; seq: number };

/** Pick boarding/destination halts of one train and jump to search results for that journey. */
export function TrainJourneyPicker({
  train, halts, classes, defaultFrom, defaultTo, today, defaultDate,
}: {
  train: string; halts: Halt[]; classes: ClassCode[]; defaultFrom?: string; defaultTo?: string; today: string; defaultDate: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom ?? halts[0].code);
  const [to, setTo] = useState(defaultTo ?? halts[halts.length - 1].code);
  const [date, setDate] = useState(defaultDate);
  const [cls, setCls] = useState<ClassCode>(classes[0]);
  const [quota, setQuota] = useState<Quota>("GN");
  const fromSeq = halts.find((h) => h.code === from)?.seq ?? 0;
  const toOptions = halts.filter((h) => h.seq > fromSeq);
  const validTo = toOptions.some((h) => h.code === to) ? to : toOptions[toOptions.length - 1]?.code;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?${new URLSearchParams({ from, to: validTo, date, quota, cls })}#${train}`);
      }}
    >
      <div>
        <label className="label" htmlFor="jp-from">Boarding</label>
        <select id="jp-from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
          {halts.slice(0, -1).map((h) => <option key={h.seq} value={h.code}>{h.name} ({h.code})</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="jp-to">Destination</label>
        <select id="jp-to" className="input" value={validTo} onChange={(e) => setTo(e.target.value)}>
          {toOptions.map((h) => <option key={h.seq} value={h.code}>{h.name} ({h.code})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="jp-date">Date</label>
          <input id="jp-date" type="date" className="input" value={date} min={today} max={addDays(today, BOOKING_WINDOW_DAYS)} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="jp-cls">Class</label>
          <select id="jp-cls" className="input" value={cls} onChange={(e) => setCls(e.target.value as ClassCode)}>
            {classes.map((c) => <option key={c} value={c}>{c} · {CLASSES[c].name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="jp-quota">Quota</label>
        <select id="jp-quota" className="input" value={quota} onChange={(e) => setQuota(e.target.value as Quota)}>
          {Object.entries(QUOTAS).map(([k, q]) => <option key={k} value={k}>{q.name}</option>)}
        </select>
      </div>
      <button className="btn-primary w-full">Check availability</button>
    </form>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKING_WINDOW_DAYS, QUOTAS, type ClassCode, type Quota } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";

type Halt = { code: string; name: string; seq: number; day: number };

/** Pick boarding/destination halts of one train and book it directly (or compare with other trains). */
export function TrainJourneyPicker({
  train, halts, classes, defaultFrom, defaultTo, today, defaultDate, defaultQuota = "GN", runsOn,
}: {
  train: string; halts: Halt[]; classes: ClassCode[]; defaultFrom?: string; defaultTo?: string; today: string; defaultDate: string;
  defaultQuota?: Quota; runsOn: number;
}) {
  const router = useRouter();
  const t = useT();
  const [from, setFrom] = useState(defaultFrom ?? halts[0].code);
  const [to, setTo] = useState(defaultTo ?? halts[halts.length - 1].code);
  const [date, setDate] = useState(defaultDate);
  const [cls, setCls] = useState<ClassCode>(classes[0]);
  const [quota, setQuota] = useState<Quota>(defaultQuota);
  const fromSeq = halts.find((h) => h.code === from)?.seq ?? 0;
  const toOptions = halts.filter((h) => h.seq > fromSeq);
  const validTo = toOptions.some((h) => h.code === to) ? to : toOptions[toOptions.length - 1]?.code;
  const params = () => new URLSearchParams({ train, from, to: validTo, date, cls, quota });
  // Running days are stored for the origin; this is a quick hint for the boarding date (the booking page re-validates).
  const fromDay = halts.find((h) => h.code === from)?.day ?? 1;
  const originDow = (new Date(`${date}T00:00:00Z`).getUTCDay() - (fromDay - 1) + 70) % 7;
  const runs = (runsOn & (1 << originDow)) !== 0;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/book?${params()}`);
      }}
    >
      <div>
        <label className="label" htmlFor="jp-from">{t("jp.boarding")}</label>
        <select id="jp-from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
          {halts.slice(0, -1).map((h) => <option key={h.seq} value={h.code}>{h.name} ({h.code})</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="jp-to">{t("jp.destination")}</label>
        <select id="jp-to" className="input" value={validTo} onChange={(e) => setTo(e.target.value)}>
          {toOptions.map((h) => <option key={h.seq} value={h.code}>{h.name} ({h.code})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="jp-date">{t("jp.date")}</label>
          <input id="jp-date" type="date" className="input" value={date} min={today} max={addDays(today, BOOKING_WINDOW_DAYS)} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="jp-cls">{t("jp.class")}</label>
          <select id="jp-cls" className="input" value={cls} onChange={(e) => setCls(e.target.value as ClassCode)}>
            {classes.map((c) => <option key={c} value={c}>{c} · {t(`class.${c}` as MessageKey)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="jp-quota">{t("jp.quota")}</label>
        <select id="jp-quota" className="input" value={quota} onChange={(e) => setQuota(e.target.value as Quota)}>
          {Object.keys(QUOTAS).map((k) => <option key={k} value={k}>{t(`quota.${k}` as MessageKey)}</option>)}
        </select>
      </div>
      {!runs && <p className="text-sm text-bad">{t("jp.noRun", { code: from })}</p>}
      <button className="btn-primary w-full" disabled={!runs}>{t("jp.book")}</button>
      <button
        type="button"
        className="btn-secondary w-full"
        onClick={() => router.push(`/search?${new URLSearchParams({ from, to: validTo, date, quota, cls })}#${train}`)}
      >
        {t("jp.compare")}
      </button>
    </form>
  );
}

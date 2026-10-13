"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BedDouble, CalendarDays, Loader2, Sparkles, TrainFront, Users, Wallet } from "lucide-react";
import type { Plan, PlanLeg, PlanResult } from "@/lib/planner";
import { formatDate, formatDuration } from "@/lib/dates";
import { availText, inr } from "@/lib/format";
import { useT } from "@/i18n/client";
import type { MessageKey, Msg, T } from "@/i18n/core";

const EXAMPLES = ["plan.ex1", "plan.ex2", "plan.ex3", "plan.ex4"] as const;
const STEPS = ["plan.step1", "plan.step2", "plan.step3"] as const;
const TAG_STYLE: Record<Plan["tags"][number], string> = {
  cheapest: "bg-green-100 text-green-900",
  fastest: "bg-sky-100 text-sky-900",
  surest: "bg-amber-100 text-amber-900",
  comfort: "bg-violet-100 text-violet-900",
};

function LegRow({ leg, label, t }: { leg: PlanLeg; label: string; t: T }) {
  const L = t.locale;
  const pct = Math.round(leg.avail.chance * 100);
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label} · {formatDate(leg.date, undefined, L)}</p>
      <Link href={`/train/${leg.train}?from=${leg.from.code}&to=${leg.to.code}&date=${leg.date}`} className="font-semibold hover:underline">
        <span className="font-mono">{leg.train}</span> {leg.name}
      </Link>
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
        <div><b className="text-base">{leg.dep}</b><br /><span className="text-slate-600">{leg.from.name}</span></div>
        <div className="text-center text-xs text-slate-500">{formatDuration(leg.duration, L)}<ArrowRight className="mx-auto size-4" aria-hidden /></div>
        <div className="text-right"><b className="text-base">{leg.arr}</b>{leg.arrivalDate !== leg.date && <sup className="ml-0.5 text-xs text-slate-500">+1</sup>}<br /><span className="text-slate-600">{leg.to.name}</span></div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="rounded bg-slate-100 px-1.5 font-semibold">{leg.cls}</span>
        <span className={leg.avail.status === "AVAILABLE" ? "text-ok" : leg.avail.status === "RAC" ? "text-warn" : "text-bad"}>{availText(leg.avail, t)}</span>
        {leg.avail.status === "WL" && <span className="text-xs text-slate-500">{t("card.chanceShort", { pct: `${pct}%` })}</span>}
        <span className="ml-auto font-medium">{inr(leg.total)}</span>
      </p>
    </div>
  );
}

function stayText(min: number, t: T) {
  const days = Math.floor(min / 1440);
  const rest = formatDuration(min % 1440, t.locale);
  return days ? t.n("plan.stayDays", days, { rest }) : rest;
}

export function PlanView({ initial, autoRun = false }: { initial: string; autoRun?: boolean }) {
  const t = useT();
  const L = t.locale;
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<PlanResult | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Arriving from the voice assistant: run the request straight away. From "Plan a trip here" (a half-written
  // request): put the cursor at the end so they can finish it.
  const started = useRef(false);
  useEffect(() => {
    if (!initial || started.current) return;
    started.current = true; // dev mode runs effects twice; plan once
    if (autoRun) {
      void submit(initial);
      return;
    }
    box.current?.focus();
    box.current?.setSelectionRange(initial.length, initial.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    return () => clearInterval(id);
  }, [busy]);

  async function submit(q: string) {
    if (q.trim().length < 3 || busy) return;
    setBusy(true);
    setStep(0);
    setResult(null);
    const r = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: q }) })
      .then((res) => res.json() as Promise<PlanResult>)
      .catch((): PlanResult => ({ ok: false, error: "plan.err.network" as MessageKey }));
    setResult(r);
    setBusy(false);
  }

  const req = result?.ok ? result.request : null;
  const multiDest = result?.ok ? new Set(result.plans.map((p) => p.destination.code)).size > 1 : false;

  return (
    <div className="space-y-5">
      <form className="card p-4" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <label htmlFor="plan-q" className="mb-2 block font-semibold">{t("plan.ask")}</label>
        <textarea id="plan-q" ref={box} rows={3} maxLength={500} className="input resize-y text-base" placeholder={t("plan.placeholder")}
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={busy || text.trim().length < 3}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />} {t("plan.submit")}
          </button>
          <span className="text-xs text-slate-500">{t("plan.tryOne")}</span>
          {EXAMPLES.map((k) => (
            <button key={k} type="button" onClick={() => { setText(t(k)); submit(t(k)); }} disabled={busy}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs hover:border-brand">{t(k)}</button>
          ))}
        </div>
      </form>

      <div aria-live="polite">
        {busy && (
          <div className="card flex items-center gap-3 p-4 text-slate-700">
            <Loader2 className="size-5 animate-spin text-brand" aria-hidden /> {t(STEPS[step])}
          </div>
        )}
        {result && !result.ok && <p className="rounded-lg bg-red-50 px-4 py-3 text-bad">{t.msg(result.error as Msg)}</p>}
      </div>

      {result?.ok && req && (
        <>
          <section className="card p-4">
            {req.summary && <p className="mb-3 flex items-start gap-2 text-slate-900"><Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {req.summary}</p>}
            <ul className="flex flex-wrap gap-2 text-sm" aria-label={t("plan.understood")}>
              <li className="rounded-full bg-slate-100 px-3 py-1"><TrainFront className="mr-1 inline size-3.5" aria-hidden />{req.originName} → {multiDest ? t("plan.ideas", { list: [...new Set(result.plans.map((p) => p.destination.name))].join(", ") }) : result.plans[0].destination.name}</li>
              <li className="rounded-full bg-slate-100 px-3 py-1"><CalendarDays className="mr-1 inline size-3.5" aria-hidden />{formatDate(req.depart_date!, undefined, L)}{req.return_date ? ` – ${formatDate(req.return_date, undefined, L)}` : ` · ${t("plan.oneWay")}`}</li>
              <li className="rounded-full bg-slate-100 px-3 py-1"><Users className="mr-1 inline size-3.5" aria-hidden />{t.n("plan.party", req.party)}</li>
              {req.budget ? <li className="rounded-full bg-slate-100 px-3 py-1"><Wallet className="mr-1 inline size-3.5" aria-hidden />{t("plan.budget", { amount: inr(req.budget) })}</li> : null}
              {req.cls && <li className="rounded-full bg-slate-100 px-3 py-1">{t(`class.${req.cls}` as MessageKey)}</li>}
              {req.overnight && <li className="rounded-full bg-slate-100 px-3 py-1"><BedDouble className="mr-1 inline size-3.5" aria-hidden />{t("explore.overnightShort")}</li>}
            </ul>
            {result.notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-warn">{result.notes.map((n, i) => <li key={i}>{t.msg(n)}</li>)}</ul>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            {result.plans.map((p) => (
              <article key={p.id} className="card flex flex-col p-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {p.tags.map((tag) => <span key={tag} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_STYLE[tag]}`}>{t(`plan.tag.${tag}` as MessageKey)}</span>)}
                </div>
                {multiDest && <h2 className="text-lg font-bold">{p.destination.name}</h2>}
                <p className="text-2xl font-bold">{inr(p.total, true)}</p>
                <p className="mb-3 text-xs text-slate-500">{t.n("plan.totalFor", req.party)}{p.overBudget && <span className="ml-1 font-medium text-bad">· {t("plan.overBudget")}</span>}</p>
                <div className="space-y-2">
                  <LegRow leg={p.out} label={p.back ? t("plan.outbound") : t("plan.train")} t={t} />
                  {p.stay !== null && (
                    <p className="px-1 text-sm text-slate-600">{t("plan.stay", { time: stayText(p.stay, t), place: p.destination.name })}</p>
                  )}
                  {p.back && <LegRow leg={p.back} label={t("plan.return")} t={t} />}
                </div>
                <div className="mt-auto grid gap-2 pt-4">
                  {p.hrefs.length === 1 ? (
                    <Link href={p.hrefs[0]} className="btn-primary">{p.back ? t("plan.bookBoth") : t("plan.book")}</Link>
                  ) : (
                    <>
                      <Link href={p.hrefs[0]} className="btn-primary">{t("plan.bookOut")}</Link>
                      <Link href={p.hrefs[1]} className="btn-secondary">{t("plan.bookBack")}</Link>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="text-xs text-slate-500">{t("plan.disclaimer")}</p>
        </>
      )}
    </div>
  );
}

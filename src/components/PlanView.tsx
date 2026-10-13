"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { CoachBoard } from "./CoachBoard";
import type { Plan, PlanLeg, PlanResult } from "@/lib/planner";
import { formatDate, formatDuration } from "@/lib/dates";
import { availText, inr } from "@/lib/format";
import { useT } from "@/i18n/client";
import type { MessageKey, Msg, T } from "@/i18n/core";

const EXAMPLES = ["plan.ex1", "plan.ex2", "plan.ex3", "plan.ex4"] as const;
const STEPS = ["plan.step1", "plan.step2", "plan.step3"] as const;
// Each kind of best is its own enamel label; the words say which, the colour only helps.
const TAG_STYLE: Record<Plan["tags"][number], string> = {
  cheapest: "bg-green text-white",
  fastest: "bg-brand text-accent",
  surest: "bg-accent text-ink",
  comfort: "bg-ink text-white",
};

function LegRow({ leg, label, t }: { leg: PlanLeg; label: string; t: T }) {
  const L = t.locale;
  const pct = Math.round(leg.avail.chance * 100);
  return (
    <div>
      <p className="bg-brand px-4 pb-1 pt-1.5 font-sign text-[1.2rem] uppercase leading-none tracking-[0.05em] text-accent">{label} · {formatDate(leg.date, undefined, L)}</p>
      <CoachBoard size="sm" number={leg.train}
        name={<Link href={`/train/${leg.train}?from=${leg.from.code}&to=${leg.to.code}&date=${leg.date}`} className="underline-offset-4 hover:underline">{leg.name}</Link>} />
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
        <div><b className="font-sign text-[1.9rem] font-normal leading-none">{leg.dep}</b><br /><span className="text-slate-600">{leg.from.name}</span></div>
        <div className="text-center text-slate-600">{formatDuration(leg.duration, L)}<ArrowRight className="mx-auto size-4" aria-hidden /></div>
        <div className="text-right"><b className="font-sign text-[1.9rem] font-normal leading-none">{leg.arr}</b>{leg.arrivalDate !== leg.date && <sup className="ml-0.5 text-sm text-slate-600">+1</sup>}<br /><span className="text-slate-600">{leg.to.name}</span></div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-y-2 border-ground px-4 py-2.5">
        <span className="rounded bg-brand px-1.5 pb-0.5 pt-1 font-sign text-[1.15rem] leading-none text-accent">{leg.cls}</span>
        <span className={leg.avail.status === "AVAILABLE" ? "text-ok" : leg.avail.status === "RAC" ? "text-warn" : "text-bad"}>{availText(leg.avail, t)}</span>
        {leg.avail.status === "WL" && <span className="text-slate-600">{t("card.chanceShort", { pct: `${pct}%` })}</span>}
        <span className="ml-auto font-semibold">{inr(leg.total)}</span>
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
      {/* The planner's section plate is signal yellow: one sentence in, a trip out. */}
      <form className="plate-yellow p-7" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <label htmlFor="plan-q" className="mb-3 block font-sign text-[2rem] uppercase leading-none tracking-[0.03em]">{t("plan.ask")}</label>
        <textarea id="plan-q" ref={box} rows={2} maxLength={500} className="input resize-y border-transparent !text-[1.4rem] leading-snug focus:border-brand" placeholder={t("plan.placeholder")}
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }} />
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button className="btn-brand px-6 py-3 font-sign text-[1.5rem] uppercase leading-none tracking-[0.04em]" disabled={busy || text.trim().length < 3}>
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />} {t("plan.submit")}
          </button>
          <span className="ml-2 font-semibold">{t("plan.tryOne")}</span>
          {EXAMPLES.map((k) => (
            <button key={k} type="button" onClick={() => { setText(t(k)); submit(t(k)); }} disabled={busy}
              className="rounded-md bg-white/70 px-3 py-1.5 text-[0.9rem] hover:bg-white">{t(k)}</button>
          ))}
        </div>
      </form>

      <div aria-live="polite">
        {busy && (
          <div className="card flex items-center gap-3 p-5 text-[1.1rem] text-slate-700">
            <Loader2 className="size-5 animate-spin text-brand" aria-hidden /> {t(STEPS[step])}
          </div>
        )}
        {result && !result.ok && <p className="rounded-lg bg-red-50 px-4 py-3 text-bad">{t.msg(result.error as Msg)}</p>}
      </div>

      {result?.ok && req && (
        <>
          {/* What was understood, lettered as one indigo line: the traveller checks it at a glance. */}
          <section className="plate-indigo p-5">
            <p className="font-sign text-[1.9rem] uppercase leading-none tracking-[0.03em] text-accent" aria-label={t("plan.understood")}>
              {req.originName} → {multiDest ? t("plan.ideas", { list: [...new Set(result.plans.map((p) => p.destination.name))].join(", ") }) : result.plans[0].destination.name}
              <span className="text-white"> · {formatDate(req.depart_date!, undefined, L)}{req.return_date ? ` – ${formatDate(req.return_date, undefined, L)}` : ` · ${t("plan.oneWay")}`}
                {" · "}{t.n("plan.party", req.party)}
                {req.budget ? ` · ${t("plan.budget", { amount: inr(req.budget) })}` : ""}
                {req.cls ? ` · ${t(`class.${req.cls}` as MessageKey)}` : ""}
                {req.overnight ? ` · ${t("explore.overnightShort")}` : ""}
              </span>
            </p>
            {req.summary && <p className="mt-2 text-[1.1rem] text-white/90">{req.summary}</p>}
            {result.notes.length > 0 && (
              <ul className="mt-3 space-y-1 rounded bg-accent-light px-3 py-2 text-ink">{result.notes.map((n, i) => <li key={i}>{t.msg(n)}</li>)}</ul>
            )}
          </section>

          {/* Plans stand side by side as one row of plates, as many columns as there are plans. */}
          <div className="grid gap-1 overflow-hidden rounded-md" style={{ gridTemplateColumns: `repeat(${result.plans.length}, minmax(0, 1fr))` }}>
            {result.plans.map((p) => (
              <article key={p.id} className="settle flex flex-col bg-white">
                <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
                  {p.tags.map((tag) => <span key={tag} className={`rounded px-2.5 pb-0.5 pt-1 font-sign text-[1.25rem] uppercase leading-none tracking-[0.04em] ${TAG_STYLE[tag]}`}>{t(`plan.tag.${tag}` as MessageKey)}</span>)}
                  {multiDest && <h2 className="ml-auto font-sign text-[1.6rem] uppercase leading-none tracking-[0.03em] text-brand">{p.destination.name}</h2>}
                </div>
                <LegRow leg={p.out} label={p.back ? t("plan.outbound") : t("plan.train")} t={t} />
                {p.stay !== null && (
                  <p className="px-4 py-2.5 font-semibold text-green">{t("plan.stay", { time: stayText(p.stay, t), place: p.destination.name })}</p>
                )}
                {p.back && <LegRow leg={p.back} label={t("plan.return")} t={t} />}
                <p className="mt-auto flex items-baseline justify-between gap-3 px-4 pt-4">
                  <span className="text-slate-600">{t.n("plan.totalFor", req.party)}{p.overBudget && <span className="ml-1 font-semibold text-bad">· {t("plan.overBudget")}</span>}</span>
                  <span className="font-sign text-[2rem] leading-none text-ink">{inr(p.total, true)}</span>
                </p>
                <div className="grid gap-2 p-4">
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
          <p className="text-slate-600">{t("plan.disclaimer")}</p>
        </>
      )}
    </div>
  );
}

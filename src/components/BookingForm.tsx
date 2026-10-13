"use client";
import { useActionState, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { createBooking, type BookingFormState } from "@/app/actions/booking";
import type { SavedPassenger } from "@/lib/booking";
import {
  CLASSES, FOOD_PREFS, MAX_PASSENGERS, SEAT_PREFS, SLEEPER_BERTHS, type ClassCode, type Quota,
} from "@/lib/constants";
import { bookingFare, passengerKind } from "@/lib/fare";
import { inr } from "@/lib/format";
import { useVoiceContext, useVoiceHandlers } from "./voice/VoiceBridge";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";

/** One train of the checkout (two for a connecting journey). */
export type Journey = {
  train: string; from: string; to: string; date: string; cls: ClassCode;
  km: number; trainType: string; premium: boolean; availStatus: string;
};
type P = { key: number; name: string; age: string; gender: string; berth: string; food: string; noBerth: boolean };

let nextKey = 1;
const blank = (premium: boolean): P => ({ key: nextKey++, name: "", age: "", gender: "", berth: "", food: premium ? "VEG" : "", noBerth: false });

export function BookingForm({ journeys, quota, user, saved }: {
  journeys: Journey[]; quota: Quota; user: { email: string; phone: string; name: string }; saved: SavedPassenger[];
}) {
  // Passenger rules come from the whole trip: meals if any train serves them, berth options from the first train.
  const journey = {
    ...journeys[0], quota,
    premium: journeys.some((j) => j.premium),
    availStatus: journeys.every((j) => j.availStatus === "AVAILABLE") ? "AVAILABLE" : "WL",
  };
  const t = useT();
  const [state, action, pending] = useActionState<BookingFormState, FormData>(createBooking, undefined);
  const [passengers, setPassengers] = useState<P[]>([blank(journey.premium)]);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [insurance, setInsurance] = useState<boolean | null>(null);
  const [autoUpgrade, setAutoUpgrade] = useState(true);
  const [confirmOnly, setConfirmOnly] = useState(false);
  const [savePassengers, setSavePassengers] = useState(true);
  const [localError, setLocalError] = useState("");

  const sleeper = CLASSES[journey.cls].berth === "sleeper";
  const berthOptions: Record<string, string> = sleeper ? SLEEPER_BERTHS : SEAT_PREFS;
  const max = MAX_PASSENGERS[journey.quota];
  const fe = state?.fieldErrors ?? {};

  const fare = useMemo(() => {
    const pax = passengers.filter((p) => p.age !== "").map((p) => ({ age: Number(p.age), noBerth: p.noBerth }));
    const legs = journeys.map((j) => bookingFare({ cls: j.cls, km: j.km, trainType: j.trainType, quota, insurance: !!insurance }, pax));
    const sum = (f: (l: (typeof legs)[number]) => number) => Math.round(legs.reduce((s, l) => s + f(l), 0) * 100) / 100;
    return {
      ...legs[0],
      legs,
      // per passenger: total across all trains of the trip
      perPassenger: legs[0].perPassenger.map((p, i) => ({
        kind: p.kind,
        fare: p.fare ? { ...p.fare, total: sum((l) => l.perPassenger[i].fare?.total ?? 0) } : null,
      })),
      ticketFare: sum((l) => l.ticketFare),
      convenienceFee: sum((l) => l.convenienceFee),
      insurance: sum((l) => l.insurance),
      total: sum((l) => l.total),
    };
  }, [journeys, quota, passengers, insurance]);

  const update = (key: number, patch: Partial<P>) => setPassengers((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const addSaved = (s: SavedPassenger) => {
    const p: P = {
      key: nextKey++, name: s.name, age: String(s.age), gender: s.gender,
      berth: s.berth_pref && s.berth_pref in berthOptions ? s.berth_pref : "",
      food: journey.premium ? s.food_pref ?? "VEG" : "", noBerth: false,
    };
    setPassengers((ps) => {
      const empty = ps.findIndex((x) => !x.name && !x.age);
      if (empty >= 0) return ps.map((x, i) => (i === empty ? p : x));
      return [...ps, p];
    });
  };
  const usedNames = new Set(passengers.map((p) => p.name.toLowerCase()));

  // ---- voice assistant: expose the form and accept passenger / option / continue commands
  const formRef = useRef<HTMLFormElement>(null);
  const voiceCtx = useMemo(
    () => ({
      booking: {
        train: journeys[0].train, cls: journeys[0].cls, saved: saved.map((s) => s.name),
        passengers: passengers.filter((p) => p.name).map((p) => p.name), insuranceChosen: insurance !== null,
      },
    }),
    [journeys, saved, passengers, insurance]
  );
  useVoiceContext(voiceCtx);
  const titleCase = (n: string) => n.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  useVoiceHandlers({
    add_passengers: (a) => {
      const missing: string[] = [];
      let count = passengers.filter((p) => p.name || p.age).length;
      const added = new Set(usedNames); // names already on the form or added earlier in this command
      for (const vp of a.passengers) {
        if (count >= max + 2) return `A ticket can have at most ${max} passengers plus 2 infants.`;
        const q = vp.name.toLowerCase().trim();
        const match = saved.find((s) => s.name.toLowerCase() === q || s.name.toLowerCase().split(" ").includes(q) || s.name.toLowerCase().includes(q));
        if (match) {
          if (added.has(match.name.toLowerCase())) continue;
          added.add(match.name.toLowerCase());
          addSaved(match);
        } else {
          const p: P = { ...blank(journey.premium), name: titleCase(vp.name), age: vp.age != null ? String(vp.age) : "", gender: vp.gender ?? "" };
          if (!p.age || !p.gender) missing.push(p.name);
          setPassengers((ps) => {
            const empty = ps.findIndex((x) => !x.name && !x.age);
            return empty >= 0 ? ps.map((x, i) => (i === empty ? p : x)) : [...ps, p];
          });
        }
        count++;
      }
      if (missing.length) return `Added ${missing.join(", ")}. Please fill in the age and gender.`;
    },
    remove_passenger: (a) => {
      const q = a.name.toLowerCase();
      const hit = passengers.find((p) => p.name.toLowerCase().includes(q));
      if (!hit) return `There's no passenger called ${a.name}.`;
      setPassengers((ps) => (ps.length === 1 ? [blank(journey.premium)] : ps.filter((p) => p.key !== hit.key)));
    },
    set_options: (a) => {
      if (a.insurance !== undefined) setInsurance(a.insurance);
      if (a.autoUpgrade !== undefined) setAutoUpgrade(a.autoUpgrade);
      if (a.confirmOnly !== undefined) setConfirmOnly(a.confirmOnly);
    },
    continue: () => {
      if (!passengers.some((p) => p.name && p.age && p.gender)) return "Add at least one passenger with name, age and gender first.";
      if (insurance === null) return "Do you want travel insurance? Say yes or no.";
      formRef.current?.requestSubmit();
    },
  });

  const submit = (formData: FormData) => {
    if (insurance === null) {
      setLocalError(t("bf.insuranceChoose"));
      return;
    }
    setLocalError("");
    formData.set(
      "payload",
      JSON.stringify({
        legs: journeys.map(({ train, from, to, date, cls }) => ({ train, from, to, date, cls })),
        quota,
        passengers: passengers.map((p) => ({ name: p.name, age: p.age, gender: p.gender, berth: p.berth, food: p.food, noBerth: p.noBerth })),
        email, phone, insurance, autoUpgrade, confirmOnly, savePassengers,
      })
    );
    action(formData);
  };

  return (
    <form ref={formRef} action={submit} className="grid grid-cols-[1fr_24rem] gap-6">
      <div className="space-y-4">
        <section className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sign text-[1.15rem] leading-tight text-brand">{t("bf.passengers")}</h2>
            <span className="text-sm text-slate-500">{t("bf.max", { max, quota: t(`quota.${journey.quota}` as MessageKey) })}</span>
          </div>

          {saved.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold uppercase text-slate-500">{t("bf.saved")}</span>
              {saved.map((s) => (
                <button key={s.id} type="button" disabled={usedNames.has(s.name.toLowerCase())} onClick={() => addSaved(s)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-sm hover:border-brand disabled:opacity-40">
                  <UserPlus className="size-3" aria-hidden /> {s.name} ({s.age}{s.gender})
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {passengers.map((p, i) => {
              const err = (f: string) => fe[`passengers.${i}.${f}`];
              const age = p.age === "" ? null : Number(p.age);
              const kind = age === null ? null : passengerKind(age, p.noBerth);
              return (
                <fieldset key={p.key} className="rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-500">
                    {t("bf.passenger", { i: i + 1 })}
                    {kind === "infant" && t("bf.infant")}
                    {kind === "child_no_berth" && t("bf.childNoBerth")}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_9rem] md:grid-cols-[1fr_5rem_7rem_9rem_8rem_auto]">
                    <div>
                      <input aria-label={t("bf.name")} className={`input ${err("name") ? "border-bad" : ""}`} placeholder={t("bf.namePh")} value={p.name} maxLength={30}
                        onChange={(e) => update(p.key, { name: e.target.value })} required />
                      {err("name") && <p className="mt-0.5 text-sm text-bad">{err("name")}</p>}
                    </div>
                    <div>
                      <input aria-label={t("bf.age")} className={`input ${err("age") ? "border-bad" : ""}`} placeholder={t("bf.age")} inputMode="numeric" value={p.age} maxLength={3}
                        onChange={(e) => update(p.key, { age: e.target.value.replace(/\D/g, ""), noBerth: false })} required />
                      {err("age") && <p className="mt-0.5 text-sm text-bad">{err("age")}</p>}
                    </div>
                    <div>
                      <select aria-label={t("bf.gender")} className={`input ${err("gender") ? "border-bad" : ""}`} value={p.gender} onChange={(e) => update(p.key, { gender: e.target.value })} required>
                        <option value="">{t("bf.gender")}</option>
                        <option value="M">{t("gender.M")}</option>
                        <option value="F">{t("gender.F")}</option>
                        <option value="T">{t("gender.T")}</option>
                      </select>
                      {err("gender") && <p className="mt-0.5 text-sm text-bad">{err("gender")}</p>}
                    </div>
                    <select aria-label={t("bf.berthPref")} className="input" value={p.berth} disabled={kind === "infant" || p.noBerth}
                      onChange={(e) => update(p.key, { berth: e.target.value })}>
                      <option value="">{sleeper ? t("bf.berthNone") : t("bf.seatNone")}</option>
                      {Object.keys(berthOptions).map((k) => <option key={k} value={k}>{t(`${sleeper ? "berth" : "seat"}.${k}` as MessageKey)}</option>)}
                    </select>
                    {journey.premium ? (
                      <select aria-label={t("bf.meal")} className="input" value={p.food} onChange={(e) => update(p.key, { food: e.target.value })} disabled={kind === "infant"}>
                        {Object.keys(FOOD_PREFS).map((k) => <option key={k} value={k}>{t(`food.${k}` as MessageKey)}</option>)}
                      </select>
                    ) : <span className="hidden md:block" />}
                    <button type="button" aria-label={t("bf.remove", { i: i + 1 })} disabled={passengers.length === 1}
                      onClick={() => setPassengers((ps) => ps.filter((x) => x.key !== p.key))}
                      className="flex items-center justify-center rounded-lg px-2 text-slate-500 hover:bg-red-50 hover:text-bad disabled:opacity-30">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  {age !== null && age >= 5 && age <= 11 && journey.quota !== "TQ" && (
                    <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" className="accent-brand" checked={p.noBerth} onChange={(e) => update(p.key, { noBerth: e.target.checked })} />
                      {t("bf.childOpt")}
                    </label>
                  )}
                  {err("noBerth") && <p className="mt-0.5 text-sm text-bad">{err("noBerth")}</p>}
                </fieldset>
              );
            })}
          </div>
          <button type="button" className="btn-secondary mt-3" disabled={passengers.length >= max + 2}
            onClick={() => setPassengers((ps) => [...ps, blank(journey.premium)])}>
            <Plus className="size-4" aria-hidden /> {t("bf.add")}
          </button>
        </section>

        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 font-sign text-[1.15rem] leading-tight text-brand">{t("bf.contact")}</h2>
          <div>
            <label className="label" htmlFor="email">{t("bf.email")}</label>
            <input id="email" type="email" className={`input ${fe.email ? "border-bad" : ""}`} value={email} onChange={(e) => setEmail(e.target.value)} required />
            {fe.email && <p className="mt-0.5 text-sm text-bad">{fe.email}</p>}
          </div>
          <div>
            <label className="label" htmlFor="phone">{t("bf.mobile")}</label>
            <input id="phone" inputMode="numeric" maxLength={10} className={`input ${fe.phone ? "border-bad" : ""}`} value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} required />
            {fe.phone && <p className="mt-0.5 text-sm text-bad">{fe.phone}</p>}
          </div>
        </section>

        <section className="card space-y-3 p-4 text-sm">
          <h2 className="font-sign text-[1.15rem] leading-tight text-brand">{t("bf.options")}</h2>
          <fieldset>
            <legend className="mb-1 font-medium">{t("bf.insurance")}</legend>
            <label className="mr-4 inline-flex items-center gap-2"><input type="radio" name="ins" className="accent-brand" checked={insurance === true} onChange={() => setInsurance(true)} /> {t("bf.insYes")}</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="ins" className="accent-brand" checked={insurance === false} onChange={() => setInsurance(false)} /> {t("bf.insNo")}</label>
          </fieldset>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 accent-brand" checked={autoUpgrade} onChange={(e) => setAutoUpgrade(e.target.checked)} />
            <span>{t("bf.autoUpgrade")}</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 accent-brand" checked={confirmOnly} onChange={(e) => setConfirmOnly(e.target.checked)} />
            <span>{t("bf.confirmOnly")}{journey.availStatus !== "AVAILABLE" && <b className="text-warn">{t("bf.noConfirmedNow")}</b>}</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 accent-brand" checked={savePassengers} onChange={(e) => setSavePassengers(e.target.checked)} />
            <span>{t("bf.save")}</span>
          </label>
        </section>
      </div>

      <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-4">
        <h2 className="font-sign text-[1.15rem] leading-tight text-brand">{t("bf.fareSummary")}</h2>
        <dl className="space-y-1.5 text-sm">
          {fare.perPassenger.map((p, i) => (
            <div key={i} className="flex justify-between">
              <dt className="text-slate-600">
                {t("bf.passenger", { i: i + 1 })} {p.kind === "infant" ? t("bf.paxInfant") : p.kind === "child_no_berth" ? t("bf.paxChild") : ""}
              </dt>
              <dd>{p.fare ? inr(p.fare.total) : t("bf.free")}</dd>
            </div>
          ))}
          {fare.legs.length > 1 && fare.legs.map((l, i) => (
            <div key={i} className="flex justify-between text-sm text-slate-500">
              <dt>{t("bf.trainLine", { i: i + 1, train: journeys[i].train, cls: journeys[i].cls })}</dt><dd>{inr(l.ticketFare)}</dd>
            </div>
          ))}
          {fare.legs.length === 1 && fare.perPassenger[0]?.fare && (
            <div className="rounded-md bg-slate-50 p-2 text-sm text-slate-500">
              {t("bf.perAdult", { base: inr(fare.perPassenger.find((x) => x.kind === "adult")?.fare?.base ?? 0) })}
              {(() => {
                const f = fare.perPassenger.find((x) => x.kind === "adult")?.fare;
                if (!f) return null;
                return (
                  <>
                    {" "}+ {t("bf.reservation")} {inr(f.reservation)}
                    {f.superfast > 0 && <> + {t("bf.superfast")} {inr(f.superfast)}</>}
                    {f.tatkal > 0 && <> + {t("bf.tatkal")} {inr(f.tatkal)}</>}
                    {f.catering > 0 && <> + {t("bf.catering")} {inr(f.catering)}</>}
                    {f.gst > 0 && <> + {t("bf.gst")} {inr(f.gst)}</>}
                  </>
                );
              })()}
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-1.5"><dt className="text-slate-600">{t("fare.ticket")}</dt><dd>{inr(fare.ticketFare)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">{t("fare.convenience")}</dt><dd>{inr(fare.convenienceFee, true)}</dd></div>
          {insurance && <div className="flex justify-between"><dt className="text-slate-600">{t("fare.insurance")}</dt><dd>{inr(fare.insurance, true)}</dd></div>}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>{t("fare.total")}</dt><dd>{inr(fare.total, true)}</dd></div>
        </dl>
        {(state?.error || localError) && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{localError || state?.error}</p>}
        <button className="btn-primary w-full py-3" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("bf.continue")}
        </button>
        <p className="text-center text-sm text-slate-500">{t("bf.holdNote")}</p>
      </aside>
    </form>
  );
}

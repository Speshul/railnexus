"use client";
import { useActionState, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { createBooking, type BookingFormState } from "@/app/actions/booking";
import type { SavedPassenger } from "@/lib/booking";
import {
  CLASSES, FOOD_PREFS, MAX_PASSENGERS, QUOTAS, SEAT_PREFS, SLEEPER_BERTHS, type ClassCode, type Quota,
} from "@/lib/constants";
import { bookingFare, passengerKind } from "@/lib/fare";
import { inr } from "@/lib/format";

type Journey = {
  train: string; from: string; to: string; date: string; cls: ClassCode; quota: Quota;
  km: number; trainType: string; premium: boolean; availStatus: string;
};
type P = { key: number; name: string; age: string; gender: string; berth: string; food: string; noBerth: boolean };

let nextKey = 1;
const blank = (premium: boolean): P => ({ key: nextKey++, name: "", age: "", gender: "", berth: "", food: premium ? "VEG" : "", noBerth: false });

export function BookingForm({ journey, user, saved }: { journey: Journey; user: { email: string; phone: string; name: string }; saved: SavedPassenger[] }) {
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

  const fare = useMemo(
    () =>
      bookingFare(
        { cls: journey.cls, km: journey.km, trainType: journey.trainType, quota: journey.quota, insurance: !!insurance },
        passengers.filter((p) => p.age !== "").map((p) => ({ age: Number(p.age), noBerth: p.noBerth }))
      ),
    [journey, passengers, insurance]
  );

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

  const submit = (formData: FormData) => {
    if (insurance === null) {
      setLocalError("Please choose whether you want travel insurance.");
      return;
    }
    setLocalError("");
    formData.set(
      "payload",
      JSON.stringify({
        ...journey,
        passengers: passengers.map((p) => ({ name: p.name, age: p.age, gender: p.gender, berth: p.berth, food: p.food, noBerth: p.noBerth })),
        email, phone, insurance, autoUpgrade, confirmOnly, savePassengers,
      })
    );
    action(formData);
  };

  return (
    <form action={submit} className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <section className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Passengers</h2>
            <span className="text-xs text-slate-500">Max {max} per ticket ({QUOTAS[journey.quota].name}) + 2 infants</span>
          </div>

          {saved.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Saved:</span>
              {saved.map((s) => (
                <button key={s.id} type="button" disabled={usedNames.has(s.name.toLowerCase())} onClick={() => addSaved(s)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs hover:border-brand disabled:opacity-40">
                  <UserPlus className="size-3" /> {s.name} ({s.age}{s.gender})
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
                  <legend className="px-1 text-xs font-semibold text-slate-500">
                    Passenger {i + 1}
                    {kind === "infant" && " · Infant (no ticket, travels free)"}
                    {kind === "child_no_berth" && " · Child, no berth (half fare)"}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_9rem] md:grid-cols-[1fr_5rem_7rem_9rem_8rem_auto]">
                    <div>
                      <input aria-label="Name" className={`input ${err("name") ? "border-bad" : ""}`} placeholder="Full name as on ID" value={p.name} maxLength={30}
                        onChange={(e) => update(p.key, { name: e.target.value })} required />
                      {err("name") && <p className="mt-0.5 text-xs text-bad">{err("name")}</p>}
                    </div>
                    <div>
                      <input aria-label="Age" className={`input ${err("age") ? "border-bad" : ""}`} placeholder="Age" inputMode="numeric" value={p.age} maxLength={3}
                        onChange={(e) => update(p.key, { age: e.target.value.replace(/\D/g, ""), noBerth: false })} required />
                      {err("age") && <p className="mt-0.5 text-xs text-bad">{err("age")}</p>}
                    </div>
                    <div>
                      <select aria-label="Gender" className={`input ${err("gender") ? "border-bad" : ""}`} value={p.gender} onChange={(e) => update(p.key, { gender: e.target.value })} required>
                        <option value="">Gender</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="T">Transgender</option>
                      </select>
                      {err("gender") && <p className="mt-0.5 text-xs text-bad">{err("gender")}</p>}
                    </div>
                    <select aria-label="Berth preference" className="input" value={p.berth} disabled={kind === "infant" || p.noBerth}
                      onChange={(e) => update(p.key, { berth: e.target.value })}>
                      <option value="">{sleeper ? "Berth: no pref." : "Seat: no pref."}</option>
                      {Object.entries(berthOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {journey.premium ? (
                      <select aria-label="Meal" className="input" value={p.food} onChange={(e) => update(p.key, { food: e.target.value })} disabled={kind === "infant"}>
                        {Object.entries(FOOD_PREFS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : <span className="hidden md:block" />}
                    <button type="button" aria-label={`Remove passenger ${i + 1}`} disabled={passengers.length === 1}
                      onClick={() => setPassengers((ps) => ps.filter((x) => x.key !== p.key))}
                      className="flex items-center justify-center rounded-lg px-2 text-slate-400 hover:bg-red-50 hover:text-bad disabled:opacity-30">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {age !== null && age >= 5 && age <= 11 && journey.quota !== "TQ" && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" className="accent-brand" checked={p.noBerth} onChange={(e) => update(p.key, { noBerth: e.target.checked })} />
                      Child: don&apos;t book a separate berth (pays half the base fare)
                    </label>
                  )}
                  {err("noBerth") && <p className="mt-0.5 text-xs text-bad">{err("noBerth")}</p>}
                </fieldset>
              );
            })}
          </div>
          <button type="button" className="btn-secondary mt-3" disabled={passengers.length >= max + 2}
            onClick={() => setPassengers((ps) => [...ps, blank(journey.premium)])}>
            <Plus className="size-4" /> Add passenger
          </button>
        </section>

        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Contact details</h2>
          <div>
            <label className="label" htmlFor="email">Email (ticket is sent here)</label>
            <input id="email" type="email" className={`input ${fe.email ? "border-bad" : ""}`} value={email} onChange={(e) => setEmail(e.target.value)} required />
            {fe.email && <p className="mt-0.5 text-xs text-bad">{fe.email}</p>}
          </div>
          <div>
            <label className="label" htmlFor="phone">Mobile</label>
            <input id="phone" inputMode="numeric" maxLength={10} className={`input ${fe.phone ? "border-bad" : ""}`} value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} required />
            {fe.phone && <p className="mt-0.5 text-xs text-bad">{fe.phone}</p>}
          </div>
        </section>

        <section className="card space-y-3 p-4 text-sm">
          <h2 className="font-semibold">Options</h2>
          <fieldset>
            <legend className="mb-1 font-medium">Travel insurance (₹0.45 per passenger, cover up to ₹10 lakh)</legend>
            <label className="mr-4 inline-flex items-center gap-2"><input type="radio" name="ins" className="accent-brand" checked={insurance === true} onChange={() => setInsurance(true)} /> Yes, add insurance</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="ins" className="accent-brand" checked={insurance === false} onChange={() => setInsurance(false)} /> No, thanks</label>
          </fieldset>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 accent-brand" checked={autoUpgrade} onChange={(e) => setAutoUpgrade(e.target.checked)} />
            <span>Consider for auto-upgradation to a higher class if berths are free at no extra cost</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 accent-brand" checked={confirmOnly} onChange={(e) => setConfirmOnly(e.target.checked)} />
            <span>Book only if confirmed berths are allotted{journey.availStatus !== "AVAILABLE" && <b className="text-warn"> (currently no confirmed berths)</b>}</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 accent-brand" checked={savePassengers} onChange={(e) => setSavePassengers(e.target.checked)} />
            <span>Save these passengers to my list for next time</span>
          </label>
        </section>
      </div>

      <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-4">
        <h2 className="font-semibold">Fare summary</h2>
        <dl className="space-y-1.5 text-sm">
          {fare.perPassenger.map((p, i) => (
            <div key={i} className="flex justify-between">
              <dt className="text-slate-600">
                Passenger {i + 1} {p.kind === "infant" ? "(infant)" : p.kind === "child_no_berth" ? "(child, no berth)" : ""}
              </dt>
              <dd>{p.fare ? inr(p.fare.total) : "Free"}</dd>
            </div>
          ))}
          {fare.perPassenger[0]?.fare && (
            <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-500">
              Per adult: base {inr(fare.perPassenger.find((x) => x.kind === "adult")?.fare?.base ?? 0)}
              {(() => {
                const f = fare.perPassenger.find((x) => x.kind === "adult")?.fare;
                if (!f) return null;
                return (
                  <>
                    {" "}+ reservation {inr(f.reservation)}
                    {f.superfast > 0 && <> + superfast {inr(f.superfast)}</>}
                    {f.tatkal > 0 && <> + Tatkal {inr(f.tatkal)}</>}
                    {f.catering > 0 && <> + catering {inr(f.catering)}</>}
                    {f.gst > 0 && <> + GST {inr(f.gst)}</>}
                  </>
                );
              })()}
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-1.5"><dt className="text-slate-600">Ticket fare</dt><dd>{inr(fare.ticketFare)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">Convenience fee (incl. GST)</dt><dd>{inr(fare.convenienceFee, true)}</dd></div>
          {insurance && <div className="flex justify-between"><dt className="text-slate-600">Travel insurance</dt><dd>{inr(fare.insurance, true)}</dd></div>}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{inr(fare.total, true)}</dd></div>
        </dl>
        {(state?.error || localError) && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{localError || state?.error}</p>}
        <button className="btn-primary w-full py-3" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Continue to review
        </button>
        <p className="text-center text-xs text-slate-500">Seats are held for 15 minutes while you review and pay.</p>
      </aside>
    </form>
  );
}

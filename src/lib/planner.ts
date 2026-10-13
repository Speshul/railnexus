import "server-only";
import { z } from "zod";
import { llmJson } from "./ai";
import { cityCodes, findTrains, nearbyStations, type Segment } from "./rail";
import { getAvailability } from "./availability";
import { bookingFare } from "./fare";
import { addDays, diffDays, formatDate, isOvernightRide, isValidDate, weekday } from "./dates";
import { BOOKING_WINDOW_DAYS, type ClassCode } from "./constants";
import { resolveStation } from "./voice/resolve";
import { bookHref } from "./trip-url";
import { msg, type Msg } from "@/i18n/core";

// ---------------------------------------------------------------- 1. understand the request (AI)

const CLASS_CODES = ["1A", "2A", "3A", "SL", "CC", "EC", "2S"] as const;
const requestSchema = z.object({
  origin: z.string().nullish(),
  destination: z.string().nullish(),
  destination_ideas: z.array(z.string()).nullish(),
  depart_date: z.string().nullish(),
  depart_weekday: z.string().nullish(),
  return_weekday: z.string().nullish(),
  nights: z.number().int().nullish(),
  depart_after: z.string().nullish(),
  depart_before: z.string().nullish(),
  return_date: z.string().nullish(),
  return_after: z.string().nullish(),
  return_before: z.string().nullish(),
  adults: z.number().int().nullish(),
  children: z.number().int().nullish(),
  seniors: z.number().int().nullish(),
  budget: z.number().nullish(),
  cls: z.enum(CLASS_CODES).nullish(),
  priority: z.enum(["cheapest", "fastest", "comfort", "surest"]).nullish(),
  overnight: z.boolean().nullish(),
  summary: z.string().nullish(),
});
export type TripRequest = z.infer<typeof requestSchema>;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const S = (type: string, extra: object = {}) => ({ type, nullable: true, ...extra });
const SCHEMA = {
  type: "OBJECT",
  properties: {
    origin: S("STRING"), destination: S("STRING"), destination_ideas: S("ARRAY", { items: { type: "STRING" } }),
    depart_date: S("STRING"), depart_weekday: S("STRING", { enum: WEEKDAYS }), return_weekday: S("STRING", { enum: WEEKDAYS }), nights: S("INTEGER"),
    depart_after: S("STRING"), depart_before: S("STRING"),
    return_date: S("STRING"), return_after: S("STRING"), return_before: S("STRING"),
    adults: S("INTEGER"), children: S("INTEGER"), seniors: S("INTEGER"), budget: S("NUMBER"),
    cls: S("STRING", { enum: [...CLASS_CODES] }), priority: S("STRING", { enum: ["cheapest", "fastest", "comfort", "surest"] }),
    overnight: S("BOOLEAN"), summary: { type: "STRING" },
  },
  required: [] as string[],
};
SCHEMA.required = Object.keys(SCHEMA.properties);

function systemPrompt(today: string) {
  const days = Array.from({ length: 14 }, (_, i) => `${addDays(today, i)} ${formatDate(addDays(today, i), { weekday: "long" })}`).join(", ");
  return `You turn a traveller's description of a train trip in India into structured fields. The text may be English, Hindi or Hinglish.
Today is ${today}. Upcoming days: ${days}.
- origin/destination: Indian city or railway station names in English ("दिल्ली"->"Delhi", "Bombay"->"Mumbai"). Never invent station codes.
- If no specific destination is given but the traveller describes what they want ("somewhere with hills", "a beach for the weekend",
  "pilgrimage"), set destination=null and destination_ideas to 2-3 real Indian cities that fit, that have railway stations and are
  realistically reachable by a direct train from the origin within the trip length. Otherwise destination_ideas=null.
- Dates as YYYY-MM-DD. "weekend" = leave Friday evening or Saturday, return Sunday. "next Friday"/"agle Friday" = the coming Friday.
  If the traveller gives a trip length ("for 3 days"), set return_date accordingly. return_date=null for one-way trips.
  Whenever they name a weekday ("Friday", "next Saturday", "is Sunday"), ALSO set depart_weekday / return_weekday to that day
  (lowercase English). nights = number of nights away if they say a trip length ("3 days" = 2 nights, "a week" = 7).
- Time windows as HH:MM 24h: morning 05:00-11:59, afternoon 12:00-16:59, evening 17:00-21:59, night 20:00-23:59, "after work" 18:00-23:59.
- adults/children(5-11)/seniors(60+): counts of travellers ("me and my wife"=2 adults, "family of four" = 2 adults + 2 children).
- budget: total rupees for everyone, for the whole trip (both ways). "3k" = 3000.
- cls: only if they name a class (AC 3 tier=3A, sleeper=SL, chair car=CC...). "AC" alone = 3A.
- priority: cheapest | fastest | comfort | surest (they want confirmed tickets) when they express one.
- overnight=true ONLY if they explicitly ask to travel overnight / sleep on the train ("raat wali train"); otherwise null.
- summary: one short sentence restating the trip. If the text has ANY Hindi words or Devanagari, write it in Hinglish (Roman script); else English.`;
}

// ---------------------------------------------------------------- 2. build itineraries from real trains

export type PlanLeg = {
  train: string; name: string; from: { code: string; name: string }; to: { code: string; name: string };
  date: string; dep: string; arr: string; arrivalDate: string; duration: number; cls: ClassCode;
  total: number; avail: { status: string; count: number; label: string; chance: number };
};
export type Plan = {
  id: string;
  tags: ("cheapest" | "fastest" | "surest" | "comfort")[];
  destination: { code: string; name: string };
  out: PlanLeg;
  back: PlanLeg | null;
  total: number;
  /** minutes between arriving and leaving again */
  stay: number | null;
  overBudget: boolean;
  hrefs: string[];
};
export type PlanResult =
  | { ok: true; request: TripRequest & { originName: string; party: number }; plans: Plan[]; notes: Msg[] }
  | { ok: false; error: Msg };

type Option = { seg: Segment; cls: ClassCode; total: number; chance: number; status: string; count: number; label: string; depMs: number; arrMs: number };

const COMFORT: Record<ClassCode, number> = { "1A": 6, EC: 5, "2A": 5, "3A": 4, CC: 3, SL: 2, "2S": 1, UR: 0 };
const toMin = (hhmm?: string | null) => (hhmm && /^\d{1,2}:\d{2}$/.test(hhmm) ? Number(hhmm.split(":")[0]) * 60 + Number(hhmm.split(":")[1]) : null);
const ms = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+05:30`);

function inWindow(depMin: number, after: number | null, before: number | null) {
  const d = depMin % 1440;
  if (after === null && before === null) return true;
  if (after !== null && before !== null && before < after) return d >= after || d <= before; // crosses midnight
  return (after === null || d >= after) && (before === null || d <= before);
}

function codesFor(name: string) {
  const r = resolveStation(name);
  if (!r) return null;
  const codes = r.city ? cityCodes(name) : nearbyStations(r.station.code, 30).map((s) => s.code).slice(0, 6);
  // For a city served by several stations (Goa, Mumbai...), call it by the city's name rather than one station's.
  const label = r.city ? name.trim().replace(/^\w/, (c) => c.toUpperCase()) : r.station.name;
  return { station: r.station, label, codes: codes.length ? codes : [r.station.code] };
}

function options(from: string[], to: string[], date: string, req: TripRequest, pax: { age: number; noBerth: boolean }[], window: [string | null | undefined, string | null | undefined]) {
  const after = toMin(window[0]);
  const before = toMin(window[1]);
  const out: Option[] = [];
  for (const seg of findTrains(from, to, date)) {
    if (!seg.train.reservable || !inWindow(seg.from.dep_min!, after, before)) continue;
    if (req.overnight && !isOvernightRide(seg.from.dep_min!, seg.duration)) continue;
    for (const cls of seg.train.classes) {
      if (cls === "UR" || (req.cls ? cls !== req.cls : (cls === "1A" || cls === "EC") && req.priority !== "comfort")) continue;
      if (!req.cls && cls === "2S" && seg.duration > 5 * 60) continue; // nobody wants 10 hours on a bench seat
      const a = getAvailability(seg, cls, "GN");
      if (!a.bookable) continue;
      const fare = bookingFare({ cls, km: seg.distance, trainType: seg.train.type, quota: "GN", insurance: false }, pax);
      out.push({
        seg, cls, total: fare.total, chance: a.chance, status: a.status, count: a.count, label: a.label,
        depMs: ms(seg.date, seg.from.dep!), arrMs: ms(seg.arrivalDate, seg.to.arr!),
      });
    }
  }
  return out;
}

// Keep a manageable shortlist: the best few by each thing a traveller might care about.
function shortlist(list: Option[], n = 10) {
  const pick = new Set<Option>();
  for (const by of [(o: Option) => o.total, (o: Option) => o.seg.duration, (o: Option) => -o.chance + o.total / 1e6, (o: Option) => -COMFORT[o.cls] + o.total / 1e6]) {
    [...list].sort((a, b) => by(a) - by(b)).slice(0, n).forEach((o) => pick.add(o));
  }
  return [...pick];
}

const leg = (o: Option): PlanLeg => ({
  train: o.seg.train.number, name: o.seg.train.name,
  from: { code: o.seg.from.code, name: o.seg.from.name }, to: { code: o.seg.to.code, name: o.seg.to.name },
  date: o.seg.date, dep: o.seg.from.dep!, arr: o.seg.to.arr!, arrivalDate: o.seg.arrivalDate, duration: o.seg.duration,
  cls: o.cls, total: o.total, avail: { status: o.status, count: o.count, label: o.label, chance: o.chance },
});

function makePlan(dest: { code: string; name: string }, out: Option, back: Option | null, budget: number | null): Plan {
  const total = Math.round((out.total + (back?.total ?? 0)) * 100) / 100;
  const ref = (o: Option) => ({ train: o.seg.train.number, from: o.seg.from.code, to: o.seg.to.code, date: o.seg.date, cls: o.cls });
  // One checkout for both directions when the return starts where the outbound ends; otherwise one link per train.
  const hrefs = back
    ? back.seg.from.code === out.seg.to.code ? [bookHref([ref(out), ref(back)], "GN")] : [bookHref([ref(out)], "GN"), bookHref([ref(back)], "GN")]
    : [bookHref([ref(out)], "GN")];
  return {
    id: `${out.seg.train.number}-${out.cls}-${back?.seg.train.number ?? ""}-${back?.cls ?? ""}`,
    tags: [], destination: dest, out: leg(out), back: back ? leg(back) : null, total,
    stay: back ? Math.round((back.depMs - out.arrMs) / 60000) : null,
    overBudget: budget !== null && total > budget, hrefs,
  };
}

type Combo = { out: Option; back: Option | null; total: number; duration: number; chance: number; comfort: number };

function combos(outs: Option[], backs: Option[] | null): Combo[] {
  const res: Combo[] = [];
  for (const o of shortlist(outs)) {
    if (!backs) {
      res.push({ out: o, back: null, total: o.total, duration: o.seg.duration, chance: o.chance, comfort: COMFORT[o.cls] });
      continue;
    }
    for (const b of shortlist(backs)) {
      if (b.depMs < o.arrMs + 3 * 3600000) continue; // at least 3 hours there
      res.push({ out: o, back: b, total: o.total + b.total, duration: o.seg.duration + b.seg.duration, chance: Math.min(o.chance, b.chance), comfort: Math.min(COMFORT[o.cls], COMFORT[b.cls]) });
    }
  }
  return res;
}

const BEST: Record<Plan["tags"][number], (a: Combo, b: Combo) => number> = {
  // cheapest among tickets with a fair chance of confirming (a cheap waitlist ticket that never confirms isn't cheap)
  cheapest: (a, b) => (b.chance >= 0.5 ? 1 : 0) - (a.chance >= 0.5 ? 1 : 0) || a.total - b.total,
  fastest: (a, b) => a.duration - b.duration || a.total - b.total,
  surest: (a, b) => b.chance - a.chance || a.total - b.total,
  comfort: (a, b) => b.comfort - a.comfort || b.chance - a.chance || a.total - b.total,
};

export async function planTrip(text: string, today: string): Promise<PlanResult> {
  const raw = await llmJson(systemPrompt(today), text, SCHEMA, "plan");
  if (raw === null) return { ok: false, error: "plan.err.ai" };
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "plan.err.ai" };
  const req = parsed.data;
  const notes: Msg[] = [];

  if (!req.origin) return { ok: false, error: "plan.err.origin" };
  const origin = codesFor(req.origin);
  if (!origin) return { ok: false, error: msg("plan.err.place", { place: req.origin }) };

  // Models are unreliable at calendar arithmetic, so weekdays and trip lengths are turned into dates here.
  const nextWeekday = (name: string | null | undefined, onOrAfter: string) => {
    const w = WEEKDAYS.indexOf((name ?? "").toLowerCase());
    return w < 0 ? null : addDays(onOrAfter, (w - weekday(onOrAfter) + 7) % 7);
  };
  let date = nextWeekday(req.depart_weekday, addDays(today, 1)) ?? (req.depart_date && isValidDate(req.depart_date) ? req.depart_date : null);
  if (!date || date < today) {
    date = addDays(today, 1);
    notes.push(msg("plan.note.date", { date: formatDate(date, { weekday: "long", day: "numeric", month: "short" }) }));
  }
  if (diffDays(date, today) > BOOKING_WINDOW_DAYS) return { ok: false, error: msg("plan.err.window", { days: BOOKING_WINDOW_DAYS }) };
  const retGuess = nextWeekday(req.return_weekday, date)
    ?? (req.nights && req.nights > 0 && req.nights < 30 ? addDays(date, req.nights) : null)
    ?? (req.return_date && isValidDate(req.return_date) ? req.return_date : null);
  const ret = retGuess && retGuess >= date ? retGuess : null;

  const adults = Math.max(0, req.adults ?? 0);
  const children = Math.max(0, req.children ?? 0);
  const seniors = Math.max(0, req.seniors ?? 0);
  const pax = [
    ...Array(adults).fill({ age: 30, noBerth: false }), ...Array(children).fill({ age: 8, noBerth: false }), ...Array(seniors).fill({ age: 65, noBerth: false }),
  ];
  if (!pax.length) pax.push({ age: 30, noBerth: false });
  if (pax.length > 6) return { ok: false, error: "plan.err.party" };
  const budget = req.budget && req.budget > 0 ? req.budget : null;

  const targets = req.destination ? [req.destination] : (req.destination_ideas ?? []).slice(0, 3);
  if (!targets.length) return { ok: false, error: "plan.err.destination" };

  const plans: Plan[] = [];
  for (const target of targets) {
    const dest = codesFor(target);
    if (!dest) {
      if (req.destination) return { ok: false, error: msg("plan.err.place", { place: target }) };
      continue;
    }
    const to = dest.codes.filter((c) => !origin.codes.includes(c));
    if (!to.length) continue;
    // Strict first; if nothing fits, relax the time of day, then the overnight wish, and say so.
    const find = (from: string[], dest: string[], d: string, win: [string | null | undefined, string | null | undefined], overnight: boolean | null | undefined) => {
      const tries: [typeof win, boolean | null | undefined, Msg | null][] = [[win, overnight, null]];
      if (win[0] || win[1]) tries.push([[null, null], overnight, "plan.note.anyTime"]);
      if (overnight) tries.push([[null, null], null, "plan.note.notOvernight"]);
      for (const [w, o, note] of tries) {
        const found = options(from, dest, d, { ...req, overnight: o }, pax, w);
        if (found.length) return { found, note };
      }
      return { found: [], note: null };
    };
    const outs = find(origin.codes, to, date, [req.depart_after, req.depart_before], req.overnight);
    // Return trains are searched from wherever the outbound can arrive, back to anywhere near home.
    const backs = ret ? find(to, origin.codes, ret, [req.return_after, req.return_before], null) : null;
    for (const note of [outs.note, backs?.note]) if (note && !notes.includes(note)) notes.push(note);
    let all = combos(outs.found, backs?.found ?? null);
    if (ret && !all.length && outs.found.length) {
      // No way back that fits: still show how to get there, and say the return needs planning separately.
      all = combos(outs.found, null);
      if (!notes.includes("plan.note.noReturn")) notes.push("plan.note.noReturn");
    }
    if (budget !== null && all.some((c) => c.total <= budget)) all = all.filter((c) => c.total <= budget);
    if (!all.length) continue;
    const destination = { code: dest.station.code, name: dest.label };

    // With one destination: up to three different trips (cheapest / fastest / surest, plus comfort if asked).
    // With several ideas: the single best trip to each.
    const wanted: Plan["tags"] = req.destination
      ? req.priority === "comfort" ? ["comfort", "cheapest", "fastest"] : ["cheapest", "fastest", "surest"]
      : [req.priority ?? "cheapest"];
    for (const tag of wanted) {
      const best = [...all].sort(BEST[tag])[0];
      const plan = makePlan(destination, best.out, best.back, budget);
      const same = plans.find((p) => p.id === plan.id);
      if (same) same.tags.push(tag);
      else plans.push({ ...plan, tags: [tag] });
    }
  }
  if (!plans.length) return { ok: false, error: "plan.err.noTrains" };
  // What the traveller said matters most goes first.
  if (req.priority) plans.sort((a, b) => Number(b.tags.includes(req.priority!)) - Number(a.tags.includes(req.priority!)));
  if (budget !== null && plans.every((p) => p.overBudget)) notes.push(msg("plan.note.budget", { budget }));
  if (retGuess && !ret) notes.push("plan.note.oneWay");

  return { ok: true, request: { ...req, depart_date: date, return_date: ret, originName: origin.label, party: pax.length }, plans, notes };
}

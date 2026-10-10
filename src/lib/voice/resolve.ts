import "server-only";
import { cityCodes, fuzzyStation, getStation, lookupTrains, searchStations, type Station } from "../rail";
import { isValidDate, formatDate, diffDays } from "../dates";
import { BOOKING_WINDOW_DAYS, CLASSES } from "../constants";
import type { VoiceAction, VoiceContext, VoiceIntent } from "./types";

type Out = { reply: string; actions: VoiceAction[] };

/** Roughly: did the user speak Hindi/Hinglish? Used for the wording of fallback replies. */
export function isHinglish(text: string) {
  return /[ऀ-ॿ]/.test(text) || /\b(se|ka|ki|ke|karo|kal|aaj|chahiye|dikhao|mujhe|hai|wali|jaana|liye|aage)\b/i.test(text);
}

function resolveStation(name: string | null | undefined): { station: Station; city: boolean } | null {
  if (!name) return null;
  const q = name.trim();
  // Treat it as a station code only when it looks like one (e.g. "NDLS"), not a spoken word like "Goa".
  if (/^[A-Z]{2,5}$/.test(q)) {
    const byCode = getStation(q);
    if (byCode && byCode.train_count > 0) return { station: byCode, city: false };
  }
  const city = cityCodes(q);
  if (city.length) {
    const s = getStation(city[0]);
    if (s) return { station: s, city: true };
  }
  const hit = searchStations(q, 1)[0] ?? fuzzyStation(q);
  return hit ? { station: hit, city: false } : null;
}

const searchHref = (p: { from: string; to: string; date: string; quota?: string | null; cls?: string | null; nearby?: boolean }) => {
  const q = new URLSearchParams({ from: p.from, to: p.to, date: p.date, quota: p.quota || "GN" });
  if (p.cls) q.set("cls", p.cls);
  if (p.nearby) q.set("nearby", "1");
  return `/search?${q}`;
};

const ORDINALS: Record<string, number> = {
  first: 0, "1st": 0, pehli: 0, pehla: 0, pahli: 0, second: 1, "2nd": 1, doosri: 1, dusri: 1, doosra: 1,
  third: 2, "3rd": 2, teesri: 2, tisri: 2, fourth: 3, chauthi: 3, last: -1, aakhri: -1,
};

type Listed = NonNullable<VoiceContext["trains"]>[number];

function fareOf(t: Listed, cls?: string | null) {
  // classes look like "SL:675:AVL 41|3A:1801:WL 5"
  const fares = t.classes.split("|").map((c) => c.split(":")).filter(([c]) => !cls || c === cls).map(([, f]) => Number(f));
  return fares.length ? Math.min(...fares) : Infinity;
}

/** Find the train the user means among the visible results: number, ordinal, superlative or name. */
function pickTrain(ref: string | null | undefined, trains: Listed[], cls?: string | null): Listed | null {
  if (!trains.length) return null;
  const r = (ref ?? "").toLowerCase().trim();
  if (!r) return trains.length === 1 ? trains[0] : null;
  const byNumber = trains.find((t) => t.n === r || r.includes(t.n));
  if (byNumber) return byNumber;
  if (r in ORDINALS) return ORDINALS[r] < 0 ? trains[trains.length - 1] : trains[ORDINALS[r]] ?? null;
  const min = (f: (t: Listed) => number) => trains.reduce((a, b) => (f(b) < f(a) ? b : a));
  if (/cheap|sast|lowest|kam paise/.test(r)) return min((t) => fareOf(t, cls));
  if (/fast|jaldi|quick|shortest/.test(r)) return min((t) => t.dur);
  if (/earl|pehle|subah|morning/.test(r)) return min((t) => Number(t.dep.replace(":", "")));
  return trains.find((t) => t.name.toLowerCase().includes(r)) ?? null;
}

export function resolveIntent(intent: VoiceIntent, ctx: VoiceContext, heard: string, today: string): Out {
  const hi = isHinglish(heard);
  const say = (en: string, hin: string) => (hi ? hin : en);
  const reply = (fallback: string) => intent.reply?.trim() || fallback;
  const needSearch = () => ({ reply: say("Search for trains first, then I can do that.", "Pehle trains search kijiye, phir ye ho jayega."), actions: [] });
  const needBooking = () => ({
    reply: say("That works on the passenger details page. Pick a train and class first.", "Ye passenger details page pe hota hai. Pehle train aur class chuno."),
    actions: [],
  });
  const validDate = (d: string | null | undefined) =>
    d && isValidDate(d) && diffDays(d, today) >= 0 && diffDays(d, today) <= BOOKING_WINDOW_DAYS ? d : null;

  switch (intent.intent) {
    case "search": {
      const fromName = intent.from || ctx.search?.fromName;
      const from = resolveStation(fromName);
      const to = resolveStation(intent.to);
      if (!from || !to) {
        const missing = !intent.to ? say("Where do you want to go?", "Kahan jaana hai?") : !fromName ? say("Where are you starting from?", "Kahan se jaana hai?")
          : say(`I couldn't find the station "${!from ? fromName : intent.to}". Try saying it differently.`, `"${!from ? fromName : intent.to}" station nahi mila. Thoda alag tarike se boliye.`);
        return { reply: missing, actions: [] };
      }
      if (from.station.code === to.station.code) return { reply: say("Start and destination are the same station.", "Dono station same hain."), actions: [] };
      if (intent.date && !validDate(intent.date))
        return { reply: say(`Bookings open only up to ${BOOKING_WINDOW_DAYS} days ahead, from today.`, `Booking sirf aaj se ${BOOKING_WINDOW_DAYS} din tak ki hoti hai.`), actions: [] };
      const date = validDate(intent.date) ?? ctx.search?.date ?? today;
      const href = searchHref({
        from: from.station.code, to: to.station.code, date, quota: intent.quota, cls: intent.cls, nearby: from.city || to.city,
      });
      const what = `${from.station.name} → ${to.station.name}, ${formatDate(date)}${intent.cls ? `, ${CLASSES[intent.cls].name}` : ""}`;
      return { reply: reply(say(`Searching ${what}.`, `${what} ke trains dhoondh rahe hain.`)), actions: [{ type: "navigate", href }] };
    }

    case "change_date": {
      if (!ctx.search) return needSearch();
      const date = validDate(intent.date);
      if (!date) return { reply: say("That date can't be booked.", "Us date ki booking nahi ho sakti."), actions: [] };
      return {
        reply: reply(say(`Showing trains for ${formatDate(date)}.`, `${formatDate(date)} ke trains dikha rahe hain.`)),
        actions: [{ type: "navigate", href: searchHref({ ...ctx.search, date }) }],
      };
    }

    case "book": {
      if (!ctx.search || !ctx.trains?.length) return needSearch();
      const t = pickTrain(intent.train, ctx.trains, intent.cls);
      if (!t) return { reply: say("Which train? Say its number, or 'the first one', 'the cheapest'.", "Kaunsi train? Number boliye, ya 'pehli wali', 'sabse sasti'."), actions: [] };
      const offered = t.classes.split("|").map((c) => c.split(":")[0]);
      const cls = intent.cls ?? (offered.length === 1 ? offered[0] : null);
      if (!cls) return { reply: say(`Which class on ${t.name}? ${offered.join(", ")}.`, `${t.name} mein kaunsi class? ${offered.join(", ")}.`), actions: [] };
      if (!offered.includes(cls)) return { reply: say(`${t.name} doesn't have ${cls}. It has ${offered.join(", ")}.`, `${t.name} mein ${cls} nahi hai. Isme ${offered.join(", ")} hai.`), actions: [] };
      const q = new URLSearchParams({ train: t.n, from: t.from, to: t.to, date: t.date, cls, quota: intent.quota || ctx.search.quota || "GN" });
      return {
        reply: reply(say(`Booking ${t.n} ${t.name} in ${cls}. Add passengers next.`, `${t.n} ${t.name}, ${cls} book kar rahe hain. Ab passengers batayein.`)),
        actions: [{ type: "navigate", href: `/book?${q}` }],
      };
    }

    case "sort": {
      if (!ctx.search) return needSearch();
      const by = ({ departure: "dep", arrival: "arr", duration: "dur", fare: "fare" } as const)[intent.sort ?? "departure"];
      return { reply: reply(say("Sorted.", "Sort kar diya.")), actions: [{ type: "tab", tab: "direct" }, { type: "sort", by }] };
    }
    case "filter":
      if (!ctx.search) return needSearch();
      return { reply: reply(say("Showing only trains with confirmed seats.", "Sirf confirm seat wali trains dikha rahe hain.")), actions: [{ type: "filter", onlyAvailable: intent.only_available ?? true }] };
    case "show_tab":
      if (!ctx.search) return needSearch();
      return {
        reply: reply(say("Here you go.", "Ye dekhiye.")),
        actions: [{ type: "tab", tab: intent.tab === "connections" ? "connect" : intent.tab === "nearby" ? "nearby" : "direct" }],
      };
    case "select_option":
      if (!ctx.search) return needSearch();
      return { reply: reply(say(`Opening option ${intent.option_index ?? 1}.`, `Option ${intent.option_index ?? 1} khol rahe hain.`)), actions: [{ type: "tab", tab: "connect" }, { type: "select_option", index: Math.max(1, intent.option_index ?? 1) }] };

    case "add_passengers": {
      if (!ctx.booking) return needBooking();
      const passengers = (intent.passengers ?? []).filter((p) => p.name.trim());
      if (!passengers.length) return { reply: say("Who should I add? Say a name, age and gender.", "Kisko add karun? Naam, umar aur gender boliye."), actions: [] };
      return { reply: reply(say(`Adding ${passengers.map((p) => p.name).join(", ")}.`, `${passengers.map((p) => p.name).join(", ")} ko add kar rahe hain.`)), actions: [{ type: "add_passengers", passengers }] };
    }
    case "remove_passenger": {
      if (!ctx.booking) return needBooking();
      const name = intent.passengers?.[0]?.name;
      if (!name) return { reply: say("Who should I remove?", "Kisko hataun?"), actions: [] };
      return { reply: reply(say(`Removing ${name}.`, `${name} ko hata rahe hain.`)), actions: [{ type: "remove_passenger", name }] };
    }
    case "set_option": {
      if (!ctx.booking) return needBooking();
      const a: VoiceAction = { type: "set_options" };
      if (intent.insurance != null) a.insurance = intent.insurance;
      if (intent.auto_upgrade != null) a.autoUpgrade = intent.auto_upgrade;
      if (intent.confirm_only != null) a.confirmOnly = intent.confirm_only;
      return { reply: reply(say("Updated.", "Update kar diya.")), actions: [a] };
    }
    case "continue":
      if (!ctx.booking) return needBooking();
      return { reply: reply(say("Taking you to the review page.", "Review page pe le ja rahe hain.")), actions: [{ type: "continue" }] };

    case "navigate": {
      const simple: Record<string, string> = { home: "/", bookings: "/account", pnr: "/pnr", trains: "/trains", stations: "/stations", login: "/login", register: "/register", back: "back" };
      if (intent.page && intent.page in simple) {
        if (intent.page === "bookings" && !ctx.loggedIn) return { reply: say("Please sign in to see your bookings.", "Bookings dekhne ke liye pehle login karo."), actions: [{ type: "navigate", href: "/login?next=/account" }] };
        return { reply: reply(say("Opening.", "Khol rahe hain.")), actions: [{ type: "navigate", href: simple[intent.page] }] };
      }
      if (intent.page === "train_route") {
        const listed = ctx.trains ? pickTrain(intent.train, ctx.trains) : null;
        const number = listed?.n ?? (intent.train && /^\d{5}$/.test(intent.train) ? intent.train : lookupTrains(intent.train ?? "", 1)[0]?.number);
        if (!number) return { reply: say("Which train's route?", "Kis train ka route?"), actions: [] };
        const qs = listed ? `?${new URLSearchParams({ from: listed.from, to: listed.to, date: listed.date })}` : "";
        return { reply: reply(say(`Opening the route of ${number}.`, `${number} ka route khol rahe hain.`)), actions: [{ type: "navigate", href: `/train/${number}${qs}` }] };
      }
      if (intent.page === "station") {
        const s = resolveStation(intent.station);
        if (!s) return { reply: say("Which station?", "Kaunsa station?"), actions: [] };
        return { reply: reply(say(`Opening ${s.station.name}.`, `${s.station.name} khol rahe hain.`)), actions: [{ type: "navigate", href: `/station/${s.station.code}` }] };
      }
      return { reply: say("Where should I go?", "Kahan jaana hai?"), actions: [] };
    }

    case "help":
      return {
        reply: say(
          'Try: "Pune to Delhi tomorrow in sleeper", "book the cheapest one in 3A", "add Asha", "next day", or "show my bookings".',
          'Boliye: "kal Pune se Delhi sleeper", "sabse sasti wali 3A mein book karo", "Asha ko add karo", "agle din", ya "meri bookings dikhao".'
        ),
        actions: [],
      };
    default:
      return {
        reply: intent.reply?.trim() || say("Sorry, I didn't get that. Say 'help' to hear examples.", "Maaf kijiye, samajh nahi aaya. Examples ke liye 'help' boliye."),
        actions: [],
      };
  }
}

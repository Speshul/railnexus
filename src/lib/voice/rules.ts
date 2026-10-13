// Offline fallback: understands common English/Hinglish commands without any API.
// Less flexible than the language model, but keeps the demo working with no keys or no quota left.
import type { VoiceContext, VoiceIntent } from "./types";
import { addDays, weekday } from "../dates";
import { isHinglish } from "./resolve";

// A few common Devanagari words that speech recognition (hi-IN) produces, mapped to Roman Hinglish.
const DEVANAGARI: Record<string, string> = {
  "कल": "kal", "आज": "aaj", "परसों": "parso", "से": "se", "तक": "tak", "के": "ke", "लिए": "liye", "को": "ko",
  "स्लीपर": "sleeper", "टिकट": "ticket", "बुक": "book", "करो": "karo", "दिल्ली": "delhi", "मुंबई": "mumbai",
  "पुणे": "pune", "कोलकाता": "kolkata", "चेन्नई": "chennai", "लखनऊ": "lucknow", "पटना": "patna", "जयपुर": "jaipur",
  "तत्काल": "tatkal", "सबसे": "sabse", "सस्ता": "sasta", "सस्ती": "sasti", "मेरी": "meri", "बुकिंग": "booking",
};

const WEEKDAYS: [RegExp, number][] = [
  [/\b(sunday|ravivar|raviwar|itwar|itvaar)\b/, 0], [/\b(monday|somvar|somwar)\b/, 1], [/\b(tuesday|mangalvar|mangalwar)\b/, 2],
  [/\b(wednesday|budhvar|budhwar)\b/, 3], [/\b(thursday|guruvar|guruwar|brihaspativar)\b/, 4],
  [/\b(friday|shukravar|shukrawar)\b/, 5], [/\b(saturday|shanivar|shaniwar)\b/, 6],
];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const CLASS_WORDS: [RegExp, VoiceIntent["cls"]][] = [
  [/\b(first ac|1st ac|1 ac|1ac|1a|first class ac)\b/, "1A"],
  [/\b(second ac|2nd ac|2 ac|2ac|2a|2 tier|two tier)\b/, "2A"],
  [/\b(third ac|3rd ac|3 ac|3ac|3a|3 tier|three tier)\b/, "3A"],
  [/\b(executive)\b/, "EC"],
  [/\b(chair car|cc)\b/, "CC"],
  [/\b(sleeper|sl)\b/, "SL"],
  [/\b(second sitting|2s|general seat|seating)\b/, "2S"],
];

function parseDate(t: string, today: string): string | null {
  if (/\b(day after tomorrow|parso|parson)\b/.test(t)) return addDays(today, 2);
  if (/\b(tomorrow|kal)\b/.test(t)) return addDays(today, 1);
  if (/\b(today|aaj)\b/.test(t)) return today;
  for (const [re, dow] of WEEKDAYS) {
    if (re.test(t)) {
      const diff = (dow - weekday(today) + 7) % 7 || 7;
      return addDays(today, diff);
    }
  }
  const m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?([a-z]{3,})/);
  if (m) {
    const mi = MONTHS.findIndex((x) => m[2].startsWith(x));
    if (mi >= 0) {
      const y = Number(today.slice(0, 4));
      let d = `${y}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (d < today) d = `${y + 1}${d.slice(4)}`;
      return d;
    }
  }
  const tarikh = t.match(/\b(\d{1,2})\s*(?:tarikh|tareekh|date)\b/);
  if (tarikh) {
    const day = Number(tarikh[1]);
    let d = `${today.slice(0, 8)}${String(day).padStart(2, "0")}`;
    if (d < today) d = addDays(`${today.slice(0, 8)}01`, 31).slice(0, 8) + String(day).padStart(2, "0");
    return d;
  }
  return null;
}

const STOP = /\b(by|on|for|in|kal|aaj|parso|tomorrow|today|day after tomorrow|sleeper|tatkal|ac|train|trains|ticket|tickets|ke|liye|ko|tak|jaana|jana|hai|karo|chahiye|book|ki|ka|the|a|next|this|coming|agle|mein|me)\b.*$/;
const clean = (s: string) => s.replace(STOP, "").replace(/[^a-z .]/g, "").trim();

export function ruleIntent(input: string, ctx: VoiceContext, today: string): VoiceIntent {
  let t = ` ${input.toLowerCase()} `;
  for (const [dev, rom] of Object.entries(DEVANAGARI)) t = t.replaceAll(dev, rom);
  t = t.replace(/[,?!।]/g, " ").replace(/\s+/g, " ").trim();
  const base: VoiceIntent = { intent: "unknown", reply: "" };
  const cls = CLASS_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
  const quota = /\btatkal\b/.test(t) ? "TQ" : /\bladies\b/.test(t) ? "LD" : /\bsenior\b/.test(t) ? "SS" : null;
  const date = parseDate(t, today);

  if (/\b(upi|card)\b/.test(t))
    return {
      ...base,
      reply: isHinglish(input)
        ? "UPI ya card payment aapko khud Pay button dabake karna hoga. Wallet se pay karna ho to boliye \"wallet se pay karo\"."
        : "Please press the Pay button yourself for UPI or card. To pay from your wallet, say \"pay from wallet\".",
    };
  if (/\b(pay|payment|bhugtan)\b/.test(t)) return { ...base, intent: "pay" };
  if (/\b(help|madad|what can you do|kya kar sakte)\b/.test(t)) return { ...base, intent: "help" };

  // navigation
  const nav: [RegExp, VoiceIntent["page"]][] = [
    [/\bpnr\b/, "pnr"],
    [/\b(where can i go|kahan ja sakte|kahan jaa sakte|explore)\b/, "explore"],
    [/\b(plan (a |my )?trip|trip plan|weekend trip)\b/, "plan"],
    [/\b(my bookings?|meri bookings?|bookings? dikhao|my tickets|mere ticket)\b/, "bookings"],
    [/\b(home|homepage|home page|main page)\b/, "home"], [/\b(go back|back|wapas|peeche)\b/, "back"],
    [/\b(login|log in|sign in)\b/, "login"], [/\b(register|sign up|signup|account banao)\b/, "register"],
    [/\b(all trains|trains page)\b/, "trains"], [/\b(stations page|all stations)\b/, "stations"],
  ];
  for (const [re, page] of nav) if (re.test(t)) return { ...base, intent: "navigate", page };
  const route = t.match(/\b(route|stops|timetable|schedule)\b.*?\b(\d{5})\b|\b(\d{5})\b.*?\b(route|stops|timetable|schedule)\b/);
  if (route) return { ...base, intent: "navigate", page: "train_route", train: route[2] ?? route[3] };

  // booking page
  if (ctx.booking) {
    if (/\b(continue|aage|next step|review|proceed)\b/.test(t)) return { ...base, intent: "continue" };
    if (/\binsurance\b/.test(t)) return { ...base, intent: "set_option", insurance: !/\b(no|nahi|nahin|mat|don'?t|without)\b/.test(t) };
    // "Asha ko add karo" (name first) or "add Asha and Ravi" (verb first)
    const before = t.match(/^(.+?)\s+(?:ko\s+)?(?:bhi\s+)?(?:add|jodo|daalo|dalo)\b/);
    const after = t.match(/\b(?:add|jodo|daalo|dalo)\s+(?!karo\b|kar\b|do\b)(.+)/);
    const add = before && !/^(please|plz)$/.test(before[1]) ? before : after;
    if (add) {
      const names = add[1].split(/\band\b|\baur\b|,/).map((s) => s.replace(/\b(passenger|passengers|ko|bhi|please)\b/g, "").trim()).filter(Boolean);
      const saved = ctx.booking.saved;
      const passengers = names.map((n) => ({ name: saved.find((s) => s.toLowerCase().includes(n)) ?? n }));
      if (passengers.length) return { ...base, intent: "add_passengers", passengers };
    }
  }

  // results page
  if (ctx.search) {
    if (/\b(next day|agle din|kal ka|ek din baad)\b/.test(t)) return { ...base, intent: "change_date", date: addDays(ctx.search.date, 1) };
    if (/\b(previous day|pichle din|ek din pehle)\b/.test(t)) return { ...base, intent: "change_date", date: addDays(ctx.search.date, -1) };
    if (/\b(connecting|connection|change wali|badal)\b/.test(t)) return { ...base, intent: "show_tab", tab: "connections" };
    if (/\b(nearby|paas ke|aas paas)\b/.test(t)) return { ...base, intent: "show_tab", tab: "nearby" };
    if (/\b(only (available|confirmed)|confirmed seats?|sirf confirm)\b/.test(t)) return { ...base, intent: "filter", only_available: true };
    const opt = t.match(/\boption\s*(\d)\b/);
    if (opt) return { ...base, intent: "select_option", option_index: Number(opt[1]) };
    const ref = t.match(/\b(first|pehli|pehla|second|doosri|dusri|third|teesri|cheapest|sasta|sasti|fastest|earliest|rajdhani|shatabdi|duronto|\d{5})\b/);
    if (/\b(book|select|le lo|chahiye)\b/.test(t) && ref) return { ...base, intent: "book", train: ref[1], cls, quota };
    if (/\b(cheapest|sasta|sasti|lowest fare|kam paise)\b/.test(t)) return { ...base, intent: "sort", sort: "fare" };
    if (/\b(fastest|jaldi|sabse fast|kam time|shortest)\b/.test(t)) return { ...base, intent: "sort", sort: "duration" };
    if (/\b(earliest|sabse pehle|departure)\b/.test(t)) return { ...base, intent: "sort", sort: "departure" };
    if (date && !/\b(from|se|to)\b/.test(t)) return { ...base, intent: "change_date", date };
  }

  // search: "from X to Y", "X se Y", "X to Y"
  const m =
    t.match(/\bfrom (.+?) to (.+)$/) ?? t.match(/^(.+?) se (.+)$/) ?? t.match(/^(.+?) to (.+)$/);
  if (m) {
    // drop leading command words and dates: "mujhe kal dadar west se ..." -> "dadar west"
    const lead = /^.*\b(?:trains?|ticket|tickets|book|show|find|search|mujhe|muje|hume|humein|dikhao)\b\s*/;
    const from = clean(m[1].replace(lead, "").replace(/\b(?:kal|aaj|parso|tomorrow|today)\b\s*/g, ""));
    const to = clean(m[2]);
    if (from && to) return { ...base, intent: "search", from, to, date, cls, quota };
  }
  const onlyTo = t.match(/\b(?:to|for) (.+)$/) ?? t.match(/^(.+?) (?:ke liye|jaana|jana)\b/);
  if (onlyTo && ctx.search) return { ...base, intent: "search", from: ctx.search.fromName, to: clean(onlyTo[1]), date, cls, quota };
  if (date && ctx.search) return { ...base, intent: "change_date", date };
  return base;
}

const FAST_INTENTS = new Set<VoiceIntent["intent"]>([
  "navigate", "change_date", "continue", "pay", "set_option", "help", "sort", "filter", "show_tab", "select_option",
]);

/**
 * Short, unambiguous commands ("agle din", "aage badho", "meri bookings dikhao", "payment kar do") are answered
 * by the rule parser directly: instant, no API quota used. Anything longer or richer goes to the language model.
 */
export function fastIntent(input: string, ctx: VoiceContext, today: string): VoiceIntent | null {
  if (input.trim().split(/\s+/).length > 6) return null;
  const i = ruleIntent(input, ctx, today);
  if (FAST_INTENTS.has(i.intent)) return i;
  if (i.intent === "unknown" && i.reply) return i; // e.g. refusing to pay
  return null;
}

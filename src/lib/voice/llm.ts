import "server-only";
import { intentSchema, type VoiceContext, type VoiceIntent } from "./types";
import { addDays, formatDate } from "../dates";

const TIMEOUT_MS = 9000;

function systemPrompt(today: string) {
  const days = Array.from({ length: 8 }, (_, i) => `${addDays(today, i)} ${formatDate(addDays(today, i), { weekday: "long" })}`).join(", ");
  return `You are the voice assistant of RailNexus, an Indian train ticket booking website.
Users speak English, Hindi or Hinglish (Hindi may arrive in Devanagari or Roman script). Convert ONE utterance into a JSON intent.
The text comes from speech recognition and may contain mistakes: misheard words, merged/split words, or names spelled by sound
(the speaker may have an accent or a nasal voice). When several possible hearings are given, use the one that makes sense for
train booking. Correct misheard place names to the closest real Indian railway station or city ("poona"->"Pune", "lucknau"->"Lucknow").

Dates: today is ${today}. Next days: ${days}. "kal"=tomorrow, "parso"=day after tomorrow, "aaj"=today, "agle <day>"/"next <day>"=that weekday in the coming week. Output YYYY-MM-DD.
Classes (cls): 1A=first AC, 2A=2 tier AC/second AC, 3A=3 tier/third AC/3AC, SL=sleeper, CC=chair car, EC=executive chair car, 2S=second sitting/general seat.
Quota: TQ=tatkal, LD=ladies, SS=senior citizen/lower berth, GN=general (default; only set if user says one).
Places: write place names in English as railway users know them (e.g. "दिल्ली"->"Delhi", "Bombay"->"Mumbai", "Dadar west"->"Dadar West"). Keep station names the user gave; do not invent codes.

Intents:
- search: find trains (from, to, date, optional cls/quota). If the user only gives a destination and the page already has a search, reuse its "from".
- book: book a specific train from the visible list. Set train to its number from context.trains (resolve "first", "cheapest", "fastest", "earliest", "Rajdhani", etc. using the list) and cls if said.
- change_date: same search on another date ("next day", "agle din", "Friday ko").
- sort: by departure|arrival|duration|fare ("sabse sasta"=fare, "sabse fast"=duration).
- filter: only_available=true for "only confirmed seats".
- show_tab: direct|connections|nearby ("change wali trains"=connections, "paas ke stations"=nearby).
- select_option: open the Nth connecting journey (option_index starts at 1).
- add_passengers: on the passenger page; passengers=[{name, age, gender}] (gender M/F/T if known). Saved passengers are in context.booking.saved; use their exact names when the user refers to them.
- remove_passenger: passengers=[{name}].
- set_option: insurance / auto_upgrade / confirm_only booleans.
- continue: go to the review step ("aage badho", "review", "continue").
- navigate: page = home|bookings|trains|stations|login|register|train_route|station|back. train_route needs train (number); station needs station (name).
- help: user asks what they can say.
- unknown: anything else, including payment requests. You can never pay or enter card/UPI details; say the user must press Pay themselves.

"reply": one short sentence confirming what you are doing, in the user's language style (Hinglish in Roman script if they used Hindi/Hinglish). Use null for fields that don't apply.`;
}

function userMessage(text: string, ctx: VoiceContext, alternatives: string[] = []) {
  const alts = alternatives.filter((a) => a && a !== text);
  return `Context: ${JSON.stringify(ctx)}\nUser said: ${text}${alts.length ? `\nOther possible hearings: ${alts.join(" | ")}` : ""}`;
}

// Gemini structured-output schema (OpenAPI subset). Mirrors intentSchema.
const S = (type: string, extra: object = {}) => ({ type, nullable: true, ...extra });
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: intentSchema.shape.intent.options },
    from: S("STRING"), to: S("STRING"), date: S("STRING"),
    cls: S("STRING", { enum: ["1A", "2A", "3A", "SL", "CC", "EC", "2S"] }),
    quota: S("STRING", { enum: ["GN", "TQ", "LD", "SS"] }),
    train: S("STRING"),
    page: S("STRING", { enum: ["home", "bookings", "trains", "stations", "login", "register", "train_route", "station", "back"] }),
    station: S("STRING"),
    sort: S("STRING", { enum: ["departure", "arrival", "duration", "fare"] }),
    only_available: S("BOOLEAN"),
    tab: S("STRING", { enum: ["direct", "connections", "nearby"] }),
    option_index: S("INTEGER"),
    passengers: S("ARRAY", {
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, age: S("INTEGER"), gender: S("STRING", { enum: ["M", "F", "T"] }) },
        required: ["name"],
      },
    }),
    insurance: S("BOOLEAN"), auto_upgrade: S("BOOLEAN"), confirm_only: S("BOOLEAN"),
    reply: { type: "STRING" },
  },
  required: [] as string[],
};
// Gemini skips optional fields; requiring every one (nullable) makes it fill or explicitly null each.
GEMINI_SCHEMA.required = Object.keys(GEMINI_SCHEMA.properties);

async function withTimeout(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function parseIntent(raw: string): VoiceIntent {
  const json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  return intentSchema.parse(json);
}

async function gemini(text: string, ctx: VoiceContext, today: string, alts: string[]): Promise<VoiceIntent> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const res = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(today) }] },
      contents: [{ role: "user", parts: [{ text: userMessage(text, ctx, alts) }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!out) throw new Error("gemini: empty response");
  return parseIntent(out);
}

async function groq(text: string, ctx: VoiceContext, today: string, alts: string[]): Promise<VoiceIntent> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no GROQ_API_KEY");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const res = await withTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemPrompt(today)}\nRespond with a single JSON object with keys: ${Object.keys(GEMINI_SCHEMA.properties).join(", ")}.`,
        },
        { role: "user", content: userMessage(text, ctx, alts) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return parseIntent(data?.choices?.[0]?.message?.content ?? "");
}

/** Try each configured provider in order; returns null if none is configured or all fail. */
export async function llmIntent(text: string, ctx: VoiceContext, today: string, alts: string[] = []) {
  for (const [name, fn] of [["gemini", gemini], ["groq", groq]] as const) {
    try {
      return { intent: await fn(text, ctx, today, alts), source: name };
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.startsWith("no ")) console.warn(`[voice] ${name} failed: ${msg}`);
    }
  }
  return null;
}

export function hasLlm() {
  return !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

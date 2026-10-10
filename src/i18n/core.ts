// Client-safe translation core. English is the source of truth; Hindi must define every key
// (hi.ts is typed against en.ts, so a missing translation fails the build).
import { en } from "./en";
import { hi } from "./hi";

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "lang";
export const isLocale = (v: unknown): v is Locale => v === "en" || v === "hi";
/** BCP 47 tags for Intl date/number formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-IN", hi: "hi-IN" };

export type MessageKey = keyof typeof en;
/** Values may themselves be message descriptors (objects), which are translated before being filled in. */
export type Vars = Record<string, string | number | { k: MessageKey; v?: Vars }>;
/** A translatable message produced by server code: a key, optionally with values to fill in. */
export type Msg = MessageKey | { k: MessageKey; v?: Vars };

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, hi };

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const s = dictionaries[locale][key] ?? en[key] ?? key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name) => {
    if (!(name in vars)) return m;
    const v = vars[name];
    return typeof v === "object" ? translate(locale, v.k, v.v) : String(v);
  });
}

export function makeT(locale: Locale) {
  const t = (key: MessageKey, vars?: Vars) => translate(locale, key, vars);
  /** Translate a message descriptor returned by server code. */
  t.msg = (m: Msg) => (typeof m === "string" ? translate(locale, m) : translate(locale, m.k, m.v));
  /** Pick a key by count: `${base}.one` when n === 1, else `${base}.other`. */
  t.n = (base: string, n: number, vars?: Vars) =>
    translate(locale, `${base}.${n === 1 ? "one" : "other"}` as MessageKey, { n, ...vars });
  /** Translate a string if it is a message key (e.g. a zod error message), otherwise return it unchanged. */
  t.maybe = (s: string) => (s in en ? translate(locale, s as MessageKey) : s);
  t.locale = locale;
  return t;
}
export type T = ReturnType<typeof makeT>;

/** Helper for server code: build a message descriptor. */
export const msg = (k: MessageKey, v?: Vars): Msg => (v ? { k, v } : k);

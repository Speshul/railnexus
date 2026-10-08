// Shared (client-safe) types for the voice assistant.
import { z } from "zod";

/** What the page tells the assistant about itself, so commands like "the cheaper one" can be resolved. */
export type VoiceContext = {
  path: string;
  loggedIn: boolean;
  search?: { from: string; to: string; fromName: string; toName: string; date: string; quota: string; cls?: string; nearby: boolean };
  /** compact list of visible trains: one string per train keeps the prompt small */
  trains?: { n: string; name: string; from: string; to: string; dep: string; arr: string; dur: number; date: string; classes: string }[];
  connections?: number;
  nearbyOptions?: number;
  booking?: { train: string; cls: string; saved: string[]; passengers: string[]; insuranceChosen: boolean };
};

export const CLASS_CODES = ["1A", "2A", "3A", "SL", "CC", "EC", "2S"] as const;
export const QUOTA_CODES = ["GN", "TQ", "LD", "SS"] as const;
export const PAGES = ["home", "bookings", "trains", "stations", "login", "register", "train_route", "station", "back"] as const;

/** Structured intent the language model (or the rule parser) extracts from one utterance. */
export const intentSchema = z.object({
  intent: z.enum([
    "search", "book", "change_date", "sort", "filter", "show_tab", "select_option",
    "add_passengers", "remove_passenger", "set_option", "continue", "navigate", "help", "unknown",
  ]),
  from: z.string().nullish(),
  to: z.string().nullish(),
  date: z.string().nullish(),
  cls: z.enum(CLASS_CODES).nullish(),
  quota: z.enum(QUOTA_CODES).nullish(),
  train: z.string().nullish(),
  page: z.enum(PAGES).nullish(),
  station: z.string().nullish(),
  sort: z.enum(["departure", "arrival", "duration", "fare"]).nullish(),
  only_available: z.boolean().nullish(),
  tab: z.enum(["direct", "connections", "nearby"]).nullish(),
  option_index: z.number().int().nullish(),
  passengers: z
    .array(z.object({ name: z.string(), age: z.number().int().nullish(), gender: z.enum(["M", "F", "T"]).nullish() }))
    .nullish(),
  insurance: z.boolean().nullish(),
  auto_upgrade: z.boolean().nullish(),
  confirm_only: z.boolean().nullish(),
  reply: z.string().default(""),
});
export type VoiceIntent = z.infer<typeof intentSchema>;

export type VoicePassenger = { name: string; age?: number | null; gender?: "M" | "F" | "T" | null };

/** Actions the browser executes. Deliberately small: there is no action that can pay. */
export type VoiceAction =
  | { type: "navigate"; href: string }
  | { type: "sort"; by: "dep" | "arr" | "dur" | "fare" }
  | { type: "filter"; onlyAvailable: boolean }
  | { type: "tab"; tab: "direct" | "connect" | "nearby" }
  | { type: "select_option"; index: number }
  | { type: "add_passengers"; passengers: VoicePassenger[] }
  | { type: "remove_passenger"; name: string }
  | { type: "set_options"; insurance?: boolean; autoUpgrade?: boolean; confirmOnly?: boolean }
  | { type: "continue" };

export type VoiceResponse = { reply: string; actions: VoiceAction[]; source: "gemini" | "groq" | "rules"; heard?: string };

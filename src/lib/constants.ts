// Client-safe constants shared by server and UI.

export const APP_NAME = "Safarnama";

export type ClassCode = "1A" | "2A" | "3A" | "SL" | "CC" | "EC" | "2S" | "UR";

export const CLASSES: Record<
  ClassCode,
  { name: string; short: string; ac: boolean; coachPrefix: string; coachCap: number; berth: "sleeper" | "seat"; rac: boolean }
> = {
  "1A": { name: "AC First Class", short: "1A", ac: true, coachPrefix: "H", coachCap: 24, berth: "sleeper", rac: false },
  "2A": { name: "AC 2 Tier", short: "2A", ac: true, coachPrefix: "A", coachCap: 48, berth: "sleeper", rac: true },
  "3A": { name: "AC 3 Tier", short: "3A", ac: true, coachPrefix: "B", coachCap: 72, berth: "sleeper", rac: true },
  SL: { name: "Sleeper", short: "SL", ac: false, coachPrefix: "S", coachCap: 72, berth: "sleeper", rac: true },
  EC: { name: "AC Executive Chair Car", short: "EC", ac: true, coachPrefix: "E", coachCap: 56, berth: "seat", rac: false },
  CC: { name: "AC Chair Car", short: "CC", ac: true, coachPrefix: "C", coachCap: 78, berth: "seat", rac: false },
  "2S": { name: "Second Sitting", short: "2S", ac: false, coachPrefix: "D", coachCap: 108, berth: "seat", rac: false },
  UR: { name: "Unreserved", short: "UR", ac: false, coachPrefix: "GS", coachCap: 0, berth: "seat", rac: false },
};

export const CLASS_ORDER: ClassCode[] = ["1A", "EC", "2A", "3A", "CC", "SL", "2S", "UR"];

export type Quota = "GN" | "TQ" | "LD" | "SS";
export const QUOTAS: Record<Quota, { name: string; help: string }> = {
  GN: { name: "General", help: "Standard booking, opens 60 days before the journey." },
  TQ: { name: "Tatkal", help: "Last-minute quota. Opens one day before the journey; higher fare, max 4 passengers." },
  LD: { name: "Ladies", help: "Reserved for women travelling alone or with a child under 12." },
  SS: { name: "Lower Berth / Sr. Citizen", help: "Lower berths for passengers aged 45+ (women) or 60+ (men), max 2 passengers." },
};

export const BOOKING_WINDOW_DAYS = 60;
export const MAX_PASSENGERS: Record<Quota, number> = { GN: 6, TQ: 4, LD: 6, SS: 2 };
export const HOLD_MINUTES = 15;

export const SLEEPER_BERTHS = { LB: "Lower", MB: "Middle", UB: "Upper", SL: "Side Lower", SU: "Side Upper" } as const;
export const SEAT_PREFS = { WS: "Window", AS: "Aisle", MS: "Middle" } as const;
export const FOOD_PREFS = { VEG: "Veg", NONVEG: "Non-Veg", JAIN: "Jain", NONE: "No Food" } as const;

// Premium trains: catering included and dynamic-ish fares.
export const PREMIUM_TYPES = new Set(["Raj", "Shtb", "Drnt"]);
export const SUPERFAST_TYPES = new Set(["SF", "Raj", "Shtb", "JShtb", "Drnt", "GR"]);

export const TRAIN_TYPE_FILTERS: { key: string; label: string; types: string[] }[] = [
  { key: "premium", label: "Rajdhani / Shatabdi / Duronto", types: ["Raj", "Shtb", "Drnt"] },
  { key: "sf", label: "Superfast", types: ["SF", "JShtb", "GR"] },
  { key: "exp", label: "Express / Mail", types: ["Exp", "Mail", ""] },
  { key: "pass", label: "Passenger", types: ["Pass", "Toy"] },
  { key: "sub", label: "Suburban / MEMU (unreserved)", types: ["MEMU", "DEMU", "Hyd", "SKr", "Del", "Klkt"] },
];

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

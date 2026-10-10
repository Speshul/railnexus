// Client-safe formatting helpers.
import type { MessageKey, T } from "@/i18n/core";

export const inr = (n: number, decimals = false) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(n);

export function availTone(status: string) {
  switch (status) {
    case "AVAILABLE": return "text-ok";
    case "RAC": return "text-warn";
    case "WL": return "text-bad";
    default: return "text-slate-500";
  }
}

/** Plain-language availability, e.g. "92 seats available" instead of "AVL 92". */
export function availText(a: { status: string; count: number; label: string }, t: T) {
  switch (a.status) {
    case "AVAILABLE": return t.n("avail.seats", a.count);
    case "RAC": return t("avail.rac", { n: a.count });
    case "WL": return t("avail.wl", { n: a.count });
    case "REGRET": return t("avail.regret");
    case "DEPARTED": return t("avail.departed");
    case "NOT_OPEN": return t("avail.notOpen");
    case "UNRESERVED": return t("avail.unreserved");
    case "NA": return t("avail.na");
    default: return a.label;
  }
}

export function runDaysLabel(mask: number, t: T) {
  if (mask === 127) return t("days.daily");
  return [0, 1, 2, 3, 4, 5, 6].filter((i) => mask & (1 << i)).map((i) => t(`day.${i}` as MessageKey)).join(", ");
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Colour for a passenger status like "CNF/B3/34/LB", "RAC 12", "GNWL 40" or "CAN". */
export function statusTone(s: string | null) {
  if (!s) return "text-slate-500";
  if (s.startsWith("CNF")) return "text-ok";
  if (s.startsWith("RAC")) return "text-warn";
  if (s === "CAN") return "text-slate-400 line-through";
  if (s.includes("WL")) return "text-bad";
  return "text-slate-600";
}

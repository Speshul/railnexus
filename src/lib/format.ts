// Client-safe formatting helpers.
import { DAY_NAMES } from "./constants";

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
export function availText(a: { status: string; count: number; label: string }) {
  switch (a.status) {
    case "AVAILABLE": return `${a.count} ${a.count === 1 ? "seat" : "seats"} available`;
    case "RAC": return `RAC ${a.count}`;
    case "WL": return `Waitlist #${a.count}`;
    case "REGRET": return "Sold out";
    default: return a.label;
  }
}

export function runDaysLabel(mask: number) {
  if (mask === 127) return "Daily";
  return DAY_NAMES.filter((_, i) => mask & (1 << i)).join(", ");
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

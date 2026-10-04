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

export function runDaysLabel(mask: number) {
  if (mask === 127) return "Daily";
  return DAY_NAMES.filter((_, i) => mask & (1 << i)).join(", ");
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

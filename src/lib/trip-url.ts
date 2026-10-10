// Client-safe helpers for the /book URL. A connecting journey books several trains in one checkout:
//   /book?legs=12951.BCT.NDLS.2026-10-12.3A~12002.NDLS.BPL.2026-10-13.CC&quota=GN
import type { ClassCode } from "./constants";

export type LegRef = { train: string; from: string; to: string; date: string; cls: ClassCode };

export const encodeLegs = (legs: LegRef[]) => legs.map((l) => [l.train, l.from, l.to, l.date, l.cls].join(".")).join("~");

export function decodeLegs(v: string): LegRef[] {
  return v
    .split("~")
    .slice(0, 2)
    .map((part) => {
      const [train, from, to, date, cls] = part.split(".");
      return { train, from: (from ?? "").toUpperCase(), to: (to ?? "").toUpperCase(), date, cls: cls as ClassCode };
    });
}

export const bookHref = (legs: LegRef[], quota: string) =>
  legs.length === 1
    ? `/book?${new URLSearchParams({ train: legs[0].train, from: legs[0].from, to: legs[0].to, date: legs[0].date, cls: legs[0].cls, quota })}`
    : `/book?${new URLSearchParams({ legs: encodeLegs(legs), quota })}`;

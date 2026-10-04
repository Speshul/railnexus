// Date helpers. All dates are plain "YYYY-MM-DD" strings interpreted in IST,
// so weekday math never depends on the server's or browser's timezone.

const IST = "Asia/Kolkata";

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date()
  );
}

/** Minutes since midnight, IST, right now. */
export function nowMinutesIST(): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

const toUTC = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

export function isValidDate(d: string | undefined | null): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = toUTC(d);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
}

export function addDays(d: string, n: number): string {
  return new Date(toUTC(d) + n * 86400000).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86400000);
}

export function weekday(d: string): number {
  return new Date(toUTC(d)).getUTCDay();
}

export function formatDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(toUTC(d)));
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** "HH:MM" for an absolute minute offset. */
export function clock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

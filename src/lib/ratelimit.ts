import "server-only";

// Tiny in-memory sliding-window limiter (per server process). Protects the free AI/speech quotas.
const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

export function rateLimited(key: string, perMinute: number) {
  const now = Date.now();
  // Drop idle keys now and then so the map doesn't grow forever.
  if (now - lastSweep > 60000) {
    for (const [k, hits] of buckets) if (!hits.some((t) => now - t < 60000)) buckets.delete(k);
    lastSweep = now;
  }
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < 60000);
  if (recent.length >= perMinute) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  return false;
}

export const clientKey = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

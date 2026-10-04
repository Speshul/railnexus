"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";

export function HoldTimer({ expiresAt }: { expiresAt: number }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : Math.max(0, expiresAt - now);
  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);
  if (left === null) return <div className="mb-4 h-11" />;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${m < 3 ? "border-red-200 bg-red-50 text-bad" : "border-amber-200 bg-amber-50 text-warn"}`}>
      <Timer className="size-4" />
      Seats held for <b className="tabular-nums">{m}:{String(s).padStart(2, "0")}</b>. Complete payment before the timer ends.
    </div>
  );
}

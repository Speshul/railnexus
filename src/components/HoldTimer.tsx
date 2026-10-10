"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { useT } from "@/i18n/client";

export function HoldTimer({ expiresAt }: { expiresAt: number }) {
  const router = useRouter();
  const t = useT();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
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
      <Timer className="size-4" aria-hidden />
      <span role="timer">{t("hold.text", { time: `${m}:${String(s).padStart(2, "0")}` })}</span>
    </div>
  );
}

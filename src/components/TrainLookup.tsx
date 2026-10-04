"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type T = { number: string; name: string; from: string; to: string; type: string };

export function TrainLookup({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/trains?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then(setResults)
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const show = open && q.trim().length >= 2 && results.length > 0;
  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        if (results[0]) router.push(`/train/${results[0].number}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        className="input pl-9"
        placeholder="Train number or name, e.g. 12951 or Rajdhani"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {show && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {results.map((t) => (
            <li key={t.number}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); router.push(`/train/${t.number}`); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-light"
              >
                <span className="font-mono font-semibold">{t.number}</span> <span className="font-medium">{t.name}</span>
                <span className="block text-xs text-slate-500">{t.from} → {t.to} · {t.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

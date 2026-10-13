"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useT } from "@/i18n/client";

export type StationOption = { code: string; name: string; state?: string | null; trains?: number };

export function StationInput({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: StationOption | null;
  onChange: (s: StationOption | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const t = useT();
  const [text, setText] = useState(value ? `${value.name} (${value.code})` : "");
  const [options, setOptions] = useState<StationOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [prevValue, setPrevValue] = useState(value);
  const abort = useRef<AbortController | null>(null);

  // Keep the text in sync when the parent changes the value (e.g. swap button).
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value ? `${value.name} (${value.code})` : "");
  }

  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 2 || (value && text === `${value.name} (${value.code})`)) return;
    const t = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const res = await fetch(`/api/stations?q=${encodeURIComponent(q)}`, { signal: abort.current.signal });
        setOptions(await res.json());
        setActive(0);
      } catch {
        /* aborted */
      }
    }, 150);
    return () => clearTimeout(t);
  }, [text, open, value]);

  const choose = (s: StationOption) => {
    onChange(s);
    setText(`${s.name} (${s.code})`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          className="input pl-9"
          value={text}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={placeholder ?? t("station.placeholder")}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && options.length && text.trim().length >= 2 ? `${id}-opt-${active}` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !options.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); choose(options[active]); }
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
      {open && options.length > 0 && text.trim().length >= 2 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((s, i) => (
            <li
              key={s.code}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${i === active ? "bg-brand-light" : ""}`}
            >
              <span>
                <span className="font-medium">{s.name}</span>
                {s.state && <span className="ml-1 text-sm text-slate-500">{s.state}</span>}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-sign text-[1.1rem] font-semibold text-slate-700">{s.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

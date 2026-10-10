"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Accessibility, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { A11Y_PREFS, defaultPrefs, readPrefs, savePrefs, type A11yKey, type A11yPrefs } from "@/lib/a11y";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";

/** Header button opening display settings: text size, contrast, readable font, reduced motion. */
export function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(defaultPrefs);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const t = useT();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("input:checked")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const change = (k: A11yKey, v: string) => {
    const next = { ...prefs, [k]: v } as A11yPrefs;
    setPrefs(next);
    savePrefs(next);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => {
          // Saved settings were applied before paint by the inline script; mirror them in the controls.
          if (!open) setPrefs(readPrefs());
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-1.5 rounded-md border border-white/30 px-2.5 py-1 hover:bg-white/10"
      >
        <Accessibility className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t("a11y.button")}</span>
        <span className="sr-only sm:hidden">{t("a11y.buttonSr")}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={t("a11y.dialog")}
          className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t("a11y.title")}</h2>
            <button onClick={() => { setOpen(false); buttonRef.current?.focus(); }} aria-label={t("a11y.close")} className="rounded p-1 hover:bg-slate-100">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="space-y-3">
            {(Object.keys(A11Y_PREFS) as A11yKey[]).map((k) => (
              <fieldset key={k}>
                <legend className="label">{t(`a11y.${k}` as MessageKey)}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(A11Y_PREFS[k].options).map((v) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name={`a11y-${k}`} value={v} checked={prefs[k] === v} onChange={() => change(k, v)} className="peer sr-only" />
                      <span className="block rounded-md border border-slate-300 px-2.5 py-1 text-sm peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1">
                        {t(`a11y.${k}.${v}` as MessageKey)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <button onClick={() => { const d = defaultPrefs(); setPrefs(d); savePrefs(d); }} className="inline-flex items-center gap-1 text-brand hover:underline">
              <RotateCcw className="size-3.5" aria-hidden /> {t("a11y.reset")}
            </button>
            <Link href="/accessibility" onClick={() => setOpen(false)} className="text-brand hover:underline">{t("a11y.about")}</Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import { useLocale } from "@/i18n/client";

/**
 * First-visit dialog (like IRCTC's): pick English or Hindi. Shown until a choice is saved in the cookie.
 * Bilingual on purpose, since we don't know the visitor's language yet.
 */
export function LanguageChooser() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => firstRef.current?.focus(), []);
  const choose = (l: "en" | "hi") =>
    start(async () => {
      await setLocale(l);
      router.refresh();
    });
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 print:hidden">
      <div role="dialog" aria-modal="true" aria-labelledby="lang-title" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <Languages className="mx-auto mb-2 size-10 text-brand" aria-hidden />
        <h2 id="lang-title" className="text-lg font-bold">
          Choose your language <span lang="hi" className="block text-base font-semibold">अपनी भाषा चुनें</span>
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button ref={firstRef} onClick={() => choose("en")} disabled={pending} className="btn-brand py-3 text-base">English</button>
          <button onClick={() => choose("hi")} disabled={pending} lang="hi" className="btn-brand py-3 text-base">हिंदी</button>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          You can change this any time from the header. <span lang="hi">आप इसे कभी भी ऊपर से बदल सकते हैं।</span>
        </p>
      </div>
    </div>
  );
}

/** Header toggle: shows the other language's name and switches to it. */
export function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale();
  const [pending, start] = useTransition();
  const other = locale === "hi" ? "en" : "hi";
  return (
    <button
      onClick={() => start(async () => { await setLocale(other); router.refresh(); })}
      disabled={pending}
      lang={other}
      aria-label={other === "hi" ? "हिंदी में देखें (switch to Hindi)" : "View in English (अंग्रेज़ी में देखें)"}
      className="rounded-md border border-white/30 px-2.5 py-1 hover:bg-white/10 disabled:opacity-60"
    >
      {other === "hi" ? "हिंदी" : "English"}
    </button>
  );
}

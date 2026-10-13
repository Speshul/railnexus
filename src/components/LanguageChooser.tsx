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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-dark/75 p-4 print:hidden">
      {/* A bilingual station board: both languages lettered side by side, as on every Indian platform. */}
      <div role="dialog" aria-modal="true" aria-labelledby="lang-title" className="settle w-full max-w-2xl overflow-hidden rounded-md bg-brand text-center text-white ring-4 ring-accent">
        <div className="px-10 pb-8 pt-9">
          <Languages className="mx-auto mb-3 size-10 text-accent" aria-hidden />
          <h2 id="lang-title" className="font-sign text-[3rem] uppercase leading-[0.9] tracking-[0.03em]">
            Choose your language <span lang="hi" className="mt-2 block text-[2.4rem] normal-case tracking-normal text-accent">अपनी भाषा चुनें</span>
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <button ref={firstRef} onClick={() => choose("en")} disabled={pending} className="btn bg-accent py-5 font-sign text-[2.4rem] uppercase leading-none tracking-[0.05em] text-ink hover:bg-accent-dark">English</button>
            <button onClick={() => choose("hi")} disabled={pending} lang="hi" className="btn bg-accent py-5 font-sign text-[2.4rem] leading-none text-ink hover:bg-accent-dark">हिंदी</button>
          </div>
        </div>
        <p className="bg-brand-dark px-6 py-3 text-[0.9rem] text-white/85">
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
      className="rounded-md px-3 py-1.5 font-semibold ring-2 ring-inset ring-accent/70 hover:bg-white/10 disabled:opacity-60"
    >
      {other === "hi" ? "हिंदी" : "English"}
    </button>
  );
}

import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Geist_Mono, Mukta, Teko } from "next/font/google";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/constants";
import { A11Y_INLINE_SCRIPT } from "@/lib/a11y";
import { VoiceBridgeProvider } from "@/components/voice/VoiceBridge";
import { VoiceAssistant } from "@/components/voice/VoiceAssistant";
import { AccessibilityMenu } from "@/components/AccessibilityMenu";
import { NavLinks } from "@/components/NavLinks";
import { LanguageChooser, LanguageToggle } from "@/components/LanguageChooser";
import { LocaleProvider } from "@/i18n/client";
import { getChosenLocale, getT } from "@/i18n/server";
import "./globals.css";

// Both faces by the Indian Type Foundry, drawn for Latin and Devanagari together, so Hindi is never a fallback.
// Teko: condensed sign lettering for names, numbers, times and labels. Mukta: reading and interface text.
const teko = Teko({ variable: "--font-teko", subsets: ["latin", "devanagari"], weight: ["400", "500", "600"] });
const mukta = Mukta({ variable: "--font-mukta", subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Designed by the Braille Institute for low-vision readers; used by the "Easy to read" font setting.
const readable = Atkinson_Hyperlegible({ variable: "--font-readable", subsets: ["latin"], weight: ["400", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { default: `${APP_NAME} · ${t("meta.title")}`, template: `%s · ${APP_NAME}` }, description: t("meta.description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  const chosen = await getChosenLocale();
  const locale = chosen ?? "en";
  const t = await getT();
  return (
    <html
      lang={locale}
      className={`${teko.variable} ${mukta.variable} ${geistMono.variable} ${readable.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply saved display settings before the first paint, so they never flash in after load. */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_INLINE_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only z-[60] rounded-md bg-accent px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {t("layout.skip")}
        </a>
        <LocaleProvider locale={locale}>
        {!chosen && <LanguageChooser />}
        <VoiceBridgeProvider>
          <header className="bg-brand-dark text-white print:hidden">
            <div className="mx-auto flex max-w-7xl items-center gap-x-8 px-6 py-3">
              {/* The wordmark, lettered like a station plate: English and Devanagari share the board. */}
              <Link href="/" className="flex shrink-0 items-baseline gap-2.5 text-accent">
                <span className="font-sign text-[2.1rem] uppercase leading-none tracking-[0.06em]">{APP_NAME}</span>
                <span className="font-sign text-[1.5rem] leading-none" lang="hi">सफ़रनामा</span>
                <span className="sr-only">{t("layout.home")}</span>
              </Link>
              <NavLinks loggedIn={!!user} />
              <div className="ml-auto flex shrink-0 items-center gap-3 text-[0.9rem]">
                <LanguageToggle />
                <AccessibilityMenu />
                {user ? (
                  <>
                    <span className="text-white/85">{t("layout.hi", { name: user.full_name.split(" ")[0] })}</span>
                    <form action={logout}>
                      <button className="rounded-md px-3 py-1.5 ring-2 ring-inset ring-white/40 hover:bg-white/10">{t("layout.logout")}</button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="rounded-md px-3 py-1.5 ring-2 ring-inset ring-white/40 hover:bg-white/10">{t("layout.login")}</Link>
                    <Link href="/register" className="rounded-md bg-accent px-3 py-1.5 font-semibold text-ink hover:bg-accent-dark">{t("layout.register")}</Link>
                  </>
                )}
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
          <footer className="mt-12 bg-brand-dark py-6 text-white/80 print:hidden">
            <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 text-[0.95rem]">
              <span className="font-sign text-[1.4rem] uppercase tracking-[0.06em] text-accent">{APP_NAME}</span>
              <p className="flex-1">{t("layout.footer", { app: APP_NAME })}</p>
              <Link href="/accessibility" className="text-white underline underline-offset-4">{t("layout.a11y")}</Link>
            </div>
          </footer>
          <VoiceAssistant loggedIn={!!user} />
        </VoiceBridgeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

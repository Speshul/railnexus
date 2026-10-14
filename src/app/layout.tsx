import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Geist_Mono, Hind, Inter, Poppins } from "next/font/google";
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
// Poppins: geometric headings, drawn for Latin and Devanagari together. Inter: highly legible body text.
// Hind (also Latin + Devanagari) supplies the Hindi letters Inter does not have, so Hindi is never a system fallback.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin", "devanagari"], weight: ["500", "600", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const hind = Hind({ variable: "--font-hind", subsets: ["latin", "devanagari"], weight: ["400", "500", "600"] });
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
      className={`${poppins.variable} ${inter.variable} ${hind.variable} ${geistMono.variable} ${readable.variable} h-full antialiased`}
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
          {/* A deep night-blue bar with softly rounded lower corners; on pages that open with a blue board it melts into it. */}
          <header className="relative z-20 rounded-b-[1.75rem] bg-gradient-to-b from-brand-dark to-[#03035a] text-white print:hidden">
            {/* Sizes scale with the window (clamp), so the bar fits on one line from a 1280px laptop to a 1920px board. */}
            <div className="mx-auto flex max-w-[86rem] items-center gap-x-[clamp(0.75rem,1.6vw,2rem)] px-[clamp(1rem,2vw,2rem)] py-5">
              <Link href="/" className="flex shrink-0 items-baseline gap-2.5 text-accent">
                <span className="font-sign text-[clamp(1.15rem,1.45vw,1.55rem)] font-bold leading-tight">{APP_NAME}</span>
                <span className="font-sign text-[clamp(0.85rem,1.05vw,1.1rem)] font-medium leading-tight text-accent/90" lang="hi">सफ़रनामा</span>
                <span className="sr-only">{t("layout.home")}</span>
              </Link>
              <NavLinks loggedIn={!!user} />
              <div className="ml-auto flex shrink-0 items-center gap-2 text-[clamp(0.7rem,0.85vw,0.85rem)]">
                <LanguageToggle />
                <AccessibilityMenu />
                {user ? (
                  <>
                    <span className="text-white/85 max-[1440px]:hidden">{t("layout.hi", { name: user.full_name.split(" ")[0] })}</span>
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
          <footer className="mt-16 rounded-t-[1.75rem] bg-brand-dark py-7 text-white/80 print:hidden">
            <div className="mx-auto flex max-w-7xl items-center gap-6 px-8 text-[0.95rem]">
              <span className="font-sign text-[1.2rem] font-bold text-accent">{APP_NAME}</span>
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

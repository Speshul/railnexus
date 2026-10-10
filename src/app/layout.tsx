import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TrainFront } from "lucide-react";
import { getUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/constants";
import { A11Y_INLINE_SCRIPT } from "@/lib/a11y";
import { VoiceBridgeProvider } from "@/components/voice/VoiceBridge";
import { VoiceAssistant } from "@/components/voice/VoiceAssistant";
import { AccessibilityMenu } from "@/components/AccessibilityMenu";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Designed by the Braille Institute for low-vision readers; used by the "Easy to read" font setting.
const readable = Atkinson_Hyperlegible({ variable: "--font-readable", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} · Train Tickets`, template: `%s · ${APP_NAME}` },
  description: "Search trains, explore routes and stops, and book Indian Railways tickets.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${readable.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply saved display settings before the first paint, so they never flash in after load. */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_INLINE_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only z-[60] rounded-md bg-accent px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        <VoiceBridgeProvider>
          <header className="bg-brand text-white print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold">
                <TrainFront className="size-6 text-accent" aria-hidden />
                {APP_NAME}
                <span className="sr-only">home</span>
              </Link>
              <NavLinks loggedIn={!!user} />
              <div className="ml-auto flex items-center gap-3 text-sm">
                <AccessibilityMenu />
                {user ? (
                  <>
                    <span className="hidden text-white/80 sm:inline">Hi, {user.full_name.split(" ")[0]}</span>
                    <form action={logout}>
                      <button className="rounded-md border border-white/30 px-3 py-1 hover:bg-white/10">Logout</button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="rounded-md border border-white/30 px-3 py-1 hover:bg-white/10">Login</Link>
                    <Link href="/register" className="rounded-md bg-accent-dark px-3 py-1 font-semibold hover:bg-accent">Register</Link>
                  </>
                )}
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-600 print:hidden">
            {APP_NAME} is a student project, not affiliated with Indian Railways or IRCTC. Train data: datameet/railways (CC0).
            Fares and seat availability are simulated. <Link href="/accessibility" className="text-brand underline">Accessibility</Link>
          </footer>
          <VoiceAssistant loggedIn={!!user} />
        </VoiceBridgeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TrainFront } from "lucide-react";
import { getUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} · Train Tickets`, template: `%s · ${APP_NAME}` },
  description: "Search trains, explore routes and stops, and book Indian Railways tickets.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="bg-brand text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <TrainFront className="size-6 text-accent" />
              {APP_NAME}
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-white/85">
              <Link href="/" className="hover:text-white">Book Tickets</Link>
              <Link href="/trains" className="hover:text-white">Trains</Link>
              <Link href="/stations" className="hover:text-white">Stations</Link>
              {user && <Link href="/account" className="hover:text-white">My Bookings</Link>}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
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
                  <Link href="/register" className="rounded-md bg-accent px-3 py-1 font-semibold hover:bg-accent-dark">Register</Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          {APP_NAME} is a student project, not affiliated with Indian Railways or IRCTC. Train data: datameet/railways (CC0).
          Fares and seat availability are simulated.
        </footer>
      </body>
    </html>
  );
}

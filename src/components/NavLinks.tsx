"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

/** Main navigation; marks the current section for screen readers (aria-current) and visually. */
export function NavLinks({ loggedIn }: { loggedIn: boolean }) {
  const path = usePathname();
  const t = useT();
  const links = [
    { href: "/", label: t("nav.book"), match: (p: string) => p === "/" || p.startsWith("/search") || p.startsWith("/book") },
    { href: "/explore", label: t("nav.explore"), match: (p: string) => p.startsWith("/explore") },
    { href: "/plan", label: t("nav.plan"), match: (p: string) => p.startsWith("/plan") },
    { href: "/trains", label: t("nav.trains"), match: (p: string) => p.startsWith("/train") },
    { href: "/stations", label: t("nav.stations"), match: (p: string) => p.startsWith("/station") },
    { href: "/pnr", label: t("nav.pnr"), match: (p: string) => p.startsWith("/pnr") },
    ...(loggedIn ? [{ href: "/wallet", label: t("nav.wallet"), match: (p: string) => p.startsWith("/wallet") }] : []),
    ...(loggedIn ? [{ href: "/account", label: t("nav.bookings"), match: (p: string) => p.startsWith("/account") || p.startsWith("/booking") || p.startsWith("/ticket") }] : []),
  ];
  return (
    <nav aria-label={t("nav.label")} className="flex flex-wrap gap-4 text-sm text-white/85">
      {links.map((l) => {
        const current = l.match(path);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}
            className={`hover:text-white ${current ? "font-semibold text-white underline decoration-accent decoration-2 underline-offset-4" : ""}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

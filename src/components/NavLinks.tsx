"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

/** Main navigation; marks the current section for screen readers (aria-current) and visually. */
export function NavLinks({ loggedIn }: { loggedIn: boolean }) {
  const path = usePathname();
  const t = useT();
  const links = [
    { href: "/", label: t("nav.book"), match: (p: string) => p === "/" || p.startsWith("/search") || p === "/book" },
    { href: "/explore", label: t("nav.explore"), match: (p: string) => p.startsWith("/explore") },
    { href: "/plan", label: t("nav.plan"), match: (p: string) => p.startsWith("/plan") },
    { href: "/trains", label: t("nav.trains"), match: (p: string) => p.startsWith("/train") },
    { href: "/stations", label: t("nav.stations"), match: (p: string) => p.startsWith("/station") },
    { href: "/pnr", label: t("nav.pnr"), match: (p: string) => p.startsWith("/pnr") },
    ...(loggedIn ? [{ href: "/wallet", label: t("nav.wallet"), match: (p: string) => p.startsWith("/wallet") }] : []),
    ...(loggedIn ? [{ href: "/account", label: t("nav.bookings"), match: (p: string) => p.startsWith("/account") || p.startsWith("/booking") || p.startsWith("/ticket") }] : []),
  ];
  return (
    <nav aria-label={t("nav.label")} className="flex items-center gap-x-6 font-sign text-[1.35rem] uppercase tracking-[0.05em] text-white/85">
      {links.map((l) => {
        const current = l.match(path);
        // The current section is lettered in yellow with a painted bar beneath, like a platform marking.
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}
            className={`relative whitespace-nowrap pb-1 pt-1.5 hover:text-white ${current ? "text-accent after:absolute after:inset-x-0 after:-bottom-[3px] after:h-[4px] after:rounded-sm after:bg-accent" : ""}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

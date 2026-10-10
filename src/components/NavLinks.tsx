"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Main navigation; marks the current section for screen readers (aria-current) and visually. */
export function NavLinks({ loggedIn }: { loggedIn: boolean }) {
  const path = usePathname();
  const links = [
    { href: "/", label: "Book Tickets", match: (p: string) => p === "/" || p.startsWith("/search") || p.startsWith("/book") },
    { href: "/trains", label: "Trains", match: (p: string) => p.startsWith("/train") },
    { href: "/stations", label: "Stations", match: (p: string) => p.startsWith("/station") },
    { href: "/pnr", label: "PNR Status", match: (p: string) => p.startsWith("/pnr") },
    ...(loggedIn ? [{ href: "/account", label: "My Bookings", match: (p: string) => p.startsWith("/account") || p.startsWith("/booking") || p.startsWith("/ticket") }] : []),
  ];
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-4 text-sm text-white/85">
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

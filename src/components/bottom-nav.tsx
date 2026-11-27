"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", d: "M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/members", label: "Members", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" },
  { href: "/members/new", label: "Add", d: "", primary: true },
  { href: "/payments", label: "Payments", d: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4" },
  { href: "/more", label: "More", d: "M4 6h16M4 12h16M4 18h16" },
];

export function BottomNav() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : href === "/members" ? path.startsWith("/members") && path !== "/members/new" : path.startsWith(href);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-bg/95 backdrop-blur pb-safe">
      <ul className="mx-auto max-w-xl grid grid-cols-5">
        {items.map((it) =>
          it.primary ? (
            <li key={it.href} className="grid place-items-center">
              <Link
                href={it.href}
                aria-label="Add member"
                className={`-mt-5 grid place-items-center size-14 rounded-2xl bg-accent text-accent-ink shadow-lg shadow-accent/20 active:scale-95 transition ${
                  path === it.href ? "ring-4 ring-accent/25" : ""
                }`}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </Link>
            </li>
          ) : (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-1 pt-2.5 pb-1.5 text-[11px] font-medium ${
                  isActive(it.href) ? "text-accent-soft" : "text-muted"
                }`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={it.d} />
                </svg>
                {it.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

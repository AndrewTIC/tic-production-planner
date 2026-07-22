"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Primary nav + section identity. The active section wears the lime pill
// (design spec §13 — the only lime in navigation), and SectionBar names the
// section on every page so nobody has to infer where they are.

const sections = [
  { href: "/", label: "Dashboard", blurb: "Today and this week at a glance" },
  { href: "/production", label: "Production", blurb: "The scheduling board — who builds what, when" },
  { href: "/builds", label: "Order Book", blurb: "Every order on the books, ready to schedule" },
  { href: "/customers", label: "Customers", blurb: "Customer register" },
  { href: "/projects", label: "Projects", blurb: "Optional grouping of orders beneath a customer" },
  { href: "/parts", label: "Build History", blurb: "Every TIC part number and what it took to build, order by order" },
  { href: "/workers", label: "Team", blurb: "The team — competencies, calendars, and logins" },
  { href: "/holidays", label: "Holidays", blurb: "Leave and closure days feeding capacity" },
  { href: "/reports", label: "Reports", blurb: "The five reports, all with CSV export" },
  { href: "/clockings", label: "Clockings", blurb: "Admin corrections and the audit view", adminOnly: true },
];

function sectionFor(pathname: string) {
  if (pathname === "/") return sections[0];
  return (
    sections
      .slice(1)
      .find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`)) ??
    null
  );
}

export function MainNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const current = sectionFor(pathname);

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {sections
        .filter((s) => !s.adminOnly || isAdmin)
        .map((s) => {
          const active = current?.href === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                active
                  ? "bg-lime-100 font-semibold text-lime-800 dark:bg-lime-800 dark:text-lime-100"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
    </nav>
  );
}

// Slim identity strip under the header: section name + one-line purpose.
export function SectionBar() {
  const pathname = usePathname();
  const current = sectionFor(pathname);
  if (!current) return null;

  return (
    <div className="border-b border-zinc-200 bg-neutral-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 md:px-6">
        <span className="text-sm font-semibold uppercase tracking-wide text-lime-800 dark:text-lime-100">
          {current.label}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {current.blurb}
        </span>
      </div>
    </div>
  );
}

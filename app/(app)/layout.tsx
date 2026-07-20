import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";

const roleStyles: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  commercial: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  workshop: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  viewer: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

// Shared chrome for every authenticated screen. Desktop-first, but the nav
// wraps rather than breaking at tablet widths.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getUserProfile();
  if (!auth) redirect("/login"); // proxy.ts already guards; belt and braces

  const { profile } = auth;

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            {/* Design spec §12/Logo Usage: 32px tall, far left, the only
                full-colour logo in the interface. Never recoloured or
                placed on lime/grey. */}
            <Image
              src="/TIC-logo.png"
              alt="TIC"
              width={34}
              height={32}
              className="h-8 w-auto"
              priority
            />
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              ESD Planner
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/production"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Production
            </Link>
            <Link
              href="/builds"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Builds
            </Link>
            <Link
              href="/customers"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Customers
            </Link>
            <Link
              href="/projects"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Projects
            </Link>
            <Link
              href="/parts"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Parts
            </Link>
            <Link
              href="/workers"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Workers
            </Link>
            <Link
              href="/holidays"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Holidays
            </Link>
            <Link
              href="/reports"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Reports
            </Link>
            {/* Corrections are admin-only (RLS enforces it; this just keeps
                the nav honest for everyone else). */}
            {profile.role === "admin" && (
              <Link
                href="/clockings"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Clockings
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {profile.display_name}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                roleStyles[profile.role] ?? roleStyles.viewer
              }`}
            >
              {profile.role}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {/* Full-bleed: the production board wants every pixel (Andrew, 17 Jul);
          narrower pages set their own max-width. */}
      <div className="px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  );
}

import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { MainNav, SectionBar } from "@/components/main-nav";

const roleStyles: Record<string, string> = {
  admin: "bg-status-review-bg text-status-review dark:bg-purple-950 dark:text-purple-300",
  commercial: "bg-status-progress-bg text-status-progress dark:bg-blue-950 dark:text-blue-300",
  workshop: "bg-status-attention-bg text-status-attention dark:bg-amber-950 dark:text-amber-300",
  viewer: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

// Shared chrome for every authenticated screen. The logo is the only
// full-colour brand mark (design spec §12); the active section carries the
// lime pill in the nav, and SectionBar names the section on every page.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getUserProfile();
  if (!auth) redirect("/login");

  const { profile } = auth;

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/TIC-logo.png"
              alt="TIC"
              width={34}
              height={32}
              className="h-8 w-auto"
              priority
            />
            <span className="hidden text-base font-semibold text-zinc-900 dark:text-zinc-50 sm:inline">
              Production Planner
            </span>
          </Link>
          <MainNav isAdmin={profile.role === "admin"} />
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
      <SectionBar />
      <div className="px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  );
}

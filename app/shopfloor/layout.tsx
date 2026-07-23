import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { KioskClock } from "./kiosk-clock";

// The kiosk deliberately sits OUTSIDE the (app) route group: no nav, no
// registers, nothing to get lost in. One shared workshop login, big targets,
// minimal typing (CLAUDE.md). Sized for the shared workshop PC now and iPads
// later — tested at 1024x768 and 1194x834.
export default async function ShopfloorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getUserProfile();
  if (!auth) redirect("/login");

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4 px-6 py-4">
          <Image
            src="/TIC-logo.png"
            alt="TIC"
            width={34}
            height={32}
            className="h-8 w-auto"
            priority
          />
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Workshop clocking
          </span>
          <KioskClock />
          {/* Way out of the kiosk — on the shared shopfloor PC this is
              ignored; anywhere else it's how an admin/user gets back. */}
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Planner
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

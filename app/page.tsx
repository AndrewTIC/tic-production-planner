import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

const roleStyles: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  commercial: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  workshop: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  viewer: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function HomePage() {
  const auth = await getUserProfile();
  if (!auth) redirect("/login"); // proxy.ts already guards; belt and braces

  // Reference data readable by every role — proves RLS reads work end to end.
  const supabase = await createClient();
  const [{ count: statusCount }, { count: phaseCount }, { count: workerCount }] =
    await Promise.all([
      supabase.from("build_statuses").select("*", { count: "exact", head: true }),
      supabase.from("phases").select("*", { count: "exact", head: true }),
      supabase.from("workers").select("*", { count: "exact", head: true }),
    ]);

  const { profile } = auth;

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            ESD Production Planner
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as <span className="font-medium">{profile.display_name}</span>{" "}
            <span
              className={`ml-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                roleStyles[profile.role] ?? roleStyles.viewer
              }`}
            >
              {profile.role}
            </span>
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Build statuses", value: statusCount },
          { label: "Phases", value: phaseCount },
          { label: "Workers", value: workerCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              {value ?? "—"}
            </p>
          </div>
        ))}
      </section>

      <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
        Phase 1 in progress — customers, projects, parts, and builds screens
        arrive next.
      </p>
    </main>
  );
}

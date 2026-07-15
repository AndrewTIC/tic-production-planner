import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  // Reference data readable by every role — proves RLS reads work end to end.
  const supabase = await createClient();
  const [
    { count: customerCount },
    { count: partCount },
    { count: statusCount },
    { count: workerCount },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("parts").select("*", { count: "exact", head: true }),
    supabase.from("build_statuses").select("*", { count: "exact", head: true }),
    supabase.from("workers").select("*", { count: "exact", head: true }),
  ]);

  const cards = [
    { label: "Customers", value: customerCount, href: "/customers" },
    { label: "Parts", value: partCount, href: "/parts" },
    { label: "Build statuses", value: statusCount },
    { label: "Workers", value: workerCount },
  ];

  return (
    <main>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Overview
      </h1>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, href }) => {
          const card = (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                {value ?? "—"}
              </p>
            </div>
          );
          return href ? (
            <Link key={label} href={href}>
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </section>

      <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
        Phase 1 in progress — projects, parts, and builds screens arrive next.
      </p>
    </main>
  );
}

import Link from "next/link";

// Reports index (spec §6.8). Five reports; the two built so far are live,
// the rest land in the next slices and are listed so the shape of the
// section is visible rather than a surprise.
const reports = [
  {
    href: "/reports/build-progress",
    title: "Build progress",
    description:
      "Estimated against actual hours by phase, percentage complete, and projected overrun.",
    ready: true,
  },
  {
    href: "/reports/materials",
    title: "Materials due and overdue",
    description:
      "Outstanding material lines across live builds, soonest first, with overdue lines flagged.",
    ready: true,
  },
  {
    href: "/reports/utilisation",
    title: "Utilisation",
    description:
      "Hours booked per worker or phase over a period, split standard / OT 1.5× / OT 2×, against hours available.",
    ready: true,
  },
  {
    href: "/reports/adherence",
    title: "Schedule adherence",
    description:
      "Builds whose scheduled completion falls after the requested delivery date.",
    ready: true,
  },
  {
    href: "/reports/customers",
    title: "Customer and project analysis",
    description: "Builds, hours, and adherence rolled up per customer and project.",
    ready: true,
  },
];

export default function ReportsPage() {
  return (
    <main className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Reports
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Every report exports to CSV for the Excel costing process, with
        overtime classified so Finance can apply the rates. Hours only — this
        system never holds a rate or a value.
      </p>

      <ul className="mt-6 space-y-3">
        {reports.map((r) => (
          <li key={r.href}>
            {r.ready ? (
              <Link
                href={r.href}
                className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-lime-600 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {r.title}
                </p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {r.description}
                </p>
              </Link>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
                <p className="font-medium text-zinc-500 dark:text-zinc-400">
                  {r.title}
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    coming next
                  </span>
                </p>
                <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                  {r.description}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

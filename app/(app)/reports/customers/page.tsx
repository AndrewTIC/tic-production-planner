import Link from "next/link";
import { customerRollup } from "../queries";

function hours(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.00$/, "");
}

export default async function CustomerAnalysisReport({
  searchParams,
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const { by } = await searchParams;
  const groupByProject = by === "project";
  const rows = await customerRollup(groupByProject);

  const totals = rows.reduce(
    (a, r) => ({
      builds: a.builds + r.builds,
      estimated: a.estimated + r.estimatedMinutes,
      actual: a.actual + r.actualMinutes,
      ot: a.ot + r.otMinutes,
      late: a.late + r.lateBuilds,
    }),
    { builds: 0, estimated: 0, actual: 0, ot: 0, late: 0 }
  );

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/reports"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Reports
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Customer and project analysis
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-zinc-300 text-sm dark:border-zinc-700">
            {[
              { key: "customer", label: "By customer" },
              { key: "project", label: "By project" },
            ].map((option) => (
              <Link
                key={option.key}
                href={`/reports/customers?by=${option.key}`}
                aria-current={
                  (option.key === "project") === groupByProject ? "true" : undefined
                }
                className={`px-3 py-1.5 ${
                  (option.key === "project") === groupByProject
                    ? "bg-lime-100 font-medium text-lime-800 dark:bg-lime-800 dark:text-lime-100"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <a
            href={`/reports/customers/csv?by=${groupByProject ? "project" : "customer"}`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Download CSV
          </a>
        </div>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Builds, hours, and adherence rolled up. Overtime hours are shown
        separately so Finance can apply the 1.5× and 2× rates externally —
        this system never prices anything.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No builds yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[48rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {[
                  "Customer",
                  ...(groupByProject ? ["Project"] : []),
                  "Builds",
                  "Estimated",
                  "Actual",
                  "of which OT",
                  "Variance",
                  "Late",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {rows.map((r) => {
                const variance = r.actualMinutes - r.estimatedMinutes;
                return (
                  <tr key={r.key}>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {r.customer}
                    </td>
                    {groupByProject && (
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {r.project ?? (
                          <span className="text-zinc-400 dark:text-zinc-500">
                            no project
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {r.builds}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {hours(r.estimatedMinutes)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {hours(r.actualMinutes)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span
                        className={
                          r.otMinutes > 0
                            ? "font-medium text-status-attention dark:text-amber-400"
                            : "text-zinc-400 dark:text-zinc-500"
                        }
                      >
                        {hours(r.otMinutes)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.actualMinutes === 0 ? (
                        <span className="text-zinc-400 dark:text-zinc-500">—</span>
                      ) : (
                        <span
                          className={
                            variance > 0
                              ? "font-medium text-status-attention dark:text-amber-400"
                              : "text-lime-800 dark:text-lime-100"
                          }
                        >
                          {variance > 0 ? "+" : ""}
                          {hours(variance)}h
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.lateBuilds > 0 ? (
                        <span className="font-medium text-status-blocked dark:text-red-400">
                          ⚠ {r.lateBuilds}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-zinc-50 font-medium dark:bg-zinc-900">
              <tr>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300" colSpan={groupByProject ? 2 : 1}>
                  All
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {totals.builds}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.estimated)}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.actual)}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.ot)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {totals.late}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}

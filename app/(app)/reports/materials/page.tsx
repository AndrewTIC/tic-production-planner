import Link from "next/link";
import { formatDate } from "@/lib/format";
import { materialsDue } from "../queries";

export default async function MaterialsReport() {
  const rows = await materialsDue();
  const overdue = rows.filter((r) => r.daysOverdue !== null);
  const undated = rows.filter((r) => !r.expectedDelivery);

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
            Materials due and overdue
          </h1>
        </div>
        <a
          href="/reports/materials/csv"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Download CSV
        </a>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Everything still outstanding on a build that has not shipped, soonest
        first. Material status never blocks scheduling — this is a chase list
        and an early warning, not a gate.
      </p>

      {rows.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Outstanding
            </p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {rows.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Overdue
            </p>
            <p
              className={`text-xl font-semibold tabular-nums ${
                overdue.length > 0
                  ? "text-status-blocked dark:text-red-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {overdue.length > 0 && "⚠ "}
              {overdue.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              No date yet
            </p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {undated.length}
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing outstanding — every material line on a live build is booked
          in.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[52rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {[
                  "Expected",
                  "Component",
                  "Build",
                  "Customer",
                  "Build status",
                  "Build due",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={
                    r.daysOverdue !== null
                      ? "bg-status-blocked-bg/40 dark:bg-red-950/20"
                      : ""
                  }
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.expectedDelivery ? (
                      <>
                        <span
                          className={
                            r.daysOverdue !== null
                              ? "font-medium text-status-blocked dark:text-red-400"
                              : "text-zinc-700 dark:text-zinc-300"
                          }
                        >
                          {formatDate(r.expectedDelivery)}
                        </span>
                        {r.daysOverdue !== null && (
                          <span className="mt-0.5 block text-xs font-medium text-status-blocked dark:text-red-400">
                            ⚠ {r.daysOverdue}{" "}
                            {r.daysOverdue === 1 ? "day" : "days"} overdue
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        no date
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-900 dark:text-zinc-100">
                      {r.componentPartNumber}
                    </span>
                    {r.description && (
                      <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                        {r.description}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/builds/${r.buildId}`}
                      className="font-mono font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {r.buNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {r.customer}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {r.status}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {formatDate(r.requestedDelivery)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

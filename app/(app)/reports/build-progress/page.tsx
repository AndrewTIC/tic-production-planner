import Link from "next/link";
import { formatDate } from "@/lib/format";
import { buildProgress } from "../queries";

function hours(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.00$/, "");
}

export default async function BuildProgressReport() {
  const rows = await buildProgress();

  const totals = rows.reduce(
    (acc, r) => ({
      estimated: acc.estimated + r.estimatedMinutes,
      actual: acc.actual + r.actualMinutes,
      overrun: acc.overrun + r.overrunMinutes,
    }),
    { estimated: 0, actual: 0, overrun: 0 }
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
            Build progress
          </h1>
        </div>
        <a
          href="/reports/build-progress/csv"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Download CSV
        </a>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Estimated against actual hours by phase. Actual hours are clock time
        net of the unpaid break. Projected assumes an unfinished operation
        still needs at least its estimate, so overrun is a forecast, not just
        hours already lost.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No builds yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[52rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {["Build", "Status", "Phase hours", "Est.", "Actual", "%", "Overrun"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {rows.map((r) => (
                <tr key={r.buildId}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/builds/${r.buildId}`}
                      className="font-mono font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {r.buNumber}
                    </Link>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      {r.part} · {r.customer}
                    </span>
                    {r.requestedDelivery && (
                      <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                        due {formatDate(r.requestedDelivery)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {r.status}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {r.phases.length === 0 ? (
                        <span className="text-zinc-400 dark:text-zinc-500">—</span>
                      ) : (
                        r.phases.map((p) => (
                          <span
                            key={p.phase}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                            title={`${p.phase}: ${hours(p.actualMinutes)}h of ${hours(p.estimatedMinutes)}h`}
                          >
                            {p.phase} {hours(p.actualMinutes)}/
                            {hours(p.estimatedMinutes)}
                          </span>
                        ))
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {hours(r.estimatedMinutes)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {hours(r.actualMinutes)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                    {r.percentComplete === null ? (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    ) : (
                      <span
                        className={
                          r.percentComplete > 100
                            ? "font-semibold text-status-attention dark:text-amber-400"
                            : "text-zinc-700 dark:text-zinc-300"
                        }
                      >
                        {r.percentComplete}%
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                    {r.overrunMinutes > 0 ? (
                      <span className="font-medium text-status-attention dark:text-amber-400">
                        ⚠ +{hours(r.overrunMinutes)}h
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50 text-sm font-medium dark:bg-zinc-900">
              <tr>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300" colSpan={3}>
                  All builds
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.estimated)}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.actual)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {totals.overrun > 0 ? `+${hours(totals.overrun)}h` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { scheduleAdherence } from "../queries";

function hours(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.00$/, "");
}

export default async function AdherenceReport() {
  const rows = await scheduleAdherence();
  const late = rows.filter((r) => r.daysLate !== null);
  const unscheduled = rows.filter((r) => r.unscheduledMinutes > 0);

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
            Schedule adherence
          </h1>
        </div>
        <a
          href="/reports/adherence/csv"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Download CSV
        </a>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Builds not yet despatched, comparing the last scheduled day against
        the requested delivery date. A build with hours still unassigned will
        finish later than its schedule currently shows — those are flagged,
        so nothing is called on time merely because the rest of it has not
        been scheduled yet.
      </p>

      {rows.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Live builds
            </p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {rows.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Scheduled late
            </p>
            <p
              className={`text-xl font-semibold tabular-nums ${
                late.length > 0
                  ? "text-status-blocked dark:text-red-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {late.length > 0 && "⚠ "}
              {late.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              With work unscheduled
            </p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {unscheduled.length}
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No live builds.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[52rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {[
                  "Build",
                  "Status",
                  "Requested",
                  "Scheduled finish",
                  "Variance",
                  "Unscheduled",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {rows.map((r) => (
                <tr
                  key={r.buildId}
                  className={
                    r.daysLate !== null ? "bg-status-blocked-bg/40 dark:bg-red-950/20" : ""
                  }
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/builds/${r.buildId}`}
                      className="font-mono font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {r.buNumber}
                    </Link>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      {r.customer}
                      {r.project && ` · ${r.project}`}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {r.status}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {formatDate(r.requestedDelivery)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {r.scheduledCompletion ? (
                      formatDate(r.scheduledCompletion)
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        not scheduled
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.daysLate !== null ? (
                      <span className="font-medium text-status-blocked dark:text-red-400">
                        ⚠ {r.daysLate} {r.daysLate === 1 ? "day" : "days"} late
                      </span>
                    ) : r.scheduledCompletion && r.requestedDelivery ? (
                      <span className="text-lime-800 dark:text-lime-100">on time</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.unscheduledMinutes > 0 ? (
                      <span
                        className="text-status-attention dark:text-amber-400"
                        title="These hours are not on the board yet, so the real finish is later than shown"
                      >
                        {hours(r.unscheduledMinutes)}h to place
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
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

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { addDays, isDateString, mondayOf, today } from "@/lib/schedule";
import { utilisation } from "../queries";

function hours(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.00$/, "");
}

export default async function UtilisationReport({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; by?: string }>;
}) {
  const params = await searchParams;
  const by = params.by === "phase" ? "phase" : "worker";
  // Default: the four weeks up to the end of this week.
  const defaultFrom = addDays(mondayOf(today()), -21);
  const from = isDateString(params.from) ? params.from : defaultFrom;
  const to = isDateString(params.to) ? params.to : addDays(from, 27);

  const rows = await utilisation(from, to, by);

  const totals = rows.reduce(
    (a, r) => ({
      standard: a.standard + r.standardMinutes,
      ot15: a.ot15 + r.ot15Minutes,
      ot2: a.ot2 + r.ot2Minutes,
      available: a.available + r.availableMinutes,
    }),
    { standard: 0, ot15: 0, ot2: 0, available: 0 }
  );

  const link = (next: Record<string, string>) => {
    const q = new URLSearchParams({ from, to, by, ...next });
    return `/reports/utilisation?${q.toString()}`;
  };

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
            Utilisation
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-zinc-300 text-sm dark:border-zinc-700">
            {(["worker", "phase"] as const).map((option) => (
              <Link
                key={option}
                href={link({ by: option })}
                aria-current={by === option ? "true" : undefined}
                className={`px-3 py-1.5 capitalize ${
                  by === option
                    ? "bg-lime-100 font-medium text-lime-800 dark:bg-lime-800 dark:text-lime-100"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                By {option}
              </Link>
            ))}
          </div>
          <a
            href={`/reports/utilisation/csv?from=${from}&to=${to}&by=${by}`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Download CSV
          </a>
        </div>
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3" action="/reports/utilisation">
        <input type="hidden" name="by" value={by} />
        <div>
          <label htmlFor="from" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Apply
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatDate(from)} – {formatDate(to)}
        </span>
      </form>

      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        Booked hours split by overtime class against standard capacity.
        Overtime sits on top of capacity rather than consuming it, so the
        percentage is standard hours only and premium hours are reported
        beside it.
        {by === "phase" &&
          " Phase capacity counts every worker competent in that phase, so phases overlap."}
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No hours booked and no capacity in this period.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[48rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {[
                  by === "worker" ? "Worker" : "Phase",
                  "Standard",
                  "OT 1.5×",
                  "OT 2×",
                  "Total booked",
                  "Available",
                  "Utilisation",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {rows.map((r) => {
                const booked = r.standardMinutes + r.ot15Minutes + r.ot2Minutes;
                return (
                  <tr key={r.key}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {r.label}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {hours(r.standardMinutes)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span
                        className={
                          r.ot15Minutes > 0
                            ? "font-medium text-status-attention dark:text-amber-400"
                            : "text-zinc-400 dark:text-zinc-500"
                        }
                      >
                        {hours(r.ot15Minutes)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span
                        className={
                          r.ot2Minutes > 0
                            ? "font-medium text-status-attention dark:text-amber-400"
                            : "text-zinc-400 dark:text-zinc-500"
                        }
                      >
                        {hours(r.ot2Minutes)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                      {hours(booked)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {hours(r.availableMinutes)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.utilisation === null ? (
                        <span className="text-zinc-400 dark:text-zinc-500">—</span>
                      ) : (
                        <span
                          className={
                            r.utilisation > 100
                              ? "font-semibold text-status-attention dark:text-amber-400"
                              : "text-zinc-700 dark:text-zinc-300"
                          }
                        >
                          {r.utilisation > 100 && "⚠ "}
                          {r.utilisation}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-zinc-50 font-medium dark:bg-zinc-900">
              <tr>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Total</td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.standard)}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.ot15)}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.ot2)}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.standard + totals.ot15 + totals.ot2)}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-100">
                  {hours(totals.available)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}

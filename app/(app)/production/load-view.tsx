import { formatDate } from "@/lib/format";
import { formatHours } from "./board-ui";

// Load view (spec §6.5): committed hours against standard capacity, per
// phase, per week, over a four-week horizon from the board's Monday.
//
// COLOUR IS NOT THE SIGNAL. The lime/amber pair fails CVD separation
// (ΔE 6.2 deutan — verified with the dataviz validator), so over-capacity
// cells ALWAYS carry the ⚠ icon and every cell always shows its percentage.
// A red-green colourblind scheduler reads the state from "⚠ 104%", not the
// hue. Do not drop the icon or the number to tidy the layout.
//
// Overtime does not consume standard capacity — it is extra on top — so the
// percentage is standard-committed ÷ standard-capacity, with any OT shown
// separately beneath.

export type LoadCell = {
  standard: number;
  overtime: number;
  capacity: number;
};

export type LoadRow = {
  key: string;
  label: string;
  cells: LoadCell[];
  // Phase rows double-count multi-skilled workers; the total row does not.
  isTotal?: boolean;
};

export function LoadView({
  weekStarts,
  rows,
}: {
  weekStarts: string[];
  rows: LoadRow[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Load
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Committed hours against standard capacity (7.5h per working day, less
        holidays). Overtime sits on top of capacity, so it is listed
        separately rather than counted in the percentage.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[44rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                Phase
              </th>
              {weekStarts.map((w) => (
                <th
                  key={w}
                  className="border-l border-zinc-200 px-4 py-2 font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    w/c
                  </span>
                  {formatDate(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {rows.map((row) => (
              <tr
                key={row.key}
                className={
                  row.isTotal
                    ? "bg-zinc-50/60 font-medium dark:bg-zinc-900/40"
                    : ""
                }
              >
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                  {row.label}
                  {row.isTotal && (
                    <span className="mt-0.5 block text-[10px] font-normal text-zinc-400 dark:text-zinc-500">
                      the real constraint
                    </span>
                  )}
                </td>
                {row.cells.map((cell, i) => (
                  <td
                    key={weekStarts[i]}
                    className="border-l border-zinc-200 px-4 py-3 align-top dark:border-zinc-800"
                  >
                    <LoadMeter cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        Phase rows count a worker in every phase they are competent in, so
        they overlap — the total row is the honest capacity ceiling.
      </p>
    </section>
  );
}

function LoadMeter({ cell }: { cell: LoadCell }) {
  const { standard, overtime, capacity } = cell;
  const pct = capacity > 0 ? Math.round((standard / capacity) * 100) : null;
  const over = pct !== null && pct > 100;

  const title =
    capacity > 0
      ? `${formatHours(standard)}h committed of ${formatHours(capacity)}h standard capacity (${pct}%)` +
        (overtime > 0 ? ` · plus ${formatHours(overtime)}h overtime` : "")
      : "No standard capacity this week (holiday or closure)";

  return (
    <div title={title}>
      <div className="flex items-baseline gap-1.5">
        {/* Icon + number are the accessible signal, not the fill colour. */}
        {over && (
          <span aria-hidden className="text-status-attention dark:text-amber-400">
            ⚠
          </span>
        )}
        <span
          className={`tabular-nums ${
            over
              ? "font-semibold text-status-attention dark:text-amber-400"
              : "text-zinc-800 dark:text-zinc-200"
          }`}
        >
          {pct === null ? "—" : `${pct}%`}
        </span>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {formatHours(standard)}/{formatHours(capacity)}h
        </span>
      </div>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full ${
            over
              ? "bg-status-attention dark:bg-amber-500"
              : "bg-lime-600 dark:bg-lime-500"
          }`}
          style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
        />
      </div>

      {overtime > 0 && (
        <p className="mt-1 text-[10px] tabular-nums text-amber-700 dark:text-amber-400">
          +{formatHours(overtime)}h OT
        </p>
      )}
    </div>
  );
}

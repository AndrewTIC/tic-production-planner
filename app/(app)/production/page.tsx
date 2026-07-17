import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { materialBadge } from "@/lib/materials";
import { MaterialBadgeChip } from "@/app/(app)/builds/material-badge";
import {
  addDays,
  dayLabel,
  isDateString,
  isWeekend,
  mondayOf,
  today,
  weekDates,
} from "@/lib/schedule";
import { BacklogDrawer } from "./backlog-drawer";

// Production board, slice 1 (read-only): BUILDS as rows (BU numbers in the
// first column — per Andrew, 17 Jul 2026, superseding the workers-as-rows
// wording in spec §6.5), days as columns over a navigable week. Cells show
// which worker is on which phase for how long. Assignment editing, conflict
// flags, and the load view come in later slices.

const priorityStyles: Record<string, string> = {
  Urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  High: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Normal: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Low: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
};

// Labour-type colour coding (design tokens, docs/design-spec-v1.2.md §4):
// Mechanical wears TIC lime, Electrical the In-Progress blue, Inspection
// the review purple — 4px left edge plus a matching tint across the bar.
// The legend above the board explains these.
const phaseBar: Record<string, string> = {
  MECH: "border-l-lime-600 bg-lime-100/70 dark:bg-lime-800/20",
  ELEC: "border-l-status-progress bg-status-progress-bg/70 dark:bg-status-progress/15",
  INSP: "border-l-status-review bg-status-review-bg/70 dark:bg-status-review/15",
};

const legend = [
  { label: "Mechanical", swatch: "bg-lime-600" },
  { label: "Electrical", swatch: "bg-status-progress" },
  { label: "Inspection", swatch: "bg-status-review" },
  { label: "Overtime", swatch: "bg-amber-400" },
];

// Stable per-worker badge colours: same worker, same colour, every week.
// Static class strings so Tailwind ships them.
const workerPalette = [
  "bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-200",
  "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200",
  "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200",
  "bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-200",
  "bg-orange-200 text-orange-900 dark:bg-orange-900 dark:text-orange-200",
  "bg-cyan-200 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-200",
  "bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-900 dark:text-fuchsia-200",
  "bg-teal-200 text-teal-900 dark:bg-teal-900 dark:text-teal-200",
];

function workerColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return workerPalette[hash % workerPalette.length];
}

// Vertical separators between day columns — multi-day work reads against
// the grid (Andrew, 17 Jul 2026).
const dayDivider = "border-l border-zinc-200 dark:border-zinc-800";

function formatHours(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const monday = mondayOf(isDateString(week) ? week : today());
  const days = weekDates(monday);
  const weekEnd = days[6];
  const todayStr = today();

  const supabase = await createClient();
  const [
    { data: builds },
    { data: closures },
    { data: assignments },
    { data: operations },
  ] = await Promise.all([
    // Rows: builds that have at least one operation (schedulable work).
    supabase
      .from("builds")
      .select(
        `id, bu_number, priority, requested_delivery_date,
         parts(part_number), customers(name), operations!inner(id)`
      )
      .order("requested_delivery_date", { ascending: true, nullsFirst: false })
      .order("bu_number"),
    // Company-wide closures shade whole columns; per-worker holidays become
    // per-assignment conflict flags in a later slice.
    supabase
      .from("holidays")
      .select("date_from, date_to, part_of_day, note")
      .is("worker_id", null)
      .lte("date_from", weekEnd)
      .gte("date_to", monday),
    supabase
      .from("assignments")
      .select(
        `id, date, planned_hours, overtime, workers(name),
         operations(build_id, phases(code))`
      )
      .gte("date", monday)
      .lte("date", weekEnd),
    supabase
      .from("operations")
      .select(
        `id, description, estimated_hours, status, blocked,
         phases(code),
         builds(id, bu_number, priority, requested_delivery_date,
                materials_complete, build_statuses(name),
                material_items(booked_in, expected_delivery_date)),
         assignments(planned_hours)`
      )
      .neq("status", "Complete"),
  ]);

  // Cell lookup: assignments per build per day.
  const cellAssignments = new Map<string, NonNullable<typeof assignments>>();
  for (const a of assignments ?? []) {
    const buildId = a.operations?.build_id;
    if (!buildId) continue;
    const key = `${buildId}|${a.date}`;
    const list = cellAssignments.get(key);
    if (list) list.push(a);
    else cellAssignments.set(key, [a]);
  }

  function closureFor(date: string) {
    return (closures ?? []).find(
      (c) => c.date_from <= date && c.date_to >= date
    );
  }

  // Backlog: operations with unassigned hours remaining (across ALL dates,
  // not just this week), heaviest remainder first.
  const backlog = (operations ?? [])
    .map((op) => ({
      ...op,
      remaining:
        Number(op.estimated_hours) -
        op.assignments.reduce((s, a) => s + Number(a.planned_hours), 0),
    }))
    .filter((op) => op.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Production
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/production?week=${addDays(monday, -7)}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Prev
          </Link>
          <Link
            href="/production"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            This week
          </Link>
          <Link
            href={`/production?week=${addDays(monday, 7)}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Next →
          </Link>
          <BacklogDrawer count={backlog.length}>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Operations with hours still to place. Material badges are
              information, never a gate.
            </p>
            {backlog.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Nothing waiting — every operation is fully assigned.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {backlog.map((op) => (
                  <li
                    key={op.id}
                    className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/builds/${op.builds?.id}`}
                        className="font-mono text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {op.builds?.bu_number ?? "—"}
                      </Link>
                      <span
                        className={`rounded-full border-l-4 py-0.5 pl-1.5 pr-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 ${
                          phaseBar[op.phases?.code ?? ""] ??
                          "border-l-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                        }`}
                      >
                        {op.phases?.code ?? "—"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          priorityStyles[op.builds?.priority ?? "Normal"] ??
                          priorityStyles.Normal
                        }`}
                      >
                        {op.builds?.priority ?? "Normal"}
                      </span>
                      {op.blocked && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                          Blocked
                        </span>
                      )}
                    </div>
                    {op.description && (
                      <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {op.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {formatHours(op.remaining)}h left
                      </span>
                      <span>of {formatHours(Number(op.estimated_hours))}h</span>
                      {op.builds?.requested_delivery_date && (
                        <span>
                          · due {formatDate(op.builds.requested_delivery_date)}
                        </span>
                      )}
                      <MaterialBadgeChip
                        badge={materialBadge(
                          op.builds?.materials_complete ?? false,
                          op.builds?.material_items ?? []
                        )}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </BacklogDrawer>
        </div>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Week commencing {formatDate(monday)} · one row per build; cells show
        who is on which phase · Sat/Sun are overtime days · read-only for now
        — assignment editing arrives in the next slice.
      </p>

      {/* Key: labour-type colours + overtime (Andrew, 17 Jul 2026). */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="font-medium text-zinc-500 dark:text-zinc-500">
          Key:
        </span>
        {legend.map(({ label, swatch }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-sky-200 text-[9px] font-semibold text-sky-900 dark:bg-sky-900 dark:text-sky-200">
            KT
          </span>
          worker (colour is consistent per person)
        </span>
      </div>

      {/* ── Board ─────────────────────────────────────────────── */}
      <div className="mt-3">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[64rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  Build
                </th>
                {days.map((d) => {
                  const closure = closureFor(d);
                  const [weekday, dayMonth] = dayLabel(d).split(" ");
                  const weekend = isWeekend(d);
                  return (
                    <th
                      key={d}
                      className={`px-3 py-2 font-medium ${dayDivider} ${
                        weekend ? "bg-neutral-100/70 dark:bg-zinc-900" : ""
                      }`}
                    >
                      <span
                        className={`block text-[10px] font-semibold uppercase tracking-wide ${
                          weekend
                            ? "text-amber-700/70 dark:text-amber-500/70"
                            : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        {weekday}
                        {weekend && " · OT"}
                      </span>
                      <span
                        className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-sm font-semibold ${
                          d === todayStr
                            ? "bg-lime-100 text-lime-800 dark:bg-lime-800 dark:text-lime-100"
                            : weekend
                              ? "text-zinc-400 dark:text-zinc-500"
                              : "text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {dayMonth}
                        {d === todayStr && " · Today"}
                      </span>
                      {closure && (
                        <span
                          className="mt-0.5 block w-fit rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          title={closure.note ?? undefined}
                        >
                          Closure
                          {closure.part_of_day !== "full" &&
                            ` (${closure.part_of_day.toUpperCase()})`}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {(builds ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    No builds with operations yet — add phase operations on a
                    build to see it here.
                  </td>
                </tr>
              ) : (
                (builds ?? []).map((b) => (
                  <tr key={b.id}>
                    <td className="sticky left-0 z-10 min-w-[13rem] bg-white px-4 py-3 align-top dark:bg-zinc-950">
                      <Link
                        href={`/builds/${b.id}`}
                        className="font-mono font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {b.bu_number}
                      </Link>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                          priorityStyles[b.priority] ?? priorityStyles.Normal
                        }`}
                      >
                        {b.priority}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                        {b.parts?.part_number ?? "—"} ·{" "}
                        {b.customers?.name ?? "—"}
                      </span>
                      {b.requested_delivery_date && (
                        <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">
                          due {formatDate(b.requested_delivery_date)}
                        </span>
                      )}
                    </td>
                    {days.map((d) => {
                      const cell = cellAssignments.get(`${b.id}|${d}`) ?? [];
                      const loaded = cell.reduce(
                        (s, a) => s + Number(a.planned_hours),
                        0
                      );
                      return (
                        <td
                          key={d}
                          className={`min-w-[8.5rem] px-2 py-2 align-top ${dayDivider} ${
                            d === todayStr
                              ? "bg-lime-100/30 dark:bg-lime-800/10"
                              : isWeekend(d)
                                ? "bg-neutral-100/70 dark:bg-zinc-900/60"
                                : ""
                          }`}
                        >
                          {cell.map((a) => {
                            const phase = a.operations?.phases?.code ?? "";
                            return (
                              // Bar per §15: labour-type tint + 4px left
                              // edge, worker-coloured badge, hours. OT keeps
                              // the amber outline over the phase tint.
                              <div
                                key={a.id}
                                className={`mb-1 flex items-center gap-1.5 rounded-md border border-l-4 px-1.5 py-1 text-xs text-zinc-800 shadow-(--shadow-1) dark:text-zinc-200 ${
                                  phaseBar[phase] ??
                                  "border-l-zinc-400 bg-white dark:bg-zinc-900"
                                } ${
                                  a.overtime
                                    ? "border-y-amber-400 border-r-amber-400 dark:border-y-amber-600 dark:border-r-amber-600"
                                    : "border-y-zinc-200 border-r-zinc-200 dark:border-y-zinc-700 dark:border-r-zinc-700"
                                }`}
                              >
                                <span
                                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${workerColor(
                                    a.workers?.name ?? "?"
                                  )}`}
                                >
                                  {initials(a.workers?.name ?? "?")}
                                </span>
                                <span className="truncate font-medium">
                                  {a.workers?.name ?? "—"}
                                </span>
                                <span className="ml-auto shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                                  {formatHours(Number(a.planned_hours))}h
                                  {a.overtime && " OT"}
                                </span>
                              </div>
                            );
                          })}
                          {cell.length > 1 && (
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                              {formatHours(loaded)}h total
                            </p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}

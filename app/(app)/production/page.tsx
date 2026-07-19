import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { materialBadge } from "@/lib/materials";
import { MaterialBadgeChip } from "@/app/(app)/builds/material-badge";
import {
  addDays,
  boardDates,
  dayLabel,
  isDateString,
  isWeekStart,
  isWeekend,
  mondayOf,
  today,
} from "@/lib/schedule";
import { getUserProfile } from "@/lib/auth";
import { BacklogDrawer } from "./backlog-drawer";
import { formatHours, phaseBar, priorityStyles } from "./board-ui";
import {
  AssignButton,
  AssignmentBar,
  SchedulingProvider,
} from "./scheduling";

// Production board (slices 1+2): BUILDS as rows (BU numbers in the first
// column — per Andrew, 17 Jul 2026, superseding the workers-as-rows wording
// in spec §6.5), days as columns over a navigable week. Cells show
// worker-on-phase bars; admin/commercial click bars to edit and assign from
// the Unscheduled work drawer, with a 6s undo toast and Ctrl/Cmd+Z (design
// spec §16). Conflict flags and the load view come in slice 3.

const legend = [
  { label: "Mechanical", swatch: "bg-lime-600" },
  { label: "Electrical", swatch: "bg-status-progress" },
  { label: "Inspection", swatch: "bg-status-review" },
  { label: "Overtime", swatch: "bg-amber-400" },
];

// Vertical separators between day columns — multi-day work reads against
// the grid (Andrew, 17 Jul 2026). Each Monday gets a heavier rule so the
// two weeks of the fortnight view stay distinguishable.
const dayDivider = "border-l border-zinc-200 dark:border-zinc-800";
const weekDivider = "border-l-2 border-zinc-300 dark:border-zinc-700";

// Fortnight is the default span (Andrew, 18 Jul 2026); Week stays available
// for a denser look at the current week. Design spec §15 lists Day · Week ·
// Fortnight · Month as zoom levels — Day/Month arrive with the timeline
// rework in migration Phase D.
const SPANS = [
  { days: 14, label: "Fortnight" },
  { days: 7, label: "Week" },
];
const DEFAULT_SPAN = 14;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; span?: string }>;
}) {
  const { week, span } = await searchParams;
  const spanDays = SPANS.some((s) => String(s.days) === span)
    ? Number(span)
    : DEFAULT_SPAN;
  const monday = mondayOf(isDateString(week) ? week : today());
  const days = boardDates(monday, spanDays);
  const weekEnd = days[days.length - 1];
  const todayStr = today();

  // Fortnight columns are half the width, so bars drop the worker name and
  // lean on the colour-coded initials badge (explained in the key).
  const compact = spanDays > 7;

  // Preserve the span across navigation; omit it when it's the default so
  // the common URL stays clean.
  const spanParam = spanDays === DEFAULT_SPAN ? "" : `&span=${spanDays}`;
  const boardHref = (weekStart: string) =>
    `/production?week=${weekStart}${spanParam}`;

  const auth = await getUserProfile();
  const canWrite =
    auth !== null && ["admin", "commercial"].includes(auth.profile.role);

  const supabase = await createClient();
  const [
    { data: builds },
    { data: closures },
    { data: assignments },
    { data: operations },
    { data: workers },
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
        `id, worker_id, date, planned_hours, overtime, workers(name),
         operations(id, build_id, description, phases(code))`
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
    supabase
      .from("workers")
      .select("id, name")
      .eq("active", true)
      .order("name"),
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

  const defaultDate =
    todayStr >= monday && todayStr <= weekEnd ? todayStr : monday;

  return (
    <SchedulingProvider workers={workers ?? []} defaultDate={defaultDate}>
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Production
        </h1>
        <div className="flex items-center gap-2 text-sm">
          {/* Span toggle — segmented control (design spec §15). */}
          <div className="flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
            {SPANS.map(({ days: d, label }) => (
              <Link
                key={d}
                href={
                  d === DEFAULT_SPAN
                    ? `/production?week=${monday}`
                    : `/production?week=${monday}&span=${d}`
                }
                aria-current={d === spanDays ? "true" : undefined}
                className={`px-3 py-1.5 ${
                  d === spanDays
                    ? "bg-lime-100 font-medium text-lime-800 dark:bg-lime-800 dark:text-lime-100"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          {/* Navigation steps by a week even in fortnight view, so the two
              halves overlap — the scheduler keeps context while paging. */}
          <Link
            href={boardHref(addDays(monday, -7))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Prev
          </Link>
          <Link
            href={spanParam ? `/production?span=${spanDays}` : "/production"}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Today
          </Link>
          <Link
            href={boardHref(addDays(monday, 7))}
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
                      {canWrite && (
                        <span className="ml-auto">
                          <AssignButton
                            op={{
                              operationId: op.id,
                              buNumber: op.builds?.bu_number ?? "—",
                              phase: op.phases?.code ?? "",
                              description: op.description,
                              remaining: op.remaining,
                            }}
                          />
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
        {formatDate(monday)} – {formatDate(weekEnd)} · one row per build; cells
        show who is on which phase · Sat/Sun are overtime days
        {canWrite &&
          " · assign from Unscheduled work, click a bar to edit — every change can be undone (Ctrl+Z)"}
        .
      </p>

      {/* Key: labour-type colours + overtime (Andrew, 17 Jul 2026). */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="font-medium text-zinc-500 dark:text-zinc-500">
          Key:
        </span>
        {legend.map(({ label, swatch }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
            {label === "Overtime" && compact ? "Overtime (*)" : label}
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
          <table
            className={`w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800 ${
              compact ? "min-w-[80rem]" : "min-w-[64rem]"
            }`}
          >
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  Build
                </th>
                {days.map((d, i) => {
                  const closure = closureFor(d);
                  const [weekday, dayMonth] = dayLabel(d).split(" ");
                  const weekend = isWeekend(d);
                  return (
                    <th
                      key={d}
                      className={`${compact ? "px-1.5" : "px-3"} py-2 font-medium ${
                        i > 0 && isWeekStart(d) ? weekDivider : dayDivider
                      } ${weekend ? "bg-neutral-100/70 dark:bg-zinc-900" : ""}`}
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
                        {d === todayStr && !compact && " · Today"}
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
                    colSpan={days.length + 1}
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
                    {days.map((d, i) => {
                      const cell = cellAssignments.get(`${b.id}|${d}`) ?? [];
                      const loaded = cell.reduce(
                        (s, a) => s + Number(a.planned_hours),
                        0
                      );
                      return (
                        <td
                          key={d}
                          className={`${
                            compact ? "min-w-[4.5rem] px-1" : "min-w-[8.5rem] px-2"
                          } py-2 align-top ${
                            i > 0 && isWeekStart(d) ? weekDivider : dayDivider
                          } ${
                            d === todayStr
                              ? "bg-lime-100/30 dark:bg-lime-800/10"
                              : isWeekend(d)
                                ? "bg-neutral-100/70 dark:bg-zinc-900/60"
                                : ""
                          }`}
                        >
                          {cell.map((a) => (
                            <AssignmentBar
                              key={a.id}
                              canWrite={canWrite}
                              compact={compact}
                              workerName={a.workers?.name ?? "—"}
                              assignment={{
                                id: a.id,
                                operation_id: a.operations?.id ?? "",
                                worker_id: a.worker_id,
                                date: a.date,
                                planned_hours: Number(a.planned_hours),
                                overtime: a.overtime,
                              }}
                              op={{
                                operationId: a.operations?.id ?? "",
                                buNumber: b.bu_number,
                                phase: a.operations?.phases?.code ?? "",
                                description: a.operations?.description ?? null,
                                remaining: 0,
                              }}
                            />
                          ))}
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
    </SchedulingProvider>
  );
}

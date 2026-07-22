import Link from "next/link";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { workerCapacity, type HolidayLite } from "@/lib/capacity";
import { addDays, boardDates, mondayOf, today } from "@/lib/schedule";

// Dashboard (design spec §10): what is happening today, what needs
// attention, who is working on what, are we on schedule. One banner, one
// hero row of numbers, then the lists that answer those questions —
// everything links to the screen where the answer can be acted on.

function hours(minutes: number): string {
  return (minutes / 60).toFixed(1).replace(/\.0$/, "");
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/London",
    }).format(new Date())
  );
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const auth = await getUserProfile();
  const todayStr = today();
  const monday = mondayOf(todayStr);
  const weekDays = boardDates(monday, 7);
  const weekEnd = weekDays[6];

  const supabase = await createClient();
  const [
    { data: openEntries },
    { data: workers },
    { data: holidays },
    { data: weekAssignments },
    { data: liveBuilds },
    { data: overdueMaterials },
    { data: blockedOps },
    { data: openOps },
    { data: weekSegments },
    { data: recentNotes },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("active_time_entries")
      .select("id, worker_id, operation_id, started_at")
      .is("ended_at", null),
    supabase
      .from("workers")
      .select("id, name, worker_phases(phases(code))")
      .eq("active", true)
      .order("name"),
    supabase
      .from("holidays")
      .select("worker_id, date_from, date_to, part_of_day")
      .lte("date_from", weekEnd)
      .gte("date_to", monday),
    supabase
      .from("assignments")
      .select("worker_id, date, planned_hours, overtime, operations(phases(code))")
      .gte("date", monday)
      .lte("date", weekEnd),
    supabase
      .from("builds")
      .select("id, bu_number, requested_delivery_date, customers(name), build_statuses!inner(name, code)")
      .neq("build_statuses.code", "READY_DESPATCH"),
    supabase
      .from("material_items")
      .select("id, builds!inner(build_statuses!inner(code))")
      .eq("booked_in", false)
      .lt("expected_delivery_date", todayStr)
      .neq("builds.build_statuses.code", "READY_DESPATCH"),
    supabase.from("operations").select("id").eq("blocked", true),
    supabase
      .from("operations")
      .select("estimated_hours, assignments(planned_hours)")
      .neq("status", "Complete"),
    supabase
      .from("active_time_entry_segments")
      .select("ot_class, minutes")
      .gte("segment_date", monday)
      .lte("segment_date", weekEnd)
      .neq("ot_class", "none"),
    supabase
      .from("notes")
      .select("id, body, author_id, created_at, builds(id, bu_number)")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("profiles").select("id, display_name"),
  ]);

  const who = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const workerName = new Map((workers ?? []).map((w) => [w.id, w.name]));

  // Who's on what right now — resolve open entries to build + phase.
  const openOpIds = (openEntries ?? [])
    .map((e) => e.operation_id)
    .filter((x): x is string => !!x);
  const { data: openOpDetail } = openOpIds.length
    ? await supabase
        .from("operations")
        .select("id, phases(code), builds(bu_number)")
        .in("id", openOpIds)
    : { data: [] as { id: string; phases: { code: string } | null; builds: { bu_number: string } | null }[] };
  const opDetail = new Map((openOpDetail ?? []).map((o) => [o.id, o]));

  // Today / this week numbers.
  const holidayList = (holidays ?? []) as HolidayLite[];
  const offToday = (workers ?? []).filter((w) =>
    holidayList.some(
      (h) =>
        (h.worker_id === null || h.worker_id === w.id) &&
        h.date_from <= todayStr &&
        h.date_to >= todayStr
    )
  );
  const todayAssignments = (weekAssignments ?? []).filter((a) => a.date === todayStr);
  const scheduledTodayWorkers = [...new Set(todayAssignments.map((a) => a.worker_id))];

  const weekCommitted = (weekAssignments ?? []).reduce(
    (s, a) => s + Number(a.planned_hours),
    0
  );
  const weekCapacity = (workers ?? []).reduce(
    (s, w) => s + workerCapacity(w.id, weekDays, holidayList),
    0
  );
  const weekLoadPct =
    weekCapacity > 0 ? Math.round((weekCommitted / weekCapacity) * 100) : null;

  const otMinutesWeek = (weekSegments ?? []).reduce((s, x) => s + (x.minutes ?? 0), 0);

  const dueSoon = (liveBuilds ?? [])
    .filter((b) => b.requested_delivery_date && b.requested_delivery_date <= addDays(todayStr, 7))
    .sort((a, b) => a.requested_delivery_date!.localeCompare(b.requested_delivery_date!));
  const overdueBuilds = dueSoon.filter((b) => b.requested_delivery_date! < todayStr);

  const unscheduledMinutes = (openOps ?? []).reduce((sum, op) => {
    const est = Math.round(Number(op.estimated_hours) * 60);
    const assigned = op.assignments.reduce(
      (s, a) => s + Math.round(Number(a.planned_hours) * 60),
      0
    );
    return sum + Math.max(0, est - assigned);
  }, 0);

  const attentionCount =
    (blockedOps?.length ?? 0) + (overdueMaterials?.length ?? 0) + overdueBuilds.length;

  const statusLine =
    (blockedOps?.length ?? 0) > 0
      ? `Workshop under pressure — ${blockedOps!.length} operation${blockedOps!.length === 1 ? "" : "s"} blocked`
      : attentionCount > 0
        ? `Attention needed — ${attentionCount} item${attentionCount === 1 ? "" : "s"} flagged below`
        : weekLoadPct !== null && weekLoadPct > 95
          ? "Busy week — running near full capacity"
          : "Workshop running normally";

  const card =
    "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";
  const statLabel =
    "text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500";

  return (
    <main className="space-y-6">
      {/* ── Banner (design spec §14) ─────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {greeting()}
          {auth ? `, ${auth.profile.display_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 font-medium text-lime-800 dark:text-lime-100">{statusLine}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {liveBuilds?.length ?? 0} live orders · week load{" "}
          {weekLoadPct === null ? "—" : `${weekLoadPct}%`} ({hours(weekCommitted * 60)}h of{" "}
          {hours(weekCapacity * 60)}h) · {dueSoon.length} due within 7 days ·{" "}
          {hours(unscheduledMinutes)}h still to schedule
        </p>
        {/* Week load meter */}
        <div className="mt-3 h-2 w-full max-w-xl overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full ${
              weekLoadPct !== null && weekLoadPct > 100
                ? "bg-status-attention dark:bg-amber-500"
                : "bg-lime-500"
            }`}
            style={{ width: `${Math.min(weekLoadPct ?? 0, 100)}%` }}
          />
        </div>
      </section>

      {/* ── Today ────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={card}>
          <p className={statLabel}>Clocked on now</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {openEntries?.length ?? 0}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {(openEntries ?? [])
              .map((e) => workerName.get(e.worker_id ?? "") ?? "")
              .filter(Boolean)
              .join(", ") || "nobody on the clock"}
          </p>
        </div>
        <div className={card}>
          <p className={statLabel}>Scheduled today</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {scheduledTodayWorkers.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {hours(todayAssignments.reduce((s, a) => s + Number(a.planned_hours), 0) * 60)}h
            planned on the board
          </p>
        </div>
        <div className={card}>
          <p className={statLabel}>Off today</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {offToday.length}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {offToday.map((w) => w.name).join(", ") || "full crew available"}
          </p>
        </div>
        <div className={card}>
          <p className={statLabel}>OT booked this week</p>
          <p
            className={`mt-1 text-3xl font-semibold tabular-nums ${
              otMinutesWeek > 0
                ? "text-status-attention dark:text-amber-400"
                : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {hours(otMinutesWeek)}h
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            premium hours, 1.5× and 2×
          </p>
        </div>
      </section>

      {/* ── Needs attention ──────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Blocked operations",
            value: blockedOps?.length ?? 0,
            href: "/production",
            hint: "flagged from the shopfloor",
          },
          {
            label: "Overdue materials",
            value: overdueMaterials?.length ?? 0,
            href: "/reports/materials",
            hint: "chase list",
          },
          {
            label: "Orders past due date",
            value: overdueBuilds.length,
            href: "/reports/adherence",
            hint: "requested delivery passed",
          },
          {
            label: "Hours unscheduled",
            value: `${hours(unscheduledMinutes)}h`,
            href: "/production",
            hint: "work not yet on the board",
            warm: unscheduledMinutes > 0,
          },
        ].map((a) => {
          const hot = typeof a.value === "number" ? a.value > 0 : a.warm;
          return (
            <Link
              key={a.label}
              href={a.href}
              className={`${card} transition hover:border-lime-600 ${
                hot ? "border-status-attention/60 dark:border-amber-700" : ""
              }`}
            >
              <p className={statLabel}>{a.label}</p>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums ${
                  hot
                    ? "text-status-attention dark:text-amber-400"
                    : "text-zinc-900 dark:text-zinc-50"
                }`}
              >
                {hot && typeof a.value === "number" ? `⚠ ${a.value}` : a.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{a.hint}</p>
            </Link>
          );
        })}
      </section>

      {/* ── Lists: who's on what · due soon · latest notes ───────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={card}>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            On the clock now
          </h2>
          {(openEntries ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Nobody is clocked on.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(openEntries ?? []).map((e) => {
                const op = opDetail.get(e.operation_id ?? "");
                return (
                  <li key={e.id} className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {workerName.get(e.worker_id ?? "") ?? "—"}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono">{op?.builds?.bu_number ?? "—"}</span>{" "}
                      {op?.phases?.code ?? ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={card}>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Due soon</h2>
          {dueSoon.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Nothing due in the next 7 days.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {dueSoon.slice(0, 6).map((b) => {
                const late = b.requested_delivery_date! < todayStr;
                return (
                  <li key={b.id} className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/builds/${b.id}`}
                      className="font-mono font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {b.bu_number}
                    </Link>
                    <span
                      className={
                        late
                          ? "font-medium text-status-blocked dark:text-red-400"
                          : "text-zinc-500 dark:text-zinc-400"
                      }
                    >
                      {late && "⚠ "}
                      {formatDate(b.requested_delivery_date)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={card}>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Latest notes
          </h2>
          {(recentNotes ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              No notes yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {(recentNotes ?? []).map((n) => (
                <li key={n.id}>
                  <p className="flex items-baseline gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">
                      {who.get(n.author_id) ?? "—"}
                    </span>
                    <Link
                      href={`/builds/${n.builds?.id}`}
                      className="font-mono hover:underline"
                    >
                      {n.builds?.bu_number}
                    </Link>
                    {formatDate(n.created_at)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-zinc-700 dark:text-zinc-300">
                    {n.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

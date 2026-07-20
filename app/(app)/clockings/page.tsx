import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { createTimeEntry, restoreTimeEntry } from "./actions";
import {
  CorrectionControls,
  type OperationOption,
  type WorkerOption,
} from "./corrections";

// Admin clocking corrections and audit (spec §6.6). Admin only — RLS gives
// no other role a write path to time_entries, and the void guard trigger
// refuses non-admins outright.
//
// The default list reads active_time_entries (CLAUDE.md rule 6); the deleted
// list reads voided_time_entries. This screen is the sanctioned audit view
// and the only place a voided entry may appear. Neither branch touches the
// table directly, so both get worked_minutes from the same derivation.

const errorMessages: Record<string, string> = {
  missing: "Choose both a worker and a job.",
  start: "Enter when the entry started.",
  end: "That end time is not a valid date and time.",
  order: "The end time must be after the start time.",
  save: "Could not save — try again.",
  void: "Could not update the entry — try again.",
};

const savedMessages: Record<string, string> = {
  added: "Time entry added.",
  corrected: "Correction saved — the original values are kept on the entry.",
  restored: "Entry restored. It counts towards totals again.",
};

const otLabels: Record<string, string> = {
  none: "Standard",
  "1.5": "OT 1.5×",
  "2.0": "OT 2×",
};

// ISO → the "YYYY-MM-DDTHH:mm" a datetime-local input expects, in UK time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function hhmm(mins: number): string {
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function elapsedMinutes(startIso: string, endIso: string | null): number | null {
  if (!endIso) return null;
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000
  );
}

// worked_minutes is a computed column (a SQL function taking the row), so
// the number is identical here, in reports, and in any export — elapsed
// time less the unpaid break.
const ENTRY_COLUMNS = `id, worker_id, operation_id, started_at, ended_at, ot_class,
  auto_closed, voided, voided_by, voided_at, adjusted_by, adjusted_at,
  original_values, worked_minutes,
  workers(name),
  operations(id, description, phases(code), builds(bu_number))`;

export default async function ClockingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    show?: string;
    error?: string;
    saved?: string;
    voided?: string;
  }>;
}) {
  const { show, error, saved, voided } = await searchParams;
  const showVoided = show === "voided";

  const auth = await getUserProfile();
  if (!auth) redirect("/login");
  if (auth.profile.role !== "admin") {
    return (
      <main className="max-w-xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Clocking corrections
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Only Admins can adjust clockings. Ask Andrew or Liam if an entry
          needs fixing.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: rawEntries }, { data: workers }, { data: operations }, { data: profiles }] =
    await Promise.all([
      showVoided
        ? supabase
            .from("voided_time_entries")
            .select(ENTRY_COLUMNS)
            .order("started_at", { ascending: false })
        : supabase
            .from("active_time_entries")
            .select(ENTRY_COLUMNS)
            .order("started_at", { ascending: false })
            .limit(100),
      supabase.from("workers").select("id, name").eq("active", true).order("name"),
      supabase
        .from("operations")
        .select("id, description, phases(code), builds(bu_number)")
        .order("created_at"),
      supabase.from("profiles").select("id, display_name"),
    ]);

  const who = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const workerOptions: WorkerOption[] = (workers ?? []).map((w) => ({
    id: w.id,
    name: w.name,
  }));

  const operationOptions: OperationOption[] = (operations ?? []).map((o) => ({
    id: o.id,
    label: `${o.builds?.bu_number ?? "—"} · ${o.phases?.code ?? "—"}${
      o.description ? ` · ${o.description}` : ""
    }`,
  }));

  // The view reports every column as nullable (views drop NOT NULL), so
  // normalise once rather than guarding at each use.
  const entries = (rawEntries ?? []).flatMap((e) =>
    e.id && e.started_at && e.worker_id && e.operation_id
      ? [
          {
            id: e.id,
            workerId: e.worker_id,
            operationId: e.operation_id,
            startedAt: e.started_at,
            endedAt: e.ended_at,
            otClass: e.ot_class ?? "none",
            workedMinutes: e.worked_minutes,
            autoClosed: !!e.auto_closed,
            voidedBy: e.voided_by,
            voidedAt: e.voided_at,
            adjustedBy: e.adjusted_by,
            adjustedAt: e.adjusted_at,
            corrected: !!e.original_values,
            workerName: e.workers?.name ?? "—",
            bu: e.operations?.builds?.bu_number ?? "—",
            phase: e.operations?.phases?.code ?? "—",
          },
        ]
      : []
  );

  // Overtime is collated from timestamped segments, not from the entry-level
  // ot_class: a 07:30–18:00 shift contributes 7.5h standard and 2h at 1.5x,
  // rather than counting the whole thing as premium time. Voided entries have
  // no segments by construction.
  type Segment = {
    time_entry_id: string | null;
    ot_class: string | null;
    segment_start: string | null;
    segment_end: string | null;
    minutes: number | null;
  };

  const { data: segments } = entries.length
    ? await supabase
        .from("active_time_entry_segments")
        .select("time_entry_id, ot_class, segment_start, segment_end, minutes")
        .in(
          "time_entry_id",
          entries.map((e) => e.id)
        )
        .order("segment_start")
    : { data: [] as Segment[] };

  const segmentsByEntry = new Map<string, Segment[]>();
  const totals: Record<string, number> = { none: 0, "1.5": 0, "2.0": 0 };
  for (const s of segments ?? []) {
    if (!s.time_entry_id) continue;
    const list = segmentsByEntry.get(s.time_entry_id);
    if (list) list.push(s);
    else segmentsByEntry.set(s.time_entry_id, [s]);
    if (s.ot_class && s.minutes != null) {
      totals[s.ot_class] = (totals[s.ot_class] ?? 0) + s.minutes;
    }
  }
  const totalOt = totals["1.5"] + totals["2.0"];

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Clockings
        </h1>
        <div className="flex overflow-hidden rounded-lg border border-zinc-300 text-sm dark:border-zinc-700">
          <Link
            href="/clockings"
            aria-current={!showVoided ? "true" : undefined}
            className={`px-3 py-1.5 ${
              !showVoided
                ? "bg-lime-100 font-medium text-lime-800 dark:bg-lime-800 dark:text-lime-100"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            Active
          </Link>
          <Link
            href="/clockings?show=voided"
            aria-current={showVoided ? "true" : undefined}
            className={`px-3 py-1.5 ${
              showVoided
                ? "bg-lime-100 font-medium text-lime-800 dark:bg-lime-800 dark:text-lime-100"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            Show deleted
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {showVoided
          ? "Deleted entries. They count towards nothing and appear on no other screen — restore one if it was deleted by mistake."
          : "Fix mis-clocks, wrong BU numbers, and forgotten clock-offs, or enter time on someone’s behalf. Corrections keep the original values and record who changed what."}
      </p>

      {error && errorMessages[error] && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {errorMessages[error]}
        </p>
      )}
      {saved && savedMessages[saved] && (
        <p role="status" className="mt-4 text-sm text-green-700 dark:text-green-400">
          {savedMessages[saved]}
        </p>
      )}
      {voided && (
        <p role="status" className="mt-4 text-sm text-green-700 dark:text-green-400">
          Entry deleted. It is kept here with its values and can be restored.
        </p>
      )}

      {/* Overtime collated on its own, away from standard time. */}
      {!showVoided && entries.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Standard
            </p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {hhmm(totals.none)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Overtime 1.5×
            </p>
            <p
              className={`text-xl font-semibold tabular-nums ${
                totals["1.5"] > 0
                  ? "text-status-attention dark:text-amber-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {hhmm(totals["1.5"])}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Overtime 2×
            </p>
            <p
              className={`text-xl font-semibold tabular-nums ${
                totals["2.0"] > 0
                  ? "text-status-attention dark:text-amber-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {hhmm(totals["2.0"])}
            </p>
          </div>
          <p className="ml-auto max-w-xs text-xs text-zinc-400 dark:text-zinc-500">
            Overtime is measured from the clock times, so a shift that runs
            past 16:00 counts only the hours after it as premium.
            {totalOt > 0 && ` ${hhmm(totalOt)} premium in this list.`}
          </p>
        </div>
      )}

      {/* Add on someone's behalf — the trial mode the spec expects. */}
      {!showVoided && (
        <form
          action={createTimeEntry}
          className="mt-6 grid grid-cols-1 items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[1fr_1.5fr_auto_auto_auto]"
        >
          <div>
            <label htmlFor="worker_id" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Worker
            </label>
            <select
              id="worker_id"
              name="worker_id"
              required
              defaultValue=""
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="" disabled>
                Select…
              </option>
              {workerOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="operation_id" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Job
            </label>
            <select
              id="operation_id"
              name="operation_id"
              required
              defaultValue=""
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="" disabled>
                Select…
              </option>
              {operationOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="started_at" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Started
            </label>
            <input
              id="started_at"
              name="started_at"
              type="datetime-local"
              required
              className="mt-1 block rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="ended_at" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Ended
            </label>
            <input
              id="ended_at"
              name="ended_at"
              type="datetime-local"
              className="mt-1 block rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
          >
            Add entry
          </button>
        </form>
      )}

      {entries.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {showVoided
            ? "Nothing has been deleted."
            : "No clockings recorded yet."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[56rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {["Worker", "Job", "Started", "Ended", "Worked", "Class", ""].map(
                  (h, i) => (
                    <th
                      key={h || i}
                      className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {entries.map((e) => (
                <tr key={e.id} className={showVoided ? "opacity-70" : ""}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {e.workerName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-zinc-900 dark:text-zinc-100">
                      {e.bu}
                    </span>{" "}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {e.phase}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {e.autoClosed && (
                        <span
                          className="rounded-full bg-status-attention-bg px-2 py-0.5 text-xs font-medium text-status-attention dark:bg-amber-950 dark:text-amber-300"
                          title="Closed automatically at end of shift — check the hours"
                        >
                          ⚠ auto-closed
                        </span>
                      )}
                      {e.corrected && (
                        <span
                          className="rounded-full bg-status-progress-bg px-2 py-0.5 text-xs font-medium text-status-progress dark:bg-blue-950 dark:text-blue-300"
                          title={`Corrected by ${who.get(e.adjustedBy ?? "") ?? "an admin"} on ${formatDateTime(e.adjustedAt)}`}
                        >
                          corrected
                        </span>
                      )}
                      {showVoided && (
                        <span
                          className="rounded-full bg-status-blocked-bg px-2 py-0.5 text-xs font-medium text-status-blocked dark:bg-red-950 dark:text-red-300"
                          title={`Deleted by ${who.get(e.voidedBy ?? "") ?? "an admin"} on ${formatDateTime(e.voidedAt)}`}
                        >
                          deleted
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {formatDateTime(e.startedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {e.endedAt ? formatDateTime(e.endedAt) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {e.workedMinutes === null || e.workedMinutes === undefined ? (
                      "open"
                    ) : (
                      <>
                        {hhmm(e.workedMinutes)}
                        {/* Make the deduction visible rather than silently
                            shrinking someone's day. */}
                        {(() => {
                          const elapsed = elapsedMinutes(e.startedAt, e.endedAt);
                          const deducted =
                            elapsed !== null ? elapsed - e.workedMinutes : 0;
                          return deducted > 0 ? (
                            <span
                              className="ml-1 text-xs text-zinc-400 dark:text-zinc-500"
                              title={`${hhmm(elapsed ?? 0)} on the clock, less ${deducted} min unpaid break`}
                            >
                              −{deducted}m break
                            </span>
                          ) : null;
                        })()}
                        {/* Where the entry crosses a standard-day boundary,
                            show which hours are premium and when. */}
                        {(() => {
                          const segs = segmentsByEntry.get(e.id) ?? [];
                          if (segs.length < 2) return null;
                          return (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {segs.map((s, i) => (
                                <span
                                  key={i}
                                  title={`${new Intl.DateTimeFormat("en-GB", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                    timeZone: "Europe/London",
                                  }).format(new Date(s.segment_start!))}–${new Intl.DateTimeFormat(
                                    "en-GB",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                      timeZone: "Europe/London",
                                    }
                                  ).format(new Date(s.segment_end!))}`}
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    s.ot_class === "none"
                                      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                      : "bg-status-attention-bg text-status-attention dark:bg-amber-950 dark:text-amber-300"
                                  }`}
                                >
                                  {hhmm(s.minutes ?? 0)}{" "}
                                  {s.ot_class === "none"
                                    ? "std"
                                    : `OT ${s.ot_class}×`}
                                </span>
                              ))}
                            </span>
                          );
                        })()}
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={
                        e.otClass === "none"
                          ? "text-zinc-500 dark:text-zinc-400"
                          : "font-medium text-status-attention dark:text-amber-400"
                      }
                    >
                      {otLabels[e.otClass] ?? e.otClass}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {showVoided ? (
                      <form action={restoreTimeEntry.bind(null, e.id)} className="text-right">
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Restore
                        </button>
                      </form>
                    ) : (
                      <CorrectionControls
                        workers={workerOptions}
                        operations={operationOptions}
                        entry={{
                          id: e.id,
                          workerId: e.workerId,
                          operationId: e.operationId,
                          startedLocal: toLocalInput(e.startedAt),
                          endedLocal: toLocalInput(e.endedAt),
                          label: `${e.workerName} · ${e.bu} ${e.phase} · ${formatDateTime(e.startedAt)} · ${
                            e.workedMinutes != null ? hhmm(e.workedMinutes) : "open"
                          }`,
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Worked time excludes the unpaid 12:00–13:00 break, so a full
        07:30–16:00 day counts as 7.5 hours. If someone genuinely worked
        through lunch, correct the entry. Overtime is split out at the
        standard-day boundaries and carries its own times — a shift running
        07:30–18:00 is 7.5 hours standard plus 2 hours at 1.5×, never 10.5
        hours of premium. Clockings are never destroyed: deleting marks an
        entry as deleted and keeps its values, and overtime is always
        recalculated from the times, never typed in.
      </p>
    </main>
  );
}

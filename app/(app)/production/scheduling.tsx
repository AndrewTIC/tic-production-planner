"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  createAssignments,
  deleteAssignment,
  deleteAssignments,
  restoreAssignment,
  updateAssignment,
  type AssignmentRow,
} from "./actions";
import { formatHours, initials, phaseBar, workerColor } from "./board-ui";

// Client scheduling layer (slice 2): "Schedule labour" creates a multi-day
// allocation from a date range + hours-per-day + overtime mode — one
// assignment row per day, undone as a batch. Editing a bar stays single-day.
// Every change shows a 6s toast with Undo, and Ctrl/Cmd+Z reverses the last
// scheduling change at any time (design spec §16).

type Worker = { id: string; name: string };

type OperationInfo = {
  operationId: string;
  buNumber: string;
  phase: string;
  description: string | null;
  remaining: number;
};

type DialogState =
  | { mode: "create"; op: OperationInfo; date: string }
  | { mode: "edit"; op: OperationInfo; assignment: AssignmentRow };

type LastChange =
  | { kind: "create"; rows: AssignmentRow[] }
  | { kind: "update"; previous: AssignmentRow }
  | { kind: "delete"; row: AssignmentRow };

type SchedulingApi = {
  openCreate: (op: OperationInfo, date?: string) => void;
  openEdit: (op: OperationInfo, assignment: AssignmentRow) => void;
};

const SchedulingContext = createContext<SchedulingApi | null>(null);

function useScheduling(): SchedulingApi {
  const api = useContext(SchedulingContext);
  if (!api) throw new Error("useScheduling outside SchedulingProvider");
  return api;
}

function isWeekendDate(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

// Overtime modes for multi-day scheduling: standard skips weekends entirely;
// weekend-ot keeps weekdays standard and flags Sat/Sun as OT; all-ot flags
// every day (evening/early OT on normal working days).
export type OtMode = "standard" | "weekend-ot" | "all-ot";

function expandDays(
  from: string,
  to: string,
  mode: OtMode
): { date: string; overtime: boolean }[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return [];
  if (to < from) return [];
  const out: { date: string; overtime: boolean }[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end && out.length <= 31) {
    const date = cursor.toISOString().slice(0, 10);
    const weekend = isWeekendDate(date);
    if (mode === "standard") {
      if (!weekend) out.push({ date, overtime: false });
    } else if (mode === "weekend-ot") {
      out.push({ date, overtime: weekend });
    } else {
      out.push({ date, overtime: true });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function SchedulingProvider({
  workers,
  defaultDate,
  children,
}: {
  workers: Worker[];
  defaultDate: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toast, setToast] = useState<{ label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastChange = useRef<LastChange | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((label: string) => {
    setToast({ label });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const undo = useCallback(async () => {
    const change = lastChange.current;
    if (!change) return;
    lastChange.current = null;
    setToast(null);
    const result =
      change.kind === "create"
        ? await deleteAssignments(change.rows.map((r) => r.id))
        : change.kind === "update"
          ? await updateAssignment(change.previous.id, {
              worker_id: change.previous.worker_id,
              date: change.previous.date,
              planned_hours: change.previous.planned_hours,
              overtime: change.previous.overtime,
            })
          : await restoreAssignment(change.row);
    if (!result.ok) setError(result.message);
    router.refresh();
  }, [router]);

  // Ctrl/Cmd+Z anywhere on the board (design spec §16).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        void undo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo]);

  const api: SchedulingApi = {
    openCreate: (op, date) =>
      setDialog({ mode: "create", op, date: date ?? defaultDate }),
    openEdit: (op, assignment) => setDialog({ mode: "edit", op, assignment }),
  };

  async function submitCreate(values: {
    worker_id: string;
    planned_hours: number;
    days: { date: string; overtime: boolean }[];
  }) {
    if (!dialog || dialog.mode !== "create") return;
    setBusy(true);
    setError(null);
    const workerName =
      workers.find((w) => w.id === values.worker_id)?.name ?? "worker";

    const result = await createAssignments({
      operation_id: dialog.op.operationId,
      worker_id: values.worker_id,
      planned_hours: values.planned_hours,
      days: values.days,
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);

    lastChange.current = { kind: "create", rows: result.assignments };
    const n = values.days.length;
    const h = formatHours(values.planned_hours);
    showToast(
      n === 1
        ? `${workerName} — ${h}h on ${dialog.op.buNumber} ${dialog.op.phase}, ${shortDate(values.days[0].date)}`
        : `${workerName} — ${n} days × ${h}h on ${dialog.op.buNumber} ${dialog.op.phase}, ${shortDate(values.days[0].date)}–${shortDate(values.days[n - 1].date)}`
    );
    setDialog(null);
    router.refresh();
  }

  async function submitEdit(values: {
    worker_id: string;
    date: string;
    planned_hours: number;
    overtime: boolean;
  }) {
    if (!dialog || dialog.mode !== "edit") return;
    setBusy(true);
    setError(null);
    const workerName =
      workers.find((w) => w.id === values.worker_id)?.name ?? "worker";

    const previous = dialog.assignment;
    const result = await updateAssignment(previous.id, values);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    lastChange.current = { kind: "update", previous };
    showToast(
      `${dialog.op.buNumber} ${dialog.op.phase} → ${workerName}, ${shortDate(values.date)}, ${formatHours(values.planned_hours)}h`
    );
    setDialog(null);
    router.refresh();
  }

  async function remove() {
    if (!dialog || dialog.mode !== "edit") return;
    setBusy(true);
    setError(null);
    const result = await deleteAssignment(dialog.assignment.id);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    lastChange.current = { kind: "delete", row: result.assignment };
    showToast(
      `Removed ${dialog.op.buNumber} ${dialog.op.phase} assignment, ${shortDate(result.assignment.date)}`
    );
    setDialog(null);
    router.refresh();
  }

  return (
    <SchedulingContext.Provider value={api}>
      {children}

      {dialog && (
        <AssignmentDialog
          key={
            dialog.mode === "edit"
              ? dialog.assignment.id
              : `new-${dialog.op.operationId}`
          }
          dialog={dialog}
          workers={workers}
          busy={busy}
          error={error}
          onSubmitCreate={submitCreate}
          onSubmitEdit={submitEdit}
          onDelete={dialog.mode === "edit" ? remove : undefined}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-(--shadow-2) dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <span>{toast.label}</span>
          <button
            type="button"
            onClick={() => void undo()}
            className="font-semibold text-lime-800 underline underline-offset-2 hover:no-underline dark:text-lime-100"
          >
            Undo
          </button>
        </div>
      )}
    </SchedulingContext.Provider>
  );
}

const inputClasses =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClasses =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

function AssignmentDialog({
  dialog,
  workers,
  busy,
  error,
  onSubmitCreate,
  onSubmitEdit,
  onDelete,
  onClose,
}: {
  dialog: DialogState;
  workers: Worker[];
  busy: boolean;
  error: string | null;
  onSubmitCreate: (values: {
    worker_id: string;
    planned_hours: number;
    days: { date: string; overtime: boolean }[];
  }) => void;
  onSubmitEdit: (values: {
    worker_id: string;
    date: string;
    planned_hours: number;
    overtime: boolean;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const editing = dialog.mode === "edit" ? dialog.assignment : null;
  const [workerId, setWorkerId] = useState(editing?.worker_id ?? "");
  const [dateFrom, setDateFrom] = useState(
    editing?.date ?? (dialog.mode === "create" ? dialog.date : "")
  );
  const [dateTo, setDateTo] = useState(dateFrom);
  const [hours, setHours] = useState(
    editing
      ? formatHours(editing.planned_hours)
      : formatHours(Math.min(dialog.op.remaining, 7.5))
  );
  const [otMode, setOtMode] = useState<OtMode>(
    dialog.mode === "create" && isWeekendDate(dateFrom) ? "all-ot" : "standard"
  );
  const [editOvertime, setEditOvertime] = useState(editing?.overtime ?? false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days =
    dialog.mode === "create" ? expandDays(dateFrom, dateTo, otMode) : [];
  const otDays = days.filter((d) => d.overtime).length;
  const totalHours = days.length * Number(hours || 0);
  const overAllocated =
    dialog.mode === "create" && totalHours > dialog.op.remaining;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={dialog.mode === "create" ? "Schedule labour" : "Edit assignment"}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-(--shadow-3) dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {dialog.mode === "create" ? "Schedule labour" : "Edit assignment"}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
            {dialog.op.buNumber}
          </span>
          <span
            className={`rounded-full border-l-4 py-0.5 pl-1.5 pr-2 text-xs font-medium ${
              phaseBar[dialog.op.phase] ??
              "border-l-zinc-400 bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            {dialog.op.phase}
          </span>
          {dialog.op.description && <span>{dialog.op.description}</span>}
        </p>
        {dialog.mode === "create" && (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {formatHours(dialog.op.remaining)}h still unassigned on this
            operation.
          </p>
        )}

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (dialog.mode === "create") {
              onSubmitCreate({
                worker_id: workerId,
                planned_hours: Number(hours),
                days,
              });
            } else {
              onSubmitEdit({
                worker_id: workerId,
                date: dateFrom,
                planned_hours: Number(hours),
                overtime: editOvertime,
              });
            }
          }}
        >
          <div>
            <label htmlFor="as-worker" className={labelClasses}>
              Worker <span className="text-red-500">*</span>
            </label>
            <select
              id="as-worker"
              required
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className={inputClasses}
            >
              <option value="" disabled>
                Select a worker…
              </option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {dialog.mode === "create" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="as-from" className={labelClasses}>
                    From <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="as-from"
                    type="date"
                    required
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      if (dateTo < e.target.value) setDateTo(e.target.value);
                    }}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="as-to" className={labelClasses}>
                    To <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="as-to"
                    type="date"
                    required
                    min={dateFrom}
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="as-hours" className={labelClasses}>
                    Hours per day <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="as-hours"
                    type="number"
                    required
                    min="0.25"
                    max="24"
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="as-ot" className={labelClasses}>
                    Overtime
                  </label>
                  <select
                    id="as-ot"
                    value={otMode}
                    onChange={(e) => setOtMode(e.target.value as OtMode)}
                    className={inputClasses}
                  >
                    <option value="standard">Standard days (skip Sat/Sun)</option>
                    <option value="weekend-ot">Standard + weekend OT</option>
                    <option value="all-ot">All days as overtime</option>
                  </select>
                </div>
              </div>

              {/* Live expansion preview — what Add will actually create. */}
              <p
                className={`text-xs ${
                  days.length === 0
                    ? "text-red-600 dark:text-red-400"
                    : overAllocated
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {days.length === 0
                  ? "No days match — a Sat/Sun-only range needs an overtime mode."
                  : `${days.length - otDays} standard${otDays > 0 ? ` + ${otDays} OT` : ""} day${days.length === 1 ? "" : "s"} · ${formatHours(totalHours)}h total${
                      overAllocated
                        ? ` — exceeds the ${formatHours(dialog.op.remaining)}h unassigned (allowed; estimates are estimates)`
                        : ""
                    }`}
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="as-date" className={labelClasses}>
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="as-date"
                    type="date"
                    required
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="as-hours-edit" className={labelClasses}>
                    Hours <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="as-hours-edit"
                    type="number"
                    required
                    min="0.25"
                    max="24"
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={editOvertime}
                  onChange={(e) => setEditOvertime(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                />
                Overtime
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  — outside 07:30–16:00 Mon–Fri, or weekend work
                </span>
              </label>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={busy || (dialog.mode === "create" && days.length === 0)}
              className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-lime-600 disabled:opacity-50"
            >
              {dialog.mode === "create" ? "Add" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            {onDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={onDelete}
                className="ml-auto rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Remove
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Board-side triggers ─────────────────────────────────────────────

export function AssignmentBar({
  assignment,
  op,
  workerName,
  canWrite,
  compact = false,
  conflicts,
}: {
  assignment: AssignmentRow;
  op: OperationInfo;
  workerName: string;
  canWrite: boolean;
  // Fortnight view: columns are half-width, so the bar shows the
  // colour-coded initials badge and hours only — the name lives in the
  // tooltip. The key explains that worker colours are consistent.
  compact?: boolean;
  // Slice 3: reasons this assignment needs a scheduler's eye (holiday
  // clash, competency, overload, past delivery). Flags, never blocks.
  conflicts?: string[];
}) {
  const { openEdit } = useScheduling();
  const hasConflict = !!conflicts && conflicts.length > 0;
  const classes = `mb-1 flex w-full items-center gap-1.5 rounded-md border border-l-4 py-1 text-left text-xs text-zinc-800 shadow-(--shadow-1) dark:text-zinc-200 ${
    compact ? "px-1" : "px-1.5"
  } ${phaseBar[op.phase] ?? "border-l-zinc-400 bg-white dark:bg-zinc-900"} ${
    assignment.overtime
      ? "border-y-amber-400 border-r-amber-400 dark:border-y-amber-600 dark:border-r-amber-600"
      : "border-y-zinc-200 border-r-zinc-200 dark:border-y-zinc-700 dark:border-r-zinc-700"
  }`;

  const label = `${workerName} — ${formatHours(assignment.planned_hours)}h${
    assignment.overtime ? " overtime" : ""
  } on ${op.buNumber} ${op.phase}${
    hasConflict ? ` — ⚠ ${conflicts.join("; ")}` : ""
  }`;

  const content = (
    <>
      {hasConflict && (
        <span
          aria-label={`Conflict: ${conflicts.join("; ")}`}
          className="shrink-0 text-amber-600 dark:text-amber-400"
        >
          ⚠
        </span>
      )}
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${workerColor(workerName)}`}
      >
        {initials(workerName)}
      </span>
      {!compact && <span className="truncate font-medium">{workerName}</span>}
      <span
        className={`shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400 ${
          compact ? "" : "ml-auto"
        }`}
      >
        {formatHours(assignment.planned_hours)}h
        {assignment.overtime && (compact ? "*" : " OT")}
      </span>
    </>
  );

  if (!canWrite)
    return (
      <div className={classes} title={label}>
        {content}
      </div>
    );

  return (
    <button
      type="button"
      onClick={() => openEdit(op, assignment)}
      title={`${label} — click to edit`}
      className={`${classes} cursor-pointer hover:brightness-95 dark:hover:brightness-110`}
    >
      {content}
    </button>
  );
}

export function AssignButton({ op }: { op: OperationInfo }) {
  const { openCreate } = useScheduling();
  return (
    <button
      type="button"
      onClick={() => openCreate(op)}
      className="rounded-lg bg-lime-500 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-lime-600"
    >
      Assign
    </button>
  );
}

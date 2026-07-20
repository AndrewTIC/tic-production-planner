"use client";

import { useEffect, useState } from "react";
import { updateTimeEntry, voidTimeEntry } from "./actions";

// Correction controls for one time entry. Two deliberately different
// weights: editing is a plain form, while voiding is gated behind an
// explicit confirmation that spells out what happens (CLAUDE.md rule 6 —
// "Deleting in the UI requires a clear confirmation warning").

export type WorkerOption = { id: string; name: string };
export type OperationOption = { id: string; label: string };

export type EntryValues = {
  id: string;
  workerId: string;
  operationId: string;
  startedLocal: string; // datetime-local format
  endedLocal: string;
  label: string; // human summary for the confirmation copy
};

const inputClasses =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClasses = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export function CorrectionControls({
  entry,
  workers,
  operations,
}: {
  entry: EntryValues;
  workers: WorkerOption[];
  operations: OperationOption[];
}) {
  const [mode, setMode] = useState<null | "edit" | "void">(null);

  useEffect(() => {
    if (!mode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMode(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode]);

  return (
    <>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Correct
        </button>
        <button
          type="button"
          onClick={() => setMode("void")}
          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete
        </button>
      </div>

      {mode && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4"
          onClick={() => setMode(null)}
        >
          <div
            role="dialog"
            aria-label={mode === "edit" ? "Correct time entry" : "Delete time entry"}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-left shadow-(--shadow-3) dark:border-zinc-800 dark:bg-zinc-900"
          >
            {mode === "edit" ? (
              <>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Correct time entry
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  The original values are kept and the change is recorded
                  against your name.
                </p>
                <form
                  action={updateTimeEntry.bind(null, entry.id)}
                  className="mt-4 space-y-3"
                >
                  <div>
                    <label htmlFor={`w-${entry.id}`} className={labelClasses}>
                      Worker
                    </label>
                    <select
                      id={`w-${entry.id}`}
                      name="worker_id"
                      required
                      defaultValue={entry.workerId}
                      className={inputClasses}
                    >
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`o-${entry.id}`} className={labelClasses}>
                      Job
                    </label>
                    <select
                      id={`o-${entry.id}`}
                      name="operation_id"
                      required
                      defaultValue={entry.operationId}
                      className={inputClasses}
                    >
                      {operations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`s-${entry.id}`} className={labelClasses}>
                        Started
                      </label>
                      <input
                        id={`s-${entry.id}`}
                        name="started_at"
                        type="datetime-local"
                        required
                        defaultValue={entry.startedLocal}
                        className={inputClasses}
                      />
                    </div>
                    <div>
                      <label htmlFor={`e-${entry.id}`} className={labelClasses}>
                        Ended
                      </label>
                      <input
                        id={`e-${entry.id}`}
                        name="ended_at"
                        type="datetime-local"
                        defaultValue={entry.endedLocal}
                        className={inputClasses}
                      />
                      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                        Leave empty to reopen the entry.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Overtime class is recalculated from these times — it is
                    never typed in.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
                    >
                      Save correction
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode(null)}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Delete this time entry?
                </h2>
                <p className="mt-3 rounded-xl bg-status-blocked-bg px-4 py-3 text-sm text-status-blocked dark:bg-red-950 dark:text-red-300">
                  <strong className="block">{entry.label}</strong>
                  It will be removed from every total, report, and screen, and
                  the hours will stop counting towards the build.
                </p>
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Nothing is destroyed: the entry is kept with its original
                  values, stamped with your name and the time, and stays
                  visible under <strong>Show deleted</strong> — where it can be
                  restored if this was a mistake.
                </p>
                <div className="mt-4 flex gap-2">
                  <form action={voidTimeEntry.bind(null, entry.id)}>
                    <button
                      type="submit"
                      className="rounded-lg bg-status-blocked px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                      Yes, delete it
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Keep it
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

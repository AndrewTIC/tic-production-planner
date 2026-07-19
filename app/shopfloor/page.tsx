import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { clearBlocked, clockOff, clockOn, setBlocked } from "./actions";
import { Elapsed } from "./kiosk-clock";

// Shopfloor clocking screen (spec §6.6). Two states: pick who you are, then
// either clock on to a job or clock off the one you are on. Clocking on to
// new work ends the previous entry automatically. Everything is a big
// tap target; the only typing is a blocked reason.

const errorMessages: Record<string, string> = {
  on: "Could not clock on — try again, or ask Andrew or Liam.",
  off: "Could not clock off — try again, or ask Andrew or Liam.",
  switch: "Could not close the previous job — try again.",
  reason: "Type a short reason before flagging the job blocked.",
  blocked: "Could not save the blocked flag — try again.",
};

const phaseTint: Record<string, string> = {
  MECH: "bg-lime-100 text-lime-800 dark:bg-lime-800 dark:text-lime-100",
  ELEC: "bg-status-progress-bg text-status-progress dark:bg-status-progress dark:text-white",
  INSP: "bg-status-review-bg text-status-review dark:bg-status-review dark:text-white",
};

export default async function ShopfloorPage({
  searchParams,
}: {
  searchParams: Promise<{
    worker?: string;
    error?: string;
    done?: string;
    blocked?: string;
  }>;
}) {
  const { worker: workerId, error, done, blocked } = await searchParams;
  const supabase = await createClient();

  const { data: workers } = await supabase
    .from("workers")
    .select("id, name")
    .eq("active", true)
    .order("name");

  const worker = (workers ?? []).find((w) => w.id === workerId) ?? null;

  // ── Step 1: who are you? ────────────────────────────────────────
  if (!worker) {
    return (
      <>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Who are you?
        </h1>
        <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
          Tap your name to clock on or off.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(workers ?? []).map((w) => (
            <Link
              key={w.id}
              href={`/shopfloor?worker=${w.id}`}
              className="flex min-h-24 items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 text-center text-xl font-semibold text-zinc-900 shadow-(--shadow-1) hover:border-lime-600 hover:bg-lime-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              {w.name}
            </Link>
          ))}
        </div>
      </>
    );
  }

  // Open entry for this worker, if any. active_time_entries excludes voided
  // rows (CLAUDE.md rule 6) — never query time_entries directly here.
  const { data: rawOpenEntry } = await supabase
    .from("active_time_entries")
    .select("id, started_at, operation_id")
    .eq("worker_id", worker.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Postgres views drop NOT NULL, so every column of active_time_entries is
  // typed nullable however the base table is defined — narrow once here.
  const openEntry =
    rawOpenEntry?.operation_id && rawOpenEntry.started_at
      ? {
          operationId: rawOpenEntry.operation_id,
          startedAt: rawOpenEntry.started_at,
        }
      : null;

  const { data: currentOperation } = openEntry
    ? await supabase
        .from("operations")
        .select(
          "id, description, blocked, blocked_reason, phases(code, name), builds(bu_number, parts(part_number))"
        )
        .eq("id", openEntry.operationId)
        .single()
    : { data: null };

  // Builds available to clock onto: clockable statuses only (spec §6.6).
  const { data: clockableBuilds } = await supabase
    .from("builds")
    .select(
      `id, bu_number, requested_delivery_date,
       parts(part_number), customers(name),
       build_statuses!inner(name, clockable),
       operations(id, description, blocked, status, phases(code, name))`
    )
    .eq("build_statuses.clockable", true)
    .order("bu_number");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          {worker.name}
        </h1>
        <Link
          href="/shopfloor"
          className="rounded-xl border border-zinc-300 px-5 py-3 text-base text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Not you? Change
        </Link>
      </div>

      {error && errorMessages[error] && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-status-blocked-bg px-4 py-3 text-base text-status-blocked dark:bg-red-950 dark:text-red-300"
        >
          {errorMessages[error]}
        </p>
      )}
      {done && !openEntry && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-lime-100 px-4 py-3 text-base font-medium text-lime-800 dark:bg-lime-800 dark:text-lime-100"
        >
          Clocked off. Thanks.
        </p>
      )}
      {blocked && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-status-attention-bg px-4 py-3 text-base text-status-attention dark:bg-amber-950 dark:text-amber-300"
        >
          Flagged as blocked — it shows on the planning board straight away.
        </p>
      )}

      {openEntry && currentOperation ? (
        // ── Clocked on ───────────────────────────────────────────
        <section className="mt-6 rounded-2xl border border-lime-600 bg-white p-6 shadow-(--shadow-1) dark:bg-zinc-900">
          <p className="text-sm font-semibold uppercase tracking-wide text-lime-800 dark:text-lime-100">
            Clocked on
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              {currentOperation.builds?.bu_number ?? "—"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-base font-medium ${
                phaseTint[currentOperation.phases?.code ?? ""] ??
                "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {currentOperation.phases?.name ?? "—"}
            </span>
            <span className="text-lg text-zinc-500 dark:text-zinc-400">
              {currentOperation.builds?.parts?.part_number ?? ""}
            </span>
          </div>
          {currentOperation.description && (
            <p className="mt-1 text-lg text-zinc-500 dark:text-zinc-400">
              {currentOperation.description}
            </p>
          )}
          <p className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            <Elapsed startedAt={openEntry.startedAt} /> so far
          </p>

          <form action={clockOff.bind(null, worker.id)} className="mt-6">
            <button
              type="submit"
              className="min-h-16 w-full rounded-2xl bg-lime-500 px-6 text-2xl font-semibold text-neutral-800 hover:bg-lime-600"
            >
              Clock off
            </button>
          </form>

          {/* Blocked flag — the one place typing is needed. */}
          {currentOperation.blocked ? (
            <div className="mt-4 rounded-xl bg-status-attention-bg p-4 dark:bg-amber-950">
              <p className="text-base font-medium text-status-attention dark:text-amber-300">
                ⚠ Flagged blocked: {currentOperation.blocked_reason}
              </p>
              <form
                action={clearBlocked.bind(null, worker.id, currentOperation.id)}
                className="mt-3"
              >
                <button
                  type="submit"
                  className="min-h-12 rounded-xl border border-zinc-300 bg-white px-5 text-base text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  Unblock — it is moving again
                </button>
              </form>
            </div>
          ) : (
            <form
              action={setBlocked.bind(null, worker.id, currentOperation.id)}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="blocked_reason"
                  className="block text-base text-zinc-700 dark:text-zinc-300"
                >
                  Something stopping this job?
                </label>
                <input
                  id="blocked_reason"
                  name="blocked_reason"
                  type="text"
                  placeholder="e.g. waiting on enclosure"
                  className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 px-4 text-base dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                className="min-h-12 rounded-xl border border-status-attention px-5 text-base font-medium text-status-attention dark:border-amber-600 dark:text-amber-400"
              >
                Flag blocked
              </button>
            </form>
          )}
        </section>
      ) : null}

      {/* Job list is always available: tapping one while already clocked on
          ends the current entry and starts the new one in a single action
          (spec §6.6) — no need to remember to clock off first. */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {openEntry ? "Switch to a different job" : "Pick the job you are starting"}
        </h2>
          {(clockableBuilds ?? []).length === 0 ? (
            <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">
              No builds are ready to clock onto. Ask Sophie, Andrew, or Liam.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {(clockableBuilds ?? []).map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-(--shadow-1) dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {b.bu_number}
                    </span>
                    <span className="text-lg text-zinc-500 dark:text-zinc-400">
                      {b.parts?.part_number ?? "—"} · {b.customers?.name ?? "—"}
                    </span>
                    {b.requested_delivery_date && (
                      <span className="text-base text-zinc-400 dark:text-zinc-500">
                        due {formatDate(b.requested_delivery_date)}
                      </span>
                    )}
                  </div>

                  {b.operations.filter((o) => o.status !== "Complete").length ===
                  0 ? (
                    <p className="mt-3 text-base text-zinc-400 dark:text-zinc-500">
                      No open operations on this build.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {b.operations
                        .filter((o) => o.status !== "Complete")
                        .map((o) => {
                          const isCurrent = openEntry?.operationId === o.id;
                          return (
                          <form
                            key={o.id}
                            action={clockOn.bind(null, worker.id, o.id)}
                          >
                            <button
                              type="submit"
                              disabled={isCurrent}
                              title={
                                isCurrent ? "You are already on this job" : undefined
                              }
                              className={`flex min-h-16 min-w-48 flex-col items-start justify-center rounded-xl border px-5 py-2 text-left ${
                                isCurrent
                                  ? "cursor-default border-lime-600 bg-lime-100 dark:border-lime-600 dark:bg-lime-800/30"
                                  : "border-zinc-300 hover:border-lime-600 hover:bg-lime-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
                                    phaseTint[o.phases?.code ?? ""] ??
                                    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                  }`}
                                >
                                  {o.phases?.name ?? "—"}
                                </span>
                                {o.blocked && (
                                  <span
                                    className="text-status-attention dark:text-amber-400"
                                    title="Flagged blocked"
                                  >
                                    ⚠
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="text-sm font-medium text-lime-800 dark:text-lime-100">
                                    ● on this now
                                  </span>
                                )}
                              </span>
                              {o.description && (
                                <span className="mt-1 text-base text-zinc-500 dark:text-zinc-400">
                                  {o.description}
                                </span>
                              )}
                            </button>
                          </form>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </section>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { updateWorker } from "../actions";

export default async function WorkerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ id }, { error, saved }] = await Promise.all([params, searchParams]);

  const auth = await getUserProfile();
  const canWrite =
    auth !== null && ["admin", "commercial"].includes(auth.profile.role);

  const supabase = await createClient();
  const [{ data: worker }, { data: phases }, { data: profiles }, { data: linkedWorkers }] =
    await Promise.all([
      supabase
        .from("workers")
        .select("*, worker_phases(phase_id)")
        .eq("id", id)
        .single(),
      supabase.from("phases").select("id, code, name").order("code"),
      supabase.from("profiles").select("id, display_name").order("display_name"),
      supabase.from("workers").select("id, user_id").not("user_id", "is", null),
    ]);

  if (!worker) notFound();

  const competencyIds = new Set(worker.worker_phases.map((wp) => wp.phase_id));
  // Offer profiles not linked to any OTHER worker (this worker's own link stays).
  const linkedElsewhere = new Set(
    (linkedWorkers ?? []).filter((w) => w.id !== worker.id).map((w) => w.user_id)
  );
  const linkableProfiles = (profiles ?? []).filter(
    (p) => !linkedElsewhere.has(p.id)
  );

  const day = worker.standard_day as {
    start?: string;
    end?: string;
    break_start?: string;
    break_end?: string;
    hours?: number;
    days?: string[];
  };

  const updateWithId = updateWorker.bind(null, worker.id);

  return (
    <main className="max-w-xl">
      <Link
        href="/workers"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Workers
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {worker.name}
        </h1>
        {!worker.active && (
          <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Inactive
          </span>
        )}
      </div>

      <form action={canWrite ? updateWithId : undefined} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name {canWrite && <span className="text-red-500">*</span>}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            disabled={!canWrite}
            defaultValue={worker.name}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Phase competencies
          </legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {(phases ?? []).map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <input
                  type="checkbox"
                  name="phases"
                  value={p.id}
                  disabled={!canWrite}
                  defaultChecked={competencyIds.has(p.id)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                />
                {p.name}
              </label>
            ))}
          </div>
          {canWrite && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              The board flags assignments outside these — a flag, not a block.
            </p>
          )}
        </fieldset>

        <div>
          <label
            htmlFor="user_id"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Linked system user <span className="text-zinc-400">(optional)</span>
          </label>
          <select
            id="user_id"
            name="user_id"
            disabled={!canWrite}
            defaultValue={worker.user_id ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          >
            <option value="">Not a system user</option>
            {linkableProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Standard day
          </span>
          <p className="mt-1 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {day.start ?? "07:30"}–{day.end ?? "16:00"}, break{" "}
            {day.break_start ?? "12:00"}–{day.break_end ?? "13:00"} ·{" "}
            {day.hours ?? 7.5} productive hours ·{" "}
            {(day.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]).join(" ")}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            The company standard day — per-worker patterns are a later
            refinement. Anything outside this window is overtime.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="active"
            disabled={!canWrite}
            defaultChecked={worker.active}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          Active
          <span className="text-zinc-400 dark:text-zinc-500">
            — workers are deactivated, never deleted; their booked hours keep
            their history
          </span>
        </label>

        {error === "name" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Name is required.
          </p>
        )}
        {(error === "save" || error === "phases") && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error === "phases"
              ? "Saved the worker but not the competencies — check and save again."
              : "Could not save the changes — try again."}
          </p>
        )}
        {saved && !error && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            Saved.
          </p>
        )}

        {canWrite && (
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
            >
              Save changes
            </button>
            <Link
              href="/workers"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        )}
      </form>

      <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
        Created {formatDateTime(worker.created_at)} · Last updated{" "}
        {formatDateTime(worker.updated_at)}
      </p>
    </main>
  );
}

import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { addHoliday, deleteHoliday } from "./actions";

const inputClasses =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClasses =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const errorMessages: Record<string, string> = {
  dates: "A start date is required.",
  order: "The end date is before the start date.",
  half_range:
    "A half day is a single date — leave “To” empty. For part-days around a longer absence, add separate entries (e.g. Thu PM, then Fri–Mon).",
  save: "Could not save — try again.",
};

const partLabels: Record<string, string> = { am: "AM", pm: "PM" };

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const auth = await getUserProfile();
  const canWrite =
    auth !== null && ["admin", "commercial"].includes(auth.profile.role);

  const supabase = await createClient();
  const [{ data: holidays, error: loadError }, { data: workers }] =
    await Promise.all([
      supabase
        .from("holidays")
        .select("id, worker_id, date_from, date_to, part_of_day, note, workers(name)")
        .order("date_from", { ascending: false }),
      supabase
        .from("workers")
        .select("id, name")
        .eq("active", true)
        .order("name"),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Holidays
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Approved leave and company closure days — the capacity model and the
        board’s holiday-conflict flag read from here.
      </p>

      {canWrite && (
        <form
          action={addHoliday}
          className="mt-6 grid grid-cols-1 items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[1fr_auto_auto_auto_1fr_auto]"
        >
          <div>
            <label htmlFor="worker_id" className={labelClasses}>
              Who
            </label>
            <select id="worker_id" name="worker_id" defaultValue="" className={inputClasses}>
              <option value="">Company-wide closure</option>
              {(workers ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="date_from" className={labelClasses}>
              From <span className="text-red-500">*</span>
            </label>
            <input id="date_from" name="date_from" type="date" required className={inputClasses} />
          </div>
          <div>
            <label htmlFor="date_to" className={labelClasses}>
              To
            </label>
            <input id="date_to" name="date_to" type="date" className={inputClasses} />
          </div>
          <div>
            <label htmlFor="part_of_day" className={labelClasses}>
              Part
            </label>
            <select
              id="part_of_day"
              name="part_of_day"
              defaultValue="full"
              className={inputClasses}
            >
              <option value="full">Full day(s)</option>
              <option value="am">Morning (AM)</option>
              <option value="pm">Afternoon (PM)</option>
            </select>
          </div>
          <div>
            <label htmlFor="note" className={labelClasses}>
              Note
            </label>
            <input
              id="note"
              name="note"
              type="text"
              autoComplete="off"
              placeholder="e.g. Annual leave, Christmas shutdown"
              className={inputClasses}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Add
          </button>
        </form>
      )}

      {error && errorMessages[error] && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {errorMessages[error]}
        </p>
      )}

      {loadError ? (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">
          Could not load holidays.
        </p>
      ) : !holidays || holidays.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No holidays recorded.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[36rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Who
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  From
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  To
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Note
                </th>
                {canWrite && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {holidays.map((h) => {
                const past = h.date_to < today;
                return (
                  <tr
                    key={h.id}
                    className={past ? "text-zinc-400 dark:text-zinc-600" : ""}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {h.worker_id ? (
                        h.workers?.name ?? "—"
                      ) : (
                        <span className="font-medium">Company-wide</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(h.date_from)}
                      {h.part_of_day !== "full" && (
                        <span className="ml-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {partLabels[h.part_of_day]}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {h.part_of_day === "full" ? formatDate(h.date_to) : "—"}
                    </td>
                    <td className="max-w-md truncate px-4 py-3">{h.note ?? ""}</td>
                    {canWrite && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <form action={deleteHoliday.bind(null, h.id)}>
                          <button
                            type="submit"
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

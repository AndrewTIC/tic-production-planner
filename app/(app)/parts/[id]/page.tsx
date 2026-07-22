import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { updatePart } from "../actions";

function hours(minutes: number): string {
  return (minutes / 60).toFixed(1).replace(/\.0$/, "");
}

export default async function PartPage({
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
  const { data: part } = await supabase
    .from("parts")
    .select("*")
    .eq("id", id)
    .single();

  if (!part) notFound();

  // The point of a part record: every build of this part number, with what
  // the labour really was and where the paper trail lives.
  const { data: history } = await supabase
    .from("builds")
    .select(
      `id, bu_number, order_number, requested_delivery_date, created_at,
       customers(name), build_statuses(name),
       operations(id, estimated_hours), notes(count), documents(count)`
    )
    .eq("part_id", id)
    .order("created_at", { ascending: false });

  const opIds = (history ?? []).flatMap((b) => b.operations.map((o) => o.id));
  const { data: worked } = opIds.length
    ? await supabase
        .from("active_time_entries")
        .select("operation_id, worked_minutes")
        .in("operation_id", opIds)
    : { data: [] as { operation_id: string | null; worked_minutes: number | null }[] };

  const actualByOp = new Map<string, number>();
  for (const w of worked ?? []) {
    if (!w.operation_id || !w.worked_minutes) continue;
    actualByOp.set(
      w.operation_id,
      (actualByOp.get(w.operation_id) ?? 0) + w.worked_minutes
    );
  }

  const historyRows = (history ?? []).map((b) => ({
    ...b,
    estimatedMinutes: b.operations.reduce(
      (s, o) => s + Math.round(Number(o.estimated_hours) * 60),
      0
    ),
    actualMinutes: b.operations.reduce(
      (s, o) => s + (actualByOp.get(o.id) ?? 0),
      0
    ),
  }));

  const updateWithId = updatePart.bind(null, part.id);

  return (
    <main className="max-w-4xl">
      <Link
        href="/parts"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Parts
      </Link>
      <h1 className="mt-2 font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {part.part_number}
      </h1>

      <form action={canWrite ? updateWithId : undefined} className="mt-6 max-w-xl space-y-4">
        <div>
          <label
            htmlFor="part_number"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Part number {canWrite && <span className="text-red-500">*</span>}
          </label>
          <input
            id="part_number"
            name="part_number"
            type="text"
            required
            autoComplete="off"
            disabled={!canWrite}
            defaultValue={part.part_number}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 font-mono text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          />
          {canWrite && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Every build of this part links here — only correct the number,
              don’t reuse the record for a different part.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            disabled={!canWrite}
            defaultValue={part.description ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          />
        </div>

        {error === "part_number" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Part number is required.
          </p>
        )}
        {error === "duplicate" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Another part already has that number.
          </p>
        )}
        {error === "save" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Could not save the changes — try again.
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
              href="/parts"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        )}
      </form>

      {/* ── Build history — every BU of this part number ─────────── */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Build history
          </h2>
          {historyRows.length > 0 && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              built {historyRows.length}× ·{" "}
              {hours(historyRows.reduce((s, b) => s + b.actualMinutes, 0))}h
              booked all-time
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Every order of this part number, with the labour it really took.
          Open a BU for its notes, documents, and operations.
        </p>

        {historyRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Never built yet — it will appear here the first time an order is
            raised against this part.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[52rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  {["BU", "Customer", "Status", "Ordered", "Due", "Est. h", "Actual h", "Notes", "Docs"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {historyRows.map((b) => (
                  <tr key={b.id} className="hover:bg-lime-100/40 dark:hover:bg-lime-800/10">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/builds/${b.id}`}
                        className="font-mono font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {b.bu_number}
                      </Link>
                      {b.order_number && (
                        <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                          PO {b.order_number}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {b.customers?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {b.build_statuses?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatDate(b.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatDate(b.requested_delivery_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {hours(b.estimatedMinutes)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      <span
                        className={
                          b.actualMinutes > b.estimatedMinutes && b.estimatedMinutes > 0
                            ? "font-medium text-status-attention dark:text-amber-400"
                            : "text-zinc-700 dark:text-zinc-300"
                        }
                      >
                        {hours(b.actualMinutes)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {b.notes?.[0]?.count ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {b.documents?.[0]?.count ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
        Created {formatDateTime(part.created_at)} · Last updated{" "}
        {formatDateTime(part.updated_at)}
      </p>
    </main>
  );
}

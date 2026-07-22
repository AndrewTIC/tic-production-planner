import Link from "next/link";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function WorkersPage() {
  const auth = await getUserProfile();
  const canWrite =
    auth !== null && ["admin", "commercial"].includes(auth.profile.role);

  const supabase = await createClient();
  const [{ data: workers, error }, { data: profiles }] = await Promise.all([
    supabase
      .from("workers")
      .select("id, name, active, user_id, worker_phases(phases(code))")
      .order("active", { ascending: false })
      .order("name"),
    supabase.from("profiles").select("id, display_name"),
  ]);

  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Team
        </h1>
        {canWrite && (
          <Link
            href="/workers/new"
            className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
          >
            New worker
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Schedulable labour. A worker may also be a system user — anyone can
        appear on the board and clock on, whatever their login role.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">
          Could not load workers.
        </p>
      ) : !workers || workers.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No workers yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[40rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Competencies
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  System user
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {workers.map((w) => (
                <tr key={w.id} className="hover:bg-lime-100/40 dark:hover:bg-lime-800/10">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/workers/${w.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {w.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {w.worker_phases.length === 0 ? (
                        <span className="text-zinc-400 dark:text-zinc-500">—</span>
                      ) : (
                        w.worker_phases.map(({ phases }) =>
                          phases ? (
                            <span
                              key={phases.code}
                              className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {phases.code}
                            </span>
                          ) : null
                        )
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {w.user_id ? profileName.get(w.user_id) ?? "Linked" : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {w.active ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
